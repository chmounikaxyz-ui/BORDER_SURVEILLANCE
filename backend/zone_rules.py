"""
Restricted-zone intrusion detection engine.
Zones are defined as normalised polygons (0.0–1.0 of frame dimensions)
so they work regardless of video resolution.

Integrates:
  - Priority Alert Engine   (priority_engine.py)
  - Activity Detector       (activity.py)
  - Operator Feedback Weights (feedback.py)
"""
import math
import time
import numpy as np
import cv2
from typing import Optional, Dict

from priority_engine import compute_priority_score, load_feedback_multipliers
from activity import ActivityDetector

# ─── YOLO class map (subset we care about) ──────────────────────────────────
YOLO_CLASS_NAMES: Dict[int, str] = {
    0: "Person",
    1: "Bicycle",
    2: "Car",
    3: "Motorcycle",
    5: "Bus",
    7: "Truck",
}


def get_class_name(cls: int) -> str:
    return YOLO_CLASS_NAMES.get(cls, "Unknown")


def get_category(cls: int) -> str:
    if cls == 0:
        return "personnel"
    if cls in (1, 2, 3, 5, 7):
        return "vehicle"
    return "default"


def get_alert_category(category: str) -> str:
    return {"personnel": "PERSONNEL", "vehicle": "VEHICLE"}.get(category, "SYSTEM")


def get_severity(risk_score: int) -> str:
    if risk_score >= 85:
        return "CRITICAL"
    if risk_score >= 65:
        return "HIGH"
    if risk_score >= 40:
        return "MEDIUM"
    return "LOW"


# ─── Zone definitions ────────────────────────────────────────────────────────
RESTRICTED_ZONES = [
    {
        "id": "zone-north-a",
        "name": "North Perimeter High Risk Zone",
        "sensitivity": "Class A (Restricted)",
        "sector": "Sector North, Northern Ridge",
        "camera_code": "BOP-01",
        "polygon_norm": [
            (0.0, 0.0), (1.0, 0.0),
            (1.0, 0.38), (0.0, 0.38),
        ],
        "cooldown": 30,
        "dwell_threshold": 45,
    },
    {
        "id": "zone-east-fence",
        "name": "East Patrol Route High Tension",
        "sensitivity": "Class A (Fence Line)",
        "sector": "Sector East, East Gate",
        "camera_code": "BOP-07",
        "polygon_norm": [
            (0.62, 0.0), (1.0, 0.0),
            (1.0, 1.0), (0.62, 1.0),
        ],
        "cooldown": 40,
        "dwell_threshold": 40,
    },
    {
        "id": "zone-south-buffer",
        "name": "South Gate Buffer Zone",
        "sensitivity": "Class B (Air Buffer)",
        "sector": "Sector South, South Outpost",
        "camera_code": "BOP-04",
        "polygon_norm": [
            (0.0, 0.62), (1.0, 0.62),
            (1.0, 1.0), (0.0, 1.0),
        ],
        "cooldown": 60,
        "dwell_threshold": 60,
    },
]


def _point_in_polygon_norm(cx_norm: float, cy_norm: float, polygon_norm: list) -> bool:
    """Use OpenCV's pointPolygonTest on normalised coords scaled to 10,000."""
    pts = np.array(
        [[int(x * 10_000), int(y * 10_000)] for x, y in polygon_norm],
        dtype=np.int32,
    )
    result = cv2.pointPolygonTest(pts, (cx_norm * 10_000, cy_norm * 10_000), False)
    return result >= 0


# ─── Engine ──────────────────────────────────────────────────────────────────

class ZoneRulesEngine:
    def __init__(self):
        # {track_id: {zone_id: last_alert_unix_time}}
        self._cooldowns: Dict[int, Dict[str, float]] = {}
        self._activity  = ActivityDetector()

        # Load operator feedback multipliers (zone_sensitivity → mult)
        try:
            from feedback import load_zone_multipliers
            mults = load_zone_multipliers()
            load_feedback_multipliers(mults)
        except Exception:
            pass  # DB may not have entries yet

    def get_class_name(self, cls: int) -> str:
        return get_class_name(cls)

    def check_intrusion(
        self,
        track_id: int,
        cx: int, cy: int,
        frame_w: int, frame_h: int,
        cls: int,
        conf: float,
        timestamp: float,
        speed_kmh: float = 0.0,
        camera_code: str = "BOP-01",
    ) -> Optional[dict]:
        """
        Return an intrusion dict if the centroid is inside a restricted zone
        and the per-track cooldown has elapsed; else return None.
        Now checks static RESTRICTED_ZONES and dynamic user-created zones from DB.
        """
        cx_norm = cx / frame_w
        cy_norm = cy / frame_h
        cat     = get_category(cls)

        # Merge default static zones and user dynamic zones from DB
        zones_to_check = list(RESTRICTED_ZONES)
        try:
            from database import get_dynamic_zones
            db_zones = get_dynamic_zones(camera_code)
            for dz in db_zones:
                zones_to_check.append({
                    "id": dz["id"],
                    "name": dz["name"],
                    "sensitivity": dz["sensitivity"],
                    "sector": dz["sector"],
                    "camera_code": dz["camera_code"],
                    "polygon_norm": dz["polygon_norm"],
                    "cooldown": dz["cooldown"],
                    "dwell_threshold": dz["dwell_threshold"],
                    "speed_limit_kmh": dz.get("speed_limit_kmh", 40.0),
                })
        except Exception:
            pass

        for zone in zones_to_check:
            if not _point_in_polygon_norm(cx_norm, cy_norm, zone["polygon_norm"]):
                continue

            # Speed anomaly threshold check
            is_speeding = False
            speed_limit = zone.get("speed_limit_kmh", 40.0)
            if speed_kmh > speed_limit > 0:
                is_speeding = True

            # ── Activity check (loitering / running / halt) ─────────────────
            activity_event = self._activity.check(
                track_id=track_id,
                zone_id=zone["id"],
                cx_norm=cx_norm,
                cy_norm=cy_norm,
                speed_kmh=speed_kmh,
                timestamp_s=timestamp,
            )

            # ── Cooldown check ───────────────────────────────────────────────
            now      = time.time()
            track_cd = self._cooldowns.setdefault(track_id, {})
            last     = track_cd.get(zone["id"], 0.0)

            # Speeding or activity events bypass cooldown
            if not activity_event and not is_speeding and (now - last) < zone["cooldown"]:
                continue

            track_cd[zone["id"]] = now

            # ── Priority score via new engine ────────────────────────────────
            risk = compute_priority_score(
                confidence=conf,
                zone=zone,
                category=cat,
                cx_norm=cx_norm,
                cy_norm=cy_norm,
            )

            # Activity events boost the risk score
            risk_boost = activity_event.get("risk_boost", 0) if activity_event else 0
            risk = int(min(99, risk + risk_boost))

            result = {
                "zone":         zone,
                "track_id":     track_id,
                "cls":          cls,
                "category":     cat,
                "class_name":   get_class_name(cls),
                "confidence":   conf,
                "risk_score":   risk,
                "cx_norm":      cx_norm,
                "cy_norm":      cy_norm,
                "timestamp_s":  timestamp,
                "activity":     activity_event,
            }

            return result

        return None

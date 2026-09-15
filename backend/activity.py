"""
Activity Detector
-----------------
Detects loitering, rapid movement, and suspicious halts from track history.
Integrated into ZoneRulesEngine per-frame after zone check.
"""
import time
from typing import Dict, Optional, Tuple


# Per-track state: { track_id: (zone_id, entry_time, last_cx, last_cy, last_speed, last_frame) }
_track_zone_entry: Dict[int, dict] = {}

# Cooldowns per track to avoid spamming same activity alert
_activity_cooldown: Dict[int, float] = {}
ACTIVITY_COOLDOWN_S = 60.0

# Thresholds
LOITER_THRESHOLD_S  = 45.0   # seconds in zone = loitering
RUNNING_SPEED_KMH   = 16.0   # km/h considered running/rapid
HALT_DELTA_THRESHOLD = 0.5   # px/frame motion below which counts as halted
HALT_FRAMES_NEEDED  = 3      # frames of near-zero motion after fast movement


class ActivityDetector:
    def __init__(self):
        self._entry: Dict[int, dict] = {}
        self._prev_speed: Dict[int, float] = {}
        self._slow_count: Dict[int, int] = {}
        self._last_alert: Dict[int, float] = {}

    def _on_cooldown(self, track_id: int) -> bool:
        last = self._last_alert.get(track_id, 0.0)
        return (time.time() - last) < ACTIVITY_COOLDOWN_S

    def _set_cooldown(self, track_id: int):
        self._last_alert[track_id] = time.time()

    def check(
        self,
        track_id: int,
        zone_id: str,
        cx_norm: float,
        cy_norm: float,
        speed_kmh: float,
        timestamp_s: float,
    ) -> Optional[dict]:
        """
        Call once per detected object per frame (inside a zone).
        Returns an activity event dict or None.
        """
        now = time.time()

        # ── Entry tracking ─────────────────────────────────────────────────
        entry = self._entry.get(track_id)
        if entry is None or entry["zone_id"] != zone_id:
            self._entry[track_id] = {
                "zone_id":    zone_id,
                "entry_time": now,
                "cx_norm":    cx_norm,
                "cy_norm":    cy_norm,
            }
            self._slow_count[track_id] = 0
            return None

        dwell_s = now - entry["entry_time"]

        # ── Running / Rapid movement ────────────────────────────────────────
        if speed_kmh >= RUNNING_SPEED_KMH and not self._on_cooldown(track_id):
            self._set_cooldown(track_id)
            return {
                "type":       "RAPID_MOVEMENT",
                "title":      "Rapid Movement Detected",
                "description": f"Subject running at {speed_kmh:.0f} km/h — possible intrusion sprint.",
                "risk_boost": 15,
                "dwell_s":    dwell_s,
            }

        # ── Suspicious halt (was fast, now stopped) ─────────────────────────
        prev_speed = self._prev_speed.get(track_id, 0.0)
        if prev_speed >= RUNNING_SPEED_KMH and speed_kmh < 2.0:
            self._slow_count[track_id] = self._slow_count.get(track_id, 0) + 1
            if (self._slow_count[track_id] >= HALT_FRAMES_NEEDED
                    and not self._on_cooldown(track_id)):
                self._slow_count[track_id] = 0
                self._set_cooldown(track_id)
                return {
                    "type":       "SUSPICIOUS_HALT",
                    "title":      "Suspicious Halt Detected",
                    "description": "Subject abruptly stopped after rapid movement — possible concealment or drop.",
                    "risk_boost": 20,
                    "dwell_s":    dwell_s,
                }
        else:
            self._slow_count[track_id] = 0

        self._prev_speed[track_id] = speed_kmh

        # ── Loitering ──────────────────────────────────────────────────────
        if dwell_s >= LOITER_THRESHOLD_S and not self._on_cooldown(track_id):
            self._set_cooldown(track_id)
            # Reset entry so future loiters can also trigger
            self._entry[track_id]["entry_time"] = now
            return {
                "type":       "LOITERING",
                "title":      "Loitering Detected",
                "description": f"Subject stationary in restricted zone for {dwell_s:.0f}s — surveillance evasion suspected.",
                "risk_boost": 10,
                "dwell_s":    dwell_s,
            }

        return None

    def clear_track(self, track_id: int):
        """Call when a track leaves the frame."""
        self._entry.pop(track_id, None)
        self._prev_speed.pop(track_id, None)
        self._slow_count.pop(track_id, None)

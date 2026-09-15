"""
Priority Alert Engine
---------------------
Replaces the simple risk_base*conf formula with a weighted multi-factor score.

Score = (confidence × 0.35)
      + (zone_sensitivity × 0.25)
      + (time_of_day × 0.15)
      + (distance_to_border × 0.15)
      + (alert_type × 0.10)

All sub-scores are normalised to [0, 100] before weighting.
"""
from datetime import datetime, timezone
from typing import Optional


# Zone sensitivity weight map (Class A > Class B)
_SENSITIVITY_WEIGHTS = {
    "Class A (Restricted)":   100,
    "Class A (Fence Line)":   95,
    "Class B (Air Buffer)":   55,
    "Class B":                50,
}

# Alert-type weight map
_TYPE_WEIGHTS = {
    "personnel": 100,
    "vehicle":   85,
    "uav":       90,
    "default":   60,
}

# Feedback-adjusted per-zone weights loaded at runtime.
# Structure: { zone_id: float }  — multiplier in [0.7, 1.3]
_zone_feedback_mult: dict = {}


def load_feedback_multipliers(zone_adjustments: dict) -> None:
    """Called by ZoneRulesEngine after reading feedback_weights from DB."""
    _zone_feedback_mult.clear()
    _zone_feedback_mult.update(zone_adjustments)


def _time_of_day_weight() -> float:
    """Night-time (21:00–05:00 UTC) boosts weight — harder to detect, higher risk."""
    hour = datetime.now(timezone.utc).hour
    if 21 <= hour or hour < 5:
        return 95.0   # night
    if 5 <= hour < 8 or 17 <= hour < 21:
        return 75.0   # dusk/dawn
    return 50.0       # daylight


def _distance_weight(cx_norm: float, cy_norm: float, category: str) -> float:
    """
    Approximate distance-to-border weight.
    We treat the top of the frame (cy_norm ~ 0) as 'deeper into border territory'.
    Vehicles approaching from bottom-right get a lower penalty.
    Personnel near the fence line (top strip) get maximum weight.
    """
    if category == "personnel":
        return max(20.0, (1.0 - cy_norm) * 100)
    # vehicles — weight by horizontal distance to right fence (cx_norm → 1.0)
    return max(20.0, cx_norm * 100)


def compute_priority_score(
    confidence: float,           # 0.0–1.0  YOLO confidence
    zone: dict,                  # RESTRICTED_ZONES entry
    category: str,               # 'personnel' | 'vehicle' | 'uav' | 'default'
    cx_norm: float,              # normalised centroid x
    cy_norm: float,              # normalised centroid y
    feedback_mult: Optional[float] = None,
) -> int:
    """
    Return an integer priority score 0–100.
    Higher = more urgent.
    """
    sensitivity_str = zone.get("sensitivity", "Class B")
    zone_id = zone.get("id", "")

    # Sub-scores (all 0–100)
    s_conf       = confidence * 100
    s_zone       = _SENSITIVITY_WEIGHTS.get(sensitivity_str, 55)
    s_time       = _time_of_day_weight()
    s_dist       = _distance_weight(cx_norm, cy_norm, category)
    s_type       = _TYPE_WEIGHTS.get(category, 60)

    raw = (
        s_conf  * 0.35 +
        s_zone  * 0.25 +
        s_time  * 0.15 +
        s_dist  * 0.15 +
        s_type  * 0.10
    )

    # Apply feedback multiplier (operator learning)
    mult = feedback_mult if feedback_mult is not None else _zone_feedback_mult.get(zone_id, 1.0)
    adjusted = raw * mult

    return int(min(99, max(1, adjusted)))

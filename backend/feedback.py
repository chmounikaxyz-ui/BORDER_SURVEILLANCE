"""
Operator Feedback Loop
-----------------------
Operators mark alerts as true/false positives.
Votes accumulate per zone+category and are used to adjust
the priority_engine multiplier at runtime (active learning).

Table: feedback_weights (zone_id, category, true_pos, false_pos, weight_mult)
  weight_mult = true_pos / (true_pos + false_pos + 1)  ∈ [0.5, 1.5]
"""
from database import get_conn


def record_feedback(alert_id: str, correct: bool) -> dict:
    """
    Look up the alert's zone and category, then increment the appropriate counter.
    Returns updated stats for this zone.
    """
    conn = get_conn()
    row = conn.execute(
        "SELECT zone_sensitivity, category FROM alerts WHERE id = ?",
        (alert_id,),
    ).fetchone()

    zone_sensitivity = (row["zone_sensitivity"] if row and row["zone_sensitivity"] else "high")
    category         = ((row["category"] if row and row["category"] else "PERSONNEL") or "PERSONNEL").lower()

    # Upsert feedback_weights row
    existing = conn.execute(
        "SELECT * FROM feedback_weights WHERE zone_sensitivity=? AND category=?",
        (zone_sensitivity, category),
    ).fetchone()

    if existing:
        true_pos  = existing["true_pos"]  + (1 if correct else 0)
        false_pos = existing["false_pos"] + (0 if correct else 1)
        weight_mult = _calc_mult(true_pos, false_pos)
        conn.execute(
            """UPDATE feedback_weights
               SET true_pos=?, false_pos=?, weight_mult=?
               WHERE zone_sensitivity=? AND category=?""",
            (true_pos, false_pos, weight_mult, zone_sensitivity, category),
        )
    else:
        true_pos  = 1 if correct else 0
        false_pos = 0 if correct else 1
        weight_mult = _calc_mult(true_pos, false_pos)
        conn.execute(
            """INSERT INTO feedback_weights
               (zone_sensitivity, category, true_pos, false_pos, weight_mult)
               VALUES (?,?,?,?,?)""",
            (zone_sensitivity, category, true_pos, false_pos, weight_mult),
        )

    if not correct:
        conn.execute("UPDATE alerts SET status = 'DISMISSED' WHERE id = ?", (alert_id,))

    conn.commit()

    result = {
        "zone_sensitivity": zone_sensitivity,
        "category":         category,
        "true_pos":         true_pos,
        "false_pos":        false_pos,
        "weight_mult":      round(weight_mult, 3),
        "accuracy_pct":     round(true_pos / max(true_pos + false_pos, 1) * 100, 1),
    }
    conn.close()
    return result


def get_feedback_stats() -> list:
    """Return all zone feedback stats for the analytics dashboard."""
    conn = get_conn()
    rows = conn.execute("SELECT * FROM feedback_weights ORDER BY weight_mult DESC").fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        total = d["true_pos"] + d["false_pos"]
        d["accuracy_pct"] = round(d["true_pos"] / max(total, 1) * 100, 1)
        d["total_votes"]  = total
        out.append(d)
    return out


def load_zone_multipliers() -> dict:
    """
    Return { zone_sensitivity: weight_mult } for use by priority_engine.
    Called at startup and periodically to refresh.
    """
    conn = get_conn()
    rows = conn.execute(
        "SELECT zone_sensitivity, weight_mult FROM feedback_weights"
    ).fetchall()
    conn.close()
    return {r["zone_sensitivity"]: r["weight_mult"] for r in rows}


def _calc_mult(true_pos: int, false_pos: int) -> float:
    """
    Maps accuracy to a weight multiplier in [0.60, 1.40].
    50% accuracy → 1.0 (no change).
    100% → 1.40 (boost).
    0%   → 0.60 (suppress).
    """
    accuracy = true_pos / max(true_pos + false_pos, 1)
    return round(0.60 + accuracy * 0.80, 3)

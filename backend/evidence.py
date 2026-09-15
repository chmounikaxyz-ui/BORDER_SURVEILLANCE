"""
Evidence frame saving: annotates the OpenCV frame with bounding boxes
and a HUD overlay, writes a JPEG, and computes a SHA-256 hash.
"""
import hashlib
import cv2
import numpy as np
from pathlib import Path
from datetime import datetime, timezone
from typing import List

EVIDENCE_DIR = Path(__file__).parent.parent / "data" / "evidence"
FRAMES_DIR = EVIDENCE_DIR / "frames"


def ensure_dirs() -> None:
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)


def save_evidence_frame(
    frame: np.ndarray,
    alert_id: str,
    boxes_info: List[dict],
) -> tuple:
    """
    Draw detections + HUD, save as JPEG, return (filename, short_hash, full_hash).
    boxes_info: list of dicts with keys xyxy, track_id, class_name, conf
    """
    ensure_dirs()

    if frame is None or frame.size == 0 or np.mean(frame) < 15:
        h, w = 600, 1000
        annotated = np.zeros((h, w, 3), dtype=np.uint8)
        annotated[:] = (22, 18, 12)  # BGR dark tactical blue-grey
        for y_step in range(0, h, 80):
            cv2.line(annotated, (0, y_step), (w, y_step), (45, 35, 25), 1)
        for x_step in range(0, w, 120):
            cv2.line(annotated, (x_step, 0), (x_step, h), (45, 35, 25), 1)
        cv2.circle(annotated, (w // 2, h // 2), 140, (75, 55, 35), 1)
        cv2.circle(annotated, (w // 2, h // 2), 4, (171, 180, 255), -1)
        cv2.putText(annotated, "OPTICAL CCTV SENSOR  |  TACTICAL CAPTURE", (30, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 198, 173), 1)
    else:
        annotated = frame.copy()
        h, w = annotated.shape[:2]

    # ── Draw ONLY the detected target box ─────────────────────────────────────
    for b in boxes_info:
        x1, y1, x2, y2 = b.get("xyxy", [0, 0, 100, 100])
        plate = b.get("plate")
        is_target = b.get("is_target", False) or bool(plate)
        if not is_target:
            continue  # ONLY highlight the detected target car!

        if plate:
            label = f"WATCHLIST MATCH: {plate}"
        elif b.get("class_name", "").lower() == "person":
            label = f"SUSPICIOUS BEHAVIOR: PERSON #{b.get('track_id', 1)}"
        else:
            label = f"INTRUSION DETECTED: {b.get('class_name', 'TARGET').upper()}"
        colour = (0, 0, 240)        # Bright tactical red (BGR)

        cv2.rectangle(annotated, (x1, y1), (x2, y2), colour, 2)
        c_len = min(18, max(6, (x2 - x1) // 4), max(6, (y2 - y1) // 4))
        cv2.line(annotated, (x1, y1), (x1 + c_len, y1), colour, 3)
        cv2.line(annotated, (x1, y1), (x1, y1 + c_len), colour, 3)
        cv2.line(annotated, (x2, y1), (x2 - c_len, y1), colour, 3)
        cv2.line(annotated, (x2, y1), (x2, y1 + c_len), colour, 3)
        cv2.line(annotated, (x1, y2), (x1 + c_len, y2), colour, 3)
        cv2.line(annotated, (x1, y2), (x1, y2 - c_len), colour, 3)
        cv2.line(annotated, (x2, y2), (x2 - c_len, y2), colour, 3)
        cv2.line(annotated, (x2, y2), (x2, y2 - c_len), colour, 3)

        # Label pill
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.48, 1)
        cv2.rectangle(annotated, (x1, max(0, y1 - th - 10)), (x1 + tw + 8, max(th + 10, y1)), colour, -1)
        cv2.putText(
            annotated, label,
            (x1 + 4, max(th + 2, y1 - 4)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 1,
        )

    # ── HUD bottom bar directly on frame ─────────────────────────────────────
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    cv2.rectangle(annotated, (0, max(0, h - 32)), (w, h), (15, 15, 15), -1)
    cv2.putText(
        annotated, f"BORDERVISION AI  |  {alert_id}  |  {ts}",
        (10, max(20, h - 11)), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (173, 198, 255), 1,
    )

    # ── Alert header strip directly on frame ─────────────────────────────────
    cv2.rectangle(annotated, (0, 0), (w, 30), (15, 15, 15), -1)
    cv2.putText(
        annotated, "!! RESTRICTED ZONE BREACH  |  EVIDENCE CAPTURE",
        (10, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (80, 100, 255), 1,
    )

    # ── Write file ───────────────────────────────────────────────────────────
    filename = f"{alert_id}.jpg"
    filepath = FRAMES_DIR / filename
    cv2.imwrite(str(filepath), annotated, [cv2.IMWRITE_JPEG_QUALITY, 88])

    # ── SHA-256 hash ─────────────────────────────────────────────────────────
    raw = filepath.read_bytes()
    full_hex = hashlib.sha256(raw).hexdigest()
    full_hash = "0x" + full_hex
    integrity_hash = "0x" + full_hex[:4] + "..." + full_hex[-2:]

    return filename, integrity_hash, full_hash


VIDEOS_DIR = EVIDENCE_DIR / "videos"


def save_evidence_video(
    source_video_path: str,
    alert_id: str,
    trigger_frame: int = 0,
    fps: float = 25.0,
    duration_sec: float = 6.0,
):
    """
    Extract or save an incident video clip to data/evidence/videos/{alert_id}.mp4.
    Returns relative URL e.g. /evidence/videos/{alert_id}.mp4 or None.
    """
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    out_filename = f"{alert_id}.mp4"
    out_path = VIDEOS_DIR / out_filename

    if not source_video_path or not Path(source_video_path).exists():
        return None

    try:
        import shutil
        shutil.copyfile(str(source_video_path), str(out_path))
        if out_path.exists() and out_path.stat().st_size > 0:
            return f"/evidence/videos/{out_filename}"
    except Exception as exc:
        print(f"[Evidence Video] error: {exc}")
    return None

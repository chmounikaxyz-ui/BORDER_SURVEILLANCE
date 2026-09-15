"""
Camera Tamper Detection
-----------------------
Runs a background thread that simulates health checks for each registered camera.
In production, replace _capture_camera_frame() with real RTSP frame grabs.

Detects three tamper conditions:
  BLACKOUT  — mean pixel brightness < 8  (camera covered/lens blocked)
  BLUR      — Laplacian variance < 30    (lens smeared/sprayed)
  FROZEN    — frame-diff < 0.5% pixels   (feed looped or cable cut)

Writes to tamper_events table. GET /api/tamper/status returns current state.
"""
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

import cv2
import numpy as np

from database import get_conn

# Seconds between health checks per camera
CHECK_INTERVAL = 30

# --- Thresholds ---
BLACKOUT_BRIGHTNESS_THRESHOLD = 8.0   # mean of greyscale frame
BLUR_LAPLACIAN_THRESHOLD      = 30.0  # variance of Laplacian
FROZEN_DIFF_THRESHOLD         = 0.005 # fraction of pixels changed


# ─── In-memory current tamper state ──────────────────────────────────────────
# { camera_code: { "status": "ok"|"BLACKOUT"|"BLUR"|"FROZEN", "since": iso_str } }
_tamper_state: Dict[str, dict] = {}
_state_lock = threading.Lock()

# Last captured frame per camera for frozen-detection
_prev_frames: Dict[str, Optional[np.ndarray]] = {}

_monitor_thread: Optional[threading.Thread] = None
_running = False


def get_tamper_status() -> list:
    """Return a copy of current tamper state for API response, synced with camera_nodes table."""
    now_iso = datetime.now(timezone.utc).isoformat()
    active_codes = []
    try:
        conn = get_conn()
        rows = conn.execute("SELECT DISTINCT code FROM camera_nodes WHERE code IS NOT NULL AND code != ''").fetchall()
        conn.close()
        active_codes = [r[0] for r in rows if r[0]]
    except Exception:
        pass

    with _state_lock:
        if active_codes:
            results = []
            for code in active_codes:
                info = _tamper_state.get(code, {"status": "ok", "since": now_iso})
                results.append({"camera_code": code, **info})
            return results
        return [
            {"camera_code": cam, **info}
            for cam, info in _tamper_state.items()
        ]


def register_camera(camera_code: str):
    """Register a new camera code to be tracked in tamper state immediately."""
    if not camera_code:
        return
    with _state_lock:
        if camera_code not in _tamper_state:
            _tamper_state[camera_code] = {
                "status": "ok",
                "since": datetime.now(timezone.utc).isoformat()
            }


def unregister_camera(camera_code: str):
    """Remove a camera code from tamper tracking."""
    with _state_lock:
        _tamper_state.pop(camera_code, None)
        _prev_frames.pop(camera_code, None)
        _injected_tamper.pop(camera_code, None)


def _detect_tamper(frame: np.ndarray, camera_code: str) -> Optional[str]:
    """Analyse a single frame. Return tamper type string or None."""
    grey = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Blackout
    if grey.mean() < BLACKOUT_BRIGHTNESS_THRESHOLD:
        return "BLACKOUT"

    # Blur
    lap_var = cv2.Laplacian(grey, cv2.CV_64F).var()
    if lap_var < BLUR_LAPLACIAN_THRESHOLD:
        return "BLUR"

    # Frozen
    prev = _prev_frames.get(camera_code)
    if prev is not None and prev.shape == frame.shape:
        diff = cv2.absdiff(grey, cv2.cvtColor(prev, cv2.COLOR_BGR2GRAY))
        changed_frac = np.count_nonzero(diff > 15) / diff.size
        if changed_frac < FROZEN_DIFF_THRESHOLD:
            return "FROZEN"

    _prev_frames[camera_code] = frame.copy()
    return None


def _capture_camera_frame(camera_code: str) -> Optional[np.ndarray]:
    """
    In production: open RTSP stream and grab one frame.
    For demonstration: synthesise a frame based on the camera_code hash
    so each camera gets a unique but stable simulated image.
    A forced tamper can be injected via _injected_tamper dict.
    """
    forced = _injected_tamper.get(camera_code)
    if forced == "BLACKOUT":
        return np.zeros((480, 640, 3), dtype=np.uint8)
    if forced == "BLUR":
        base = np.random.randint(100, 200, (480, 640, 3), dtype=np.uint8)
        return cv2.GaussianBlur(base, (61, 61), 0)  # very blurry
    if forced == "FROZEN":
        # Return identical frame each time
        seed = abs(hash(camera_code)) % (2 ** 32)
        rng  = np.random.default_rng(seed)
        return rng.integers(50, 200, (480, 640, 3), dtype=np.uint8)

    # Healthy frame — random noise that changes each call
    seed = abs(hash(camera_code + str(int(time.time() / 10)))) % (2 ** 32)
    rng  = np.random.default_rng(seed)
    return rng.integers(50, 220, (480, 640, 3), dtype=np.uint8)


# Allow API to inject tamper for demo purposes
# { camera_code: "BLACKOUT"|"BLUR"|"FROZEN"|None }
_injected_tamper: Dict[str, Optional[str]] = {}


def inject_tamper(camera_code: str, tamper_type: Optional[str]):
    """API endpoint helper — simulate a tamper on a specific camera."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with _state_lock:
        if tamper_type is None:
            _injected_tamper.pop(camera_code, None)
            _tamper_state[camera_code] = {"status": "ok", "since": now_iso}
            try:
                _resolve_tamper_event(camera_code)
            except Exception:
                pass
        else:
            _injected_tamper[camera_code] = tamper_type
            _tamper_state[camera_code] = {"status": tamper_type, "since": now_iso}
            try:
                _write_tamper_event(camera_code, tamper_type)
            except Exception:
                pass


def _write_tamper_event(camera_code: str, tamper_type: str):
    ev_id = f"tamp-{uuid.uuid4().hex[:8]}"
    now   = datetime.now(timezone.utc).isoformat()
    conn  = get_conn()
    conn.execute(
        """INSERT INTO tamper_events (id, camera_code, tamper_type, detected_at)
           VALUES (?,?,?,?)""",
        (ev_id, camera_code, tamper_type, now),
    )
    conn.commit()
    conn.close()
    print(f"[Tamper] {tamper_type} detected on {camera_code}")


def _resolve_tamper_event(camera_code: str):
    now  = datetime.now(timezone.utc).isoformat()
    conn = get_conn()
    conn.execute(
        """UPDATE tamper_events SET resolved_at = ?
           WHERE camera_code = ? AND resolved_at IS NULL""",
        (now, camera_code),
    )
    conn.commit()
    conn.close()


def _check_cameras(camera_codes: list):
    """Single pass — check all cameras."""
    for code in camera_codes:
        frame = _capture_camera_frame(code)
        if frame is None:
            continue
        tamper = _detect_tamper(frame, code)
        now_iso = datetime.now(timezone.utc).isoformat()

        with _state_lock:
            prev_state = _tamper_state.get(code, {}).get("status", "ok")

            if tamper:
                if prev_state == "ok":
                    _write_tamper_event(code, tamper)
                _tamper_state[code] = {"status": tamper, "since": now_iso}
            else:
                if prev_state != "ok":
                    _resolve_tamper_event(code)
                _tamper_state[code] = {"status": "ok", "since": now_iso}


def _monitor_loop(camera_codes: list):
    global _running
    while _running:
        try:
            current_codes = list(camera_codes)
            try:
                conn = get_conn()
                rows = conn.execute("SELECT DISTINCT code FROM camera_nodes WHERE code IS NOT NULL AND code != ''").fetchall()
                conn.close()
                db_codes = [r[0] for r in rows if r[0]]
                if db_codes:
                    current_codes = db_codes
            except Exception:
                pass
            _check_cameras(current_codes)
        except Exception as exc:
            print(f"[Tamper] Monitor error: {exc}")
        for _ in range(int(CHECK_INTERVAL * 2)):
            if not _running:
                break
            time.sleep(0.5)


def start_monitor(camera_codes: list):
    """Start the background tamper monitor. Call once at startup."""
    global _monitor_thread, _running
    if _monitor_thread and _monitor_thread.is_alive():
        return
    _running = True
    _monitor_thread = threading.Thread(
        target=_monitor_loop,
        args=(camera_codes,),
        daemon=True,
        name="TamperMonitor",
    )
    _monitor_thread.start()
    print(f"[Tamper] Monitor started for {len(camera_codes)} cameras")


def stop_monitor():
    global _running
    _running = False

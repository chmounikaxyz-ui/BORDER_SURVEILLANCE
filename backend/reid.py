"""
Cross-post Re-Identification Module (Reid)
------------------------------------------
Lightweight colour-histogram-based appearance fingerprinting.
Detects when the same subject appears across different cameras.

Algorithm:
  1. Compute 64-bin HSV histogram of the bounding-box crop (normalised L1)
  2. Compare against a rolling store of recent tracks (10-min window)
  3. Cosine similarity > SIMILARITY_THRESHOLD → same subject, new camera
  4. Emit a CROSS_POST event and write to reid_tracks DB table

No extra installs required — uses only OpenCV and NumPy.
"""
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Dict, Deque, List, Optional, Tuple

import cv2
import numpy as np

from database import get_conn

SIMILARITY_THRESHOLD = 0.88
MAX_STORE_SIZE       = 500    # rolling window of track fingerprints
TRACK_TTL_S          = 600    # 10 minutes


class _TrackEntry:
    __slots__ = ("fingerprint", "camera_code", "track_id", "first_seen",
                 "last_seen", "reid_id", "cameras_seen")

    def __init__(self, fingerprint, camera_code, track_id, reid_id):
        self.fingerprint   = fingerprint
        self.camera_code   = camera_code
        self.track_id      = track_id
        self.first_seen    = time.time()
        self.last_seen     = self.first_seen
        self.reid_id       = reid_id
        self.cameras_seen: List[str] = [camera_code]


def _compute_histogram(crop: np.ndarray) -> np.ndarray:
    """64-bin HSV histogram, L1-normalised → 1-D float32 vector."""
    if crop.size == 0:
        return np.zeros(64, dtype=np.float32)
    hsv   = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    hist  = cv2.calcHist([hsv], [0], None, [64], [0, 180])
    hist  = hist.flatten().astype(np.float32)
    total = hist.sum()
    if total > 0:
        hist /= total
    return hist


def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


class ReIDStore:
    """In-process rolling store for track fingerprints."""

    def __init__(self):
        self._store: Deque[_TrackEntry] = deque(maxlen=MAX_STORE_SIZE)

    def _purge_expired(self):
        now = time.time()
        while self._store and (now - self._store[0].last_seen) > TRACK_TTL_S:
            self._store.popleft()

    def process(
        self,
        crop:        np.ndarray,
        camera_code: str,
        track_id:    int,
        alert_id:    str,
    ) -> Optional[dict]:
        """
        Returns a cross-post event dict if this subject was already seen
        on a different camera, else None.
        """
        self._purge_expired()
        hist = _compute_histogram(crop)

        # Search for a match from a DIFFERENT camera
        best_sim  = 0.0
        best_entry: Optional[_TrackEntry] = None

        for entry in self._store:
            if entry.camera_code == camera_code:
                # Same camera — update fingerprint and continue
                if entry.track_id == track_id:
                    entry.fingerprint = hist
                    entry.last_seen   = time.time()
                continue
            sim = _cosine_sim(hist, entry.fingerprint)
            if sim > best_sim:
                best_sim   = sim
                best_entry = entry

        if best_sim >= SIMILARITY_THRESHOLD and best_entry is not None:
            # Cross-camera match detected
            event = self._emit_cross_post(
                best_entry, camera_code, track_id, best_sim, alert_id
            )
            # Add new camera to entry
            if camera_code not in best_entry.cameras_seen:
                best_entry.cameras_seen.append(camera_code)
            best_entry.last_seen = time.time()
            return event

        # No match — add new entry
        reid_id = f"reid-{uuid.uuid4().hex[:8]}"
        self._store.append(_TrackEntry(hist, camera_code, track_id, reid_id))
        return None

    def _emit_cross_post(
        self,
        entry:       _TrackEntry,
        new_cam:     str,
        new_track:   int,
        similarity:  float,
        alert_id:    str,
    ) -> dict:
        now     = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        conn = get_conn()
        conn.execute(
            """INSERT OR REPLACE INTO reid_tracks
               (id, original_camera, cameras_seen, first_seen, last_seen,
                similarity_score, alert_ids)
               VALUES (?,?,?,?,?,?,?)""",
            (
                entry.reid_id,
                entry.camera_code,
                ",".join(entry.cameras_seen + [new_cam]),
                datetime.fromtimestamp(entry.first_seen, tz=timezone.utc).isoformat(),
                now_iso,
                round(similarity, 3),
                alert_id,
            ),
        )
        conn.commit()
        conn.close()

        print(f"[ReID] Subject {entry.reid_id} re-identified: "
              f"{entry.camera_code} → {new_cam} "
              f"(similarity={similarity:.2%})")

        return {
            "reid_id":         entry.reid_id,
            "from_camera":     entry.camera_code,
            "to_camera":       new_cam,
            "similarity":      round(similarity, 3),
            "cameras_seen":    entry.cameras_seen + [new_cam],
            "first_seen":      datetime.fromtimestamp(
                                   entry.first_seen, tz=timezone.utc
                               ).isoformat(),
        }

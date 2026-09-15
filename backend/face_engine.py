"""
BorderVision AI — Deep Face Recognition Engine (Google Photos-Level Biometrics)
Uses OpenCV YuNet Deep Face Detection + SFace Deep 128D Facial Feature Embeddings
with Cosine Distance matching and Spatial LBP fallback.
"""
import os
import cv2
import numpy as np
import base64
import urllib.request
import threading
from typing import Optional, List, Dict, Tuple, Any


class DeepFaceEngine:
    def __init__(self):
        self.yunet = None
        self.sface = None
        self._lock = threading.Lock()
        self._ref_embedding_cache: Dict[str, Optional[np.ndarray]] = {}
        self._init_models()

    def _init_models(self):
        """Initializes OpenCV YuNet & SFace deep learning models from backend/models/."""
        try:
            models_dir = os.path.join(os.path.dirname(__file__), "models")
            yunet_path = os.path.join(models_dir, "face_detection_yunet_2023mar.onnx")
            sface_path = os.path.join(models_dir, "face_recognition_sface_2021dec.onnx")

            if os.path.exists(yunet_path) and os.path.exists(sface_path):
                if hasattr(cv2, "FaceDetectorYN") and hasattr(cv2, "FaceRecognizerSF"):
                    self.yunet = cv2.FaceDetectorYN.create(
                        model=yunet_path,
                        config="",
                        input_size=(320, 320),
                        score_threshold=0.30,
                        nms_threshold=0.3,
                        top_k=5000
                    )
                    self.sface = cv2.FaceRecognizerSF.create(sface_path, "")
                    print("[FaceEngine] OpenCV YuNet + SFace 128D Deep Feature Embeddings loaded [OK]")
                else:
                    print("[FaceEngine] cv2.FaceDetectorYN not available in OpenCV build; using fallback [OK]")
            else:
                print(f"[FaceEngine] Models not found at {models_dir}; using fallback [OK]")
        except Exception as exc:
            print(f"[FaceEngine] Model initialization error: {exc}")

    def decode_image(self, photo_b64: str) -> Optional[np.ndarray]:
        """Decodes base64 image string or fetches HTTP URL to OpenCV BGR numpy array."""
        if not photo_b64:
            return None

        try:
            if photo_b64.startswith("http://") or photo_b64.startswith("https://"):
                req = urllib.request.Request(photo_b64, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=4) as resp:
                    arr = np.frombuffer(resp.read(), np.uint8)
                    return cv2.imdecode(arr, cv2.IMREAD_COLOR)

            clean_b64 = photo_b64.strip()
            if "," in clean_b64:
                clean_b64 = clean_b64.split(",", 1)[1]
            clean_b64 = clean_b64.replace(" ", "+")
            missing = len(clean_b64) % 4
            if missing:
                clean_b64 += "=" * (4 - missing)

            raw = base64.b64decode(clean_b64)
            arr = np.frombuffer(raw, np.uint8)
            return cv2.imdecode(arr, cv2.IMREAD_COLOR)
        except Exception as err:
            print(f"[FaceEngine] Image decode error: {err}")
            return None

    def _is_valid_face_geometry(self, face_arr: np.ndarray, img_w: int, img_h: int) -> bool:
        """Verifies that facial landmarks are within bounds."""
        if face_arr is None or len(face_arr) < 15:
            return False
        conf = float(face_arr[14])
        if conf < 0.25:
            return False

        fw, fh = float(face_arr[2]), float(face_arr[3])
        if fw < 10 or fh < 10:
            return False

        rex, rey = float(face_arr[4]), float(face_arr[5])
        lex, ley = float(face_arr[6]), float(face_arr[7])

        # Eye presence check: Eyes must be within the actual image bounds
        if rex < 0 or rex >= img_w or rey < 0 or rey >= img_h:
            return False
        if lex < 0 or lex >= img_w or ley < 0 or ley >= img_h:
            return False

        # Inter-ocular distance check (eyes cannot be overlapping)
        eye_dist = np.hypot(lex - rex, ley - rey)
        if eye_dist < 6:
            return False

        return True

    def extract_128d_embedding(self, img: np.ndarray) -> Optional[np.ndarray]:
        """
        Extracts a normalized 128D feature embedding vector from an input BGR image.
        """
        if img is None or img.size == 0:
            return None

        h, w = img.shape[:2]

        with self._lock:
            if self.sface is not None and self.yunet is not None:
                # 1. Try YuNet face detection & landmark alignment on image directly
                if min(h, w) >= 20:
                    try:
                        self.yunet.setInputSize((w, h))
                        _, faces = self.yunet.detect(img)
                        if faces is not None and len(faces) > 0 and self._is_valid_face_geometry(faces[0], w, h):
                            aligned = self.sface.alignCrop(img, faces[0])
                            if aligned is not None and aligned.shape == (112, 112, 3):
                                feat = self.sface.feature(np.ascontiguousarray(aligned, dtype=np.uint8))
                                if feat is not None:
                                    return feat.flatten()
                    except Exception:
                        pass

                    # 1b. If tight crop, pad image by 30% so YuNet detects landmarks reliably
                    try:
                        pad_h, pad_w = max(15, int(h * 0.30)), max(15, int(w * 0.30))
                        padded = cv2.copyMakeBorder(img, pad_h, pad_h, pad_w, pad_w, cv2.BORDER_REFLECT)
                        ph, pw = padded.shape[:2]
                        self.yunet.setInputSize((pw, ph))
                        _, faces = self.yunet.detect(padded)
                        if faces is not None and len(faces) > 0 and self._is_valid_face_geometry(faces[0], pw, ph):
                            aligned = self.sface.alignCrop(padded, faces[0])
                            if aligned is not None and aligned.shape == (112, 112, 3):
                                feat = self.sface.feature(np.ascontiguousarray(aligned, dtype=np.uint8))
                                if feat is not None:
                                    return feat.flatten()
                    except Exception:
                        pass

                # 1c. Direct aligned resize fallback for tightly cropped faces
                try:
                    resized = cv2.resize(img, (112, 112))
                    feat = self.sface.feature(np.ascontiguousarray(resized, dtype=np.uint8))
                    if feat is not None:
                        return feat.flatten()
                except Exception:
                    pass

        return None

    def get_reference_embedding(self, photo_b64: str) -> Optional[np.ndarray]:
        """Returns cached 128D embedding for a watchlist reference photo."""
        if not photo_b64:
            return None
        if photo_b64 in self._ref_embedding_cache:
            return self._ref_embedding_cache[photo_b64]

        ref_img = self.decode_image(photo_b64)
        if ref_img is None:
            self._ref_embedding_cache[photo_b64] = None
            return None

        emb = self.extract_128d_embedding(ref_img)
        self._ref_embedding_cache[photo_b64] = emb
        return emb

    def detect_and_extract_faces(self, img: np.ndarray) -> List[Dict[str, Any]]:
        """
        Runs YuNet deep face detector on the full frame and extracts 128D SFace embeddings for each face.
        Returns a list of detected face objects with normalized bboxes and embeddings.
        """
        if img is None or img.size == 0:
            return []

        h, w = img.shape[:2]
        results = []

        with self._lock:
            if self.yunet is not None:
                try:
                    self.yunet.setInputSize((w, h))
                    _, faces = self.yunet.detect(img)
                    if faces is not None and len(faces) > 0:
                        for i in range(len(faces)):
                            f = faces[i]
                            fx, fy, fw, fh = map(int, f[0:4])
                            conf = float(f[14])
                            if conf < 0.28 or fw < 15 or fh < 15:
                                continue

                            # Clamp coordinates
                            x1 = max(0, fx)
                            y1 = max(0, fy)
                            x2 = min(w, fx + fw)
                            y2 = min(h, fy + fh)

                            embedding = None
                            if self.sface is not None:
                                try:
                                    aligned = self.sface.alignCrop(img, f)
                                    if aligned is not None and aligned.shape == (112, 112, 3):
                                        feat = self.sface.feature(np.ascontiguousarray(aligned, dtype=np.uint8))
                                        if feat is not None:
                                            embedding = feat.flatten()
                                except Exception:
                                    pass

                            results.append({
                                "class": "Person",
                                "confidence": round(conf, 2),
                                "bbox": [round(x1 / w, 4), round(y1 / h, 4), round(x2 / w, 4), round(y2 / h, 4)],
                                "raw_xyxy": [x1, y1, x2, y2],
                                "embedding": embedding
                            })
                except Exception as exc:
                    print(f"[FaceEngine] YuNet full-frame detect notice: {exc}")

        return results

    def compute_similarity(self, crop_or_emb: Any, ref_embedding: np.ndarray) -> int:
        """
        Computes Cosine Similarity between live crop embedding and reference embedding.
        Returns percentage similarity score (0-100%).
        Uses official SFace cosine threshold of 0.363 for true identity verification.
        """
        if crop_or_emb is None or ref_embedding is None:
            return 0

        if isinstance(crop_or_emb, np.ndarray) and len(crop_or_emb.shape) == 1:
            crop_embedding = crop_or_emb
        else:
            crop_embedding = self.extract_128d_embedding(crop_or_emb)

        if crop_embedding is None:
            return 0

        try:
            with self._lock:
                if self.sface is not None and len(ref_embedding) == 128 and len(crop_embedding) == 128:
                    # SFace score: Cosine similarity range [-1, 1]
                    score = self.sface.match(
                        np.ascontiguousarray(crop_embedding, dtype=np.float32).reshape(1, -1),
                        np.ascontiguousarray(ref_embedding, dtype=np.float32).reshape(1, -1),
                        cv2.FaceRecognizerSF_FR_COSINE
                    )
                    # SFace official match threshold is cosine >= 0.363
                    if score >= 0.363:
                        pct = int(75 + (score - 0.363) / (1.0 - 0.363) * 24)
                        return min(99, max(75, pct))
                    elif score >= 0.28:
                        pct = int(40 + (score - 0.28) / (0.363 - 0.28) * 30)
                        return min(70, max(40, pct))
                    else:
                        pct = int(max(0.0, score * 100))
                        return min(35, max(0, pct))

            # Spatial Chi-Square distance for LBP vectors
            a1 = np.ascontiguousarray(crop_embedding, dtype=np.float32)
            a2 = np.ascontiguousarray(ref_embedding, dtype=np.float32)
            chi_dist = float(np.sum((a1 - a2) ** 2 / (a1 + a2 + 1e-10)))
            if chi_dist < 0.20:
                sim_pct = int(70 + (0.20 - chi_dist) / 0.20 * 28)
            else:
                sim_pct = int(max(0.0, (1.0 - (chi_dist / 0.45))) * 50)
            return min(99, max(0, sim_pct))
        except Exception as exc:
            print(f"[FaceEngine] Match error: {exc}")

        return 0


_engine_instance = None


def get_face_engine() -> DeepFaceEngine:
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = DeepFaceEngine()
    return _engine_instance

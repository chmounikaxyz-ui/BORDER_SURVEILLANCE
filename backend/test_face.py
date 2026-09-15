import os
import sys
import cv2
import numpy as np

from database import get_conn
from face_engine import get_face_engine

engine = get_face_engine()
print("Engine YuNet:", engine.yunet)
print("Engine SFace:", engine.sface)

conn = get_conn()
rows = conn.execute("SELECT id, name, photo_base64 FROM watchlist_persons").fetchall()
conn.close()

print(f"Total Watchlist Persons: {len(rows)}")
for r in rows:
    p_id, name, b64 = r
    img = engine.decode_image(b64)
    if img is not None:
        print(f"Person: {name}, image shape: {img.shape}")
        emb = engine.extract_128d_embedding(img)
        print(f"  Embedding: {emb is not None}, len: {len(emb) if emb is not None else 0}")
        if emb is not None:
            # Self similarity test
            sim = engine.compute_similarity(img, emb)
            print(f"  Self-similarity score: {sim}%")
    else:
        print(f"Person: {name}, image: None")

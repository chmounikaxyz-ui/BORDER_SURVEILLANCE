import sqlite3
import base64
import cv2
import numpy as np

def create_dummy_jpeg_b64(color_bgr):
    img = np.zeros((150, 150, 3), dtype=np.uint8)
    img[:] = (30, 30, 30)
    # Draw face shape
    cv2.circle(img, (75, 65), 35, color_bgr, -1)
    cv2.circle(img, (60, 55), 5, (255, 255, 255), -1)
    cv2.circle(img, (90, 55), 5, (255, 255, 255), -1)
    cv2.ellipse(img, (75, 80), (15, 8), 0, 0, 180, (255, 255, 255), 2)
    # Body
    pts = np.array([[20, 150], [40, 110], [110, 110], [130, 150]], np.int32)
    cv2.fillPoly(img, [pts], color_bgr)
    
    _, buf = cv2.imencode('.jpg', img)
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode('utf-8')

conn = sqlite3.connect('backend/surveillance.db')
cursor = conn.cursor()

# Get all watchlist persons
rows = cursor.execute("SELECT id, name, photo_base64 FROM watchlist_persons").fetchall()
print(f"Found {len(rows)} persons in watchlist_persons.")

colors = [
    (255, 142, 77), # blue
    (101, 138, 255), # orange
    (77, 77, 255), # red
    (80, 175, 76), # green
]

for idx, (pid, name, photo) in enumerate(rows):
    if not photo or "svg+xml" in photo:
        color = colors[idx % len(colors)]
        new_photo = create_dummy_jpeg_b64(color)
        cursor.execute("UPDATE watchlist_persons SET photo_base64 = ? WHERE id = ?", (new_photo, pid))
        print(f"Updated photo for {name} ({pid}) to valid JPEG base64.")

conn.commit()
conn.close()
print("Database update complete.")

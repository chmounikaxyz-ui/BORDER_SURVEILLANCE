import sqlite3
import base64
import sys
sys.path.append('backend')
from main import _calc_image_similarity

conn = sqlite3.connect('backend/surveillance.db')
cursor = conn.cursor()
rows = cursor.execute('SELECT id, name, photo_base64 FROM watchlist_persons').fetchall()
print(f"Total Watchlist Persons in DB: {len(rows)}")

for r in rows:
    p_id, name, photo_b64 = r
    b64_len = len(photo_b64) if photo_b64 else 0
    print(f"- ID: {p_id}, Name: {name}, Photo B64 Length: {b64_len}")

conn.close()

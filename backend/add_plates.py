# -*- coding: utf-8 -*-
r"""
Script to manage watchlist vehicle plates in SQLite DB.
Run from: c:\Users\HP\Desktop\surveillance\backend\
"""
import uuid
from datetime import datetime, timezone
from database import get_conn, init_db

# Ensure all tables exist
init_db()
conn = get_conn()

# Wipe all existing entries
conn.execute("DELETE FROM watchlist_vehicles")
conn.commit()
print("Cleared all watchlist_vehicles.")

# Add target vehicle plates for video matching
plates = [
    ("YR62TYF", "CRITICAL", "BMW",  "5 Series", "Black", "Suspect vehicle - watchlist match"),
    ("LC71PZS", "HIGH",     "Audi", "Q5",       "Dark",  "Flagged for investigation"),
    ("LC71P25", "HIGH",     "Audi", "Q5",       "Dark",  "Alternate plate reading"),
]

now = datetime.now(timezone.utc).isoformat()
for plate, threat, make, model, color, notes in plates:
    vid = "veh-" + uuid.uuid5(uuid.NAMESPACE_DNS, plate).hex[:8]
    try:
        conn.execute(
            """INSERT OR IGNORE INTO watchlist_vehicles
               (id, plate_number, threat_level, make, model, color, notes, added_by, created_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (vid, plate, threat, make, model, color, notes, "Operator", now)
        )
        print(f"  Added: {plate} ({threat}) - {make} {model}")
    except Exception as e:
        print(f"  Failed {plate}: {e}")

conn.commit()

# Verify
rows = conn.execute(
    "SELECT plate_number, threat_level, make, model FROM watchlist_vehicles"
).fetchall()
print(f"\nWatchlist now has {len(rows)} vehicles.")
for r in rows:
    print(f"  {r[0]:<15} {r[1]:<10} {r[2]} {r[3]}")

conn.close()


import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "..", "data", "surveillance.db")
db_path = os.path.abspath(db_path)
print(f"Using DB: {db_path}")

conn = sqlite3.connect(db_path)
conn.execute("DELETE FROM watchlist_vehicles")
conn.commit()
remaining = conn.execute("SELECT COUNT(*) FROM watchlist_vehicles").fetchone()[0]
print(f"Done. Remaining vehicles: {remaining}")
conn.close()

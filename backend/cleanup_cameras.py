import sqlite3

conn = sqlite3.connect("surveillance.db")
conn.row_factory = sqlite3.Row

# Delete stale phone cameras that can't connect
conn.execute("DELETE FROM camera_nodes WHERE stream_url LIKE '%4747%' OR stream_url LIKE '%192.168.55%' OR stream_url LIKE '%192.0.0%'")
conn.commit()

# Show remaining cameras
rows = conn.execute("SELECT id, name, code, stream_url FROM camera_nodes").fetchall()
print(f"Remaining cameras ({len(rows)}):")
for r in rows:
    print(f"  {r['id']} | {r['name']} | {r['code']} | stream_url={r['stream_url']}")

conn.close()
print("\nDone! Stale phone cameras removed.")

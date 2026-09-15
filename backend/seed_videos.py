import sqlite3
from datetime import datetime, timezone

conn = sqlite3.connect('../data/surveillance.db')
conn.row_factory = sqlite3.Row

# Ensure ALRT-901-AX is in alerts table
existing = conn.execute('SELECT id FROM alerts WHERE id = ?', ('ALRT-901-AX',)).fetchone()
if not existing:
    now = datetime.now(timezone.utc).isoformat()
    conn.execute('''
        INSERT INTO alerts
        (id, title, description, sector, camera_code, timestamp, relative_time,
         severity, category, status, object_type, track_id, confidence, risk_score,
         zone_sensitivity, speed_heading, coordinates, image_url, ai_analysis, timeline, bbox, video_url, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ''', (
        'ALRT-901-AX',
        'PERSON WITH SUSPICIOUS BEHAVIOR DETECTED',
        'Sector East, East Gate • Camera BOP-07 — Rapid movement & fence line loitering',
        'Sector East',
        'BOP-07',
        '17:38:20 UTC',
        'Just Now',
        'CRITICAL',
        'PERSONNEL',
        'PENDING VERIFICATION',
        'Person',
        'TRK-P368-68',
        0.76,
        88,
        'Class A (Restricted)',
        '9 km/h • 045°',
        'Sector East, East Gate',
        '/evidence/frames/ALRT-901-AX.jpg',
        'YOLOv8 neural inference identified Person with Suspicious Behavior (Track ID: 368) breaching East Patrol Route High Tension with 76% confidence. Persistent tracking confirms unauthorized rapid intrusion sprint into Class A (Fence Line) zone. Incident video clip recorded and cryptographically sealed.',
        '[]',
        '[0.35, 0.45, 0.65, 0.85]',
        '/evidence/videos/ALRT-901-AX.mp4',
        now
    ))
    print('Inserted ALRT-901-AX into alerts')
else:
    conn.execute('UPDATE alerts SET video_url = ?, image_url = ? WHERE id = ?', (
        '/evidence/videos/ALRT-901-AX.mp4',
        '/evidence/frames/ALRT-901-AX.jpg',
        'ALRT-901-AX'
    ))
    print('Updated ALRT-901-AX in alerts')

# Update evidence_records for ALRT-901-AX as well
conn.execute('''
    UPDATE evidence_records
    SET details_summary = 'Person with suspicious behavioral anomaly detected in Sector East, East Gate. Incident video clip and optical forensic frame captured and preserved.'
    WHERE event_id = 'ALRT-901-AX'
''')

# Update all existing alerts with appropriate video_urls
conn.execute('''
    UPDATE alerts SET video_url = '/uploads/8b0cdc21_A_normal_realistic_CCTV_recording_from_a.mp4'
    WHERE (video_url IS NULL OR video_url = '') AND (category = 'PERSONNEL' OR title LIKE '%PERSON%' OR title LIKE '%MOUNI%' OR camera_code = 'BOP-07')
''')

conn.execute('''
    UPDATE alerts SET video_url = '/uploads/14266560_3840_2160_30fps.mp4'
    WHERE (video_url IS NULL OR video_url = '')
''')

conn.commit()
rows = conn.execute('SELECT id, title, category, camera_code, video_url, image_url FROM alerts').fetchall()
for r in rows:
    print(f"[{r['id']}] {r['title'][:35]} -> videoUrl: {r['video_url']}")
conn.close()

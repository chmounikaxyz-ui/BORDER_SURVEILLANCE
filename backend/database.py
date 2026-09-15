"""
SQLite database setup and connection helper.
Each function opens its own connection to be thread-safe
(the detector runs in a background thread).
"""
import sqlite3
import shutil
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "surveillance.db"
OLD_DB_PATH = Path(__file__).parent / "surveillance.db"

if OLD_DB_PATH.exists() and not DB_PATH.exists():
    try:
        shutil.copy2(OLD_DB_PATH, DB_PATH)
        print(f"[DB Migration] Migrated database to {DB_PATH}")
    except Exception as e:
        print("[DB Migration Error]", e)


def get_conn() -> sqlite3.Connection:
    """Return a new SQLite connection with row_factory set."""
    conn = sqlite3.connect(str(DB_PATH), timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # allow concurrent reads/writes
    conn.execute("PRAGMA busy_timeout=30000") # wait up to 30s for write locks
    conn.execute("PRAGMA synchronous=NORMAL") # faster writes with safe WAL
    conn.execute("PRAGMA cache_size=-64000")  # 64 MB memory cache
    conn.execute("PRAGMA temp_store=MEMORY")  # in-memory temp table ops
    return conn


def init_db() -> None:
    """Create tables if they don't exist."""
    conn = get_conn()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS video_jobs (
        id              TEXT PRIMARY KEY,
        video_path      TEXT NOT NULL,
        status          TEXT DEFAULT 'queued',
        progress        INTEGER DEFAULT 0,
        current_frame   INTEGER DEFAULT 0,
        total_frames    INTEGER DEFAULT 0,
        alerts_generated INTEGER DEFAULT 0,
        created_at      TEXT NOT NULL,
        completed_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS alerts (
        id              TEXT PRIMARY KEY,
        title           TEXT NOT NULL,
        description     TEXT,
        sector          TEXT,
        camera_code     TEXT,
        timestamp       TEXT,
        relative_time   TEXT,
        severity        TEXT,
        category        TEXT,
        status          TEXT DEFAULT 'PENDING VERIFICATION',
        object_type     TEXT,
        track_id        TEXT,
        confidence      REAL,
        risk_score      INTEGER,
        zone_sensitivity TEXT,
        speed_heading   TEXT,
        coordinates     TEXT,
        image_url       TEXT,
        ai_analysis     TEXT,
        timeline        TEXT,
        bbox            TEXT,
        created_at      TEXT
    );

    CREATE TABLE IF NOT EXISTS evidence_records (
        id              TEXT PRIMARY KEY,
        event_id        TEXT,
        timestamp       TEXT,
        event_type      TEXT,
        source          TEXT,
        camera_code     TEXT,
        operator_action TEXT DEFAULT 'Auto-Resolved',
        integrity_hash  TEXT,
        full_hash       TEXT,
        coordinates     TEXT,
        image_url       TEXT,
        details_summary TEXT,
        audit_trail     TEXT
    );

    CREATE TABLE IF NOT EXISTS watchlist_persons (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        alias           TEXT DEFAULT '',
        nationality     TEXT DEFAULT '',
        threat_level    TEXT DEFAULT 'MEDIUM',
        notes           TEXT DEFAULT '',
        photo_base64    TEXT DEFAULT '',
        created_at      TEXT NOT NULL,
        added_by        TEXT DEFAULT 'Operator'
    );

    CREATE TABLE IF NOT EXISTS watchlist_vehicles (
        id              TEXT PRIMARY KEY,
        plate_number    TEXT NOT NULL,
        make            TEXT DEFAULT '',
        model           TEXT DEFAULT '',
        color           TEXT DEFAULT '',
        threat_level    TEXT DEFAULT 'MEDIUM',
        notes           TEXT DEFAULT '',
        photo_base64    TEXT DEFAULT '',
        created_at      TEXT NOT NULL,
        added_by        TEXT DEFAULT 'Operator'
    );

    CREATE TABLE IF NOT EXISTS anpr_hits (
        id              TEXT PRIMARY KEY,
        plate_detected  TEXT NOT NULL,
        plate_matched   TEXT NOT NULL,
        vehicle_id      TEXT,
        alert_id        TEXT,
        camera_code     TEXT,
        confidence      REAL,
        threat_level    TEXT,
        detected_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tamper_events (
        id              TEXT PRIMARY KEY,
        camera_code     TEXT NOT NULL,
        tamper_type     TEXT NOT NULL,   -- BLACKOUT | BLUR | FROZEN
        detected_at     TEXT NOT NULL,
        resolved_at     TEXT             -- NULL while active
    );

    CREATE TABLE IF NOT EXISTS reid_tracks (
        id              TEXT PRIMARY KEY,
        original_camera TEXT NOT NULL,
        cameras_seen    TEXT NOT NULL,   -- comma-separated
        first_seen      TEXT NOT NULL,
        last_seen       TEXT NOT NULL,
        similarity_score REAL,
        alert_ids       TEXT             -- comma-separated
    );

    CREATE TABLE IF NOT EXISTS feedback_weights (
        zone_sensitivity TEXT NOT NULL,
        category         TEXT NOT NULL,
        true_pos         INTEGER DEFAULT 0,
        false_pos        INTEGER DEFAULT 0,
        weight_mult      REAL    DEFAULT 1.0,
        PRIMARY KEY (zone_sensitivity, category)
    );

    CREATE TABLE IF NOT EXISTS camera_nodes (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        code            TEXT NOT NULL UNIQUE,
        sector          TEXT DEFAULT 'Sector North',
        type            TEXT DEFAULT 'optical',
        stream_url      TEXT NOT NULL,
        status          TEXT DEFAULT 'online',
        lat             REAL DEFAULT 34.0528,
        lng             REAL DEFAULT -118.2415,
        resolution      TEXT DEFAULT '1080p',
        fps             INTEGER DEFAULT 30,
        bitrate         TEXT DEFAULT '4.2 Mbps',
        location_name   TEXT DEFAULT '',
        created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watchlist_matches (
        id               TEXT PRIMARY KEY,
        person_id        TEXT,
        person_name      TEXT NOT NULL,
        camera_code      TEXT NOT NULL,
        similarity_score INTEGER NOT NULL,
        status_type      TEXT DEFAULT 'critical',
        status_label     TEXT DEFAULT 'MATCH CONFIRMED',
        verified_status  TEXT DEFAULT 'pending',
        reference_image  TEXT,
        captured_image   TEXT,
        location_name    TEXT,
        timestamp        TEXT NOT NULL,
        list_origin      TEXT DEFAULT 'Interpol / National Database'
    );

    CREATE TABLE IF NOT EXISTS dynamic_zones (
        id               TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        camera_code      TEXT NOT NULL,
        sector           TEXT DEFAULT 'Sector General',
        sensitivity      TEXT DEFAULT 'Class A (Restricted)',
        polygon_norm     TEXT NOT NULL,
        cooldown         INTEGER DEFAULT 30,
        dwell_threshold  INTEGER DEFAULT 15,
        speed_limit_kmh  REAL DEFAULT 40.0,
        restricted_hours TEXT DEFAULT '',
        created_at       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_watchlist_persons_created ON watchlist_persons(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_watchlist_vehicles_created ON watchlist_vehicles(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_watchlist_matches_ts ON watchlist_matches(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_anpr_hits_time ON anpr_hits(detected_at DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
    """)

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    try:
        conn.execute("ALTER TABLE alerts ADD COLUMN bbox TEXT")
        conn.commit()
    except Exception:
        pass

    try:
        conn.execute("ALTER TABLE alerts ADD COLUMN video_url TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass

    try:
        conn.execute("ALTER TABLE video_jobs ADD COLUMN alert_summary TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass

    # Remove any legacy mock cameras and ensure only the real Laptop Webcam exists
    try:
        conn.execute("DELETE FROM camera_nodes WHERE id LIKE 'cam-0%' OR code LIKE 'BOP-%' OR code LIKE 'CHK_%'")
        conn.commit()
    except Exception:
        pass

    cam_count = conn.execute("SELECT COUNT(*) FROM camera_nodes").fetchone()[0]
    if cam_count == 0:
        from data import CAMERAS_DATA
        for cam in CAMERAS_DATA:
            try:
                conn.execute(
                    """INSERT OR REPLACE INTO camera_nodes
                       (id, name, code, sector, type, stream_url, status, lat, lng, resolution, fps, bitrate, location_name, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (cam["id"], cam["name"], cam["code"], cam["sector"], cam["type"],
                     cam.get("imageUrl", "0"), cam["status"], cam["lat"], cam["lng"],
                     cam["resolution"], cam["fps"], cam.get("bitrate", "4.8 Mbps"),
                     cam.get("locationName", ""), now)
                )
            except Exception:
                pass
        conn.commit()

    conn.commit()
    conn.close()
    print("[DB] SQLite initialised at", DB_PATH)


# ─── Dynamic Zones Helpers ───────────────────────────────────────────────────

def add_dynamic_zone(
    zone_id: str,
    name: str,
    camera_code: str,
    sector: str,
    sensitivity: str,
    polygon_norm: list,
    cooldown: int = 30,
    dwell_threshold: int = 15,
    speed_limit_kmh: float = 40.0,
    restricted_hours: str = '',
) -> dict:
    import json
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    poly_str = json.dumps(polygon_norm)

    conn = get_conn()
    conn.execute(
        """INSERT INTO dynamic_zones
           (id, name, camera_code, sector, sensitivity, polygon_norm, cooldown, dwell_threshold, speed_limit_kmh, restricted_hours, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (zone_id, name, camera_code, sector, sensitivity, poly_str, cooldown, dwell_threshold, speed_limit_kmh, restricted_hours, now)
    )
    conn.commit()
    conn.close()

    return {
        "id": zone_id,
        "name": name,
        "camera_code": camera_code,
        "sector": sector,
        "sensitivity": sensitivity,
        "polygon_norm": polygon_norm,
        "cooldown": cooldown,
        "dwell_threshold": dwell_threshold,
        "speed_limit_kmh": speed_limit_kmh,
        "restricted_hours": restricted_hours,
        "created_at": now,
    }


def get_dynamic_zones(camera_code: str = None) -> list:
    import json
    conn = get_conn()
    if camera_code:
        rows = conn.execute("SELECT * FROM dynamic_zones WHERE camera_code = ? ORDER BY created_at DESC", (camera_code,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM dynamic_zones ORDER BY created_at DESC").fetchall()
    conn.close()

    zones = []
    for r in rows:
        zones.append({
            "id": r["id"],
            "name": r["name"],
            "camera_code": r["camera_code"],
            "sector": r["sector"],
            "sensitivity": r["sensitivity"],
            "polygon_norm": json.loads(r["polygon_norm"]),
            "cooldown": r["cooldown"],
            "dwell_threshold": r["dwell_threshold"],
            "speed_limit_kmh": r["speed_limit_kmh"],
            "restricted_hours": r["restricted_hours"],
            "created_at": r["created_at"],
        })
    return zones


def delete_dynamic_zone(zone_id: str) -> bool:
    conn = get_conn()
    cursor = conn.execute("DELETE FROM dynamic_zones WHERE id = ?", (zone_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted




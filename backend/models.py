"""
Pydantic v2 request/response schemas.
Alert and EvidenceRecord shapes intentionally match the TypeScript
interfaces in src/types.ts so the React frontend works without changes.
"""
from pydantic import BaseModel
from typing import Optional, List


# ─── Requests ────────────────────────────────────────────────────────────────

class VideoJobRequest(BaseModel):
    video_path: str


class AlertStatusUpdate(BaseModel):
    status: str  # 'DISMISSED' | 'ESCALATED' | 'VERIFIED' | 'PENDING VERIFICATION'


# ─── Alert timeline step ─────────────────────────────────────────────────────

class TimelineStep(BaseModel):
    title: str
    time: str
    hash: Optional[str] = None
    active: Optional[bool] = None
    status: Optional[str] = None   # 'normal' | 'primary' | 'error' | 'pending'


# ─── Responses ───────────────────────────────────────────────────────────────

class AlertResponse(BaseModel):
    id: str
    title: str
    description: str
    sector: str
    cameraCode: str
    timestamp: str
    relativeTime: str
    severity: str
    category: str
    status: str
    objectType: str
    trackId: str
    confidence: float
    riskScore: int
    zoneSensitivity: str
    speedHeading: str
    coordinates: str
    imageUrl: str
    aiAnalysis: str
    timeline: List[TimelineStep]


class AuditEntry(BaseModel):
    time: str
    action: str
    type: str
    blockHash: Optional[str] = None


class EvidenceResponse(BaseModel):
    id: str
    eventId: str
    timestamp: str
    eventType: str
    source: str
    cameraCode: str
    operatorAction: str
    integrityHash: str
    fullHash: str
    coordinates: str
    imageUrl: Optional[str] = None
    videoUrl: Optional[str] = None
    detailsSummary: Optional[str] = None
    auditTrail: List[AuditEntry]


class VideoJobStatus(BaseModel):
    job_id: str
    status: str               # queued | running | complete | error
    progress: int             # 0-100
    current_frame: int = 0
    total_frames: int = 0
    alerts_generated: int = 0
    alert_summary: str = ''


class AnalyticsResponse(BaseModel):
    totalAlerts: int
    criticalAlerts: int
    highAlerts: int
    personnelCount: int
    vehicleCount: int
    evidenceCount: int
    interceptionRate: float
    avgResponseTime: str
    falseAlarmRate: float


# ─── Watchlist ────────────────────────────────────────────────────────────────

class WatchlistPersonCreate(BaseModel):
    name: str
    alias: Optional[str] = ''
    nationality: Optional[str] = ''
    threat_level: Optional[str] = 'MEDIUM'
    threatLevel: Optional[str] = None
    notes: Optional[str] = ''
    photo_base64: Optional[str] = ''
    photoBase64: Optional[str] = None
    added_by: Optional[str] = 'Operator'
    addedBy: Optional[str] = None


class WatchlistVehicleCreate(BaseModel):
    plate_number: Optional[str] = ''
    plateNumber: Optional[str] = None
    make: Optional[str] = ''
    model: Optional[str] = ''
    color: Optional[str] = ''
    threat_level: Optional[str] = 'MEDIUM'
    threatLevel: Optional[str] = None
    notes: Optional[str] = ''
    photo_base64: Optional[str] = ''
    photoBase64: Optional[str] = None
    added_by: Optional[str] = 'Operator'
    addedBy: Optional[str] = None


class WatchlistPersonResponse(BaseModel):
    id: str
    name: str
    alias: str
    nationality: str
    threatLevel: str
    notes: str
    photoBase64: str
    createdAt: str
    addedBy: str


class WatchlistVehicleResponse(BaseModel):
    id: str
    plateNumber: str
    make: str
    model: str
    color: str
    threatLevel: str
    notes: str
    photoBase64: str
    createdAt: str
    addedBy: str


# ─── Feedback ─────────────────────────────────────────────────────────────────

class AlertFeedback(BaseModel):
    correct: bool   # True = true positive, False = false positive


# ─── Tamper ───────────────────────────────────────────────────────────────────

class TamperInject(BaseModel):
    camera_code: str
    tamper_type: Optional[str] = None   # "BLACKOUT" | "BLUR" | "FROZEN" | null to clear


# ─── ANPR Hit ─────────────────────────────────────────────────────────────────

class AnprHitResponse(BaseModel):
    id: str
    plate_detected: str
    plate_matched: str
    vehicle_id: Optional[str]
    alert_id: Optional[str]
    camera_code: Optional[str]
    confidence: Optional[float]
    threat_level: Optional[str]
    detected_at: str


# ─── ReID Track ───────────────────────────────────────────────────────────────

class ReidTrackResponse(BaseModel):
    id: str
    original_camera: str
    cameras_seen: str
    first_seen: str
    last_seen: str
    similarity_score: Optional[float]
    alert_ids: Optional[str]


# ─── Camera Management ────────────────────────────────────────────────────────

class CameraCreate(BaseModel):
    name: str
    code: str
    sector: str = 'Sector North'
    type: str = 'optical'            # optical | thermal | ptz | alpr | webcam
    stream_url: str                  # '0' for webcam, or 'rtsp://...', 'http://...'
    lat: float = 34.0528
    lng: float = -118.2415
    resolution: str = '1080p'
    fps: int = 30
    location_name: str = ''


class CameraStatusUpdate(BaseModel):
    status: str                       # online | offline | warning | connecting


class FrameDetectRequest(BaseModel):
    image_base64: Optional[str] = ""
    image_url: Optional[str] = ""
    video_base64: Optional[str] = ""
    camera_code: Optional[str] = "CAM-LIVE"
    create_alert: Optional[bool] = True
    is_manual_capture: Optional[bool] = False


# ─── Dynamic Custom Zones ──────────────────────────────────────────────────────

class DynamicZoneCreate(BaseModel):
    name: str
    camera_code: str
    sector: str = 'Sector General'
    sensitivity: str = 'Class A (Restricted)'
    polygon_norm: List[List[float]]   # [[x, y], [x, y], ...] normalized 0.0-1.0
    cooldown: int = 30
    dwell_threshold: int = 15
    speed_limit_kmh: Optional[float] = 40.0
    restricted_hours: Optional[str] = ''  # e.g., "22:00-06:00" or empty for 24/7


class DynamicZoneResponse(BaseModel):
    id: str
    name: str
    camera_code: str
    sector: str
    sensitivity: str
    polygon_norm: List[List[float]]
    cooldown: int
    dwell_threshold: int
    speed_limit_kmh: float
    restricted_hours: str
    created_at: str


# ─── ANPR Scan ────────────────────────────────────────────────────────────────

class AnprScanRequest(BaseModel):
    image_base64: Optional[str] = ""
    camera_code: Optional[str] = "BOP-01"


class AnprScanResponse(BaseModel):
    plate_number: str
    confidence: float
    matched_watchlist: Optional[WatchlistVehicleResponse] = None
    alert_created: bool = False
    alert_id: Optional[str] = None
class AlertVideoUpload(BaseModel):
    video_base64: str


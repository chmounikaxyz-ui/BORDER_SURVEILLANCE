export type NavTab = 
  | 'dashboard'
  | 'live-surveillance'
  | 'alerts'
  | 'camera-network'
  | 'watchlist-matches'
  | 'watchlist-db'
  | 'evidence-vault'
  | 'system-health'
  | 'settings'
  | 'system-architecture';

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertCategory = 'VEHICLE' | 'PERSONNEL' | 'UAV' | 'SYSTEM' | 'ANIMAL';
export type AlertStatus = 'PENDING VERIFICATION' | 'PENDING REVIEW' | 'ESCALATED' | 'DISMISSED' | 'VERIFIED';

export interface CameraNode {
  id: string;
  name: string;
  code: string;
  sector: string;
  type: 'optical' | 'thermal' | 'ptz' | 'alpr' | 'drone' | 'webcam';
  status: 'online' | 'offline' | 'warning' | 'connecting';
  hasAlert: boolean;
  alertType?: string;
  lat: number;
  lng: number;
  resolution: string;
  fps: number;
  bitrate: string;
  imageUrl?: string;
  stream_url?: string;
  coordinatesString?: string;
  locationName: string;
  ptzSupport?: boolean;
}

export interface TacticalAlertSubject {
  type: 'PERSON' | 'VEHICLE';
  name: string;
  alias?: string;
  plateNumber?: string;
  threatLevel: string;
  nationality?: string;
  color?: string;
  notes?: string;
  addedBy?: string;
  createdAt?: string;
  photoBase64?: string;
}

export interface TacticalAlert {
  id: string;
  title: string;
  description: string;
  sector: string;
  cameraCode: string;
  timestamp: string;
  relativeTime: string;
  severity: AlertSeverity;
  category: AlertCategory;
  status: AlertStatus;
  objectType: string;
  trackId: string;
  confidence: number;
  riskScore: number;
  zoneSensitivity: string;
  speedHeading: string;
  coordinates: string;
  imageUrl: string;
  videoUrl?: string;
  capturedFrameUrl?: string;
  aiAnalysis: string;
  subject?: TacticalAlertSubject;
  timeline: {
    title: string;
    time: string;
    hash?: string;
    active?: boolean;
    status?: 'normal' | 'primary' | 'error' | 'pending';
  }[];
}

export interface WatchlistMatch {
  id: string;
  code: string;
  similarityScore: number;
  statusLabel: string;
  statusType: 'critical' | 'routine' | 'warning';
  referenceImage: string;
  capturedImage: string;
  location: string;
  timestamp: string;
  listOrigin: string;
  verifiedStatus?: 'escalated' | 'rejected' | 'pending';
}

export interface EvidenceRecord {
  id: string;
  eventId: string;
  timestamp: string;
  eventType: 'Intrusion' | 'Vehicle' | 'System' | 'Watchlist' | 'Person' | string;
  source: string;
  cameraCode: string;
  operatorAction: 'Escalated' | 'Dismissed' | 'Auto-Resolved' | 'Verified';
  integrityHash: string;
  fullHash: string;
  coordinates: string;
  imageUrl?: string;
  videoUrl?: string;
  detailsSummary?: string;
  auditTrail: {
    time: string;
    action: string;
    type: 'threat' | 'record' | 'view' | 'escalate' | 'dismiss' | 'block';
    blockHash?: string;
  }[];
}

export interface EdgeNode {
  id: string;
  name: string;
  zone: string;
  status: 'online' | 'offline' | 'warning';
  ping: string;
  syncTime: string;
  queuedEvidenceMb?: number;
}

export interface HeartbeatLog {
  id: string;
  timestamp: string;
  type: 'HEARTBEAT' | 'TIMEOUT' | 'SYNC' | 'SYS_ALERT' | 'OBJ_TRACK_INIT';
  camCode: string;
  message: string;
}

export type WatchlistThreatLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface WatchlistPerson {
  id: string;
  name: string;
  alias: string;
  nationality: string;
  threatLevel: WatchlistThreatLevel;
  notes: string;
  photoBase64: string;  // data:image/... base64
  createdAt: string;
  addedBy: string;
}

export interface WatchlistVehicle {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  color: string;
  threatLevel: WatchlistThreatLevel;
  notes: string;
  photoBase64: string;  // data:image/... base64
  createdAt: string;
  addedBy: string;
}

export interface DynamicZone {
  id: string;
  name: string;
  camera_code: string;
  sector: string;
  sensitivity: string;
  polygon_norm: [number, number][];
  cooldown: number;
  dwell_threshold: number;
  speed_limit_kmh: number;
  restricted_hours: string;
  created_at: string;
}

export interface AnprScanResult {
  plate_number: string;
  confidence: number;
  matched_watchlist?: WatchlistVehicle | null;
  alert_created: boolean;
  alert_id?: string | null;
}

export interface ReidTrajectoryStep {
  cameraCode: string;
  location: string;
  timestamp: string;
  status: string;
}

export interface ReidTrajectory {
  targetId: string;
  name: string;
  threatLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  overallTrajectory: ReidTrajectoryStep[];
  speedAvgKmh: number;
  heading: string;
}


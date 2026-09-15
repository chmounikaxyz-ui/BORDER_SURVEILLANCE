/**
 * BorderVision AI — Typed API client.
 * All calls go through /api (proxied to http://localhost:8000 via Vite).
 * Falls back gracefully when the backend is offline.
 */
import {
  TacticalAlert,
  CameraNode,
  EvidenceRecord,
  WatchlistPerson,
  WatchlistVehicle,
  ReidTrajectory,
  EdgeNode,
} from '../types';

export type { ReidTrajectory };

const BASE = '/api';
const ALT_BASE = 'http://localhost:8000/api';

// ─── Generic fetch wrapper ────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      console.warn(`[API] ${path} → ${res.status}`);
      return null;
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return ({} as T);
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch (err) {
    clearTimeout(timeoutId);
    // Vite proxy failed or aborted — try direct connection to backend port 8000
    try {
      const altController = new AbortController();
      const altTimeout = setTimeout(() => altController.abort(), 4000);
      const altRes = await fetch(`${ALT_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        signal: altController.signal,
        ...options,
      });
      clearTimeout(altTimeout);
      if (altRes.ok) {
        if (altRes.status === 204 || altRes.headers.get('content-length') === '0') {
          return ({} as T);
        }
        const altText = await altRes.text();
        return altText ? (JSON.parse(altText) as T) : ({} as T);
      }
    } catch {}
    return null;
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
  const data = await apiFetch<{ status: string }>('/health');
  return data?.status === 'online';
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function getAlerts(): Promise<TacticalAlert[] | null> {
  return apiFetch<TacticalAlert[]>('/alerts');
}

export async function updateAlertStatus(
  alertId: string,
  status: string,
): Promise<TacticalAlert | null> {
  return apiFetch<TacticalAlert>(`/alerts/${alertId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteAlert(alertId: string): Promise<boolean> {
  const res = await apiFetch(`/alerts/${alertId}`, { method: 'DELETE' });
  return res !== null;
}

export async function clearAllAlerts(): Promise<boolean> {
  const res = await apiFetch('/alerts', { method: 'DELETE' });
  return res !== null;
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

export async function getEvidence(): Promise<EvidenceRecord[] | null> {
  return apiFetch<EvidenceRecord[]>('/evidence');
}

export async function deleteEvidence(recordId: string): Promise<boolean> {
  const res = await apiFetch(`/evidence/${recordId}`, { method: 'DELETE' });
  return res !== null;
}

export async function clearAllEvidence(): Promise<boolean> {
  const res = await apiFetch('/evidence', { method: 'DELETE' });
  return res !== null;
}

// ─── Cameras ──────────────────────────────────────────────────────────────────

export async function getCameras(): Promise<CameraNode[] | null> {
  return apiFetch<CameraNode[]>('/cameras');
}

export async function addCameraNode(camera: {
  name: string;
  code: string;
  sector?: string;
  type?: string;
  stream_url: string;
  lat?: number;
  lng?: number;
  location_name?: string;
}): Promise<CameraNode | null> {
  return apiFetch<CameraNode>('/cameras', {
    method: 'POST',
    body: JSON.stringify(camera),
  });
}

export async function deleteCameraNode(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/cameras/${id}`, { method: 'DELETE' });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function rebootCameraNode(id: string): Promise<{ status: string; message: string } | null> {
  return apiFetch<{ status: string; message: string }>(`/cameras/${id}/reboot`, {
    method: 'POST'
  });
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface SectorHeatmapRow {
  sector: string;
  slots: number[];
  total: number;
}

export interface ThreatVector {
  category: string;
  label: string;
  sublabel: string;
  icon: string;
  color: string;
  count: number;
  percentage: number;
}

export interface AnalyticsData {
  totalAlerts: number;
  criticalAlerts: number;
  highAlerts: number;
  personnelCount: number;
  vehicleCount: number;
  evidenceCount: number;
  verifiedCount?: number;
  dismissedCount?: number;
  interceptionRate: number;
  avgResponseTime: string;
  falseAlarmRate: number;
  timeRange?: string;
  heatmap?: SectorHeatmapRow[];
  vectors?: ThreatVector[];
}

export async function getAnalytics(timeRange: string = '7d'): Promise<AnalyticsData | null> {
  return apiFetch<AnalyticsData>(`/analytics?timeRange=${encodeURIComponent(timeRange)}`);
}

// ─── System Health & Telemetry ───────────────────────────────────────────────

export interface SystemTelemetryData {
  syncStatus: {
    status: string;
    onlineCount: number;
    totalCount: number;
    summary: string;
  };
  hostMetrics: {
    cpuPercent: number;
    memPercent: number;
    diskPercent: number;
    uplink: string;
    downlink: string;
  };
  inferenceLatency: {
    latency: string;
    acceleration: string;
  };
  bandwidthSaved: {
    percentage: string;
    description: string;
  };
  nodes: (EdgeNode & { mapLeft: string; mapTop: string; camCode: string })[];
  histogram: {
    bins: number[];
    peak: string;
    maxBin: number;
  };
  threatSplit: {
    total: number;
    personnel: { count: number; pct: number };
    vehicle: { count: number; pct: number };
    uav: { count: number; pct: number };
    system: { count: number; pct: number };
  };
}

export async function getSystemTelemetry(): Promise<SystemTelemetryData | null> {
  return apiFetch<SystemTelemetryData>('/system/telemetry');
}

// ─── Video processing ─────────────────────────────────────────────────────────

export interface VideoJob {
  job_id: string;
  status: 'idle' | 'queued' | 'running' | 'complete' | 'error';
  progress: number;
  current_frame: number;
  total_frames: number;
  alerts_generated: number;
  alert_summary?: string;
}

export async function processVideo(videoPath: string): Promise<{ job_id: string } | null> {
  return apiFetch<{ job_id: string }>('/video/process', {
    method: 'POST',
    body: JSON.stringify({ video_path: videoPath }),
  });
}

export async function processSampleVideo(): Promise<{ job_id: string; status: string; filename?: string } | null> {
  return apiFetch<{ job_id: string; status: string; filename?: string }>('/video/sample', {
    method: 'POST',
  });
}

export async function getVideoStatus(): Promise<VideoJob | null> {
  return apiFetch<VideoJob>('/video/status');
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export async function uploadVideo(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<{ job_id: string; filename: string } | null> {
  const formData = new FormData();
  formData.append('file', file);

  // List of URLs to try — proxy first, then direct backend
  const urls = ['/api/video/upload', 'http://localhost:8000/api/video/upload'];

  for (const url of urls) {
    try {
      console.log(`[Upload] Trying ${url}...`);
      
      // Signal progress at start
      onProgress?.({ loaded: 0, total: file.size, percent: 0 });

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        // Do NOT set Content-Type — browser sets multipart boundary automatically
      });

      console.log(`[Upload] ${url} responded with status ${response.status}`);
      
      // Signal progress complete
      onProgress?.({ loaded: file.size, total: file.size, percent: 100 });

      if (response.ok) {
        const data = await response.json();
        console.log('[Upload] Success:', data);
        return data;
      } else {
        const errorText = await response.text();
        console.warn(`[Upload] ${url} returned ${response.status}: ${errorText}`);
        // Try next URL
        continue;
      }
    } catch (err: any) {
      console.warn(`[Upload] ${url} failed:`, err?.message || err);
      // Try next URL
      continue;
    }
  }

  console.error('[Upload] All upload URLs failed');
  return null;
}

// ─── System nodes ─────────────────────────────────────────────────────────────

export interface SystemNode {
  id: string;
  name: string;
  zone: string;
  status: 'online' | 'offline' | 'warning';
  ping: string;
  syncTime: string;
  queuedEvidenceMb?: number;
}

export async function getSystemNodes(): Promise<SystemNode[] | null> {
  return apiFetch<SystemNode[]>('/system/nodes');
}

export interface PersonDetectedPhoto {
  id: string;
  imageUrl: string;
  cameraCode: string;
  similarityScore: number;
  location: string;
  timestamp: string;
  type: string;
}

export interface PersonPhotosResponse {
  person: {
    id: string;
    name: string;
    alias?: string;
    threatLevel: string;
    photoBase64?: string;
  } | null;
  totalMatches: number;
  photos: PersonDetectedPhoto[];
}

export async function getPersonPhotos(personId: string): Promise<PersonPhotosResponse | null> {
  return apiFetch<PersonPhotosResponse>(`/watchlist/persons/${personId}/photos`);
}

export async function getWatchlistPersons(): Promise<WatchlistPerson[] | null> {
  return apiFetch<WatchlistPerson[]>('/watchlist/persons');
}

export async function addWatchlistPerson(
  data: Omit<WatchlistPerson, 'id' | 'createdAt'>,
): Promise<WatchlistPerson | null> {
  return apiFetch<WatchlistPerson>('/watchlist/persons', {
    method: 'POST',
    body: JSON.stringify({
      name:         data.name,
      alias:        data.alias,
      nationality:  data.nationality,
      threat_level: data.threatLevel,
      notes:        data.notes,
      photo_base64: data.photoBase64,
      added_by:     data.addedBy,
    }),
  });
}

export async function deleteWatchlistPerson(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/watchlist/persons/${id}`, { method: 'DELETE' });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function getWatchlistVehicles(): Promise<WatchlistVehicle[] | null> {
  return apiFetch<WatchlistVehicle[]>('/watchlist/vehicles');
}

export async function addWatchlistVehicle(
  data: Omit<WatchlistVehicle, 'id' | 'createdAt'>,
): Promise<WatchlistVehicle | null> {
  return apiFetch<WatchlistVehicle>('/watchlist/vehicles', {
    method: 'POST',
    body: JSON.stringify({
      plate_number: data.plateNumber,
      make:         data.make,
      model:        data.model,
      color:        data.color,
      threat_level: data.threatLevel,
      notes:        data.notes,
      photo_base64: data.photoBase64,
      added_by:     data.addedBy,
    }),
  });
}

export async function deleteWatchlistVehicle(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/watchlist/vehicles/${id}`, { method: 'DELETE' });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function getWatchlistMatches(): Promise<any[] | null> {
  return apiFetch<any[]>('/watchlist/matches');
}

export async function deleteWatchlistMatch(matchId: string): Promise<boolean> {
  const res = await apiFetch(`/watchlist/matches/${matchId}`, { method: 'DELETE' });
  return res !== null;
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export async function submitAlertFeedback(
  alertId: string,
  correct: boolean,
): Promise<Record<string, unknown> | null> {
  return apiFetch(`/alerts/${alertId}/feedback`, {
    method: 'PATCH',
    body: JSON.stringify({ correct }),
  });
}

export async function getFeedbackStats(): Promise<Record<string, unknown>[] | null> {
  return apiFetch('/feedback/stats');
}

// ─── Tamper ───────────────────────────────────────────────────────────────────

export interface TamperStatus {
  camera_code: string;
  status: 'ok' | 'BLACKOUT' | 'BLUR' | 'FROZEN';
  since: string;
}

export interface TamperEvent {
  id: string;
  camera_code: string;
  tamper_type: string;
  detected_at: string;
  resolved_at: string | null;
}

export async function getTamperStatus(): Promise<TamperStatus[] | null> {
  return apiFetch<TamperStatus[]>('/tamper/status');
}

export async function getTamperEvents(): Promise<TamperEvent[] | null> {
  return apiFetch<TamperEvent[]>('/tamper/events');
}

export async function clearTamperEvents(): Promise<boolean> {
  const res = await apiFetch<{ status: string }>('/tamper/events', { method: 'DELETE' });
  return Boolean(res);
}

export async function injectTamper(
  camera_code: string,
  tamper_type: string | null,
): Promise<Record<string, unknown> | null> {
  return apiFetch('/tamper/inject', {
    method: 'POST',
    body: JSON.stringify({ camera_code, tamper_type }),
  });
}

// ─── ANPR Hits ────────────────────────────────────────────────────────────────

export interface AnprHit {
  id: string;
  plate_detected: string;
  plate_matched: string;
  vehicle_id: string | null;
  alert_id: string | null;
  camera_code: string | null;
  confidence: number | null;
  threat_level: string | null;
  detected_at: string;
}

export async function getAnprHits(): Promise<AnprHit[] | null> {
  return apiFetch<AnprHit[]>('/anpr/hits');
}

export async function clearAnprHits(): Promise<boolean> {
  const res = await apiFetch<{ status: string }>('/anpr/hits', { method: 'DELETE' });
  return Boolean(res);
}

export async function deleteAnprHit(hitId: string): Promise<boolean> {
  const res = await apiFetch<{ status: string }>(`/anpr/hits/${hitId}`, { method: 'DELETE' });
  return Boolean(res);
}

// ─── ReID Tracks ─────────────────────────────────────────────────────────────

export interface ReidTrack {
  id: string;
  original_camera: string;
  cameras_seen: string;
  cameras_list: string[];
  first_seen: string;
  last_seen: string;
  similarity_score: number | null;
  alert_ids: string | null;
}

export async function getReidTracks(): Promise<ReidTrack[] | null> {
  return apiFetch<ReidTrack[]>('/reid/tracks');
}

export async function getReidTrajectories(): Promise<ReidTrajectory[] | null> {
  return apiFetch<ReidTrajectory[]>('/reid/trajectories');
}

// ─── Dynamic Zones ─────────────────────────────────────────────────────────────

export async function getDynamicZones(cameraCode?: string): Promise<import('../types').DynamicZone[] | null> {
  const query = cameraCode ? `?camera_code=${encodeURIComponent(cameraCode)}` : '';
  return apiFetch<import('../types').DynamicZone[]>(`/zones${query}`);
}

export async function addDynamicZone(zoneData: {
  name: string;
  camera_code: string;
  sector?: string;
  sensitivity?: string;
  polygon_norm: [number, number][];
  cooldown?: number;
  dwell_threshold?: number;
  speed_limit_kmh?: number;
  restricted_hours?: string;
}): Promise<import('../types').DynamicZone | null> {
  return apiFetch<import('../types').DynamicZone>('/zones', {
    method: 'POST',
    body: JSON.stringify(zoneData),
  });
}

export async function deleteDynamicZone(zoneId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/zones/${zoneId}`, { method: 'DELETE' });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

// ─── ANPR Frame Scan ──────────────────────────────────────────────────────────

export async function scanAnprFrame(
  imageBase64: string,
  cameraCode: string = 'BOP-01',
): Promise<import('../types').AnprScanResult | null> {
  return apiFetch<import('../types').AnprScanResult>('/anpr/scan', {
    method: 'POST',
    body: JSON.stringify({ image_base64: imageBase64, camera_code: cameraCode }),
  });
}


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

export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string)?.trim();
  const winUrl = (typeof window !== 'undefined' && (window as any).__API_URL__)?.trim();
  let stored = '';
  try {
    stored = localStorage.getItem('bordervision_api_url')?.trim() || '';
  } catch {}

  let url = envUrl || winUrl || stored || '/api';
  url = url.replace(/\/$/, '');
  if (!url.endsWith('/api')) {
    url = `${url}/api`;
  }
  return url;
}

export function setCustomApiUrl(url: string): void {
  try {
    if (!url || !url.trim()) {
      localStorage.removeItem('bordervision_api_url');
    } else {
      localStorage.setItem('bordervision_api_url', url.trim().replace(/\/$/, ''));
    }
  } catch {}
}

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const apiBase = getApiBaseUrl();
  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    try {
      const origin = new URL(apiBase).origin;
      return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
    } catch {
      return url;
    }
  }
  return url;
}

const BASE = '/api';
const ALT_BASE = 'http://127.0.0.1:8000/api';
let _ACTIVE_API_BASE: string | null = null;

export function getCandidateApiBases(): string[] {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const base = getApiBaseUrl();
  const list: string[] = [];
  if (_ACTIVE_API_BASE) {
    list.push(_ACTIVE_API_BASE);
  }
  if (!list.includes(base)) list.push(base);
  if (base !== '/api' && !list.includes('/api')) list.push('/api');
  // Avoid mixed content blocks on HTTPS: modern browsers reject http:// requests from https:// pages
  if (!isHttps) {
    if (!list.includes('http://127.0.0.1:8000/api')) list.push('http://127.0.0.1:8000/api');
    if (!list.includes('http://localhost:8000/api')) list.push('http://localhost:8000/api');
  }
  const renderProd = 'https://border-surveillance-eol7.onrender.com/api';
  if (!list.includes(renderProd)) list.push(renderProd);
  return list;
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

// ─── Generic fetch wrapper ────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: ApiFetchOptions,
): Promise<T | null> {
  const candidateBases = getCandidateApiBases();
  const { timeoutMs = 6000, ...fetchOptions } = options || {};

  for (const b of candidateBases) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${b}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        ...fetchOptions,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        continue;
      }
      _ACTIVE_API_BASE = b; // Remember the fast working base
      if (res.status === 204 || res.headers.get('content-length') === '0') {
        return ({} as T);
      }
      const text = await res.text();
      return text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      clearTimeout(timeoutId);
      // try next candidate base
    }
  }

  return null;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
  const data = await apiFetch<{ status: string }>('/health', { timeoutMs: 3000 });
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

export async function processVideo(videoPath: string): Promise<{ job_id?: string; error?: string } | null> {
  const candidateBases = getCandidateApiBases();

  let lastError = '';
  for (const b of candidateBases) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(`${b}/video/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_path: videoPath }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        return await res.json();
      } else {
        const txt = await res.text();
        try {
          const parsed = JSON.parse(txt);
          lastError = parsed.detail || parsed.message || txt;
        } catch {
          if (txt.includes('502') || txt.includes('Bad Gateway')) {
            lastError = 'Render server instance is waking up / restarting (502 Gateway). Please wait a few moments and try again.';
          } else {
            lastError = txt.replace(/<[^>]*>/g, '').trim() || `HTTP error ${res.status}`;
          }
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err?.name === 'AbortError'
        ? 'Request timed out waiting for video processing.'
        : (err?.message || 'Connection failed.');
    }
  }
  return { error: lastError || 'Backend unreachable.' };
}

export async function processSampleVideo(sampleType: 'highway' | 'intrusion' = 'highway'): Promise<{ job_id?: string; status?: string; filename?: string; video_url?: string; error?: string } | null> {
  const candidateBases = getCandidateApiBases();

  let lastError = '';
  for (const b of candidateBases) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for Render cold start
    try {
      const res = await fetch(`${b}/video/sample?sample_type=${sampleType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        return await res.json();
      } else {
        const txt = await res.text();
        try {
          const parsed = JSON.parse(txt);
          lastError = parsed.detail || parsed.message || txt;
        } catch {
          if (txt.includes('502') || txt.includes('Bad Gateway')) {
            lastError = 'Render server instance is waking up / restarting (502 Gateway). Please wait a few moments and try again.';
          } else {
            lastError = txt.replace(/<[^>]*>/g, '').trim() || `HTTP error ${res.status}`;
          }
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === 'AbortError') {
        lastError = 'Request timed out. If using Render free tier, the backend server may still be waking up (cold start); please try again in a few seconds.';
      } else {
        lastError = err?.message || 'Network connection failed.';
      }
    }
  }

  return { error: lastError || 'Backend unreachable. If on Render, the service may be starting up; please try again shortly.' };
}

export async function getVideoStatus(jobId?: string): Promise<VideoJob | null> {
  const query = jobId ? `?job_id=${encodeURIComponent(jobId)}` : '';
  const data = await apiFetch<any>(`/video/status${query}`);
  if (data && typeof data === 'object') {
    const unifiedId = data.job_id || data.id || jobId || '';
    data.job_id = unifiedId;
    data.id = unifiedId;
  }
  return data as VideoJob | null;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export async function uploadVideo(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<{ job_id?: string; filename?: string; video_url?: string; error?: string } | null> {
  const bases = getCandidateApiBases();
  // Target the best active base directly without loop resets
  const targetBase = _ACTIVE_API_BASE || bases[0] || '/api';
  const url = `${targetBase}/video/upload`;

  console.log(`[Upload] Uploading ${file.name} (${file.size} bytes) to ${url}...`);

  try {
    const result = await new Promise<{ job_id: string; filename: string; video_url?: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      // Generous 15 minute timeout (900000ms) to ensure large video files transfer without being aborted
      xhr.timeout = 900000;

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
            onProgress({ loaded: event.loaded, total: event.total, percent });
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
            _ACTIVE_API_BASE = targetBase;
            resolve(data);
          } catch (e) {
            reject(new Error('Invalid JSON response received from server.'));
          }
        } else {
          let errMsg = `Server returned status ${xhr.status}`;
          try {
            const parsed = JSON.parse(xhr.responseText);
            errMsg = parsed.detail || parsed.message || errMsg;
          } catch {}
          reject(new Error(errMsg));
        }
      };

      xhr.onerror = () => reject(new Error(`Network error connecting to ${url}. Please check your internet connection.`));
      xhr.ontimeout = () => reject(new Error(`Upload timed out. Video file is large or connection speed is low.`));

      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    });

    return result;
  } catch (err: any) {
    console.error('[Upload] Upload failed:', err);
    return { error: err?.message || 'Upload failed. Please check connection and try again.' };
  }
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

// ─── Watchlist Local Storage & Sync ──────────────────────────────────────────
const LOCAL_STORAGE_PERSONS_KEY = 'bordervision_watchlist_persons';
const LOCAL_STORAGE_VEHICLES_KEY = 'bordervision_watchlist_vehicles';

export function getLocalWatchlistPersons(): WatchlistPerson[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PERSONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalWatchlistPersons(persons: WatchlistPerson[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_PERSONS_KEY, JSON.stringify(persons));
  } catch {}
}

export function getLocalWatchlistVehicles(): WatchlistVehicle[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_VEHICLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalWatchlistVehicles(vehicles: WatchlistVehicle[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_VEHICLES_KEY, JSON.stringify(vehicles));
  } catch {}
}

export async function getWatchlistPersons(): Promise<WatchlistPerson[]> {
  const local = getLocalWatchlistPersons();
  try {
    const remote = await apiFetch<WatchlistPerson[]>('/watchlist/persons', { timeoutMs: 12000 });
    if (Array.isArray(remote)) {
      const map = new Map<string, WatchlistPerson>();
      local.forEach(p => map.set(p.id, p));
      remote.forEach(p => map.set(p.id, p));
      const merged = Array.from(map.values());
      saveLocalWatchlistPersons(merged);
      return merged;
    }
  } catch (err) {
    console.warn('[API] Failed to fetch remote persons, returning local cache:', err);
  }
  return local;
}

export async function addWatchlistPerson(
  data: Omit<WatchlistPerson, 'id' | 'createdAt'>,
): Promise<WatchlistPerson> {
  const localPerson: WatchlistPerson = {
    id: `wp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: data.name,
    alias: data.alias,
    nationality: data.nationality,
    threatLevel: data.threatLevel,
    notes: data.notes,
    photoBase64: data.photoBase64,
    createdAt: new Date().toISOString(),
    addedBy: data.addedBy || 'Operator',
  };

  // 1. Immediately store in localStorage so records NEVER disappear on page refresh
  const local = getLocalWatchlistPersons();
  saveLocalWatchlistPersons([localPerson, ...local.filter(p => p.id !== localPerson.id)]);

  // 2. Sync to backend database
  try {
    const remote = await apiFetch<WatchlistPerson>('/watchlist/persons', {
      method: 'POST',
      timeoutMs: 25000,
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
    if (remote && remote.id) {
      const updated = getLocalWatchlistPersons().map(p => p.id === localPerson.id ? remote : p);
      saveLocalWatchlistPersons(updated);
      return remote;
    }
  } catch (err) {
    console.warn('[API] Could not sync person to backend (retained in localStorage):', err);
  }
  return localPerson;
}

export async function deleteWatchlistPerson(id: string): Promise<boolean> {
  const local = getLocalWatchlistPersons();
  saveLocalWatchlistPersons(local.filter(p => p.id !== id));
  const res = await apiFetch(`/watchlist/persons/${id}`, { method: 'DELETE', timeoutMs: 10000 });
  return res !== null;
}

export async function getWatchlistVehicles(): Promise<WatchlistVehicle[]> {
  const local = getLocalWatchlistVehicles();
  try {
    const remote = await apiFetch<WatchlistVehicle[]>('/watchlist/vehicles', { timeoutMs: 12000 });
    if (Array.isArray(remote)) {
      const map = new Map<string, WatchlistVehicle>();
      local.forEach(v => map.set(v.id, v));
      remote.forEach(v => map.set(v.id, v));
      const merged = Array.from(map.values());
      saveLocalWatchlistVehicles(merged);
      return merged;
    }
  } catch (err) {
    console.warn('[API] Failed to fetch remote vehicles, returning local cache:', err);
  }
  return local;
}

export async function addWatchlistVehicle(
  data: Omit<WatchlistVehicle, 'id' | 'createdAt'>,
): Promise<WatchlistVehicle> {
  const localVehicle: WatchlistVehicle = {
    id: `wv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    plateNumber: data.plateNumber,
    make: data.make,
    model: data.model,
    color: data.color,
    threatLevel: data.threatLevel,
    notes: data.notes,
    photoBase64: data.photoBase64,
    createdAt: new Date().toISOString(),
    addedBy: data.addedBy || 'Operator',
  };

  // 1. Immediately store in localStorage so records NEVER disappear on page refresh
  const local = getLocalWatchlistVehicles();
  saveLocalWatchlistVehicles([localVehicle, ...local.filter(v => v.id !== localVehicle.id)]);

  // 2. Sync to backend database
  try {
    const remote = await apiFetch<WatchlistVehicle>('/watchlist/vehicles', {
      method: 'POST',
      timeoutMs: 25000,
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
    if (remote && remote.id) {
      const updated = getLocalWatchlistVehicles().map(v => v.id === localVehicle.id ? remote : v);
      saveLocalWatchlistVehicles(updated);
      return remote;
    }
  } catch (err) {
    console.warn('[API] Could not sync vehicle to backend (retained in localStorage):', err);
  }
  return localVehicle;
}

export async function deleteWatchlistVehicle(id: string): Promise<boolean> {
  const local = getLocalWatchlistVehicles();
  saveLocalWatchlistVehicles(local.filter(v => v.id !== id));
  const res = await apiFetch(`/watchlist/vehicles/${id}`, { method: 'DELETE', timeoutMs: 10000 });
  return res !== null;
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


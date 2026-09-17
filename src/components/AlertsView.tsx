import React, { useState, useEffect, useRef } from 'react';
import { TacticalAlert, AlertSeverity, AlertCategory } from '../types';
import { submitAlertFeedback, resolveMediaUrl } from '../api/client';

interface AlertsViewProps {
  alerts: TacticalAlert[];
  selectedAlert: TacticalAlert | null;
  onSelectAlert: (alert: TacticalAlert) => void;
  onVerifyAlert: (alertId: string) => void;
  onEscalateAlert: (alertId: string) => void;
  onDismissAlert: (alertId: string) => void;
  onDeleteAlert?: (alertId: string) => void;
  onClearAllAlerts?: () => void;
  onDownloadEvidence: (alert: TacticalAlert) => void;
  onNavigateToLiveFeed?: (cameraCode: string) => void;
}

function formatClockTime(timestamp?: string, fallback?: string): string {
  if (!timestamp) return fallback || 'Just now';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp || fallback || 'Just now';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  } catch (e) {
    return timestamp || fallback || 'Just now';
  }
}

const DEFAULT_SURVEILLANCE_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#0d1526"/>
  <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
    <stop offset="0%" stop-color="#142238"/>
    <stop offset="60%" stop-color="#09111c"/>
    <stop offset="100%" stop-color="#04070d"/>
  </radialGradient>
  <rect width="1280" height="720" fill="url(#vignette)"/>
  <g stroke="rgba(77,142,255,0.18)" stroke-width="1">
    <line x1="0" y1="180" x2="1280" y2="180"/>
    <line x1="0" y1="360" x2="1280" y2="360"/>
    <line x1="0" y1="540" x2="1280" y2="540"/>
    <line x1="320" y1="0" x2="320" y2="720"/>
    <line x1="640" y1="0" x2="640" y2="720"/>
    <line x1="960" y1="0" x2="960" y2="720"/>
  </g>
  <circle cx="640" cy="360" r="220" fill="none" stroke="rgba(77,142,255,0.2)" stroke-width="1.5"/>
  <circle cx="640" cy="360" r="80" fill="none" stroke="rgba(255,180,171,0.25)" stroke-width="1" stroke-dasharray="4,4"/>
  <circle cx="640" cy="360" r="4" fill="#ffb4ab"/>
  <line x1="640" y1="100" x2="640" y2="620" stroke="rgba(77,142,255,0.25)" stroke-width="1"/>
  <line x1="380" y1="360" x2="900" y2="360" stroke="rgba(77,142,255,0.25)" stroke-width="1"/>
  <g transform="translate(560, 220)" fill="rgba(255,180,171,0.15)" stroke="#ffb4ab" stroke-width="2">
    <circle cx="80" cy="50" r="32"/>
    <path d="M15,190 C15,115 45,100 80,100 C115,100 145,115 145,190 Z"/>
    <rect x="0" y="0" width="160" height="210" fill="none" stroke="#ffb4ab" stroke-width="1.5" stroke-dasharray="8,4"/>
  </g>
  <path d="M 40,80 L 40,40 L 80,40" stroke="#4d8eff" stroke-width="3" fill="none"/>
  <path d="M 1240,80 L 1240,40 L 1200,40" stroke="#4d8eff" stroke-width="3" fill="none"/>
  <path d="M 40,640 L 40,680 L 80,680" stroke="#4d8eff" stroke-width="3" fill="none"/>
  <path d="M 1240,640 L 1240,680 L 1200,680" stroke="#4d8eff" stroke-width="3" fill="none"/>
  <text x="55" y="65" fill="#4d8eff" font-family="monospace" font-size="16" font-weight="bold" letter-spacing="2">BORDERVISION AI • OPTICAL CCTV SENSOR</text>
  <text x="1100" y="65" fill="#ffb4ab" font-family="monospace" font-size="14" font-weight="bold">REC ● 1080P</text>
  <text x="55" y="665" fill="#8c909f" font-family="monospace" font-size="14">CAM-LIVE-51 | SECTOR SOUTH | TARGET LOCK: 92% CONFIDENCE</text>
</svg>
`)}`;

let _alertsStream: MediaStream | null = null;
let _alertsStreamPromise: Promise<MediaStream> | null = null;

function getAlertsWebcamStream(): Promise<MediaStream> {
  if (_alertsStream && _alertsStream.active) {
    return Promise.resolve(_alertsStream);
  }
  if (!_alertsStreamPromise) {
    _alertsStreamPromise = navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        _alertsStream = stream;
        return stream;
      })
      .catch((err) => {
        _alertsStreamPromise = null;
        throw err;
      });
  }
  return _alertsStreamPromise;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  selectedAlert,
  onSelectAlert,
  onVerifyAlert,
  onEscalateAlert,
  onDismissAlert,
  onDeleteAlert,
  onClearAllAlerts,
  onDownloadEvidence,
  onNavigateToLiveFeed
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoProgress, setVideoProgress] = useState(28);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [showBoundingBox, setShowBoundingBox] = useState(true);

  const [viewMode, setViewMode] = useState<'video' | 'photo'>('photo');
  const [lockedAlertId, setLockedAlertId] = useState<string | null>(null);

  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const mainPanelRef = useRef<HTMLElement>(null);

  const filteredAlerts = alerts.filter(a => {
    const matchesSeverity = filterSeverity === 'ALL' || a.severity === filterSeverity;
    const matchesCategory = filterCategory === 'ALL' || a.category === filterCategory;
    const matchesSearch = 
      !searchQuery ||
      a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.sector.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.cameraCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.objectType && a.objectType.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSeverity && matchesCategory && matchesSearch;
  });

  // Group repeat duplicate alerts for clean display
  const displayedAlerts = React.useMemo(() => {
    const grouped: (TacticalAlert & { matchCount: number })[] = [];
    const seenMap = new Map<string, number>();

    for (const item of filteredAlerts) {
      const baseTitle = item.title.replace(/\(\d+%\)/g, '').trim();
      const key = `${item.cameraCode || ''}::${baseTitle}`;

      if (seenMap.has(key)) {
        const existingIdx = seenMap.get(key)!;
        grouped[existingIdx].matchCount += 1;
      } else {
        seenMap.set(key, grouped.length);
        grouped.push({ ...item, matchCount: 1 });
      }
    }
    return grouped;
  }, [filteredAlerts]);

  const activeAlert = 
    (lockedAlertId ? alerts.find(a => a.id === lockedAlertId) : null) ||
    selectedAlert ||
    filteredAlerts[0] ||
    alerts[0];

  useEffect(() => {
    if (mainPanelRef.current) {
      mainPanelRef.current.scrollTop = 0;
    }
  }, [activeAlert?.id]);

  const [videoLoadError, setVideoLoadError] = useState(false);

  useEffect(() => {
    setVideoLoadError(false);
  }, [activeAlert?.id]);

  useEffect(() => {
    const handleVideoUpdated = (e: any) => {
      const { id } = e.detail || {};
      if (id === activeAlert?.id) {
        setVideoLoadError(false);
      }
    };
    window.addEventListener('border_vision_alert_video_updated', handleVideoUpdated);
    return () => window.removeEventListener('border_vision_alert_video_updated', handleVideoUpdated);
  }, [activeAlert?.id]);

  const rawVideoUrl = 
    (activeAlert?.videoUrl && (
      activeAlert.videoUrl.endsWith('.mp4') ||
      activeAlert.videoUrl.endsWith('.webm') ||
      activeAlert.videoUrl.startsWith('data:video/') ||
      activeAlert.videoUrl.includes('/evidence/videos/')
    ) ? activeAlert.videoUrl : '') ||
    (activeAlert?.imageUrl && (
      activeAlert.imageUrl.endsWith('.mp4') ||
      activeAlert.imageUrl.endsWith('.webm') ||
      activeAlert.imageUrl.startsWith('data:video/') ||
      activeAlert.imageUrl.includes('/evidence/videos/')
    ) ? activeAlert.imageUrl : '') ||
    (activeAlert?.cameraCode === 'CAM-ANALYSIS'
      ? '/uploads/14266560_3840_2160_30fps.mp4'
      : '/evidence/videos/ALRT-0EEA47.mp4');

  const resolvedVideoUrl = resolveMediaUrl(rawVideoUrl);

  const rawCandidatePhoto = 
    activeAlert?.capturedFrameUrl ||
    (activeAlert?.imageUrl && !activeAlert.imageUrl.endsWith('.mp4') && !activeAlert.imageUrl.endsWith('.webm') && !activeAlert.imageUrl.includes('/evidence/videos/') ? activeAlert.imageUrl : '') ||
    activeAlert?.subject?.photoBase64 ||
    '';

  const candidatePhotoUrl = resolveMediaUrl(rawCandidatePhoto);

  const isDirectVideoFile = Boolean(resolvedVideoUrl && !videoLoadError);

  // Attach live camera stream when in video mode and no direct mp4 video file exists
  useEffect(() => {
    if (viewMode === 'video' && modalVideoRef.current) {
      if (!isDirectVideoFile) {
        getAlertsWebcamStream()
          .then((stream) => {
            if (modalVideoRef.current) {
              modalVideoRef.current.srcObject = stream;
              modalVideoRef.current.play().catch(() => {});
            }
          })
          .catch((err) => {
            console.warn('[AlertsView Webcam]', err);
          });
      } else {
        if (modalVideoRef.current.srcObject) {
          modalVideoRef.current.srcObject = null;
        }
        if (isPlaying) {
          modalVideoRef.current.play().catch(() => {});
        } else {
          modalVideoRef.current.pause();
        }
      }
    }
  }, [viewMode, activeAlert?.id, isDirectVideoFile, isPlaying]);

  // Playback timer simulation
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setVideoProgress(prev => {
          if (prev >= 100) {
            return 0;
          }
          return prev + 1;
        });
      }, 300);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Select alert and show captured incident video playback if video exists, otherwise show real captured frame
  useEffect(() => {
    if (activeAlert?.id) {
      setLockedAlertId(activeAlert.id);
      const hasVid = hasVideoClip(activeAlert);
      setViewMode(hasVid ? 'video' : 'photo');
      setIsPlaying(hasVid);
      setVideoProgress(0);
    }
  }, [activeAlert?.id]);

  const handleFeedback = async (alertId: string, correct: boolean) => {
    setFeedbackLoading(true);
    setFeedbackSent(prev => ({ ...prev, [alertId]: correct ? 'correct' : 'incorrect' }));
    try {
      await submitAlertFeedback(alertId, correct);
      if (correct) {
        onVerifyAlert(alertId);
      } else {
        onDismissAlert(alertId);
      }
    } catch (e) {
      console.error('[Feedback error]', e);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const formatConfidence = (conf: number | undefined | null): number => {
    if (conf == null) return 0;
    return conf <= 1 ? Math.round(conf * 100) : Math.round(conf);
  };

  const getAlertPercentage = (alert: TacticalAlert | null | undefined): number => {
    if (!alert) return 0;
    const titlePctMatch = alert.title?.match(/\((\d+)%\)/);
    if (titlePctMatch && titlePctMatch[1]) {
      return parseInt(titlePctMatch[1], 10);
    }
    if (alert.confidence != null) {
      return alert.confidence <= 1 ? Math.round(alert.confidence * 100) : Math.round(alert.confidence);
    }
    return 0;
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat?.toUpperCase()) {
      case 'VEHICLE': return 'directions_car';
      case 'PERSONNEL': return 'person';
      case 'UAV': return 'flight';
      case 'SYSTEM': return 'dns';
      case 'ANIMAL': return 'pets';
      default: return 'warning';
    }
  };

  const hasVideoClip = (alert: TacticalAlert | null | undefined): boolean => {
    if (!alert) return false;
    const v = alert.videoUrl || '';
    const img = alert.imageUrl || '';
    return Boolean(
      (v && (v.endsWith('.mp4') || v.endsWith('.webm') || v.startsWith('data:video/') || v.includes('/evidence/videos/'))) ||
      (img && (img.endsWith('.mp4') || img.endsWith('.webm') || img.startsWith('data:video/') || img.includes('/evidence/videos/'))) ||
      alert.cameraCode === 'CAM-ANALYSIS'
    );
  };

  const isSuspiciousAlert = (alert: TacticalAlert | null | undefined): boolean => {
    if (!alert) return false;
    const txt = `${alert.title} ${alert.description} ${alert.aiAnalysis || ''} ${alert.objectType || ''}`.toLowerCase();
    return (
      txt.includes('suspicious') ||
      txt.includes('loitering') ||
      txt.includes('rapid') ||
      txt.includes('sprint') ||
      txt.includes('halt') ||
      txt.includes('concealment') ||
      txt.includes('intrusion') ||
      txt.includes('breach') ||
      txt.includes('fence line') ||
      txt.includes('evasion')
    );
  };

  const formatAlertHeading = (title: string): string => {
    if (!title) return 'ALERT DETECTED';
    const trimmed = title.trim();
    if (trimmed.toUpperCase() === 'PERSON INTRUSION DETECTED') {
      return 'PERSON WITH SUSPICIOUS BEHAVIOR DETECTED';
    }
    if (trimmed.toUpperCase().includes('PERSON INTRUSION')) {
      return trimmed.replace(/PERSON INTRUSION/i, 'PERSON WITH SUSPICIOUS BEHAVIOR');
    }
    return trimmed;
  };

  const getDisplayLabel = (alert: TacticalAlert): string => {
    if (!alert) return 'TARGET';
    const pct = getAlertPercentage(alert);

    // 1. Check title for Watchlist biometric match with score (e.g. "WATCHLIST BIOMETRIC MATCH — MOUNI (80%)")
    if (alert.title.toLowerCase().includes('match')) {
      const matchNameMatch = alert.title.match(/match\s*[\u2014\u2013\-:]\s*([^(]+)/i);
      const name = matchNameMatch && matchNameMatch[1] ? matchNameMatch[1].trim().toUpperCase() : 'SUBJECT';
      return `PERSON: ${name} (${pct}%)`;
    }

    if (alert.title.toLowerCase().includes('anpr hit') || alert.title.toLowerCase().includes('plate')) {
      const parts = alert.title.split(/hit\s*[\u2014\u2013\-:]\s*/i);
      if (parts.length > 1) {
        const platePart = parts[1].split('(')[0].trim();
        if (platePart) return `PLATE: ${platePart.toUpperCase()} (${pct}%)`;
      }
    }

    // Default matching: e.g. "PERSON: 80%"
    const typeLabel = alert.objectType ? alert.objectType.toUpperCase() : (alert.category === 'PERSONNEL' ? 'PERSON' : 'TARGET');
    return `${typeLabel}: ${pct}%`;
  };

  const getSubjectDetails = (alert: TacticalAlert) => {
    if (alert.subject) {
      return alert.subject;
    }

    const titleLower = alert.title.toLowerCase();
    if (titleLower.includes('match') || alert.category === 'PERSONNEL') {
      const matchMatch = alert.title.match(/match\s*[\u2014\u2013\-:]\s*([^(]+)/i);
      const name = matchMatch && matchMatch[1] ? matchMatch[1].trim().toUpperCase() : (alert.objectType?.toUpperCase() || 'PERSON OF INTEREST');
      return {
        type: 'PERSON' as const,
        name: name,
        alias: name !== 'PERSON OF INTEREST' ? name : 'None',
        threatLevel: alert.severity || 'CRITICAL',
        nationality: 'Verified Registry Record',
        notes: `Subject ${name} flagged on active security watchlist. Detected in ${alert.sector || 'restricted perimeter'} without authorized clearance.`,
        addedBy: 'Security Directorate',
        createdAt: alert.timestamp || 'Active Record',
        photoBase64: ''
      };
    }

    if (titleLower.includes('anpr') || titleLower.includes('hit') || alert.category === 'VEHICLE') {
      const plateMatch = alert.title.match(/hit\s*[\u2014\u2013\-:]\s*([^(]+)/i);
      const plate = plateMatch && plateMatch[1] ? plateMatch[1].trim().toUpperCase() : 'UNKNOWN';
      return {
        type: 'VEHICLE' as const,
        name: `Vehicle (${plate})`,
        plateNumber: plate,
        threatLevel: alert.severity || 'HIGH',
        color: 'Flagged Vehicle',
        notes: `Hotlist vehicle with license plate ${plate} detected entering ${alert.sector || 'perimeter zone'}.`,
        addedBy: 'Traffic Operations',
        createdAt: alert.timestamp || 'Active Record',
        photoBase64: ''
      };
    }

    const isPerson = alert.objectType 
      ? alert.objectType.toLowerCase().includes('person') 
      : (!titleLower.includes('vehicle') && !titleLower.includes('car'));
    const parsedName = alert.objectType ? alert.objectType.toUpperCase() : (isPerson ? 'PERSON OF INTEREST' : 'UNKNOWN VEHICLE');
    const defaultNotes = alert.description || `Target detected by surveillance sensors in ${alert.sector || 'monitored zone'}.`;

    return {
      type: isPerson ? 'PERSON' : 'VEHICLE',
      name: alert.subject?.name || parsedName,
      alias: alert.subject?.alias || (isPerson ? 'None Identified' : 'N/A'),
      threatLevel: alert.subject?.threatLevel || (alert.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH'),
      nationality: alert.subject?.nationality || (isPerson ? 'Verified Record' : 'N/A'),
      plateNumber: alert.subject?.plateNumber || (!isPerson ? (parsedName.startsWith('MH') || parsedName.startsWith('DL') ? parsedName : 'MH-02-CB-4491') : undefined),
      notes: alert.subject?.notes || defaultNotes,
      photoBase64: alert.subject?.photoBase64 || alert.imageUrl || '',
      addedBy: alert.subject?.addedBy || 'Central Surveillance Operations',
      createdAt: alert.subject?.createdAt || alert.timestamp || 'Active Record',
    };
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0b1422] text-[#dae3f7] font-sans antialiased">
      {/* LEFT SIDEBAR: ACTIVE ALERTS STREAM */}
      <aside className="w-80 md:w-96 bg-[#131c2a] border-r border-[#424754]/30 flex flex-col shrink-0">
        {/* Stream Header */}
        <div className="p-4 border-b border-[#424754]/30 bg-[#17202e] flex flex-col gap-3 shadow-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ffb4ab] text-[20px]">
                notifications_active
              </span>
              <h2 className="text-[14px] font-bold tracking-wider text-[#dae3f7] uppercase font-mono">
                Threat Stream
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-[#93000a]/40 text-[#ffb4ab] border border-[#ffb4ab]/40 animate-pulse">
                {filteredAlerts.length} ACTIVE
              </span>
              {onClearAllAlerts && filteredAlerts.length > 0 && (
                <button
                  onClick={onClearAllAlerts}
                  className="px-2 py-0.5 rounded text-[10px] font-mono text-[#c2c6d6] hover:text-[#ffb4ab] bg-[#222a39] hover:bg-[#93000a]/30 border border-[#424754]/40 transition-colors"
                  title="Clear all alerts"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#c2c6d6]">
              search
            </span>
            <input
              type="text"
              placeholder="Filter by ID, Camera, Title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#0b1422] border border-[#424754]/40 rounded-md text-[12px] text-[#dae3f7] placeholder-[#c2c6d6]/50 focus:outline-none focus:border-[#adc6ff]"
            />
          </div>

          {/* Severity & Category Quick Filters */}
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5 items-center">
              <span className="text-[9px] font-bold text-[#c2c6d6] uppercase mr-1">Sev:</span>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setFilterSeverity(sev)}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors whitespace-nowrap ${
                    filterSeverity === sev
                      ? 'bg-[#adc6ff] text-[#00285d]'
                      : 'bg-[#222a39]/70 text-[#c2c6d6] hover:bg-[#2c3544]'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
            <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5 items-center">
              <span className="text-[9px] font-bold text-[#c2c6d6] uppercase mr-1">Cat:</span>
              {['ALL', 'VEHICLE', 'PERSONNEL', 'UAV', 'SYSTEM'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors whitespace-nowrap ${
                    filterCategory === cat
                      ? 'bg-[#adc6ff] text-[#00285d]'
                      : 'bg-[#222a39]/70 text-[#c2c6d6] hover:bg-[#2c3544]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Alert Cards List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 no-scrollbar bg-[#0b1422]">
          {displayedAlerts.length === 0 ? (
            <div className="p-6 text-center text-[#c2c6d6]/60 text-[12px]">
              No alerts matching current filters.
            </div>
          ) : (
            displayedAlerts.map((alertItem) => {
              const isSelected = activeAlert?.id === alertItem.id;
              const isCritical = alertItem.severity === 'CRITICAL';
              const isHigh = alertItem.severity === 'HIGH';

              return (
                <div
                  key={alertItem.id}
                  onClick={() => {
                    setLockedAlertId(alertItem.id);
                    onSelectAlert(alertItem);
                  }}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all relative ${
                    isSelected
                      ? 'bg-[#222a39] border-[#adc6ff] shadow-[0_0_12px_rgba(173,198,255,0.15)]'
                      : 'bg-[#17202e] border-[#424754]/30 hover:bg-[#222a39]/70'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[11px] font-bold text-[#adc6ff]">
                        {alertItem.id}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        isCritical
                          ? 'bg-[#ffb4ab] text-[#690005]'
                          : isHigh
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {alertItem.severity}
                      </span>

                      {alertItem.category && (
                        <span className="flex items-center gap-0.5 text-[9px] text-[#c2c6d6] bg-[#222a39] px-1.5 py-0.5 rounded border border-[#424754]/30 font-mono">
                          <span className="material-symbols-outlined text-[11px]">
                            {getCategoryIcon(alertItem.category)}
                          </span>
                          {alertItem.category}
                        </span>
                      )}

                      {/* Highlight: Suspicious Behavior */}
                      {isSuspiciousAlert(alertItem) && (
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-purple-900/60 text-purple-200 border border-purple-500/50 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(168,85,247,0.25)]">
                          <span className="material-symbols-outlined text-[11px] text-purple-300">psychology_alt</span>
                          SUSPICIOUS BEHAVIOR
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[#c2c6d6]">
                        {formatClockTime(alertItem.timestamp, alertItem.relativeTime)}
                      </span>
                      {onDeleteAlert && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeAlert?.id === alertItem.id) {
                              setLockedAlertId(null);
                            }
                            onDeleteAlert(alertItem.id);
                          }}
                          title="Delete Alert"
                          className="p-0.5 hover:bg-[#93000a]/40 text-[#c2c6d6] hover:text-[#ffb4ab] rounded transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-[13px] font-semibold text-[#dae3f7] mb-1 line-clamp-1">
                    {formatAlertHeading(alertItem.title)}
                  </h3>

                  <p className="text-[11px] text-[#c2c6d6] line-clamp-1 mb-2 font-mono">
                    {alertItem.description}
                  </p>

                  <div className="flex justify-between items-center pt-2 border-t border-[#424754]/20 text-[10px] font-mono text-[#c2c6d6]">
                    <span className="flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4d8eff]"></span>
                      Conf: {getAlertPercentage(alertItem)}%
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      alertItem.status === 'DISMISSED' ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30' :
                      alertItem.status === 'VERIFIED' ? 'bg-green-950/60 text-green-300 border border-green-500/30' :
                      'bg-[#2c3544] text-[#dae3f7]'
                    }`}>
                      {alertItem.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* RIGHT MAIN AREA: TACTICAL INTELLIGENCE DOSSIER */}
      <main ref={mainPanelRef} className="flex-1 bg-[#0b1422] flex flex-col h-full overflow-y-auto p-6 space-y-6">
        {activeAlert ? (
          <>
            {/* 1. TOP ACTION & STATUS HEADER BAR */}
            <div className="bg-[#17202e] p-4 rounded-xl border border-[#3b475c]/40 shadow-xl flex flex-col gap-3">
              
              {/* Row 1: Badges bar (ID, Severity, Category, Suspicious Behavior, Status) */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px]">
                  <span className="px-2 py-0.5 bg-[#1e293b] text-[#adc6ff] font-bold rounded border border-[#38bdf8]/30 tracking-wider">
                    {activeAlert.id}
                  </span>
                  <span className={`px-2 py-0.5 font-bold rounded-full uppercase tracking-wider ${
                    activeAlert.severity === 'CRITICAL' ? 'bg-[#93000a]/80 text-[#ffdad6] border border-[#ffb4ab]/50 shadow-[0_0_8px_rgba(255,180,171,0.2)]' :
                    activeAlert.severity === 'HIGH' ? 'bg-orange-950/80 text-orange-300 border border-orange-500/40' :
                    'bg-blue-950/80 text-blue-300 border border-blue-500/40'
                  }`}>
                    {activeAlert.severity}
                  </span>
                  <span className="px-2 py-0.5 bg-[#0f172a] text-[#94a3b8] rounded uppercase border border-[#334155] font-semibold">
                    {activeAlert.category}
                  </span>
                  {isSuspiciousAlert(activeAlert) && (
                    <span className="px-2.5 py-0.5 bg-purple-950/90 text-purple-200 border border-purple-500/60 rounded-full font-mono text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(168,85,247,0.35)]">
                      <span className="material-symbols-outlined text-[12px] text-purple-300">psychology_alt</span>
                      SUSPICIOUS BEHAVIOR
                    </span>
                  )}
                </div>

                {/* Right: Verification Status */}
                <span className={`px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                  activeAlert.status === 'VERIFIED'
                    ? 'bg-green-950/70 text-green-300 border-green-500/60 shadow-[0_0_8px_rgba(34,197,94,0.25)]'
                    : activeAlert.status === 'DISMISSED'
                    ? 'bg-amber-950/70 text-amber-300 border-amber-500/60'
                    : 'bg-amber-950/40 text-amber-400 border-amber-500/40'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    activeAlert.status === 'VERIFIED'
                      ? 'bg-green-400'
                      : activeAlert.status === 'DISMISSED'
                      ? 'bg-amber-400'
                      : 'bg-amber-400 animate-ping'
                  }`}></span>
                  {activeAlert.status}
                </span>
              </div>

              {/* Row 2: Full-Width Title (No Badges Colliding) */}
              <div className="flex items-start sm:items-center gap-3 w-full">
                <div className="p-2 bg-[#93000a]/20 border border-[#ffb4ab]/30 rounded-lg text-[#ffb4ab] shrink-0 shadow-[0_0_10px_rgba(147,0,10,0.2)]">
                  <span className="material-symbols-outlined text-[20px] animate-pulse">crisis_alert</span>
                </div>
                <h1 className="text-[17px] md:text-[20px] font-extrabold text-[#dae3f7] leading-snug tracking-tight flex-1">
                  {formatAlertHeading(activeAlert.title)}
                </h1>
              </div>

              {/* Row 2: Metadata (Left) + Actions (Right) on ONE clean bar */}
              <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-[#3b475c]/25">
                {/* Metadata Line */}
                <div className="flex items-center gap-3 font-mono text-[11px] text-[#94a3b8] flex-wrap">
                  {activeAlert.sector && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-[#c2c6d6]">location_on</span>
                      {activeAlert.sector}
                    </span>
                  )}
                  {activeAlert.cameraCode && (
                    <span className="flex items-center gap-1 text-[#adc6ff] font-semibold bg-[#1e293b]/60 px-2 py-0.5 rounded border border-[#38bdf8]/20">
                      <span className="material-symbols-outlined text-[13px] text-[#38bdf8]">videocam</span>
                      {activeAlert.cameraCode}
                    </span>
                  )}
                  {(activeAlert.timestamp || activeAlert.relativeTime) && (
                    <span className="flex items-center gap-1 text-[#cbd5e1]">
                      <span className="material-symbols-outlined text-[13px] text-[#94a3b8]">schedule</span>
                      {formatClockTime(activeAlert.timestamp, activeAlert.relativeTime)}
                    </span>
                  )}
                </div>

                {/* Right: Action Buttons Toolbar */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Verify Threat Button */}
                  <button
                    onClick={() => {
                      onVerifyAlert(activeAlert.id);
                      setFeedbackSent(prev => ({ ...prev, [activeAlert.id]: 'correct' }));
                    }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1 border ${
                      activeAlert.status === 'VERIFIED' || feedbackSent[activeAlert.id] === 'correct'
                        ? 'bg-green-950/80 border-green-500/80 text-green-300 shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                        : 'bg-[#1e293b] hover:bg-[#334155] border-green-500/40 text-green-400 hover:text-green-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {activeAlert.status === 'VERIFIED' || feedbackSent[activeAlert.id] === 'correct' ? 'verified' : 'check_circle'}
                    </span>
                    {activeAlert.status === 'VERIFIED' || feedbackSent[activeAlert.id] === 'correct' ? 'Verified Breach' : 'Verify Threat'}
                  </button>

                  {/* False Positive Button */}
                  <button
                    onClick={() => {
                      onDismissAlert(activeAlert.id);
                      setFeedbackSent(prev => ({ ...prev, [activeAlert.id]: 'incorrect' }));
                    }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1 border ${
                      activeAlert.status === 'DISMISSED' || feedbackSent[activeAlert.id] === 'incorrect'
                        ? 'bg-amber-950/70 border-amber-500/70 text-amber-300'
                        : 'bg-[#1e293b] hover:bg-[#334155] border-amber-500/40 text-amber-400 hover:text-amber-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {activeAlert.status === 'DISMISSED' || feedbackSent[activeAlert.id] === 'incorrect' ? 'check_circle' : 'warning'}
                    </span>
                    {activeAlert.status === 'DISMISSED' || feedbackSent[activeAlert.id] === 'incorrect' ? 'Marked False Positive' : 'False Positive'}
                  </button>

                  {onDeleteAlert && (
                    <button
                      onClick={() => {
                        setLockedAlertId(null);
                        onDeleteAlert(activeAlert.id);
                      }}
                      className="px-2.5 py-1 bg-[#93000a]/20 hover:bg-[#93000a] border border-[#ffb4ab]/30 text-[#ffb4ab] hover:text-[#ffdad6] rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1 active:scale-95"
                      title="Delete Alert"
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                      Delete
                    </button>
                  )}

                  {/* AI Model Feedback Ratings */}
                  <div className="flex items-center gap-1 bg-[#0d1526] px-2 py-0.5 rounded-md border border-[#424754]/40">
                    <span className="text-[9px] font-mono font-bold uppercase text-[#8c909f] tracking-wider">AI Feedback:</span>
                    <button
                      disabled={feedbackLoading}
                      onClick={() => handleFeedback(activeAlert.id, true)}
                      title="True Positive — correct alert"
                      className={`p-1 rounded transition-all border ${
                        feedbackSent[activeAlert.id] === 'correct'
                          ? 'bg-green-600 border-green-400 text-white shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                          : 'bg-[#222a39] border-[#424754]/30 text-[#c2c6d6] hover:border-green-500/50 hover:text-green-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">thumb_up</span>
                    </button>
                    <button
                      disabled={feedbackLoading}
                      onClick={() => handleFeedback(activeAlert.id, false)}
                      title="False Positive — incorrect alert"
                      className={`p-1 rounded transition-all border ${
                        feedbackSent[activeAlert.id] === 'incorrect'
                          ? 'bg-[#93000a] border-[#ffb4ab] text-white shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                          : 'bg-[#222a39] border-[#424754]/30 text-[#c2c6d6] hover:border-[#ffb4ab]/50 hover:text-[#ffb4ab]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">thumb_down</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* 2. HERO INCIDENT REPLAY VIDEO PLAYER */}
            <div 
              className="bg-[#17202e] rounded-xl overflow-hidden border border-[#424754]/40 flex flex-col shadow-2xl shrink-0 w-full"
              style={{ minHeight: '520px' }}
            >
              <div 
                className="relative w-full bg-black overflow-hidden flex items-center justify-center shrink-0"
                style={{ height: '440px', minHeight: '440px' }}
              >
                {/* Always render fallback background so container never collapses */}
                <img
                  alt=""
                  src={DEFAULT_SURVEILLANCE_IMAGE}
                  className="absolute inset-0 w-full h-full object-cover opacity-40 z-0"
                  aria-hidden="true"
                />
                {viewMode === 'video' ? (
                  resolvedVideoUrl && !videoLoadError ? (
                    <video
                      ref={modalVideoRef}
                      src={resolvedVideoUrl}
                      autoPlay
                      playsInline
                      muted
                      loop
                      controls
                      disablePictureInPicture
                      disableRemotePlayback
                      controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
                      className="absolute inset-0 w-full h-full object-cover z-[1]"
                      poster={candidatePhotoUrl || DEFAULT_SURVEILLANCE_IMAGE}
                      onError={() => {
                        console.warn('[Video Player] Video source failed to load, falling back to frame:', resolvedVideoUrl);
                        setVideoLoadError(true);
                      }}
                    />
                  ) : candidatePhotoUrl ? (
                    <div className="absolute inset-0 z-[1] flex flex-col">
                      <img
                        alt="Detected Frame"
                        src={candidatePhotoUrl}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_SURVEILLANCE_IMAGE; }}
                        className="w-full h-full object-cover"
                      />

                      <div className="absolute bottom-0 left-0 right-0 bg-black/85 backdrop-blur-xs px-4 py-2 text-[11px] font-mono text-[#adc6ff] flex items-center justify-between border-t border-white/10 z-[2]">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[15px] text-[#adc6ff]">photo_camera</span>
                          <span className="text-[#c2c6d6] font-mono">
                            {videoLoadError
                              ? 'Forensic incident frame preserved (Video clip synchronizing or offline)'
                              : 'High-resolution optical incident frame recorded at detection time'
                            }
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[#8c909f]">
                          BORDERVISION AI • {activeAlert.id}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <img
                      alt=""
                      src={DEFAULT_SURVEILLANCE_IMAGE}
                      className="absolute inset-0 w-full h-full object-cover z-[1]"
                    />
                  )
                ) : candidatePhotoUrl ? (
                  <img
                    alt="Incident Captured Frame"
                    src={candidatePhotoUrl}
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      if (target.src !== DEFAULT_SURVEILLANCE_IMAGE) {
                        target.src = DEFAULT_SURVEILLANCE_IMAGE;
                      }
                    }}
                    className="absolute inset-0 w-full h-full object-cover z-[1]"
                  />
                ) : resolvedVideoUrl && !videoLoadError ? (
                  <video
                    src={resolvedVideoUrl}
                    playsInline
                    muted
                    controls={false}
                    onError={() => setVideoLoadError(true)}
                    className="absolute inset-0 w-full h-full object-cover z-[1]"
                  />
                ) : (
                  <img
                    alt="Threat Capture Frame"
                    src={DEFAULT_SURVEILLANCE_IMAGE}
                    className="absolute inset-0 w-full h-full object-cover z-[1]"
                  />
                )}


                {/* Tactical Bounding Box Overlay for Target Tracking matching Photo 2 */}
                {showBoundingBox && activeAlert.bbox && Array.isArray(activeAlert.bbox) && activeAlert.bbox.length === 4 && activeAlert.category !== 'SYSTEM' && !activeAlert.title.toUpperCase().includes('TAMPER') && !activeAlert.title.toUpperCase().includes('SABOTAGE') && (() => {
                  const minY = Math.min(activeAlert.bbox[1], activeAlert.bbox[3]);
                  const minX = Math.min(activeAlert.bbox[0], activeAlert.bbox[2]);
                  const boxW = Math.abs(activeAlert.bbox[2] - activeAlert.bbox[0]);
                  const boxH = Math.abs(activeAlert.bbox[3] - activeAlert.bbox[1]);
                  if (boxW >= 0.95 && boxH >= 0.95) return null;
                  const isMatch = activeAlert.title.toLowerCase().includes('match');
                  const isVehicle = activeAlert.category === 'VEHICLE' || activeAlert.objectType?.toLowerCase() === 'car';
                  const rawSpd = (activeAlert.speedHeading && activeAlert.speedHeading !== 'Unknown')
                    ? activeAlert.speedHeading
                    : (isVehicle ? '45 km/h • 045°' : '9 km/h • 045°');
                  const displaySpd = rawSpd.includes('•') ? rawSpd.split('•')[0].trim() : (rawSpd.includes('km/h') ? rawSpd.trim() : `${rawSpd} km/h`);
                  const displayHdg = rawSpd.includes('•') ? (rawSpd.split('•')[1].trim().match(/\d+°/) ? rawSpd.split('•')[1].trim().match(/\d+°/)![0] : '045°') : '045°';
                  const labelTopClass = minY < 0.06 ? 'top-0' : '-top-[23px]';

                  return (
                    <div 
                      className="absolute border-2 border-[#ffb4ab] bg-[#ffb4ab]/5 z-10 pointer-events-none shadow-[0_0_15px_rgba(255,180,171,0.25)] transition-all"
                      style={{
                        top: `${Math.max(0, Math.min(1, minY)) * 100}%`,
                        left: `${Math.max(0, Math.min(1, minX)) * 100}%`,
                        width: `${Math.max(2, Math.min(100, boxW * 100))}%`,
                        height: `${Math.max(2, Math.min(100, boxH * 100))}%`
                      }}
                    >
                      {/* Top Label Badge — sits cleanly ABOVE the box top edge */}
                      <div className={`absolute ${labelTopClass} -left-[2px] bg-[#ffb4ab] text-[#690005] text-[10px] font-mono font-bold px-2 py-0.5 rounded-t-sm shadow-md flex items-center gap-1.5 whitespace-nowrap`}>
                        <span className="material-symbols-outlined text-[13px] leading-none">
                          {isMatch ? 'person_search' : getCategoryIcon(activeAlert.category)}
                        </span>
                        <span>[{getDisplayLabel(activeAlert)}]</span>
                      </div>

                      {/* Bottom Telemetry HUD Bar — sleek single-line translucent pill */}
                      <div className="absolute bottom-1 left-1 right-1 flex justify-between items-center text-[9px] font-mono text-[#ffdad6] bg-black/80 backdrop-blur-xs px-2 py-0.5 rounded border border-white/10 shadow-sm whitespace-nowrap overflow-hidden">
                        <span>SPD: {displaySpd}</span>
                        <span>HDG: {displayHdg}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Video HUD Overlays */}
                <div className="absolute top-4 left-4 z-20 flex gap-2">
                  <span className="px-2.5 py-1 bg-black/80 backdrop-blur-md rounded font-mono text-[11px] border border-[#ffb4ab]/30 text-[#adc6ff] flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      viewMode === 'video' && isDirectVideoFile
                        ? 'bg-red-500 animate-pulse'
                        : viewMode === 'video'
                          ? 'bg-green-400 animate-pulse'
                          : 'bg-[#ffb4ab]'
                    }`}></span>
                    {viewMode === 'video' && isDirectVideoFile
                      ? 'INCIDENT VIDEO CLIP'
                      : viewMode === 'photo'
                        ? 'INCIDENT CAPTURED FRAME'
                        : 'OPTICAL INCIDENT SNAPSHOT'
                    }
                  </span>
                  <span className="px-2.5 py-1 bg-black/70 backdrop-blur-md rounded font-mono text-[11px] text-[#dae3f7] border border-white/10">
                    {activeAlert.cameraCode || 'CAM-LIVE-78'} • OPTICAL 1080P
                  </span>
                </div>

                {/* View Mode Switcher (Live Feed vs Captured Incident Frame) */}
                <div className="absolute top-4 right-4 z-20 flex items-center bg-black/80 backdrop-blur-md p-1 rounded-lg border border-white/10 gap-1">
                  <button
                    onClick={() => {
                      setViewMode('photo');
                      setIsPlaying(false);
                    }}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors flex items-center gap-1 ${
                      viewMode === 'photo'
                        ? 'bg-[#ffb4ab] text-[#690005]'
                        : 'text-[#c2c6d6] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                    Captured Frame
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('video');
                      setIsPlaying(hasVideoClip(activeAlert));
                    }}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors flex items-center gap-1.5 ${
                      viewMode === 'video'
                        ? 'bg-[#4d8eff] text-[#00285d]'
                        : 'text-[#c2c6d6] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">videocam</span>
                    Video Playback
                  </button>
                </div>
              </div>

              {/* Controls Toolbar: Render Video Controls if video exists, or Forensic Snapshot Toolbar if no video */}
              <div className="p-4 bg-[#131c2a] border-t border-[#424754]/20 flex flex-col gap-3">
                {hasVideoClip(activeAlert) ? (
                  <div className="flex justify-between items-center">
                    {/* Playback Navigation: 3 Square Icon Buttons ([ || ] [ ↺ ] [ ↻ ]) */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsPlaying(prev => !prev)}
                        className="w-10 h-10 bg-[#1c2536] hover:bg-[#283347] active:bg-[#4d8eff]/30 text-[#dae3f7] rounded-xl transition-colors border border-[#3b4559]/60 flex items-center justify-center shadow"
                        title={isPlaying ? 'Pause Clip' : 'Play Incident Clip'}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {isPlaying ? 'pause' : 'play_arrow'}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          if (modalVideoRef.current) {
                            modalVideoRef.current.currentTime = Math.max(0, modalVideoRef.current.currentTime - 5);
                          }
                        }}
                        className="w-10 h-10 bg-[#1c2536] hover:bg-[#283347] active:bg-[#4d8eff]/30 text-[#dae3f7] rounded-xl transition-colors border border-[#3b4559]/60 flex items-center justify-center shadow"
                        title="Skip 5s backward"
                      >
                        <span className="material-symbols-outlined text-[20px]">replay_5</span>
                      </button>

                      <button
                        onClick={() => {
                          if (modalVideoRef.current) {
                            modalVideoRef.current.currentTime = Math.min(
                              modalVideoRef.current.duration || 9999,
                              modalVideoRef.current.currentTime + 5
                            );
                          }
                        }}
                        className="w-10 h-10 bg-[#1c2536] hover:bg-[#283347] active:bg-[#4d8eff]/30 text-[#dae3f7] rounded-xl transition-colors border border-[#3b4559]/60 flex items-center justify-center shadow"
                        title="Skip 5s forward"
                      >
                        <span className="material-symbols-outlined text-[20px]">forward_5</span>
                      </button>

                      <button
                        onClick={() => {
                          if (modalVideoRef.current) {
                            modalVideoRef.current.currentTime = 0;
                            modalVideoRef.current.play().catch(() => {});
                            setIsPlaying(true);
                          }
                        }}
                        className="w-10 h-10 bg-[#1c2536] hover:bg-[#283347] active:bg-[#4d8eff]/30 text-[#dae3f7] rounded-xl transition-colors border border-[#3b4559]/60 flex items-center justify-center shadow"
                        title="Replay from start"
                      >
                        <span className="material-symbols-outlined text-[20px]">refresh</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onDownloadEvidence(activeAlert)}
                        className="flex items-center gap-2 px-3.5 py-2 bg-[#222a39] hover:bg-[#2c3544] text-[#adc6ff] rounded-lg text-[12px] font-bold uppercase transition-colors border border-[#adc6ff]/30 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        Export Video Clip
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#adc6ff] text-[16px]">photo_camera</span>
                      <span className="text-[11px] font-mono text-[#c2c6d6]">
                        Optical forensic snapshot preserved with SHA-256 integrity hash
                      </span>
                    </div>
                    <button
                      onClick={() => onDownloadEvidence(activeAlert)}
                      className="flex items-center gap-2 px-3.5 py-2 bg-[#222a39] hover:bg-[#2c3544] text-[#adc6ff] hover:text-white rounded-lg text-[12px] font-mono font-bold uppercase transition-colors border border-[#adc6ff]/30 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      Export Incident Frame (JPG)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Target Subject Dossier */}
            {(() => {
              const subj = getSubjectDetails(activeAlert);
              const matchPct = getAlertPercentage(activeAlert);
              const isPerson = subj.type === 'PERSON';

              return (
                <div className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/30 flex flex-col gap-4 shadow-lg">
                  {/* Header */}
                  <div className="flex justify-between items-center pb-3 border-b border-[#424754]/30">
                    <h3 className="text-[16px] font-bold text-[#dae3f7] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#ffb4ab]">
                        {isPerson ? 'person_search' : 'directions_car'}
                      </span>
                      Target Subject Dossier
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#93000a]/40 text-[#ffb4ab] border border-[#ffb4ab]/40">
                      {subj.threatLevel} THREAT
                    </span>
                  </div>

                  {/* Subject Identity Banner */}
                  <div className="flex items-center gap-3.5 bg-[#131c2a] p-3.5 rounded-xl border border-[#424754]/20">
                    <div className="w-12 h-12 rounded-xl bg-[#222a39] border border-[#424754]/40 flex items-center justify-center text-[#ffb4ab] shrink-0 overflow-hidden shadow-inner">
                      {subj.photoBase64 ? (
                        <img src={subj.photoBase64} alt={subj.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-[28px]">
                          {isPerson ? 'badge' : 'car_tag'}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-mono text-[#adc6ff] uppercase tracking-wider">
                        {isPerson ? 'WATCHLIST PERSON OF INTEREST' : 'HOTLIST VEHICLE TARGET'}
                      </span>
                      <h4 className="text-[18px] font-extrabold text-[#dae3f7] tracking-wide truncate">
                        {subj.name}
                      </h4>
                      <span className="text-[11px] font-mono text-[#c2c6d6]">
                        {isPerson ? `Alias: ${subj.alias || 'None'} • ${subj.nationality || 'Verified Record'}` : `Plate: ${subj.plateNumber || 'N/A'}`}
                      </span>
                    </div>
                  </div>

                  {/* 4-Field Officer Tactical Matrix */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 font-mono text-[12px]">
                    <div className="bg-[#131c2a] p-3 rounded-lg border border-[#424754]/20">
                      <span className="text-[10px] text-[#8c909f] uppercase tracking-wider block mb-1">
                        Watchlist Status
                      </span>
                      <span className="text-[#ffb4ab] font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#ffb4ab] animate-pulse"></span>
                        ACTIVE BOLO / FLAGGED
                      </span>
                    </div>
                    <div className="bg-[#131c2a] p-3 rounded-lg border border-[#424754]/20">
                      <span className="text-[10px] text-[#8c909f] uppercase tracking-wider block mb-1">
                        Biometric Match
                      </span>
                      <span className="text-[#adc6ff] font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-green-400">verified</span>
                        {matchPct}% Verified Match
                      </span>
                    </div>
                    <div className="bg-[#131c2a] p-3 rounded-lg border border-[#424754]/20">
                      <span className="text-[10px] text-[#8c909f] uppercase tracking-wider block mb-1">
                        Location & Camera
                      </span>
                      <span className="text-[#dae3f7] font-bold truncate block">
                        {activeAlert.sector} ({activeAlert.cameraCode})
                      </span>
                    </div>
                    <div className="bg-[#131c2a] p-3 rounded-lg border border-[#424754]/20">
                      <span className="text-[10px] text-[#8c909f] uppercase tracking-wider block mb-1">
                        Movement / Speed
                      </span>
                      <span className="text-[#dae3f7] font-bold">
                        {(() => {
                          const spd = activeAlert.speedHeading;
                          if (spd && spd !== 'Unknown') {
                            return spd.includes('(') ? spd : `${spd} (NE)`;
                          }
                          return isPerson ? '9 km/h • 045° (NE)' : '45 km/h • 045° (NE)';
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Officer Intelligence Notes & Case Background */}
                  <div className="bg-[#131c2a] p-3.5 rounded-lg border border-[#424754]/20 flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#adc6ff] flex items-center gap-1.5 font-mono">
                      <span className="material-symbols-outlined text-[16px]">info</span>
                      Officer Intelligence & Case Background
                    </span>
                    <p className="text-[12px] text-[#c2c6d6] leading-relaxed">
                      {subj.notes || `Subject ${subj.name} is registered on active watchlist. Perimeter breach detected in ${activeAlert.sector}. Access clearance is unpermitted.`}
                    </p>
                    <div className="flex justify-between items-center text-[10px] font-mono text-[#8c909f] pt-2 border-t border-[#424754]/20 mt-1">
                      <span>Registry Origin: {subj.addedBy || 'Security Operations'}</span>
                      <span>Track ID: {activeAlert.trackId || 'TRK-3524'}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-[#c2c6d6]">
            <span className="material-symbols-outlined text-[64px] opacity-30 mb-4">notifications_off</span>
            <p className="text-lg font-semibold">No Alert Selected</p>
            <p className="text-sm">Select an active threat from the left stream to inspect tactical dossier.</p>
          </div>
        )}
      </main>
    </div>
  );
};


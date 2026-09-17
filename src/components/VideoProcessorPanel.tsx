import React, { useState, useEffect, useRef, useCallback } from 'react';
import { processVideo, getVideoStatus, uploadVideo, processSampleVideo, VideoJob, UploadProgress, getApiBaseUrl } from '../api/client';

interface VideoProcessorPanelProps {
  onAlertsGenerated?: (count: number) => void;
}

type InputMode = 'upload' | 'path';

export const VideoProcessorPanel: React.FC<VideoProcessorPanelProps> = ({
  onAlertsGenerated,
}) => {
  // Mode toggle: drag-and-drop upload vs file path
  const [mode, setMode] = useState<InputMode>('upload');

  // Upload mode state
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [liveDetections, setLiveDetections] = useState<{ class: string; confidence: number; bbox: number[]; match_name?: string; match_score?: number }[]>([]);

  // Path mode state
  const [videoPath, setVideoPath] = useState('');

  // Shared state
  const [job, setJob] = useState<VideoJob | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setVideoPreviewUrl(url);
      setLiveDetections([]);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setVideoPreviewUrl(null);
      setLiveDetections([]);
    }
  }, [selectedFile]);

  const [displayMode, setDisplayMode] = useState<'player' | 'stream'>('player');
  const isDetectingRef = useRef(false);

  // Automatically switch to live stream while background analysis job is actively running
  useEffect(() => {
    if (job?.status === 'running') {
      setDisplayMode('stream');
    }
  }, [job?.status]);

  // ── Frame detection trigger on video playback / seek ──────────────────────
  const runFrameDetection = useCallback(async () => {
    // Only detect if analysis is actively running or complete
    if (!job || (job.status !== 'running' && job.status !== 'complete')) {
      setLiveDetections([]);
      return;
    }
    if (isDetectingRef.current) return;
    const vid = videoRef.current;
    if (!vid || vid.readyState < 2 || vid.seeking) return;

    isDetectingRef.current = true;
    try {
      const canvas = canvasRef.current || document.createElement('canvas');
      // High-speed 640x360 downsampled probe for ultra-low latency tracking
      const targetW = 640;
      const targetH = 360;
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        isDetectingRef.current = false;
        return;
      }

      ctx.drawImage(vid, 0, 0, targetW, targetH);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.65);

      const payload = {
        image_base64: dataUrl,
        camera_code: 'CAM-ANALYSIS',
        create_alert: false, // Never create duplicate DB alerts from video frame probes
      };

      const res = await fetch(`${getApiBaseUrl()}/detect/frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.detections)) {
          setLiveDetections(data.detections);
        }
      }
    } catch (e) {
      // Ignore transient errors
    } finally {
      isDetectingRef.current = false;
    }
  }, [job]);

  // ── High-frequency tracking loop ONLY when video analysis is running or complete ──
  useEffect(() => {
    if (!videoPreviewUrl || !job || (job.status !== 'running' && job.status !== 'complete')) {
      setLiveDetections([]);
      return;
    }

    const interval = setInterval(runFrameDetection, 250);
    return () => clearInterval(interval);
  }, [videoPreviewUrl, job?.status, runFrameDetection]);

  // ── Poll job status while running ─────────────────────────────────────────
  useEffect(() => {
    const shouldPoll = job?.status === 'queued' || job?.status === 'running';
    if (shouldPoll && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        const status = await getVideoStatus();
        if (status) {
          setJob(status);
          if (status.status === 'complete' || status.status === 'error') {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            if (status.alerts_generated > 0) {
              onAlertsGenerated?.(status.alerts_generated);
              window.dispatchEvent(new CustomEvent('border_vision_alert_triggered', {
                detail: {
                  id: status.job_id,
                  title: status.alert_summary || `${status.alerts_generated} Incident Alerts Generated`,
                  severity: status.alert_summary?.includes('Watchlist') ? 'CRITICAL' : 'HIGH'
                }
              }));
            }
          }
        }
      }, 1200);
    }
    return () => {
      if (!shouldPoll && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [job?.status]);

  // ── Drag-and-drop handlers ────────────────────────────────────────────────
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const ALLOWED_EXTENSIONS = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.wmv', '.flv'];
  const MAX_SIZE_MB = 500;

  const validateAndSetFile = (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported format "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Maximum: ${MAX_SIZE_MB}MB`);
      return;
    }
    setSelectedFile(file);
    setError(null);
    setJob(null);
    setUploadProgress(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── Start detection (upload mode) ─────────────────────────────────────────
  const handleUploadStart = async () => {
    if (!selectedFile) {
      setError('Please select a video file first.');
      return;
    }

    if (selectedFile.size > 150 * 1024 * 1024) {
      setError(`File is too large (${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB). For cloud processing, please upload a video under 150MB or use the Preset Highway Surveillance sample.`);
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress({ loaded: 0, total: selectedFile.size, percent: 0 });

    try {
      console.log('[VideoProcessor] Starting upload of', selectedFile.name, selectedFile.size, 'bytes');
      const result = await uploadVideo(selectedFile, (progress) => {
        setUploadProgress(progress);
      });

      console.log('[VideoProcessor] Upload result:', result);
      setIsUploading(false);

      if (!result || result.error || !result.job_id) {
        setError(result?.error || 'Upload failed. Please check network connection or verify video format.');
        setUploadProgress(null);
        return;
      }

      setUploadProgress(null);
      setJob({
        job_id: result.job_id,
        status: 'queued',
        progress: 0,
        current_frame: 0,
        total_frames: 0,
        alerts_generated: 0,
      });
    } catch (err: any) {
      console.error('[VideoProcessor] Upload exception:', err);
      setIsUploading(false);
      setUploadProgress(null);
      setError(`Upload error: ${err?.message || 'Unknown error'}`);
    }
  };

  // ── Start detection (path mode) ───────────────────────────────────────────
  const handlePathStart = async () => {
    if (!videoPath.trim()) {
      setError('Please enter a valid video file path.');
      return;
    }
    setError(null);
    setIsStarting(true);
    const result = await processVideo(videoPath.trim());
    setIsStarting(false);

    if (!result || result.error || !result.job_id) {
      setError(result?.error || 'Backend unreachable. Start the Python backend first.');
      return;
    }

    setJob({
      job_id: result.job_id,
      status: 'queued',
      progress: 0,
      current_frame: 0,
      total_frames: 0,
      alerts_generated: 0,
    });
  };

  // ── Start detection on pre-loaded sample video ───────────────────────────
  const handleSampleStart = async () => {
    setError(null);
    setIsStarting(true);
    const result = await processSampleVideo();
    setIsStarting(false);

    if (!result || result.error || !result.job_id) {
      setError(
        result?.error ||
        'Could not start sample video detection. If using Render free tier, the instance may be starting up (cold start); please try again in a few seconds.'
      );
      return;
    }

    if (result.filename) {
      const apiBase = getApiBaseUrl();
      const origin = apiBase.startsWith('http') ? apiBase.replace(/\/api\/?$/, '') : '';
      setVideoPreviewUrl(`${origin}/uploads/${result.filename}`);
    }

    setJob({
      job_id: result.job_id,
      status: 'queued',
      progress: 0,
      current_frame: 0,
      total_frames: 0,
      alerts_generated: 0,
    });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadProgress(null);
    setJob(null);
    setError(null);
    setVideoPath('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isRunning = job?.status === 'queued' || job?.status === 'running';
  const isComplete = job?.status === 'complete';
  const isError = job?.status === 'error';
  const isBusy = isRunning || isUploading || isStarting;

  const progressPct = job?.progress ?? 0;
  const progressColor =
    isError ? '#ffb4ab' : isComplete ? '#4ade80' : '#4d8eff';

  return (
    <div className="bg-[#131c2a] rounded-xl border border-[#424754]/30 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 bg-[#17202e] border-b border-[#424754]/20 flex items-center gap-3">
        <span className="material-symbols-outlined text-[#adc6ff] text-[20px]">
          smart_display
        </span>
        <div className="flex-1">
          <h2 className="text-[15px] font-bold text-[#dae3f7]">
            Video Analysis Engine
          </h2>
          <p className="text-[11px] text-[#c2c6d6] font-mono">
            YOLOv8n + ByteTrack • Suspicious Behaviour & Threat Intrusion Detection
          </p>
        </div>
        {isRunning && (
          <span className="flex items-center gap-1.5 text-[#4d8eff] text-[11px] font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-[#4d8eff] animate-ping" />
            PROCESSING
          </span>
        )}
        {isUploading && (
          <span className="flex items-center gap-1.5 text-[#f5c842] text-[11px] font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-[#f5c842] animate-ping" />
            UPLOADING
          </span>
        )}
        {isComplete && (
          <span className="flex items-center gap-1.5 text-green-400 text-[11px] font-mono font-bold">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            COMPLETE
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* ═══ Video Viewport (Stream or Direct Playback) ═══ */}
        {((job && job.status !== 'idle') || videoPreviewUrl) && (
          <div className="relative w-full h-[520px] rounded-xl overflow-hidden border border-[#424754]/30 bg-black shadow-xl flex items-center justify-center">
            {displayMode === 'stream' && (isRunning || isComplete) ? (
              <img
                src={`${getApiBaseUrl()}/video/stream`}
                alt="AI Video Analysis Stream"
                className="w-full h-full object-contain bg-black block"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  crossOrigin="anonymous"
                  src={videoPreviewUrl || undefined}
                  controls
                  disablePictureInPicture
                  disableRemotePlayback
                  controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
                  autoPlay={Boolean(job && (job.status === 'running' || job.status === 'complete'))}
                  loop
                  playsInline
                  onLoadedData={() => { if (job && (job.status === 'running' || job.status === 'complete')) runFrameDetection(); }}
                  onSeeked={() => { if (job && (job.status === 'running' || job.status === 'complete')) runFrameDetection(); }}
                  onPlay={() => { if (job && (job.status === 'running' || job.status === 'complete')) runFrameDetection(); }}
                  onTimeUpdate={() => {
                    if (job && (job.status === 'running' || job.status === 'complete') && Math.random() < 0.25) {
                      runFrameDetection();
                    }
                  }}
                  className="w-full h-full object-contain bg-black block"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* AI Overlay SVG for Watchlist Detections (Live Surveillance style) - only during active/completed job */}
                {Boolean(job && (job.status === 'running' || job.status === 'complete')) && liveDetections.length > 0 && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none z-10"
                    preserveAspectRatio="none"
                    viewBox="0 0 1000 600"
                  >
                    {liveDetections.map((det, idx) => {
                      const [nx1, ny1, nx2, ny2] = det.bbox;
                      const x = nx1 * 1000;
                      const y = ny1 * 600;
                      const w = Math.max(20, (nx2 - nx1) * 1000);
                      const h = Math.max(20, (ny2 - ny1) * 600);
                      const matchName = det.match_name;
                      const matchScoreRaw = det.match_score;
                      const matchScore = matchScoreRaw !== undefined && matchScoreRaw !== null
                        ? (matchScoreRaw > 1 ? Math.round(matchScoreRaw) : Math.round(matchScoreRaw * 100))
                        : (det.confidence ? (det.confidence > 1 ? Math.round(det.confidence) : Math.round(det.confidence * 100)) : 94);
                      const isPerson = (det.class || '').toLowerCase().includes('person');
                      const labelText = matchName
                        ? `WATCHLIST MATCH: ${matchName.toUpperCase()} (${matchScore}%)`
                        : isPerson
                        ? `SUSPICIOUS BEHAVIOR: PERSON (${matchScore}%)`
                        : `${(det.class || 'TARGET').toUpperCase()} (${matchScore}%)`;
                      const color = '#ff3333';

                      return (
                        <g key={idx} className="transition-all duration-200 ease-out">
                          {/* Tactical Bounding Box */}
                          <rect
                            x={x}
                            y={y}
                            width={w}
                            height={h}
                            fill="rgba(255, 51, 51, 0.22)"
                            stroke={color}
                            strokeWidth="3.5"
                            className="animate-pulse transition-all duration-200 ease-out"
                          />
                          {/* Corner Reticles */}
                          <path
                            d={`M${x},${y + 18} L${x},${y} L${x + 18},${y} M${x + w - 18},${y} L${x + w},${y} L${x + w},${y + 18} M${x + w},${y + h - 18} L${x + w},${y + h} L${x + w - 18},${y + h} M${x + 18},${y + h} L${x},${y + h} L${x},${y + h - 18}`}
                            fill="none"
                            stroke={color}
                            strokeWidth="3.5"
                            className="transition-all duration-200 ease-out"
                          />
                          {/* Label Badge */}
                          <rect
                            x={x}
                            y={Math.max(0, y - 26)}
                            width={Math.max(160, labelText.length * 8.5 + 18)}
                            height="24"
                            fill="#0b1422"
                            stroke={color}
                            strokeWidth="1.5"
                            rx="3"
                            className="transition-all duration-200 ease-out"
                          />
                          <text
                            x={x + 6}
                            y={Math.max(16, y - 9)}
                            fill="#ff4d4d"
                            fontSize="11"
                            fontFamily="monospace"
                            fontWeight="bold"
                            className="transition-all duration-200 ease-out"
                          >
                            [{labelText}]
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </>
            )}

            {/* HUD overlay - top left */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md border text-[10px] font-mono font-bold uppercase tracking-wider ${
                isRunning
                  ? 'bg-[#4d8eff]/20 border-[#4d8eff]/40 text-[#4d8eff]'
                  : isComplete
                  ? 'bg-green-500/20 border-green-500/40 text-green-400'
                  : 'bg-[#ffb4ab]/20 border-[#ffb4ab]/40 text-[#ffb4ab]'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  isRunning ? 'bg-[#4d8eff] animate-pulse' : isComplete ? 'bg-green-400' : 'bg-[#ffb4ab]'
                }`} />
                {isRunning ? 'LIVE DETECTION' : isComplete ? 'ANALYSIS COMPLETE' : 'READY'}
              </div>
            </div>

            {/* View Mode Switcher (AI Stream vs Video Player) */}
            <div className="absolute top-3 right-3 z-20 flex items-center bg-black/80 backdrop-blur-md p-1 rounded-lg border border-white/10 gap-1">
              <button
                onClick={() => setDisplayMode('stream')}
                className={`px-3 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors ${
                  displayMode === 'stream'
                    ? 'bg-[#4d8eff] text-[#00285d]'
                    : 'text-[#c2c6d6] hover:text-white'
                }`}
              >
                AI STREAM
              </button>
              <button
                onClick={() => setDisplayMode('player')}
                className={`px-3 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors ${
                  displayMode === 'player'
                    ? 'bg-[#4d8eff] text-[#00285d]'
                    : 'text-[#c2c6d6] hover:text-white'
                }`}
              >
                VIDEO PLAYER
              </button>
            </div>

          </div>
        )}



        {/* ═══ Upload Mode ═══ */}
        {mode === 'upload' && !job && (
          <>
            {/* Drag-and-Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => !isBusy && fileInputRef.current?.click()}
              className={`relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}
                ${dragActive
                  ? 'border-[#4d8eff] bg-[#4d8eff]/10 scale-[1.01]'
                  : selectedFile
                    ? 'border-[#4ade80]/40 bg-[#4ade80]/5 hover:border-[#4ade80]/60'
                    : 'border-[#424754]/40 bg-[#0b1422]/60 hover:border-[#adc6ff]/40 hover:bg-[#adc6ff]/5'
                }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.avi,.mov,.mkv,.webm,.wmv,.flv,video/*"
                onChange={handleFileSelect}
                disabled={isBusy}
                className="hidden"
              />

              {selectedFile ? (
                <div className="p-6 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-[#4ade80]/10 border border-[#4ade80]/30 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[#4ade80] text-[28px]">movie</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-[#dae3f7] truncate">{selectedFile.name}</p>
                    <p className="text-[11px] font-mono text-[#c2c6d6] mt-0.5">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type || 'video'}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                    className="p-2 rounded-lg bg-[#222a39] hover:bg-[#93000a]/40 border border-[#424754]/30 hover:border-[#ffb4ab]/30 transition-colors"
                    title="Remove file"
                  >
                    <span className="material-symbols-outlined text-[#c2c6d6] hover:text-[#ffb4ab] text-[16px]">close</span>
                  </button>
                </div>
              ) : (
                <div className="py-10 px-6 flex flex-col items-center gap-3">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                    dragActive ? 'bg-[#4d8eff]/20 scale-110' : 'bg-[#222a39]'
                  }`}>
                    <span className={`material-symbols-outlined text-[32px] transition-colors ${
                      dragActive ? 'text-[#4d8eff]' : 'text-[#424754]'
                    }`}>
                      {dragActive ? 'downloading' : 'cloud_upload'}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-bold text-[#dae3f7]">
                      {dragActive ? 'Drop your video here' : 'Drag & drop a video file'}
                    </p>
                    <p className="text-[11px] text-[#c2c6d6] mt-1 font-mono">
                      or <span className="text-[#4d8eff] underline underline-offset-2">click to browse</span>
                    </p>
                  </div>
                  <p className="text-[10px] text-[#424754] font-mono">
                    MP4, AVI, MOV, MKV, WebM • Max {MAX_SIZE_MB}MB
                  </p>
                </div>
              )}

              {isUploading && uploadProgress && (
                <div className="absolute inset-0 bg-[#0b1422]/90 rounded-xl flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                  <span className="material-symbols-outlined text-[#f5c842] text-[32px] animate-pulse">cloud_upload</span>
                  <div className="w-3/4 space-y-2">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-[#c2c6d6]">Uploading to server…</span>
                      <span className="text-[#f5c842] font-bold">{uploadProgress.percent}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#222a39] rounded-full overflow-hidden border border-[#424754]/30">
                      <div
                        className="h-full rounded-full transition-all duration-300 bg-[#f5c842]"
                        style={{ width: `${uploadProgress.percent}%`, boxShadow: '0 0 8px rgba(245, 200, 66, 0.5)' }}
                      />
                    </div>
                    <p className="text-[10px] text-[#c2c6d6] font-mono text-center">
                      {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {selectedFile && !isUploading && (
              <button
                onClick={(e) => { e.stopPropagation(); handleUploadStart(); }}
                className="w-full py-3 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                Upload & Start Detection
              </button>
            )}

            {/* Quick Demo Test Button */}
            {!selectedFile && !isUploading && (
              <button
                type="button"
                onClick={handleSampleStart}
                disabled={isStarting || isRunning}
                className="w-full py-2.5 bg-[#222a39] hover:bg-[#2c3544] border border-[#adc6ff]/30 text-[#adc6ff] font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <span className={`material-symbols-outlined text-[18px] ${isStarting ? 'animate-spin' : ''}`}>
                  {isStarting ? 'sync' : 'smart_display'}
                </span>
                {isStarting ? 'Starting Detection...' : 'Run AI Detection on Highway Surveillance Footage (Preset Sample)'}
              </button>
            )}
          </>
        )}

        {/* ═══ Path Mode ═══ */}
        {mode === 'path' && !job && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#c2c6d6]">
              Video File Path (local MP4)
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-[#0b1422] border border-[#424754]/40 focus-within:border-[#adc6ff]/50 rounded-lg px-3 py-2 transition-colors">
                <span className="material-symbols-outlined text-[#c2c6d6] text-[16px] mr-2 shrink-0">folder_open</span>
                <input
                  type="text"
                  value={videoPath}
                  onChange={(e) => setVideoPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isRunning && handlePathStart()}
                  placeholder="C:\Users\...\footage.mp4"
                  disabled={isRunning}
                  className="bg-transparent flex-1 text-[12px] font-mono text-[#dae3f7] placeholder:text-[#c2c6d6]/40 focus:outline-none disabled:opacity-50"
                />
              </div>
              <button
                onClick={handlePathStart}
                disabled={isRunning || isStarting}
                className="px-4 py-2 bg-[#4d8eff] hover:bg-[#adc6ff] disabled:opacity-50 disabled:cursor-not-allowed text-[#00285d] font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors shadow-md flex items-center gap-2 whitespace-nowrap"
              >
                <span className={`material-symbols-outlined text-[18px] ${isStarting || isRunning ? 'animate-spin' : ''}`}>
                  {isStarting || isRunning ? 'sync' : 'play_arrow'}
                </span>
                {isStarting ? 'Starting...' : isRunning ? 'Running...' : 'Start Detection'}
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="text-[11px] text-[#ffb4ab] font-mono flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">error</span>
            {error}
          </p>
        )}

        {/* ═══ Detection Progress ═══ */}
        {job && job.status !== 'idle' && (
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#c2c6d6]">
                {isComplete ? 'Analysis Complete' : isError ? 'Error — check backend logs' : `Analysing frame ${(job.current_frame || 0).toLocaleString()} / ${(job.total_frames || 0).toLocaleString()}`}
              </span>
              <span className="font-bold" style={{ color: progressColor }}>{progressPct}%</span>
            </div>
            <div className="w-full h-2 bg-[#0b1422] rounded-full overflow-hidden border border-[#424754]/30">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, backgroundColor: progressColor, boxShadow: `0 0 8px ${progressColor}80` }}
              />
            </div>


            {/* Completion banner */}
            {isComplete && (job.alerts_generated ?? 0) > 0 && (
              <div className="flex items-center gap-2 bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 rounded-lg px-3 py-2">
                <span className="material-symbols-outlined text-[#ffb4ab] text-[18px]">warning</span>
                <span className="text-[12px] font-mono text-[#ffdad6]">
                  {job.alert_summary
                    ? `${job.alert_summary} — check the Alerts tab.`
                    : `${job.alerts_generated} security threat${job.alerts_generated !== 1 ? 's' : ''} detected (Suspicious Behaviour / Perimeter Intrusion) — check the Alerts tab.`}
                </span>
              </div>
            )}
            {isComplete && (job.alerts_generated ?? 0) === 0 && (
              <div className="flex items-center gap-2 bg-green-950/40 border border-green-500/30 rounded-lg px-3 py-2">
                <span className="material-symbols-outlined text-green-400 text-[18px]">verified</span>
                <span className="text-[12px] font-mono text-green-300">
                  Analysis complete — no unauthorized intrusions or suspicious behaviour detected.
                </span>
              </div>
            )}

            {/* Reset */}
            {(isComplete || isError) && (
              <button
                onClick={handleReset}
                className="w-full py-2.5 bg-[#222a39] hover:bg-[#2c3544] border border-[#424754]/30 rounded-lg text-[12px] font-bold uppercase tracking-wider text-[#c2c6d6] transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">replay</span>
                Analyse Another Video
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

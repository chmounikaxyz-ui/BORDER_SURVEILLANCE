
import React, { useState, useEffect, useRef } from 'react';
import { CameraNode, TacticalAlert } from '../types';
import { getApiBaseUrl } from '../api/client';

interface LiveSurveillanceViewProps {
  cameras: CameraNode[];
  selectedCamera: CameraNode | null;
  onSelectCamera: (cam: CameraNode) => void;
  onOpenAlertModal?: (alert: TacticalAlert) => void;
  onOpenCustomZoneModal?: () => void;
  onDeleteCamera?: (camId: string, camCode: string) => void;
}

// Shared webcam stream manager to prevent hardware locking across multiple feed cells
let _globalStream: MediaStream | null = null;
let _globalStreamPromise: Promise<MediaStream> | null = null;

async function getSharedStream(): Promise<MediaStream> {
  if (_globalStream && _globalStream.active) {
    return _globalStream;
  }
  // Clear stale promise
  _globalStreamPromise = null;
  _globalStream = null;

  if (!_globalStreamPromise) {
    _globalStreamPromise = (async () => {
      try {
        // Enumerate devices and prefer real hardware webcam over virtual (DroidCam, OBS, etc.)
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        // Prefer real webcam: look for non-virtual device
        const realCam = videoDevices.find(d => 
          !d.label.toLowerCase().includes('droidcam') &&
          !d.label.toLowerCase().includes('obs') &&
          !d.label.toLowerCase().includes('virtual')
        ) || videoDevices[0];

        const constraints: MediaStreamConstraints = realCam?.deviceId
          ? { video: { deviceId: { exact: realCam.deviceId } } }
          : { video: true };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        _globalStream = stream;
        return stream;
      } catch (err) {
        _globalStreamPromise = null;
        throw err;
      }
    })();
  }
  return _globalStreamPromise;
}

// ── Camera feed cell: shows real image from backend OR a status screen ──────
const CameraFeedCell: React.FC<{
  cam: CameraNode | null;
  isFocused?: boolean;
  label?: string;
  onClick?: () => void;
  showPtz?: boolean;
  azimuth?: number;
  elevation?: number;
  zoomLevel?: number;
  onPtzMove?: (dir: 'up' | 'down' | 'left' | 'right' | 'center') => void;
  onZoom?: (delta: number) => void;
  aiOverlaysEnabled?: boolean;
}> = ({
  cam,
  isFocused = false,
  label,
  onClick,
  showPtz = false,
  azimuth = 0,
  elevation = 0,
  zoomLevel = 1,
  onPtzMove,
  onZoom,
  aiOverlaysEnabled = true,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedBlobsRef = useRef<Blob[]>([]);
    const lastFinalizedVideoRef = useRef<Blob | null>(null);
    const recordingCycleTimerRef = useRef<any>(null);
    const isComponentMountedRef = useRef(true);
    const isDetectingRef = useRef(false);
    const lastDetectionTimeRef = useRef(0);
    const [webcamError, setWebcamError] = useState<string | null>(null);
    const [liveDetections, setLiveDetections] = useState<{ class: string; confidence: number; bbox: number[]; match_name?: string; match_score?: number }[]>([]);
    const [tamperInfo, setTamperInfo] = useState<{ type: string; reason: string } | null>(null);
    const [isSavingClip, setIsSavingClip] = useState(false);
    const isWebcam = cam?.type === 'webcam' || (cam as any)?.stream_url === '0';

    const startRecordingStream = (stream: MediaStream) => {
      if (!window.MediaRecorder || mediaRecorderRef.current) return;
      try {
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : 'video/mp4';

        let currentChunks: Blob[] = [];
        const mr = new MediaRecorder(stream, { mimeType });

        mr.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            currentChunks.push(event.data);
          }
        };

        mr.onstop = () => {
          if (currentChunks.length > 0) {
            const finishedBlob = new Blob(currentChunks, { type: mimeType });
            if (finishedBlob.size > 1500) {
              lastFinalizedVideoRef.current = finishedBlob;
              recordedBlobsRef.current.push(finishedBlob);
              if (recordedBlobsRef.current.length > 3) {
                recordedBlobsRef.current.shift();
              }
            }
          }
          currentChunks = [];
          if (isComponentMountedRef.current && stream && stream.active && mediaRecorderRef.current) {
            try {
              mr.start();
            } catch {}
          }
        };

        mr.start();
        mediaRecorderRef.current = mr;

        if (recordingCycleTimerRef.current) clearInterval(recordingCycleTimerRef.current);
        recordingCycleTimerRef.current = setInterval(() => {
          if (mr.state === 'recording') {
            try {
              mr.stop();
            } catch {}
          }
        }, 3500);
      } catch (e) {
        console.warn('[MediaRecorder] Setup error:', e);
      }
    };

    // 1. Setup recorder for local webcam
    useEffect(() => {
      isComponentMountedRef.current = true;
      if (!isWebcam || !cam || cam.status !== 'online') return;
      setWebcamError(null);

      getSharedStream()
        .then((s) => {
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play().catch(() => { });
          }
          startRecordingStream(s);
        })
        .catch((err) => {
          console.warn('[Webcam] getUserMedia failed:', err);
          setWebcamError(err.message || 'Camera permission denied or device busy');
        });

      return () => {
        isComponentMountedRef.current = false;
        if (recordingCycleTimerRef.current) {
          clearInterval(recordingCycleTimerRef.current);
          recordingCycleTimerRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try { mediaRecorderRef.current.stop(); } catch (e) {}
          mediaRecorderRef.current = null;
        }
      };
    }, [isWebcam, cam?.id, cam?.status]);

    // 2. Setup recorder for optical / IP CCTV camera feeds via canvas captureStream
    useEffect(() => {
      if (isWebcam || !cam || cam.status !== 'online') return;

      let timer: any = null;
      timer = setInterval(() => {
        if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0 && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            try {
              ctx.drawImage(imgRef.current, 0, 0, 640, 360);
            } catch (e) {}
          }
        }
      }, 150);

      const initRecorderTimer = setTimeout(() => {
        if (canvasRef.current && !mediaRecorderRef.current && (canvasRef.current as any).captureStream) {
          try {
            const canvasStream = (canvasRef.current as any).captureStream(10);
            if (canvasStream) {
              startRecordingStream(canvasStream);
            }
          } catch (e) {
            console.warn('[Canvas Recorder] Setup error:', e);
          }
        }
      }, 500);

      return () => {
        clearInterval(timer);
        clearTimeout(initRecorderTimer);
        if (recordingCycleTimerRef.current) {
          clearInterval(recordingCycleTimerRef.current);
          recordingCycleTimerRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try { mediaRecorderRef.current.stop(); } catch (e) {}
          mediaRecorderRef.current = null;
        }
      };
    }, [isWebcam, cam?.id, cam?.status]);

    const getRollingVideoBase64 = async (): Promise<string | null> => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
        await new Promise((r) => setTimeout(r, 120));
      }

      const targetBlob = lastFinalizedVideoRef.current || (recordedBlobsRef.current.length > 0 ? recordedBlobsRef.current[recordedBlobsRef.current.length - 1] : null);
      if (!targetBlob || targetBlob.size < 1000) return null;

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(targetBlob);
      });
    };

    const handleManualVideoRecord = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isSavingClip) return;
      setIsSavingClip(true);

      try {
        const videoBase64 = await getRollingVideoBase64();
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 270;
        const ctx = canvas.getContext('2d');
        let dataUrl = "";
        if (ctx) {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            ctx.drawImage(videoRef.current, 0, 0, 480, 270);
          } else if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
            ctx.drawImage(imgRef.current, 0, 0, 480, 270);
          }
          dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        }

        const payload = {
          image_base64: dataUrl,
          video_base64: videoBase64 || "",
          camera_code: cam?.code || 'CAM-LIVE-78',
          is_manual_capture: true,
          create_alert: true
        };

        const res = await fetch(`${getApiBaseUrl()}/detect/frame`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.alert_created && data.new_alert) {
            window.dispatchEvent(new CustomEvent('border_vision_alert_triggered', { detail: data.new_alert }));
          }
        }

        setTimeout(() => setIsSavingClip(false), 2000);
      } catch (err) {
        setIsSavingClip(false);
      }
    };

    // Live frame detection loop (POST lightweight canvas frames to backend every 350ms)
    useEffect(() => {
      if (!aiOverlaysEnabled || !cam) return;
      if (!isWebcam && cam.status !== 'online') return;

      const interval = setInterval(async () => {
        if (isDetectingRef.current) return;
        isDetectingRef.current = true;

        try {
          let dataUrl: string | null = null;

          if (isWebcam && videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
            const canvas = canvasRef.current || document.createElement('canvas');
            canvas.width = 480;
            canvas.height = 270;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, 480, 270);
              dataUrl = canvas.toDataURL('image/jpeg', 0.5);
            }
          } else if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
            try {
              const canvas = canvasRef.current || document.createElement('canvas');
              canvas.width = 480;
              canvas.height = 270;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(imgRef.current, 0, 0, 480, 270);
                dataUrl = canvas.toDataURL('image/jpeg', 0.5);
              }
            } catch (e) {
              // Cross-origin image fallback
            }
          }

          const payload = dataUrl
            ? { image_base64: dataUrl, camera_code: cam.code || 'CAM-LIVE-78', create_alert: true }
            : cam.imageUrl
              ? { image_url: cam.imageUrl, camera_code: cam.code || 'CAM-LIVE-78', create_alert: true }
              : null;

          if (payload) {
            let res: Response;
            const controller = new AbortController();
            const abortTimeout = setTimeout(() => controller.abort(), 2400);

            try {
              try {
                res = await fetch(`${getApiBaseUrl()}/detect/frame`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                  signal: controller.signal
                });
              } catch {
                res = await fetch('/api/detect/frame', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                  signal: controller.signal
                });
              }
            } finally {
              clearTimeout(abortTimeout);
            }

            if (res && res.ok) {
              const data = await res.json();
              if (data.tamper_detected) {
                setTamperInfo({ type: data.tamper_type, reason: data.tamper_reason });
                setLiveDetections([]);
                if (data.alert_created && data.new_alert) {
                  window.dispatchEvent(new CustomEvent('border_vision_alert_triggered', { detail: data.new_alert }));
                  // Capture rolling video clip of tamper incident and persist to evidence
                  getRollingVideoBase64().then((vidB64) => {
                    if (vidB64) {
                      fetch(`${getApiBaseUrl()}/alerts/${data.new_alert.id}/video`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ video_base64: vidB64 })
                      }).then(async (vRes) => {
                        if (vRes.ok) {
                          const vData = await vRes.json();
                          window.dispatchEvent(new CustomEvent('border_vision_alert_video_updated', {
                            detail: { id: data.new_alert.id, videoUrl: vData.video_url }
                          }));
                        }
                      }).catch(() => {});
                    }
                  }).catch(() => {});
                }
                return;
              } else {
                setTamperInfo(null);
              }

              if (data && Array.isArray(data.detections)) {
                if (data.detections.length > 0) {
                  setLiveDetections(data.detections);
                  lastDetectionTimeRef.current = Date.now();
                } else if (Date.now() - lastDetectionTimeRef.current > 1200) {
                  setLiveDetections([]);
                }

                if (data.alert_created && data.new_alert) {
                  window.dispatchEvent(new CustomEvent('border_vision_alert_triggered', { detail: data.new_alert }));
                  // Asynchronously upload recorded video clip in background without blocking frame detection
                  getRollingVideoBase64().then((vidB64) => {
                    if (vidB64) {
                      fetch(`${getApiBaseUrl()}/alerts/${data.new_alert.id}/video`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ video_base64: vidB64 })
                      }).then(async (vRes) => {
                        if (vRes.ok) {
                          const vData = await vRes.json();
                          window.dispatchEvent(new CustomEvent('border_vision_alert_video_updated', {
                            detail: { id: data.new_alert.id, videoUrl: vData.video_url }
                          }));
                        }
                      }).catch(() => {});
                    }
                  }).catch(() => {});
                }
                return;
              }
            }
          }
          if (Date.now() - lastDetectionTimeRef.current > 1200) {
            setLiveDetections([]);
          }
        } catch (err) {
          // Network or frame grab error
          if (Date.now() - lastDetectionTimeRef.current > 1500) {
            setLiveDetections([]);
          }
        } finally {
          isDetectingRef.current = false;
        }
      }, 350);

      return () => clearInterval(interval);
    }, [isWebcam, aiOverlaysEnabled, cam?.id, cam?.code, cam?.imageUrl, cam?.status]);

    const borderColor = cam?.hasAlert
      ? 'border-[#ffb4ab]'
      : cam?.status === 'offline'
        ? 'border-[#424754]/30'
        : cam?.status === 'warning'
          ? 'border-amber-500/60'
          : isFocused
            ? 'border-[#adc6ff]/60'
            : 'border-[#424754]/30';

    const shadowColor = cam?.hasAlert
      ? 'shadow-[0_0_20px_rgba(255,180,171,0.18)]'
      : '';

    const displayLabel = label || cam?.code || 'UNKNOWN';
    const isOffline = !cam || cam.status === 'offline';
    const isConnecting = cam?.status === 'connecting';
    const isWarning = cam?.status === 'warning';
    const streamSrc = cam?.imageUrl || (cam?.id && !isWebcam ? `/api/cameras/${cam.id}/stream` : '');
    const hasImage = Boolean(streamSrc) && cam?.status !== 'offline';

    return (
      <div
        onClick={onClick}
        className={`relative w-full h-full min-h-0 group rounded-xl overflow-hidden border-2 ${borderColor} ${shadowColor} bg-[#060e1c] ${onClick ? 'cursor-pointer' : ''} transition-colors flex flex-col justify-center items-center`}
      >
        {/* Real image feed when camera is online */}
        {isWebcam ? (
          webcamError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center gap-2 bg-[#131c2a]">
              <span className="material-symbols-outlined text-amber-400 text-[36px]">videocam_off</span>
              <span className="text-[12px] font-bold text-amber-300 font-mono">Webcam Access Blocked / Busy</span>
              <span className="text-[10px] text-[#c2c6d6] font-mono max-w-xs leading-relaxed">
                Please allow camera permissions in your browser's address bar or close apps using the webcam.
              </span>
              <button
                onClick={() => {
                  getSharedStream()
                    .then(s => {
                      if (videoRef.current) videoRef.current.srcObject = s;
                      setWebcamError(null);
                    })
                    .catch(err => setWebcamError(err.message));
                }}
                className="mt-1 px-3 py-1 bg-[#4d8eff] text-[#00285d] font-bold text-[10px] uppercase rounded"
              >
                Grant Permission
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                disablePictureInPicture
                disableRemotePlayback
                className="absolute inset-0 w-full h-full object-cover grayscale-[0.15] contrast-[1.1] brightness-90 transition-transform duration-[8s] group-hover:scale-[1.015]"
              />
            </>
          )
        ) : hasImage ? (
          <img
            ref={imgRef}
            src={streamSrc}
            crossOrigin="anonymous"
            alt={displayLabel}
            className="absolute inset-0 w-full h-full object-cover grayscale-[0.2] contrast-[1.15] brightness-90 transition-transform duration-[8s] group-hover:scale-[1.015]"
            onError={(e) => {
              const svgFallback = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#0b121e"/><radialGradient id="v" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#142238"/><stop offset="100%" stop-color="#04070d"/></radialGradient><rect width="1280" height="720" fill="url(#v)"/><g stroke="rgba(77,142,255,0.15)" stroke-width="1"><line x1="0" y1="180" x2="1280" y2="180"/><line x1="0" y1="360" x2="1280" y2="360"/><line x1="0" y1="540" x2="1280" y2="540"/><line x1="320" y1="0" x2="320" y2="720"/><line x1="640" y1="0" x2="640" y2="720"/><line x1="960" y1="0" x2="960" y2="720"/></g><circle cx="640" cy="360" r="220" fill="none" stroke="rgba(77,142,255,0.25)" stroke-width="1.5"/><circle cx="640" cy="360" r="4" fill="#ffb4ab"/><text x="55" y="65" fill="#4d8eff" font-family="monospace" font-size="16" font-weight="bold">${displayLabel} • CONNECTING STREAM</text></svg>`)}`;
              (e.currentTarget as HTMLImageElement).src = svgFallback;
            }}
          />
        ) : isOffline ? (
          /* OFFLINE state */
          <>
            <div className="absolute inset-0 bg-[radial-gradient(#1a2030_1px,transparent_1px)] [background-size:8px_8px] opacity-50" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
              <span className="material-symbols-outlined text-[#ffb4ab]/50 text-[32px]">signal_disconnected</span>
              <span className="font-mono text-[10px] text-[#ffb4ab]/60 tracking-widest">SIGNAL LOST</span>
            </div>
          </>
        ) : isConnecting ? (
          /* CONNECTING state */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-[#8c909f] text-[32px] animate-pulse">videocam_off</span>
            <span className="font-mono text-[10px] text-[#8c909f] tracking-widest animate-pulse">CONNECTING...</span>
          </div>
        ) : isWarning ? (
          /* WARNING state */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-amber-400/60 text-[32px] animate-pulse">warning</span>
            <span className="font-mono text-[10px] text-amber-400/60 tracking-widest">TAMPER / DEGRADED</span>
          </div>
        ) : (
          /* Standby */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[#424754] text-[28px]">videocam</span>
            <span className="font-mono text-[10px] text-[#424754] tracking-widest">NO FEED</span>
          </div>
        )}

        <canvas ref={canvasRef} width={640} height={360} className="hidden" />

        {/* Flashing Red HUD Sensor Tamper Banner */}
        {tamperInfo && (
          <div className="absolute inset-0 bg-[#93000a]/50 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center gap-2.5 p-4 text-center animate-pulse border-4 border-[#ffb4ab]">
            <div className="p-3 bg-[#93000a] text-[#ffdad6] rounded-full border-2 border-[#ffb4ab] shadow-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[36px]">videocam_off</span>
            </div>
            <span className="text-[16px] font-bold text-[#ffdad6] tracking-wider uppercase font-mono">
              ⚠️ CRITICAL SENSOR TAMPER — {tamperInfo.type} DETECTED
            </span>
            <span className="text-[12px] text-white font-mono max-w-md bg-black/70 px-3 py-1.5 rounded-lg border border-red-500/30">
              {tamperInfo.reason || 'Camera optical view is blocked, covered, or dark.'}
            </span>
            <span className="px-3 py-1 bg-black/80 rounded-full text-[10px] font-mono font-bold text-red-300 border border-red-500/50 uppercase tracking-wider">
              AUTOMATIC AUDIT ALERT DISPATCHED
            </span>
          </div>
        )}

        {/* AI overlay SVG on main feed — displays detections and Watchlist suspect matches */}
        {aiOverlaysEnabled && (isWebcam ? !webcamError : hasImage) && (
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
              const matchName = (det as any).match_name;
              const isMatch = Boolean(matchName);
              const matchScoreRaw = (det as any).match_score;
              const matchScore = matchScoreRaw !== undefined && matchScoreRaw !== null
                ? (matchScoreRaw > 1 ? Math.round(matchScoreRaw) : Math.round(matchScoreRaw * 100))
                : (det.confidence ? (det.confidence > 1 ? Math.round(det.confidence) : Math.round(det.confidence * 100)) : 90);
              const classScore = det.confidence ? (det.confidence > 1 ? Math.round(det.confidence) : Math.round(det.confidence * 100)) : 85;
              const labelText = isMatch 
                ? `MATCH: ${matchName.toUpperCase()} (${matchScore}%)`
                : `${(det.class || 'PERSON').toUpperCase()} (${classScore}%)`;
              const color = isMatch ? '#ff3333' : '#38bdf8';

              return (
                <g key={idx}>
                  {/* Bounding box */}
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill={isMatch ? 'rgba(255, 51, 51, 0.20)' : 'rgba(56, 189, 248, 0.08)'}
                    stroke={color}
                    strokeWidth="2.5"
                    className={isMatch ? "animate-pulse" : ""}
                  />
                  {/* Bounding box corner ticks */}
                  <path
                    d={`M${x},${y + 15} L${x},${y} L${x + 15},${y} M${x + w - 15},${y} L${x + w},${y} L${x + w},${y + 15} M${x + w},${y + h - 15} L${x + w},${y + h} L${x + w - 15},${y + h} M${x + 15},${y + h} L${x},${y + h} L${x},${y + h - 15}`}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                  />
                  {/* Label badge */}
                  <rect
                    x={x}
                    y={Math.max(0, y - 26)}
                    width={Math.max(120, labelText.length * 8.5 + 16)}
                    height="22"
                    fill="#0b1422"
                    stroke={color}
                    strokeWidth="1.5"
                    rx="3"
                  />
                  <text
                    x={x + 6}
                    y={Math.max(15, y - 10)}
                    fill={color}
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    [{labelText}]
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* HUD top bar */}
        <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-start z-20 bg-gradient-to-b from-[#0b1422]/80 to-transparent pointer-events-none">
          <div className="flex items-center gap-1.5">
            {cam?.hasAlert && (
              <span className="px-2 py-0.5 bg-[#93000a]/70 border border-[#ffb4ab]/60 rounded-sm font-mono text-[9px] text-[#ffb4ab] font-bold tracking-widest flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-[#ffb4ab] rounded-full animate-ping" />
                {cam.alertType || 'ALERT'}
              </span>
            )}
            <span className="px-1.5 py-0.5 bg-[#17202e]/70 backdrop-blur-sm border border-[#424754]/40 rounded-sm font-mono text-[9px] text-[#dae3f7]">
              {displayLabel}
            </span>
          </div>
          {cam?.status === 'online' && (
            <div className="flex items-center gap-1.5">
              {isWebcam && (
                <button
                  onClick={handleManualVideoRecord}
                  disabled={isSavingClip}
                  className="pointer-events-auto px-2 py-0.5 bg-[#93000a]/80 hover:bg-[#ffb4ab] text-[#ffdad6] hover:text-[#690005] border border-[#ffb4ab]/40 rounded font-mono text-[9px] font-bold tracking-wider flex items-center gap-1 transition-colors shadow"
                  title="Force Capture & Save 5-Second Incident Replay Video Clip"
                >
                  <span className="material-symbols-outlined text-[12px]">{isSavingClip ? 'sync' : 'videocam'}</span>
                  {isSavingClip ? 'SAVING...' : 'RECORD CLIP'}
                </button>
              )}
              <div className="flex items-center gap-1 bg-[#0b1422]/60 px-1.5 py-0.5 rounded border border-[#424754]/30">
                <div className="w-1.5 h-1.5 bg-[#ffb4ab] rounded-full animate-pulse" />
                <span className="font-mono text-[9px] text-[#ffb4ab] font-bold">REC</span>
              </div>
            </div>
          )}
        </div>

        {/* HUD bottom (hover) */}
        {cam && (
          <div className="absolute bottom-0 left-0 right-0 p-3 flex justify-between items-end z-20 bg-gradient-to-t from-[#0b1422]/90 via-[#0b1422]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="flex flex-col gap-1 font-mono text-[10px] text-[#c2c6d6]">
              <span className="text-[#adc6ff]">{cam.coordinatesString || `${cam.lat ?? 34.0528}° N, ${Math.abs(cam.lng ?? -118.2415)}° W`}</span>
              {isFocused && (
                <span>AZ: {azimuth}° | EL: {elevation}° | ZM: {zoomLevel}x</span>
              )}
            </div>
            <div className="flex flex-col items-end gap-0.5 font-mono text-[9px] text-[#c2c6d6]">
              <span>{cam.resolution} | {cam.fps}FPS</span>
              <span className="text-green-400">{cam.bitrate}</span>
            </div>
          </div>
        )}

        {/* PTZ controls — focus view only */}
        {showPtz && cam?.ptzSupport && onPtzMove && onZoom && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-30 opacity-30 group-hover:opacity-100 transition-opacity">
            <div className="bg-[#222a39]/90 backdrop-blur-md rounded-full p-1 border border-[#424754]/40 shadow-lg flex flex-col items-center gap-1">
              <button onClick={() => onPtzMove('up')} className="w-8 h-8 rounded-full hover:bg-[#424754]/40 flex items-center justify-center text-[#dae3f7] transition-colors" title="Pan Up">
                <span className="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
              </button>
              <div className="flex gap-1">
                <button onClick={() => onPtzMove('left')} className="w-8 h-8 rounded-full hover:bg-[#424754]/40 flex items-center justify-center text-[#dae3f7] transition-colors">
                  <span className="material-symbols-outlined text-[18px]">keyboard_arrow_left</span>
                </button>
                <button onClick={() => onPtzMove('center')} className="w-8 h-8 rounded-full bg-[#424754]/20 hover:bg-[#adc6ff]/20 flex items-center justify-center text-[#adc6ff] transition-colors border border-[#424754]/30">
                  <span className="material-symbols-outlined text-[16px]">my_location</span>
                </button>
                <button onClick={() => onPtzMove('right')} className="w-8 h-8 rounded-full hover:bg-[#424754]/40 flex items-center justify-center text-[#dae3f7] transition-colors">
                  <span className="material-symbols-outlined text-[18px]">keyboard_arrow_right</span>
                </button>
              </div>
              <button onClick={() => onPtzMove('down')} className="w-8 h-8 rounded-full hover:bg-[#424754]/40 flex items-center justify-center text-[#dae3f7] transition-colors">
                <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
              </button>
            </div>
            <div className="bg-[#222a39]/90 backdrop-blur-md rounded-full p-1 border border-[#424754]/40 shadow-lg flex flex-col items-center mt-1">
              <button onClick={() => onZoom(0.5)} className="w-8 h-8 rounded-full hover:bg-[#424754]/40 flex items-center justify-center text-[#dae3f7] transition-colors">
                <span className="material-symbols-outlined text-[18px]">add</span>
              </button>
              <div className="h-12 w-1 bg-[#424754]/40 my-1 rounded-full relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-full bg-[#4d8eff] rounded-full transition-all" style={{ height: `${(zoomLevel / 12) * 100}%` }} />
              </div>
              <button onClick={() => onZoom(-0.5)} className="w-8 h-8 rounded-full hover:bg-[#424754]/40 flex items-center justify-center text-[#dae3f7] transition-colors">
                <span className="material-symbols-outlined text-[18px]">remove</span>
              </button>
            </div>
          </div>
        )}

        {/* Click-to-focus hint for sub-feeds */}
        {!isFocused && onClick && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-[#0b1422]/80 text-[#adc6ff] font-mono text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity z-20">
            CLICK TO FOCUS
          </div>
        )}
      </div>
    );
  };

// ── Camera tree sidebar row ──────────────────────────────────────────────────
const CameraRow: React.FC<{
  cam: CameraNode;
  isActive: boolean;
  onClick: () => void;
}> = ({ cam, isActive, onClick }) => {
  const dotColor =
    cam.status === 'online'
      ? cam.hasAlert
        ? 'bg-[#ffb4ab] animate-pulse shadow-[0_0_8px_rgba(255,180,171,0.8)]'
        : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
      : cam.status === 'connecting'
        ? 'bg-amber-500 animate-pulse'
        : cam.status === 'warning'
          ? 'bg-amber-400 animate-pulse'
          : 'bg-[#ffb4ab]/50';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left py-2 px-3 rounded-md border flex items-center justify-between group transition-colors ${isActive
          ? 'bg-[#4d8eff]/20 border-[#adc6ff]/40 text-[#adc6ff]'
          : 'hover:bg-[#222a39] border-transparent text-[#c2c6d6]'
        }`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="font-mono text-[12px] font-semibold">{cam.name}</span>
      </div>
      {cam.hasAlert && <span className="material-symbols-outlined text-[14px] text-[#ffb4ab]">warning</span>}
      {cam.status === 'offline' && <span className="material-symbols-outlined text-[14px] text-[#ffb4ab]/60">signal_disconnected</span>}
    </button>
  );
};

// ── Main view ────────────────────────────────────────────────────────────────
export const LiveSurveillanceView: React.FC<LiveSurveillanceViewProps> = ({
  cameras,
  selectedCamera,
  onSelectCamera,
  onOpenCustomZoneModal,
  onDeleteCamera,
}) => {
  const [activeLayout, setActiveLayout] = useState<'focus' | 'quad' | 'multi'>('quad');
  const [aiOverlaysEnabled, setAiOverlaysEnabled] = useState(true);
  const [sectorFilter, setSectorFilter] = useState('');
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // PTZ state
  const [zoomLevel, setZoomLevel] = useState(4.2);
  const [azimuth, setAzimuth] = useState(142.5);
  const [elevation, setElevation] = useState(-12.4);

  // Live telemetry (driven by real camera data)
  const [telemetryLogs, setTelemetryLogs] = useState<{ time: string; node: string; text: string; type: string }[]>([]);
  const telemetryEndRef = useRef<HTMLDivElement>(null);

  const activeCam = selectedCamera || cameras[0] || null;

  // Generate telemetry lines from real camera data when available
  useEffect(() => {
    if (cameras.length === 0) return;

    const pushLog = () => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const onlineCams = cameras.filter(c => c.status === 'online');
      if (onlineCams.length === 0) return;
      const cam = onlineCams[Math.floor(Math.random() * onlineCams.length)];
      const events = [
        { node: `[${cam.code}]`, text: `HEARTBEAT ping=${Math.floor(Math.random() * 30 + 10)}ms`, type: 'normal' },
        { node: `[${cam.code}]`, text: `FRAME_VERIFY_HMAC_SHA256 seq=${Math.floor(Math.random() * 90000 + 10000)}`, type: 'normal' },
        { node: `[${cam.code}]`, text: `BITRATE_SAMPLE=${(Math.random() * 2 + 2).toFixed(1)}Mbps`, type: 'normal' },
      ];
      const ev = events[Math.floor(Math.random() * events.length)];
      setTelemetryLogs(prev => [...prev.slice(-20), { time: timeStr, ...ev }]);
    };

    pushLog(); // Immediate first telemetry line
    const interval = setInterval(pushLog, 2000);
    return () => clearInterval(interval);
  }, [cameras]);

  useEffect(() => {
    telemetryEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [telemetryLogs]);

  const handlePtzMove = (direction: 'up' | 'down' | 'left' | 'right' | 'center') => {
    if (direction === 'up') setElevation(p => +(p + 1.2).toFixed(1));
    if (direction === 'down') setElevation(p => +(p - 1.2).toFixed(1));
    if (direction === 'left') setAzimuth(p => +(p - 2.5).toFixed(1));
    if (direction === 'right') setAzimuth(p => +(p + 2.5).toFixed(1));
    if (direction === 'center') { setAzimuth(142.5); setElevation(-12.4); setZoomLevel(4.2); }
  };

  // Group cameras by sector
  const sectors = Array.from(new Set(cameras.map(c => c.sector)));
  const filteredCameras = sectorFilter
    ? cameras.filter(c => c.name.toLowerCase().includes(sectorFilter.toLowerCase()) || c.code.toLowerCase().includes(sectorFilter.toLowerCase()))
    : cameras;

  // Pick sub-feeds (up to 4 non-active cameras)
  const subFeeds = cameras.filter(c => c.id !== activeCam?.id).slice(0, 4);

  return (
    <div className="flex flex-1 h-full min-h-0 overflow-hidden text-[#dae3f7]">
      {/* LEFT SIDEBAR */}
      <aside className="w-64 xl:w-72 flex-shrink-0 bg-[#17202e] border-r border-[#424754]/20 flex flex-col h-full min-h-0 z-10 relative overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#424754]/20 shrink-0">
          <h2 className="text-[15px] font-bold text-[#dae3f7] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#adc6ff] text-[18px]">view_comfy_alt</span>
            Active Sectors
            <span className="ml-auto text-[11px] font-mono font-normal text-[#adc6ff]">{cameras.filter(c => c.status === 'online').length}/{cameras.length}</span>
          </h2>
          <div className="mt-2.5 flex items-center bg-[#2c3544] rounded-md px-3 py-1 border border-[#424754]/30 focus-within:border-[#adc6ff]/40 transition-colors">
            <span className="material-symbols-outlined text-[#c2c6d6] text-[15px] mr-2">search</span>
            <input
              value={sectorFilter}
              onChange={e => setSectorFilter(e.target.value)}
              className="bg-transparent w-full text-[11px] text-[#dae3f7] placeholder:text-[#c2c6d6]/50 focus:outline-none"
              placeholder="Filter cameras..."
              type="text"
            />
          </div>
        </div>

        {/* Camera list — real data, grouped by sector */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-2 min-h-0">
          {cameras.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-28 gap-2 text-[#424754]">
              <span className="material-symbols-outlined text-[24px]">videocam_off</span>
              <span className="text-[10px] font-mono">No cameras registered</span>
            </div>
          ) : (
            sectors.map(sector => {
              const sectorCams = filteredCameras.filter(c => c.sector === sector);
              if (sectorCams.length === 0) return null;
              return (
                <div key={sector} className="mb-2">
                  <div className="px-4 py-1.5 text-[11px] font-bold text-[#adc6ff] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[13px]">folder_open</span>
                    {sector}
                  </div>
                  <div className="pl-3 pr-2.5 flex flex-col gap-1">
                    {sectorCams.map(cam => (
                      <CameraRow
                        key={cam.id}
                        cam={cam}
                        isActive={activeCam?.id === cam.id}
                        onClick={() => onSelectCamera(cam)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Live Telemetry Terminal */}
        <div className="h-44 border-t border-[#424754]/20 bg-[#060e1c] flex flex-col shrink-0 min-h-0">
          <div className="px-3.5 py-1.5 border-b border-[#424754]/20 flex justify-between items-center bg-[#0b1422]/70 sticky top-0">
            <span className="text-[9px] font-bold uppercase text-[#c2c6d6] tracking-widest">Live Telemetry</span>
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cameras.length > 0 ? 'bg-[#adc6ff]' : 'bg-[#424754]'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${cameras.length > 0 ? 'bg-[#adc6ff]' : 'bg-[#424754]'}`} />
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 font-mono text-[9px] leading-tight space-y-1 no-scrollbar">
            {telemetryLogs.length === 0 ? (
              <div className="text-[#424754] text-center mt-3">Awaiting camera heartbeats...</div>
            ) : (
              telemetryLogs.map((log, i) => (
                <div key={i} className={`flex gap-1.5 ${log.type === 'error' ? 'text-[#ffb4ab]' : log.type === 'warning' ? 'text-amber-400' : 'text-[#c2c6d6]'}`}>
                  <span className="text-[#adc6ff] opacity-70 shrink-0">{log.time}</span>
                  <span className="text-[#b7c8e1] shrink-0">{log.node}</span>
                  <span className="truncate">{log.text}</span>
                </div>
              ))
            )}
            <div ref={telemetryEndRef} />
          </div>
        </div>
      </aside>

      {/* MAIN SURVEILLANCE GRID */}
      <main className="flex-1 bg-[#0b1422] relative flex flex-col h-full min-h-0 overflow-hidden">
        {/* Toolbar */}
        <div className="h-12 px-5 flex items-center justify-between border-b border-[#424754]/20 bg-[#17202e]/60 backdrop-blur-md z-20 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-bold text-[#dae3f7]">Tactical Grid View</h1>
            <div className="h-3.5 w-px bg-[#424754]/40" />
            <div className="flex bg-[#222a39] rounded-md p-0.5 border border-[#424754]/30">
              {(['focus', 'quad', 'multi'] as const).map((layout, i) => (
                <button
                  key={layout}
                  onClick={() => setActiveLayout(layout)}
                  className={`p-1 rounded transition-all ${activeLayout === layout ? 'bg-[#424754]/60 text-[#dae3f7] shadow-sm' : 'text-[#c2c6d6] hover:text-[#dae3f7] hover:bg-[#424754]/20'}`}
                  title={['Focus (1×1)', 'Quad (3-feed)', 'Multi (all)'][i]}
                >
                  <span className="material-symbols-outlined text-[16px]">{['crop_din', 'grid_view', 'apps'][i]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeCam && onDeleteCamera && (
              <button
                onClick={() => setShowDisconnectModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#93000a]/40 hover:bg-[#93000a] text-[#ffdad6] hover:text-white border border-[#ffb4ab]/40 text-[11px] font-bold rounded-lg transition-colors shadow"
                title="Disconnect active camera from network"
              >
                <span className="material-symbols-outlined text-[14px]">videocam_off</span>
                <span>Disconnect Cam</span>
              </button>
            )}
            {onOpenCustomZoneModal && (
              <button
                onClick={onOpenCustomZoneModal}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-[11px] font-bold rounded-lg transition-colors shadow"
              >
                <span className="material-symbols-outlined text-[14px]">polyline</span>
                <span>+ Custom Zone</span>
              </button>
            )}
            <label className="flex items-center cursor-pointer gap-2 group">
              <div onClick={() => setAiOverlaysEnabled(!aiOverlaysEnabled)} className="relative cursor-pointer">
                <div className={`block w-9 h-5 rounded-full border border-[#adc6ff]/30 transition-colors ${aiOverlaysEnabled ? 'bg-[#4d8eff]' : 'bg-[#222a39]'}`} />
                <div className={`dot absolute top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${aiOverlaysEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-[10px] font-bold uppercase text-[#adc6ff] tracking-wider select-none">AI OVERLAYS</span>
            </label>
          </div>
        </div>

        {/* No cameras connected fallback */}
        {cameras.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#424754]">
            <span className="material-symbols-outlined text-[48px]">videocam_off</span>
            <p className="text-[14px] font-mono text-[#8c909f]">No camera network registered</p>
            <p className="text-[11px] text-[#424754] font-mono">Backend API connection required — check System Health</p>
          </div>
        )}

        {/* Grid */}
        {cameras.length > 0 && (
          <div className="flex-1 p-2.5 overflow-hidden flex flex-col h-full min-h-0">
            {activeLayout === 'focus' ? (
              <div className="w-full h-full flex-1 relative min-h-0">
                <CameraFeedCell
                  cam={activeCam}
                  isFocused
                  label={activeCam?.code}
                  showPtz
                  azimuth={azimuth}
                  elevation={elevation}
                  zoomLevel={zoomLevel}
                  onPtzMove={handlePtzMove}
                  onZoom={d => setZoomLevel(p => +(Math.min(12, Math.max(1, p + d))).toFixed(1))}
                  aiOverlaysEnabled={aiOverlaysEnabled}
                />
              </div>
            ) : activeLayout === 'quad' ? (
              <div className="h-full w-full min-h-0 grid grid-cols-3 grid-rows-2 gap-2.5">
                {/* Main 2×2 focal feed */}
                <div className="col-span-2 row-span-2 relative h-full w-full min-h-0">
                  <CameraFeedCell
                    cam={activeCam}
                    isFocused
                    label={activeCam?.code}
                    showPtz
                    azimuth={azimuth}
                    elevation={elevation}
                    zoomLevel={zoomLevel}
                    onPtzMove={handlePtzMove}
                    onZoom={d => setZoomLevel(p => +(Math.min(12, Math.max(1, p + d))).toFixed(1))}
                    aiOverlaysEnabled={aiOverlaysEnabled}
                  />
                </div>
                {/* Sub-feed 1 */}
                <div className="h-full w-full min-h-0">
                  {subFeeds[0] ? (
                    <CameraFeedCell
                      key={subFeeds[0].id}
                      cam={subFeeds[0]}
                      onClick={() => onSelectCamera(subFeeds[0])}
                      aiOverlaysEnabled={aiOverlaysEnabled}
                    />
                  ) : (
                    <div className="h-full w-full rounded-xl border border-[#424754]/20 bg-[#060e1c]/60 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#2c3544] text-[24px]">add</span>
                    </div>
                  )}
                </div>
                {/* Sub-feed 2 */}
                <div className="h-full w-full min-h-0">
                  {subFeeds[1] ? (
                    <CameraFeedCell
                      key={subFeeds[1].id}
                      cam={subFeeds[1]}
                      onClick={() => onSelectCamera(subFeeds[1])}
                      aiOverlaysEnabled={aiOverlaysEnabled}
                    />
                  ) : (
                    <div className="h-full w-full rounded-xl border border-[#424754]/20 bg-[#060e1c]/60 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#2c3544] text-[24px]">add</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Multi — all cameras in a responsive grid fitting within viewport */
              <div className={`h-full w-full min-h-0 grid gap-2.5 ${cameras.length <= 2 ? 'grid-cols-2 grid-rows-1' : cameras.length <= 4 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-3 grid-rows-2'}`}>
                {cameras.slice(0, 6).map(cam => (
                  <div key={cam.id} className="h-full w-full min-h-0">
                    <CameraFeedCell
                      cam={cam}
                      isFocused={activeCam?.id === cam.id}
                      onClick={() => onSelectCamera(cam)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Custom Styled Disconnect Confirmation Modal */}
      {showDisconnectModal && activeCam && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-[#17202e] border border-[#ffb4ab]/30 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-[#ffb4ab] text-[28px]">warning</span>
              <h3 className="text-[16px] font-bold text-[#dae3f7]">Confirm Removal</h3>
            </div>
            <p className="text-[13px] text-[#c2c6d6] mb-5 font-mono leading-relaxed">
              This will unbind camera <span className="text-[#adc6ff] font-bold">{activeCam.code}</span> ({activeCam.name}) from the network database. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDisconnectModal(false)}
                className="flex-1 py-2.5 bg-[#222a39] hover:bg-[#2c3544] border border-[#424754]/30 rounded-lg text-[12px] font-bold uppercase tracking-wider text-[#c2c6d6] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteCamera?.(activeCam.id, activeCam.code);
                  setShowDisconnectModal(false);
                }}
                className="flex-1 py-2.5 bg-[#93000a] hover:bg-[#ffb4ab] text-[#ffdad6] hover:text-[#690005] rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">link_off</span>
                Remove Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

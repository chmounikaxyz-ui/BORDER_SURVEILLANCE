import React, { useState, useEffect, useRef } from 'react';
import { CameraNode, NavTab, TacticalAlert } from '../types';
import { VideoProcessorPanel } from './VideoProcessorPanel';

interface DashboardViewProps {
  cameras: CameraNode[];
  alerts: TacticalAlert[];
  onSelectCamera: (cam: CameraNode) => void;
  onNavigate: (tab: NavTab) => void;
  onOpenAddCameraModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  alerts,
  cameras,
  onSelectCamera,
  onNavigate,
  onOpenAddCameraModal
}) => {
  const [radarAudio, setRadarAudio] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const criticalCount = alerts.filter(a => a.severity?.toUpperCase() === 'CRITICAL').length;
  const highCount = alerts.filter(a => a.severity?.toUpperCase() === 'HIGH').length;
  const pendingCount = alerts.filter(a => a.status?.toUpperCase().includes('PENDING')).length;

  // Synthesize authentic tactical acoustic radar beeps / sonar blips
  const playRadarBeep = (isAlert = false) => {
    if (!radarAudio) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isAlert) {
        // High alert tactical warning double-beep
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1180, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } else {
        // Crisp sonar acoustic blip / radar ping
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1550, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.09, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {
      // Audio safety
    }
  };

  // Unlock browser audio context automatically on any user gesture
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = new AudioContextClass();
          }
          if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
          }
        }
      } catch (e) {}
    };

    window.addEventListener('click', unlockAudio, { once: false });
    window.addEventListener('keydown', unlockAudio, { once: false });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Periodic tactical radar sonar ping loop
  useEffect(() => {
    if (cameras.length === 0 || !radarAudio) return;
    const interval = setInterval(() => {
      const hasAnyAlert = cameras.some(c => c.hasAlert);
      playRadarBeep(hasAnyAlert);
    }, 3500);
    return () => clearInterval(interval);
  }, [cameras, radarAudio]);

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 text-[#dae3f7]">
      {/* Top Banner Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#131c2a] p-6 rounded-xl border border-[#424754]/30 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#adc6ff]/5 to-transparent pointer-events-none"></div>
        <div className="flex flex-col gap-1 relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-bold text-[#adc6ff] tracking-tight">
              BorderVision AI Command Centre
            </h1>
          </div>
          <p className="text-[14px] text-[#c2c6d6] max-w-2xl">
            Real-time AI-assisted threat detection, biometric recognition, and border response automation.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10 shrink-0">
          {onOpenAddCameraModal && (
            <button
              onClick={onOpenAddCameraModal}
              className="px-4 py-2 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors shadow-md flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">videocam</span>
              + Connect Real Camera
            </button>
          )}
          <div className="flex items-center gap-2 bg-[#222a39] px-3.5 py-2 rounded-full border border-[#adc6ff]/20 shadow-md">
            <div className="w-2.5 h-2.5 rounded-full bg-[#adc6ff] animate-pulse shadow-[0_0_8px_rgba(173,198,255,0.6)]"></div>
            <span className="text-[11px] font-bold uppercase text-[#adc6ff] tracking-wider">
              LIVE MONITORING ACTIVE
            </span>
          </div>
        </div>
      </header>

      {/* 4 KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Cameras */}
        <div
          onClick={() => onNavigate('live-surveillance')}
          className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/20 hover:bg-[#222a39] transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#adc6ff]/5 rounded-full blur-xl group-hover:bg-[#adc6ff]/10 transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-[#dae3f7]">Active Cameras</span>
              <span className="text-[32px] font-bold text-[#adc6ff] mt-1 tracking-tight">
                {cameras.filter(c => c.status === 'online').length}
                <span className="text-[#c2c6d6] text-[20px] opacity-50 font-normal">/{cameras.length}</span>
              </span>
            </div>
            <div className="p-2 bg-[#222a39] rounded-lg text-[#adc6ff]">
              <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                videocam
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-3 border-t border-[#424754]/20 relative z-10">
            <span className="material-symbols-outlined text-[#adc6ff] text-[16px]">arrow_upward</span>
            <span className="text-[12px] text-[#c2c6d6]">{cameras.filter(c => c.hasAlert).length} cameras with active alerts</span>
          </div>
        </div>

        {/* KPI 2: Active Threats */}
        <div
          onClick={() => onNavigate('alerts')}
          className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/20 hover:bg-[#222a39] transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#ffb4ab]/5 rounded-full blur-xl group-hover:bg-[#ffb4ab]/10 transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-[#dae3f7]">Active Threats</span>
              <span className="text-[32px] font-bold text-[#ffb4ab] mt-1 tracking-tight">
                {criticalCount}
                <span className="text-[#c2c6d6] text-[20px] opacity-50 font-normal"> CRIT</span>
              </span>
            </div>
            <div className="p-2 bg-[#222a39] rounded-lg text-[#ffb4ab]">
              <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                crisis_alert
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-3 border-t border-[#424754]/20 relative z-10">
            <span className="material-symbols-outlined text-[#ffb4ab] text-[16px]">warning</span>
            <span className="text-[12px] text-[#c2c6d6]">{highCount} HIGH + {pendingCount} pending review</span>
          </div>
        </div>

        {/* KPI 3: Watchlist Matches */}
        <div
          onClick={() => onNavigate('watchlist')}
          className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/20 hover:bg-[#222a39] transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#4d8eff]/5 rounded-full blur-xl group-hover:bg-[#4d8eff]/10 transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-[#dae3f7]">Biometric Matches</span>
              <span className="text-[32px] font-bold text-[#adc6ff] mt-1 tracking-tight">
                0
                <span className="text-[#c2c6d6] text-[20px] opacity-50 font-normal"> today</span>
              </span>
            </div>
            <div className="p-2 bg-[#222a39] rounded-lg text-[#adc6ff]">
              <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                person_search
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-3 border-t border-[#424754]/20 relative z-10">
            <span className="material-symbols-outlined text-[#adc6ff] text-[16px]">face_retouching_off</span>
            <span className="text-[12px] text-[#c2c6d6]">Engine not connected</span>
          </div>
        </div>

        {/* KPI 4: System Health */}
        <div
          onClick={() => onNavigate('system-health')}
          className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/20 hover:bg-[#222a39] transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#bbc7df]/5 rounded-full blur-xl group-hover:bg-[#bbc7df]/10 transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-[#dae3f7]">System Health</span>
              <span className="text-[32px] font-bold text-[#bbc7df] mt-1 tracking-tight">
                {cameras.length > 0 ? Math.round((cameras.filter(c => c.status === 'online').length / cameras.length) * 10) : 0}
                <span className="text-[#c2c6d6] text-[20px] opacity-50 font-normal">/10</span>
              </span>
            </div>
            <div className="p-2 bg-[#222a39] rounded-lg text-[#bbc7df]">
              <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                router
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-3 border-t border-[#424754]/20 relative z-10">
            <span className="material-symbols-outlined text-[#bbc7df] text-[16px]">sync</span>
            <span className="text-[12px] text-[#c2c6d6]">Live from backend nodes</span>
          </div>
        </div>
      </div>

      {/* Video Processor Panel */}
      <VideoProcessorPanel
        onAlertsGenerated={(count) => {
          console.log(`[Dashboard] ${count} new alerts from video detection`);
        }}
      />



      {/* Border Operations Map */}
      <div className="bg-[#17202e] rounded-xl border border-[#424754]/20 overflow-hidden shadow-lg">
        <div className="p-3.5 border-b border-[#424754]/20 bg-[#131c2a] flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#adc6ff]">map</span>
            <h2 className="text-[17px] font-bold text-[#dae3f7]">
              Border Operations Map
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {/* Radar Acoustic Beeper Toggle */}
            <button
              onClick={() => {
                const next = !radarAudio;
                setRadarAudio(next);
                if (next) playRadarBeep(false);
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold flex items-center gap-1.5 transition-colors border ${
                radarAudio
                  ? 'bg-green-950/60 text-green-300 border-green-500/40 hover:bg-green-900/60'
                  : 'bg-[#1b2535] text-[#8c909f] border-white/5 hover:text-white'
              }`}
              title={radarAudio ? 'Mute Radar Acoustic Pings' : 'Enable Radar Acoustic Pings'}
            >
              <span className="material-symbols-outlined text-[15px]">
                {radarAudio ? 'volume_up' : 'volume_off'}
              </span>
              <span>{radarAudio ? 'RADAR BEEP: ACTIVE' : 'MUTED'}</span>
            </button>

            <div className="flex gap-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#c2c6d6]">
                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"></span> Online
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#c2c6d6]">
                <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.6)]"></span> Warning
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#c2c6d6]">
                <span className="w-2 h-2 rounded-full bg-[#ffb4ab] animate-pulse shadow-[0_0_6px_rgba(255,180,171,0.8)]"></span> Alert
              </div>
            </div>
          </div>
        </div>

        {/* Border Operations Tactical Radar & Sector Grid */}
        <div className="relative w-full h-80 bg-[#060e1c] overflow-hidden select-none">
          {/* Tactical Background Coordinate Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1b253b_1px,transparent_1px),linear-gradient(to_bottom,#1b253b_1px,transparent_1px)] bg-[size:36px_36px] opacity-30 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(13,31,58,0.7)_0%,_rgba(6,13,26,0.95)_85%)] pointer-events-none" />

          {/* SVG Tactical Sector Grid & Radar Rings */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 320" preserveAspectRatio="none">
            <defs>
              {/* Radar Sweep Gradient */}
              <radialGradient id="radarSweep" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#4d8eff" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#4d8eff" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Radar Concentric Rings */}
            <circle cx="400" cy="160" r="70" fill="none" stroke="#4d8eff" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="400" cy="160" r="140" fill="none" stroke="#4d8eff" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx="400" cy="160" r="210" fill="none" stroke="#4d8eff" strokeOpacity="0.05" strokeWidth="1" />
            <circle cx="400" cy="160" r="280" fill="url(#radarSweep)" stroke="#4d8eff" strokeOpacity="0.03" strokeWidth="1" />

            {/* Center Crosshairs & Sector Perimeter Lines */}
            <line x1="400" y1="15" x2="400" y2="305" stroke="#424754" strokeOpacity="0.25" strokeDasharray="4 4" />
            <line x1="40" y1="160" x2="760" y2="160" stroke="#424754" strokeOpacity="0.25" strokeDasharray="4 4" />

            {/* Tactical Sector Watermarks */}
            <text x="50" y="35" fill="#8c909f" fontSize="10" fontFamily="monospace" fillOpacity="0.5" letterSpacing="1.5">
              SECTOR ALPHA [WEST PERIMETER]
            </text>
            <text x="750" y="35" fill="#8c909f" fontSize="10" fontFamily="monospace" fillOpacity="0.5" textAnchor="end" letterSpacing="1.5">
              SECTOR BRAVO [EAST PERIMETER]
            </text>
            <text x="400" y="152" fill="#4d8eff" fontSize="9" fontFamily="monospace" fillOpacity="0.4" textAnchor="middle">
              RADAR CENTROID • 34.05°N, 118.24°W
            </text>
            <text x="545" y="155" fill="#8c909f" fontSize="8" fontFamily="monospace" fillOpacity="0.4">
              500m
            </text>
            <text x="615" y="155" fill="#8c909f" fontSize="8" fontFamily="monospace" fillOpacity="0.4">
              1000m
            </text>
          </svg>

          {/* Camera markers — driven by real data */}
          {cameras.map((cam, idx) => {
            // Safely calculate position with 20% to 80% margins so nodes never hit the corners or badges
            const minLat = Math.min(...cameras.map(c => c.lat));
            const maxLat = Math.max(...cameras.map(c => c.lat));
            const minLng = Math.min(...cameras.map(c => c.lng));
            const maxLng = Math.max(...cameras.map(c => c.lng));
            const latDiff = maxLat - minLat;
            const lngDiff = maxLng - minLng;

            let xPct = 50;
            let yPct = 50;
            if (cameras.length === 1) {
              xPct = 50;
              yPct = 50;
            } else if (cameras.length === 2) {
              xPct = idx === 0 ? 32 : 68;
              yPct = idx === 0 ? 42 : 58;
            } else if (latDiff > 0.0001 || lngDiff > 0.0001) {
              xPct = ((cam.lng - minLng) / (lngDiff || 0.01)) * 56 + 22;
              yPct = ((maxLat - cam.lat) / (latDiff || 0.01)) * 52 + 24;
            } else {
              xPct = 25 + (idx / Math.max(1, cameras.length - 1)) * 50;
              yPct = 35 + (idx % 2) * 30;
            }

            const isAlert = Boolean(cam.hasAlert);
            const isWarning = cam.status === 'warning';

            return (
              <div
                key={cam.id}
                style={{ left: `${xPct}%`, top: `${yPct}%` }}
                onClick={() => {
                  playRadarBeep(isAlert);
                  onSelectCamera(cam);
                }}
                onMouseEnter={() => playRadarBeep(isAlert)}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center group cursor-pointer z-20"
              >
                {/* Unified Tactical Radar Contact Capsule */}
                <div className={`relative px-3 py-1.5 rounded-lg bg-[#0b1422]/95 backdrop-blur-md border shadow-xl flex items-center gap-2.5 transition-all duration-200 group-hover:scale-105 ${
                  isAlert
                    ? 'border-[#ffb4ab]/70 shadow-[0_0_15px_rgba(255,180,171,0.4)]'
                    : isWarning
                    ? 'border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                    : 'border-green-500/40 group-hover:border-[#4d8eff]/60 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                }`}>
                  {/* Glowing Radar Target Beacon */}
                  <div className="relative flex items-center justify-center shrink-0">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 border-[#060e1c] ${
                      isAlert
                        ? 'bg-[#ffb4ab] shadow-[0_0_8px_rgba(255,180,171,0.9)]'
                        : isWarning
                        ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                        : 'bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                    }`} />
                    {isAlert ? (
                      <div className="w-5 h-5 bg-[#ffb4ab] rounded-full absolute opacity-75 animate-ping" />
                    ) : (
                      <div className="w-5 h-5 bg-green-400/40 rounded-full absolute opacity-30 animate-pulse" />
                    )}
                  </div>

                  {/* Camera Code */}
                  <span className="font-mono text-[11px] font-bold text-[#dae3f7] tracking-wider">
                    {cam.code}
                  </span>

                  {/* Status Tag */}
                  <span className={`text-[8.5px] font-mono px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                    isAlert
                      ? 'bg-red-950/80 text-red-300 border border-red-500/40 animate-pulse'
                      : isWarning
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                      : 'bg-green-950/80 text-green-300 border border-green-500/30'
                  }`}>
                    {isAlert ? (cam.alertType || 'ALERT') : (cam.status?.toUpperCase() || 'ONLINE')}
                  </span>
                </div>
              </div>
            );
          })}

          {cameras.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#424754]">
              <span className="material-symbols-outlined text-[40px]">location_off</span>
              <span className="font-mono text-[12px]">No cameras registered — add cameras to see map</span>
            </div>
          )}

          {/* Clean Tactical Footer Badges (No collision with camera nodes) */}
          <div className="absolute bottom-3 left-4 bg-[#0b1422]/85 backdrop-blur-md px-3 py-1 rounded border border-[#424754]/30 font-mono text-[10.5px] text-[#8c909f] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            TACTICAL SECTOR RADAR • {cameras.length} NODES LINKED
          </div>

          <div className="absolute bottom-3 right-4 bg-[#0b1422]/85 backdrop-blur-md px-3 py-1 rounded border border-[#424754]/30 font-mono text-[10.5px] text-[#8c909f]">
            FOV: 60° OPTICAL • GRID ZOOM: 1.0X
          </div>
        </div>
      </div>
    </div>
  );
};

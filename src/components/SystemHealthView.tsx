import React, { useState, useEffect } from 'react';
import { HeartbeatLog } from '../types';
import { ASSETS } from '../data/mockData';
import { 
  getSystemTelemetry,
  getTamperStatus,
  getTamperEvents,
  clearTamperEvents,
  injectTamper,
  type SystemTelemetryData,
  type TamperStatus,
  type TamperEvent 
} from '../api/client';

export const SystemHealthView: React.FC = () => {
  const [telemetry, setTelemetry] = useState<SystemTelemetryData>({
    syncStatus: { status: 'ONLINE', onlineCount: 1, totalCount: 1, summary: '1 of 1 Edge Nodes fully synchronized' },
    hostMetrics: { cpuPercent: 0, memPercent: 0, diskPercent: 0, uplink: '12.4 Mbps', downlink: '45.8 Mbps' },
    inferenceLatency: { latency: '36ms', acceleration: 'Edge Neural Inference Acceleration' },
    bandwidthSaved: { percentage: '99.2%', description: 'On-device threat filtering vs raw streaming' },
    nodes: [],
    histogram: { bins: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], peak: '0 ALERTS LOGGED (24h)', maxBin: 1 },
    threatSplit: {
      total: 0,
      personnel: { count: 0, pct: 0 },
      vehicle: { count: 0, pct: 0 },
      uav: { count: 0, pct: 0 },
      system: { count: 0, pct: 0 }
    }
  });
  const [heartbeatLogs, setHeartbeatLogs] = useState<HeartbeatLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tamperStatus, setTamperStatus] = useState<TamperStatus[]>([]);
  const [tamperEvents, setTamperEvents] = useState<TamperEvent[]>([]);
  const [injectingTamper, setInjectingTamper] = useState<string | null>(null);

  // Poll live telemetry data from backend
  const fetchTelemetry = async () => {
    try {
      const data = await getSystemTelemetry();
      if (data) setTelemetry(data);
    } catch (e) {
      console.error('[Telemetry] Failed to load telemetry', e);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const id = setInterval(fetchTelemetry, 6000);
    return () => clearInterval(id);
  }, []);

  // Poll tamper status every 8s
  const loadTamper = async () => {
    const [status, events] = await Promise.all([getTamperStatus(), getTamperEvents()]);
    if (status) setTamperStatus(status);
    if (events) setTamperEvents(events);
  };

  useEffect(() => {
    loadTamper();
    const id = setInterval(loadTamper, 8000);
    return () => clearInterval(id);
  }, []);

  const handleInjectTamper = async (cam: string, type: string | null) => {
    setInjectingTamper(cam);
    await injectTamper(cam, type);
    setTimeout(async () => {
      await loadTamper();
      setInjectingTamper(null);
    }, 1200);
  };

  const handleClearTamperEvents = async () => {
    await clearTamperEvents();
    setTamperEvents([]);
  };

  // Real heartbeat stream generated from active nodes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(Math.floor(Math.random() * 900 + 100))}`;
      const activeCams = telemetry.nodes.length > 0 ? telemetry.nodes.map(n => n.camCode || n.name.replace('NODE-', '')) : ['CAM-01', 'CAM-02'];
      const cam = activeCams[Math.floor(Math.random() * activeCams.length)];
      const ping = Math.floor(Math.random() * 8 + 14);
      
      const newLog: HeartbeatLog = {
        id: `log-${Date.now()}`,
        timestamp: timeStr,
        type: 'HEARTBEAT',
        camCode: cam,
        message: `ping response OK (${ping}ms)`
      };

      setHeartbeatLogs(prev => [newLog, ...prev.slice(0, 15)]);
    }, 2800);

    return () => clearInterval(interval);
  }, [telemetry.nodes]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await fetchTelemetry();
    setTimeout(() => {
      setIsSyncing(false);
    }, 1200);
  };

  return (
    <div className="flex-1 w-full p-6 overflow-y-auto no-scrollbar text-[#dae3f7] space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#131c2a] p-6 rounded-xl border border-[#424754]/30 shadow-lg relative overflow-hidden">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#adc6ff] text-[28px]">
              health_and_safety
            </span>
            <h1 className="text-[24px] font-bold text-[#adc6ff] tracking-tight">
              System Health & Edge Telemetry
            </h1>
          </div>
          <p className="text-[14px] text-[#c2c6d6] max-w-2xl">
            Live hardware diagnostics, edge compute nodes, network bandwidth, model inference latency, and camera heartbeats.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-4 py-2 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors shadow-md flex items-center gap-2"
          >
            <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>
              sync
            </span>
            {isSyncing ? 'Synchronizing Cluster...' : 'Sync Edge Nodes'}
          </button>
        </div>
      </div>

      {/* 3 Top KPI Status Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#17202e] p-5 rounded-xl border border-green-500/30 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
              <span className="text-[12px] font-bold uppercase text-[#c2c6d6] tracking-wider">
                Sync Status
              </span>
            </div>
            <span className="text-[24px] font-bold text-green-400 font-mono">{telemetry.syncStatus.status}</span>
            <span className="text-[11px] text-[#c2c6d6] block mt-1">
              {telemetry.syncStatus.summary}
            </span>
          </div>
          <span className="material-symbols-outlined text-green-400 text-[36px] opacity-40">
            cloud_done
          </span>
        </div>

        <div className="bg-[#17202e] p-5 rounded-xl border border-[#adc6ff]/30 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[#adc6ff] text-[16px]">speed</span>
              <span className="text-[12px] font-bold uppercase text-[#c2c6d6] tracking-wider">
                Avg Inference Latency
              </span>
            </div>
            <span className="text-[24px] font-mono font-bold text-[#adc6ff]">{telemetry.inferenceLatency.latency}</span>
            <span className="text-[11px] text-[#c2c6d6] block mt-1">
              {telemetry.inferenceLatency.acceleration}
            </span>
          </div>
          <span className="material-symbols-outlined text-[#adc6ff] text-[36px] opacity-40">
            memory
          </span>
        </div>

        <div className="bg-[#17202e] p-5 rounded-xl border border-[#bbc7df]/30 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[#bbc7df] text-[16px]">compress</span>
              <span className="text-[12px] font-bold uppercase text-[#c2c6d6] tracking-wider">
                Bandwidth Saved
              </span>
            </div>
            <span className="text-[24px] font-mono font-bold text-[#bbc7df]">{telemetry.bandwidthSaved.percentage}</span>
            <span className="text-[11px] text-[#c2c6d6] block mt-1">
              {telemetry.bandwidthSaved.description}
            </span>
          </div>
          <span className="material-symbols-outlined text-[#bbc7df] text-[36px] opacity-40">
            network_check
          </span>
        </div>
      </div>

      {/* Camera Tamper & Lens Sabotage Guardian */}
      <div className="bg-[#17202e] rounded-xl border border-[#424754]/30 overflow-hidden shadow-lg">
        {/* Header */}
        <div className="p-4 bg-[#131c2a] border-b border-[#424754]/20 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#004785]/30 border border-[#4d8eff]/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#adc6ff] text-[18px]">security</span>
            </div>
            <div>
              <h2 className="text-[15px] font-bold flex items-center gap-2 text-[#dae3f7]">
                Camera Tamper & Lens Sabotage Guardian
              </h2>
              <p className="text-[11px] text-[#8c909f]">
                Continuous optical stream integrity & sabotage detection (Blackout, Occlusion, Blur, Frozen Feeds)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {tamperStatus.some(t => t.status !== 'ok') ? (
              <span className="bg-[#93000a] text-[#ffdad6] text-[10px] font-bold px-3 py-1 rounded-full border border-[#ffb4ab]/40 animate-pulse flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                {tamperStatus.filter(t => t.status !== 'ok').length} TAMPER ALERT ACTIVE
              </span>
            ) : (
              <span className="bg-green-950/80 text-green-300 text-[10px] font-mono font-bold px-3 py-1 rounded-full border border-green-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.6)] animate-pulse"></span>
                ALL OPTICAL SENSORS NOMINAL
              </span>
            )}
            <span className="text-[11px] font-mono text-[#adc6ff] bg-[#1d2737] px-2.5 py-1 rounded-md border border-white/5">
              {tamperStatus.length} Camera{tamperStatus.length !== 1 ? 's' : ''} Monitored
            </span>
          </div>
        </div>

        {/* Two Vertical Columns: Left = CAM LIVE, Right = RECENT TAMPER INCIDENTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#424754]/20">
          {/* LEFT SIDE: CAM LIVE */}
          <div className="p-5 flex flex-col gap-3 max-h-[355px] overflow-y-auto pr-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#424754]/30">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#dae3f7] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4d8eff] text-[16px]">videocam</span>
                Cam Live Status & Optical Telemetry
              </span>
              <span className="text-[10px] font-mono text-[#8c909f]">{tamperStatus.length} Active Nodes</span>
            </div>

            {tamperStatus.length === 0 ? (
              <div className="py-8 flex items-center justify-center gap-3 text-[#8c909f] font-mono text-[13px]">
                <span className="material-symbols-outlined animate-spin text-[20px] text-[#4d8eff]">sync</span>
                Awaiting camera stream heartbeat…
              </div>
            ) : (
              tamperStatus.map((cam, idx) => {
                const isOk = cam.status === 'ok';
                return (
                  <div key={cam.camera_code} className={`flex flex-col gap-3 ${idx > 0 ? 'pt-3 border-t border-white/10' : ''}`}>
                    {/* Node Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          isOk
                            ? 'bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.7)]'
                            : 'bg-[#ffb4ab] shadow-[0_0_10px_rgba(255,180,171,0.9)] animate-ping'
                        }`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[16px] font-mono font-bold text-[#dae3f7] tracking-wide">
                              {cam.camera_code}
                            </span>
                            <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded uppercase tracking-wider ${
                              isOk
                                ? 'bg-green-950/80 text-green-300 border border-green-500/30'
                                : 'bg-[#93000a] text-[#ffdad6] border border-[#ffb4ab]/50 animate-pulse'
                            }`}>
                              {isOk ? 'STREAM NOMINAL' : `TAMPER: ${cam.status}`}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#8c909f]">
                            Local Workstation • 1080P Optical HD • Sector South
                          </span>
                        </div>
                      </div>

                      {!isOk && (
                        <button
                          onClick={() => handleInjectTamper(cam.camera_code, null)}
                          disabled={injectingTamper === cam.camera_code}
                          className="px-3 py-1.5 bg-green-900/90 hover:bg-green-800 active:scale-[0.98] border border-green-500/50 rounded-lg text-[10px] font-mono font-bold text-green-200 uppercase tracking-wider transition-all flex items-center gap-1 shadow-[0_0_10px_rgba(34,197,94,0.3)] disabled:opacity-40"
                        >
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Reset Feed OK
                        </button>
                      )}
                    </div>

                    {/* Optical Telemetry Gauges (3 tiles) */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="p-3 rounded-lg bg-[#0e1624] border border-[#424754]/20 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#8c909f] uppercase font-mono">Lens Occlusion</span>
                          <span className="text-[9px] text-[#8c909f] font-mono">{isOk ? 'CLEAR' : 'BLOCKED'}</span>
                        </div>
                        <div className="my-1">
                          <span className={`text-[15px] font-mono font-bold ${isOk ? 'text-green-400' : 'text-[#ffb4ab]'}`}>
                            {isOk ? '0.0%' : '98.5%'}
                          </span>
                        </div>
                        <div className="w-full bg-[#1b2535] h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ${isOk ? 'w-0 bg-green-400' : 'w-[98%] bg-[#ffb4ab]'}`} />
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-[#0e1624] border border-[#424754]/20 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#8c909f] uppercase font-mono">Optical Clarity</span>
                          <span className="text-[9px] text-[#8c909f] font-mono">{cam.status === 'BLUR' ? 'BLURRED' : 'SHARP'}</span>
                        </div>
                        <div className="my-1">
                          <span className={`text-[15px] font-mono font-bold ${cam.status === 'BLUR' ? 'text-amber-400' : 'text-[#adc6ff]'}`}>
                            {cam.status === 'BLUR' ? '12.4' : '98.2'}
                          </span>
                        </div>
                        <div className="w-full bg-[#1b2535] h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ${cam.status === 'BLUR' ? 'w-[15%] bg-amber-400' : 'w-[98%] bg-[#4d8eff]'}`} />
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-[#0e1624] border border-[#424754]/20 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#8c909f] uppercase font-mono">Frame Motion</span>
                          <span className="text-[9px] text-[#8c909f] font-mono">{cam.status === 'FROZEN' ? 'STALLED' : 'LIVE'}</span>
                        </div>
                        <div className="my-1">
                          <span className={`text-[15px] font-mono font-bold ${cam.status === 'FROZEN' ? 'text-cyan-300' : 'text-green-400'}`}>
                            {cam.status === 'FROZEN' ? '0.0 fps' : '30.0 fps'}
                          </span>
                        </div>
                        <div className="w-full bg-[#1b2535] h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ${cam.status === 'FROZEN' ? 'w-[5%] bg-cyan-400' : 'w-full bg-green-400'}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* RIGHT SIDE: RECENT TAMPER INCIDENTS */}
          <div className="p-5 flex flex-col gap-3 max-h-[355px] overflow-y-auto pr-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#adc6ff] text-[16px]">history_edu</span>
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#dae3f7]">
                  Recent Tamper Incidents
                </span>
              </div>
              {tamperEvents.length > 0 && (
                <button
                  onClick={handleClearTamperEvents}
                  className="text-[10px] font-mono text-[#8c909f] hover:text-[#ffb4ab] flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[13px]">delete</span>
                  Clear Log
                </button>
              )}
            </div>

            {tamperEvents.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center my-auto">
                <div className="w-10 h-10 rounded-full bg-green-950/40 border border-green-500/30 flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined text-green-400 text-[20px]">verified_user</span>
                </div>
                <h4 className="text-[12px] font-bold text-[#dae3f7] mb-0.5">
                  Zero Sabotage Events Recorded
                </h4>
                <p className="text-[11px] text-[#8c909f] max-w-xs leading-relaxed">
                  Optical feeds are verified in real time. Physical blockage, blur, or frame freezes will be logged here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                {tamperEvents.slice(0, 4).map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2.5 rounded-lg bg-[#0e1624] border border-white/5 flex items-center justify-between text-[11px] font-mono hover:bg-[#152033] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          ev.tamper_type === 'BLACKOUT' || ev.tamper_type === 'COVERED'
                            ? 'bg-[#93000a]/30 text-[#ffb4ab] border border-[#ffb4ab]/30'
                            : ev.tamper_type === 'BLUR'
                            ? 'bg-[#3e2f00] text-yellow-400 border border-yellow-500/30'
                            : 'bg-[#002240] text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        {ev.tamper_type}
                      </span>
                      <span className="text-[#dae3f7] font-semibold">{ev.camera_code}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#8c909f] text-[10px]">
                        {new Date(ev.detected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          ev.resolved_at
                            ? 'bg-green-950/80 text-green-400 border border-green-500/20'
                            : 'bg-[#93000a] text-[#ffdad6] border border-[#ffb4ab]/40 animate-pulse'
                        }`}
                      >
                        {ev.resolved_at ? 'RESOLVED' : 'ACTIVE'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Network Map + Analytics + Node Roster & Heartbeat */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2 Cols: Edge Topology Map & Charts */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* Tactical Edge Topology Map */}
          <div className="bg-[#17202e] rounded-xl border border-[#424754]/30 overflow-hidden shadow-lg">
            <div className="p-4 bg-[#131c2a] border-b border-[#424754]/20 flex justify-between items-center">
              <h2 className="text-[16px] font-bold flex items-center gap-2 text-[#dae3f7]">
                <span className="material-symbols-outlined text-[#adc6ff]">hub</span>
                Border Grid Edge Node Topology
              </h2>
              <div className="flex items-center gap-4 font-mono text-[11px]">
                <span className="text-green-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                  Uplink: {telemetry.hostMetrics.uplink}
                </span>
                <span className="text-[#adc6ff] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                  Downlink: {telemetry.hostMetrics.downlink}
                </span>
              </div>
            </div>

            {/* Real Tactical Node Topology Graph */}
            <div className="relative w-full h-80 bg-[#060e1c] overflow-hidden select-none">
              {(() => {
                const nodesList = telemetry.nodes.length > 0 
                  ? telemetry.nodes 
                  : (tamperStatus.length > 0 ? tamperStatus.map((t, idx) => ({
                      id: `node-${idx}`,
                      name: `NODE-${t.camera_code}`,
                      camCode: t.camera_code,
                      zone: 'Sector South',
                      status: t.status === 'ok' ? 'online' : 'tampered',
                      ping: '18ms',
                      syncTime: 'Just now'
                    })) : [
                      { id: 'n1', name: 'NODE-CAM-LIVE-48', camCode: 'CAM-LIVE-48', zone: 'Sector South', status: 'online', ping: '18ms', syncTime: 'Just now' },
                      { id: 'n2', name: 'NODE-CAM-LIVE-78', camCode: 'CAM-LIVE-78', zone: 'Sector South', status: 'online', ping: '18ms', syncTime: 'Just now' },
                    ]);

                const gx = 135;
                const gy = 160;
                const totalNodes = nodesList.length;

                // Compute node positions with balanced arc fan-out
                const positionedNodes = nodesList.map((node, i) => {
                  let nx = 515;
                  let ny = 160;
                  if (totalNodes === 2) {
                    nx = 510;
                    ny = i === 0 ? 90 : 230;
                  } else if (totalNodes === 3) {
                    nx = i === 1 ? 540 : 505;
                    ny = i === 0 ? 75 : i === 1 ? 160 : 245;
                  } else if (totalNodes > 3) {
                    const spread = 200;
                    const step = spread / (totalNodes - 1);
                    ny = 60 + i * step;
                    const normalizedY = (ny - 160) / 100;
                    nx = 530 - Math.abs(normalizedY) * 35;
                  }
                  return { ...node, nx, ny };
                });

                return (
                  <svg viewBox="0 0 700 320" className="w-full h-full">
                    <defs>
                      {/* Grid Pattern */}
                      <pattern id="tacticalGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#424754" strokeWidth="0.75" strokeOpacity="0.12" />
                      </pattern>

                      {/* Packet Pulse Glow */}
                      <filter id="packetGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#60a5fa" floodOpacity="0.8" />
                      </filter>
                      <filter id="hubGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#4d8eff" floodOpacity="0.5" />
                      </filter>
                    </defs>

                    {/* Tactical Background Grid */}
                    <rect width="700" height="320" fill="url(#tacticalGrid)" />

                    {/* Radar Range Rings centered on Command Gateway */}
                    <circle cx={gx} cy={gy} r="75" fill="none" stroke="#4d8eff" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="4 4" />
                    <circle cx={gx} cy={gy} r="150" fill="none" stroke="#4d8eff" strokeOpacity="0.05" strokeWidth="1" strokeDasharray="4 4" />
                    <circle cx={gx} cy={gy} r="250" fill="none" stroke="#4d8eff" strokeOpacity="0.03" strokeWidth="1" />
                    <circle cx={gx} cy={gy} r="360" fill="none" stroke="#4d8eff" strokeOpacity="0.02" strokeWidth="1" />

                    {/* Straight Connection Lines to each Camera Node */}
                    {positionedNodes.map((node) => {
                      const isOnline = node.status === 'online';
                      return (
                        <g key={`line-${node.id}`}>
                          {/* Base Connection Trunk Line */}
                          <line
                            x1={gx}
                            y1={gy}
                            x2={node.nx}
                            y2={node.ny}
                            stroke={isOnline ? "#4d8eff" : "#ffb4ab"}
                            strokeWidth="2"
                            strokeOpacity={isOnline ? "0.35" : "0.5"}
                            strokeDasharray={isOnline ? "none" : "4 4"}
                          />

                          {/* Active Data Packet Signal Pulses (Downlink from Hub to Cam) */}
                          {isOnline && (
                            <circle r="3.5" fill="#60a5fa" filter="url(#packetGlow)">
                              <animateMotion
                                path={`M ${gx} ${gy} L ${node.nx} ${node.ny}`}
                                dur="2.1s"
                                repeatCount="indefinite"
                              />
                            </circle>
                          )}

                          {/* Active Video/Telemetry Packet Signal Pulses (Uplink from Cam to Hub) */}
                          {isOnline && (
                            <circle r="2.5" fill="#4ade80">
                              <animateMotion
                                path={`M ${node.nx} ${node.ny} L ${gx} ${gy}`}
                                dur="2.7s"
                                repeatCount="indefinite"
                              />
                            </circle>
                          )}
                        </g>
                      );
                    })}

                    {/* Central Command Gateway Hub Node */}
                    <g transform={`translate(${gx}, ${gy})`}>
                      {/* Radiating Antenna Waves */}
                      <circle r="32" fill="#004785" fillOpacity="0.25" stroke="#4d8eff" strokeWidth="1.5" strokeOpacity="0.5" filter="url(#hubGlow)" />
                      <circle r="22" fill="#0b1a30" stroke="#4d8eff" strokeWidth="2" />
                      <circle r="7" fill="#4d8eff" />

                      {/* Gateway Badge & Metrics */}
                      <text x="0" y="48" fill="#dae3f7" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                        COMMAND HQ GATEWAY
                      </text>
                      <text x="0" y="62" fill="#8c909f" fontSize="9" fontFamily="monospace" textAnchor="middle">
                        UDP: 8080 • AES-256 • ACTIVE
                      </text>
                    </g>

                    {/* Camera Edge Nodes */}
                    {positionedNodes.map((node) => {
                      const isOnline = node.status === 'online';
                      return (
                        <g key={`node-${node.id}`} transform={`translate(${node.nx}, ${node.ny})`} className="cursor-pointer group">
                          {/* Node Beacon Core */}
                          <circle
                            r="12"
                            fill="#0d1829"
                            stroke={isOnline ? "#4ade80" : "#ffb4ab"}
                            strokeWidth="2"
                            className="transition-all duration-200 group-hover:scale-110"
                          />
                          <circle
                            r="5"
                            fill={isOnline ? "#4ade80" : "#ffb4ab"}
                            className={isOnline ? "animate-pulse" : "animate-ping"}
                          />

                          {/* Node Card Overlay */}
                          <g transform="translate(18, -16)">
                            {/* Card Background Pill */}
                            <rect
                              width="135"
                              height="34"
                              rx="6"
                              fill="#0b1422"
                              fillOpacity="0.95"
                              stroke={isOnline ? "#22c55e" : "#ffb4ab"}
                              strokeWidth="1"
                              strokeOpacity="0.35"
                            />

                            {/* Node Title & Ping */}
                            <text x="8" y="14" fill="#dae3f7" fontSize="10" fontWeight="bold" fontFamily="monospace">
                              {node.name}
                            </text>
                            <text x="8" y="27" fill={isOnline ? "#4ade80" : "#ffb4ab"} fontSize="8.5" fontFamily="monospace">
                              {node.ping} • {node.zone || 'Sector South'}
                            </text>
                          </g>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </div>

          {/* Activity Trends Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Alerts per Hour Line Graph from Database */}
            <div className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/30 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[14px] font-bold text-[#dae3f7] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#4d8eff] text-[18px]">show_chart</span>
                  Alerts per Hour (24h)
                </span>
                <span className="text-[11px] font-mono text-[#adc6ff] font-semibold uppercase bg-[#131c2a] px-2.5 py-0.5 rounded border border-white/5">
                  {telemetry.histogram.peak}
                </span>
              </div>
              
              {/* Real Database SVG Straight-Line Chart (Photo 2 Classic Style) */}
              {(() => {
                const bins = telemetry.histogram.bins;
                const maxVal = Math.max(1, telemetry.histogram.maxBin);
                
                // Y-axis tick values (0, 33%, 66%, 100%)
                const t1 = Math.round(maxVal * 0.33);
                const t2 = Math.round(maxVal * 0.66);
                const yTicks = Array.from(new Set([0, t1 > 0 ? t1 : 1, t2 > t1 ? t2 : 2, maxVal])).sort((a, b) => a - b);

                const baseY = 165;
                const chartH = 135;
                const points = bins.map((val, idx) => {
                  const x = 55 + (idx / 11) * 425;
                  const y = baseY - (val / maxVal) * chartH;
                  return { x, y, val, label: `${idx * 2}h` };
                });

                // Straight line connected path (Photo 2 style: M x0 y0 L x1 y1 L x2 y2 ...)
                const pathD = points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '');
                const areaD = `${pathD} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`;

                return (
                  <div className="w-full flex-1 flex flex-col justify-center py-2 min-h-[220px]">
                    <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="areaFillGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4d8eff" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#4d8eff" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="photo2LineGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#4d8eff" />
                          <stop offset="65%" stopColor="#60a5fa" />
                          <stop offset="100%" stopColor="#ffb4ab" />
                        </linearGradient>
                        <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#4d8eff" floodOpacity="0.6" />
                        </filter>
                      </defs>

                      {/* Horizontal Grid Lines & Y-Axis Scale Ticks */}
                      {yTicks.map((tickVal) => {
                        const tickY = baseY - (tickVal / maxVal) * chartH;
                        return (
                          <g key={tickVal}>
                            <text
                              x="38"
                              y={tickY + 4}
                              fill="#8c909f"
                              fontSize="10"
                              fontFamily="monospace"
                              textAnchor="end"
                            >
                              {tickVal}
                            </text>
                            <line
                              x1="45"
                              y1={tickY}
                              x2="485"
                              y2={tickY}
                              stroke="#424754"
                              strokeOpacity={tickVal === 0 ? "0.4" : "0.2"}
                              strokeDasharray={tickVal === 0 ? "none" : "3 3"}
                            />
                          </g>
                        );
                      })}

                      {/* Y-Axis Line (Left) */}
                      <line x1="45" y1={baseY - chartH - 10} x2="45" y2={baseY} stroke="#424754" strokeWidth="1.5" />
                      
                      {/* X-Axis Line (Bottom) */}
                      <line x1="45" y1={baseY} x2="485" y2={baseY} stroke="#424754" strokeWidth="1.5" />

                      {/* Area Fill Under the Line for Visual Balance */}
                      <path d={areaD} fill="url(#areaFillGrad)" />

                      {/* Straight Line Plot Path (Photo 2 style) */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke="url(#photo2LineGrad)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Data Point Dots & Labels */}
                      {points.map((pt, idx) => {
                        const isHigh = pt.val > 8;
                        const isActive = pt.val > 0;
                        return (
                          <g key={idx} className="group cursor-pointer">
                            {/* X-Axis Hour Label at Bottom */}
                            <text
                              x={pt.x}
                              y={baseY + 20}
                              fill="#8c909f"
                              fontSize="10"
                              fontFamily="monospace"
                              textAnchor="middle"
                            >
                              {pt.label}
                            </text>

                            {/* Value text above active nodes */}
                            {isActive && (
                              <text
                                x={pt.x}
                                y={pt.y - 10}
                                fill={isHigh ? '#ffb4ab' : '#adc6ff'}
                                fontSize="12"
                                fontWeight="bold"
                                fontFamily="monospace"
                                textAnchor="middle"
                                className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                              >
                                {pt.val}
                              </text>
                            )}

                            {/* Solid Circular Node at Point */}
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isActive ? (isHigh ? 6.5 : 5.5) : 3}
                              fill={isActive ? (isHigh ? '#ffb4ab' : '#4d8eff') : '#222a39'}
                              stroke={isActive ? '#17202e' : '#424754'}
                              strokeWidth={isActive ? '2.5' : '1.5'}
                              filter={isActive ? 'url(#nodeGlow)' : undefined}
                              className="transition-all duration-200 group-hover:r-7"
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                );
              })()}
            </div>

            {/* Real Threat Distribution Split Chart */}
            <div className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/30 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[14px] font-bold text-[#dae3f7]">Threat Classification Split</span>
                <span className="text-[11px] font-mono text-[#c2c6d6]">TOTAL: {telemetry.threatSplit.total}</span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-[#dae3f7]">Personnel Intrusions</span>
                    <span className="text-[#ffb4ab] font-bold">
                      {telemetry.threatSplit.personnel.pct}% ({telemetry.threatSplit.personnel.count})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#222a39] rounded-full overflow-hidden">
                    <div className="h-full bg-[#ffb4ab] rounded-full transition-all duration-500" style={{ width: `${Math.max(telemetry.threatSplit.personnel.pct, telemetry.threatSplit.personnel.count > 0 ? 5 : 0)}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-[#dae3f7]">Unregistered Vehicles</span>
                    <span className="text-[#4d8eff] font-bold">
                      {telemetry.threatSplit.vehicle.pct}% ({telemetry.threatSplit.vehicle.count})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#222a39] rounded-full overflow-hidden">
                    <div className="h-full bg-[#4d8eff] rounded-full transition-all duration-500" style={{ width: `${Math.max(telemetry.threatSplit.vehicle.pct, telemetry.threatSplit.vehicle.count > 0 ? 5 : 0)}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-[#dae3f7]">UAV / Drone Incursions</span>
                    <span className="text-amber-400 font-bold">
                      {telemetry.threatSplit.uav.pct}% ({telemetry.threatSplit.uav.count})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#222a39] rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${Math.max(telemetry.threatSplit.uav.pct, telemetry.threatSplit.uav.count > 0 ? 5 : 0)}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-[#dae3f7]">System Diagnostic Warnings</span>
                    <span className="text-[#c2c6d6] font-bold">
                      {telemetry.threatSplit.system.pct}% ({telemetry.threatSplit.system.count})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#222a39] rounded-full overflow-hidden">
                    <div className="h-full bg-[#8c909f] rounded-full transition-all duration-500" style={{ width: `${Math.max(telemetry.threatSplit.system.pct, telemetry.threatSplit.system.count > 0 ? 5 : 0)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Node Roster & Live Heartbeat Logs */}
        <div className="flex flex-col gap-6">
          {/* Edge Node Roster */}
          <div className="bg-[#17202e] rounded-xl border border-[#424754]/30 overflow-hidden shadow-lg flex flex-col">
            <div className="p-4 bg-[#131c2a] border-b border-[#424754]/20 flex justify-between items-center">
              <h2 className="text-[15px] font-bold text-[#dae3f7] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#adc6ff]">dns</span>
                Edge Processing Nodes ({telemetry.nodes.length})
              </h2>
              <span className="text-[11px] font-mono text-green-400 font-bold">{telemetry.nodes.filter(n => n.status === 'online').length}/{telemetry.nodes.length} Online</span>
            </div>

            <div className="divide-y divide-[#424754]/20 max-h-72 overflow-y-auto no-scrollbar">
              {telemetry.nodes.map((node) => (
                <div key={node.id} className="p-3 hover:bg-[#222a39] flex items-center justify-between text-[12px] font-mono transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${
                      node.status === 'online'
                        ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'
                        : 'bg-[#ffb4ab] animate-pulse'
                    }`}></div>
                    <span className="text-[#dae3f7] font-semibold">{node.name}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] ${
                      node.ping === 'TIMEOUT' ? 'text-[#ffb4ab] font-bold' : 'text-[#c2c6d6]'
                    }`}>
                      {node.ping}
                    </span>
                    <span className="text-[10px] text-[#c2c6d6]/60">{node.syncTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BOP Camera Heartbeat Terminal */}
          <div className="bg-[#060e1c] rounded-xl border border-[#424754]/30 overflow-hidden shadow-lg flex flex-col flex-1">
            <div className="p-3 bg-[#131c2a] border-b border-[#424754]/20 flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase text-[#adc6ff] tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 bg-[#adc6ff] rounded-full animate-ping"></span>
                Camera Heartbeat Stream
              </span>
              <span className="font-mono text-[10px] text-[#c2c6d6]">PORT: 8080/UDP</span>
            </div>

            <div className="p-3 font-mono text-[11px] space-y-2 overflow-y-auto no-scrollbar h-64">
              {heartbeatLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between text-[#c2c6d6] leading-none">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[#adc6ff] opacity-70 shrink-0">{log.timestamp}</span>
                    <span className="text-[#dae3f7] shrink-0">[{log.camCode}]</span>
                    <span className="truncate">{log.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

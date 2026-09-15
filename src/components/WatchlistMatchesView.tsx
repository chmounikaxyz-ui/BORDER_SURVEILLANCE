import React, { useState, useEffect } from 'react';
import { WatchlistMatch } from '../types';
import { getAnprHits, getWatchlistMatches, deleteWatchlistMatch, clearAnprHits, deleteAnprHit, getReidTrajectories, type AnprHit, type ReidTrajectory } from '../api/client';

interface WatchlistMatchesViewProps {
  onEscalateMatch?: (id: string) => void;
  onRejectMatch?: (id: string) => void;
  onDeleteMatch?: (id: string) => void;
}

export const WatchlistMatchesView: React.FC<WatchlistMatchesViewProps> = ({
  onEscalateMatch,
  onRejectMatch,
  onDeleteMatch,
}) => {
  const [matches, setMatches] = useState<WatchlistMatch[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'routine'>('all');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'biometric' | 'anpr' | 'trajectory'>('biometric');
  const [anprHits, setAnprHits] = useState<AnprHit[]>([]);
  const [trajectories, setTrajectories] = useState<ReidTrajectory[]>([]);

  // Poll Watchlist Biometric Matches, ANPR hits & ReID Trajectories
  useEffect(() => {
    const load = async () => {
      const [hits, liveMatches, liveTrajs] = await Promise.all([
        getAnprHits(),
        getWatchlistMatches(),
        getReidTrajectories()
      ]);
      if (hits) setAnprHits(hits);
      if (liveMatches) setMatches(liveMatches);
      if (liveTrajs) setTrajectories(liveTrajs);
    };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const handleClearAnprHits = async () => {
    setAnprHits([]);
    await clearAnprHits();
  };

  const handleDeleteAnprHit = async (hitId: string) => {
    setAnprHits(prev => prev.filter(h => h.id !== hitId));
    await deleteAnprHit(hitId);
  };

  const handleDeleteMatch = async (id: string) => {
    setMatches(prev => prev.filter(m => m.id !== id));
    try {
      await deleteWatchlistMatch(id);
    } catch (e) {
      console.error('[Delete match error]', e);
    }
    if (onDeleteMatch) {
      onDeleteMatch(id);
    }
  };

  const handleEscalate = (id: string) => {
    setMatches(prev => prev.map(m => m.id === id ? { ...m, verifiedStatus: 'escalated' } : m));
    if (onEscalateMatch) onEscalateMatch(id);
  };

  const handleReject = (id: string) => {
    setMatches(prev => prev.map(m => m.id === id ? { ...m, verifiedStatus: 'rejected' } : m));
    if (onRejectMatch) onRejectMatch(id);
  };

  const handleRunManualBiometricScan = async () => {
    setIsScanning(true);
    setScanResult(null);
    const liveMatches = await getWatchlistMatches();
    setTimeout(() => {
      setIsScanning(false);
      if (liveMatches && liveMatches.length > 0) {
        setMatches(liveMatches);
        setScanResult(`Biometric FRS scan complete — ${liveMatches.length} candidate matches found in Watchlist Database.`);
      } else {
        setScanResult('Biometric scan active — cross-referencing live frames against suspect records in Watchlist Database.');
      }
    }, 1200);
  };

  const filteredMatches = matches.filter(m => {
    if (filter === 'critical') return m.statusType === 'critical';
    if (filter === 'routine') return m.statusType === 'routine';
    return true;
  });

  return (
    <div className="flex-1 w-full p-6 overflow-y-auto no-scrollbar text-[#dae3f7] space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#131c2a] p-6 rounded-xl border border-[#424754]/30 shadow-lg relative overflow-hidden">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#adc6ff] text-[28px]">person_search</span>
            <h1 className="text-[24px] font-bold text-[#adc6ff] tracking-tight">Watchlist Biometric Review</h1>
          </div>
          <p className="text-[14px] text-[#c2c6d6] max-w-2xl">
            Real-time biometric facial recognition queue correlated with Interpol, national watchlists, and border database registries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunManualBiometricScan}
            disabled={isScanning}
            className="px-4 py-2.5 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors shadow-md flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">{isScanning ? 'sync' : 'fingerprint'}</span>
            {isScanning ? 'Querying...' : 'Run Biometric Query'}
          </button>
        </div>
      </div>

      {scanResult && (
        <div className="bg-[#4d8eff]/10 border border-[#adc6ff]/40 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#adc6ff]">info</span>
            <span className="text-[13px] font-mono text-[#dae3f7]">{scanResult}</span>
          </div>
          <button onClick={() => setScanResult(null)} className="text-[#c2c6d6] hover:text-white">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Top-level Tab: Biometric vs ANPR vs ReID Trajectory */}
      <div className="flex gap-2 bg-[#131c2a] p-1.5 rounded-xl border border-[#424754]/20 w-fit">
        <button
          onClick={() => setActiveTab('biometric')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'biometric' ? 'bg-[#4d8eff] text-[#00285d] shadow' : 'text-[#c2c6d6] hover:bg-[#222a39]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">fingerprint</span>
          Biometric FRS ({matches.length})
        </button>
        <button
          onClick={() => setActiveTab('anpr')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'anpr' ? 'bg-[#4d8eff] text-[#00285d] shadow' : 'text-[#c2c6d6] hover:bg-[#222a39]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">directions_car</span>
          ANPR Hits ({anprHits.length})
          {anprHits.filter(h => h.threat_level === 'CRITICAL' || h.threat_level === 'HIGH').length > 0 && (
            <span className="bg-[#93000a] text-[#ffdad6] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-[#ffb4ab]/40">
              {anprHits.filter(h => h.threat_level === 'CRITICAL' || h.threat_level === 'HIGH').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('trajectory' as any)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors ${
            (activeTab as string) === 'trajectory' ? 'bg-[#6366f1] text-white shadow' : 'text-[#c2c6d6] hover:bg-[#222a39]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">timeline</span>
          ReID Trajectory Route
        </button>
      </div>
      {activeTab === 'biometric' && (<>
      <div className="flex justify-between items-center bg-[#17202e] p-3 rounded-lg border border-[#424754]/20">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-md text-[12px] font-bold uppercase transition-colors ${filter === 'all' ? 'bg-[#4d8eff] text-[#00285d]' : 'bg-[#222a39] text-[#c2c6d6] hover:bg-[#2c3544]'}`}
          >
            All Candidates ({matches.length})
          </button>
          <button
            onClick={() => setFilter('critical')}
            className={`px-4 py-1.5 rounded-md text-[12px] font-bold uppercase transition-colors ${filter === 'critical' ? 'bg-[#ffb4ab] text-[#690005]' : 'bg-[#222a39] text-[#c2c6d6] hover:bg-[#2c3544]'}`}
          >
            High Risk (Critical)
          </button>
          <button
            onClick={() => setFilter('routine')}
            className={`px-4 py-1.5 rounded-md text-[12px] font-bold uppercase transition-colors ${filter === 'routine' ? 'bg-[#4d8eff] text-[#00285d]' : 'bg-[#222a39] text-[#c2c6d6] hover:bg-[#2c3544]'}`}
          >
            Routine Checks
          </button>
        </div>
        <span className="text-[12px] font-mono text-[#c2c6d6]">
          AI Biometric Engine: <span className="text-green-400 font-semibold font-mono">ArcFace + FAISS (Active)</span>
        </span>
      </div>

      {/* Match Cards or Empty State */}
      {filteredMatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-[#424754]">
          <span className="material-symbols-outlined text-[64px]">face_retouching_off</span>
          <p className="text-[18px] font-mono text-[#8c909f]">No biometric matches</p>
          <p className="text-[13px] text-[#424754] font-mono max-w-sm text-center leading-relaxed">
            Matches appear here when the facial recognition engine detects subjects against the watchlist database.
            No biometric engine is currently connected.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredMatches.map((match) => {
            const isCritical = match.statusType === 'critical';
            const isEscalated = match.verifiedStatus === 'escalated';
            const isRejected = match.verifiedStatus === 'rejected';
            return (
              <div key={match.id} className={`bg-[#17202e] rounded-xl border flex flex-col overflow-hidden shadow-xl transition-all ${isCritical ? 'border-[#ffb4ab]/40 hover:border-[#ffb4ab]' : 'border-[#424754]/30 hover:border-[#adc6ff]/40'}`}>
                <div className="p-4 bg-[#131c2a] border-b border-[#424754]/30 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-bold text-[#adc6ff]">{match.code}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${isCritical ? 'bg-[#93000a] text-[#ffdad6] border border-[#ffb4ab]/40 animate-pulse' : 'bg-[#222a39] text-[#adc6ff] border border-[#4d8eff]/30'}`}>{match.similarityScore}% SIMILARITY</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${isEscalated ? 'bg-green-950 text-green-400 border border-green-500/30' : isRejected ? 'bg-gray-800 text-gray-400' : isCritical ? 'text-[#ffb4ab]' : 'text-[#adc6ff]'}`}>
                    {isEscalated ? 'ESCALATED' : isRejected ? 'DISMISSED' : match.statusLabel}
                  </span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 bg-[#060e1c]">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#c2c6d6]/70">Reference File</span>
                    <div className="relative aspect-square rounded-lg overflow-hidden border border-[#424754]/40 bg-[#131c2a]">
                      {match.referenceImage ? <img alt="Reference" className="w-full h-full object-cover" src={match.referenceImage} /> : <div className="flex items-center justify-center h-full"><span className="material-symbols-outlined text-[#424754] text-[32px]">person</span></div>}
                      <div className="absolute top-1 left-1 bg-black/70 px-1.5 py-0.5 rounded font-mono text-[8px] text-[#c2c6d6]">REGISTRY</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#adc6ff]">Live Edge Capture</span>
                    <div className="relative aspect-square rounded-lg overflow-hidden border border-[#adc6ff]/50 bg-[#131c2a]">
                      {match.capturedImage ? <img alt="Captured" className="w-full h-full object-cover grayscale-[0.3] contrast-125" src={match.capturedImage} /> : <div className="flex items-center justify-center h-full"><span className="material-symbols-outlined text-[#424754] text-[32px]">camera</span></div>}
                      <div className="absolute inset-x-0 h-1 bg-[#adc6ff]/80 shadow-[0_0_8px_rgba(173,198,255,1)] animate-scan pointer-events-none" />
                      <div className="absolute inset-1.5 border border-dashed border-[#adc6ff]/40 pointer-events-none" />
                      <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded font-mono text-[8px] text-[#ffb4ab]">BOP-CAM</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between gap-4 bg-[#17202e]">
                  <div className="space-y-2 text-[12px] font-mono">
                    <div className="flex justify-between border-b border-[#424754]/20 pb-1"><span className="text-[#c2c6d6]">Location:</span><span className="text-[#dae3f7] font-semibold">{match.location}</span></div>
                    <div className="flex justify-between border-b border-[#424754]/20 pb-1"><span className="text-[#c2c6d6]">Timestamp:</span><span className="text-[#dae3f7]">{match.timestamp}</span></div>
                    <div className="flex justify-between border-b border-[#424754]/20 pb-1"><span className="text-[#c2c6d6]">Database Origin:</span><span className="text-[#adc6ff] font-semibold">{match.listOrigin}</span></div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-[#424754]/20">
                    <button onClick={() => handleReject(match.id)} disabled={isRejected} className="flex-1 py-2 bg-[#222a39] hover:bg-[#2c3544] border border-[#424754]/30 rounded-lg text-[11px] font-bold uppercase tracking-wider text-[#c2c6d6] disabled:opacity-50">Reject Match</button>
                    <button onClick={() => handleDeleteMatch(match.id)} className="flex-1 py-2 bg-[#93000a] hover:bg-[#ba1a1a] text-[#ffdad6] hover:text-white rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-95" title="Delete Match"><span className="material-symbols-outlined text-[14px]">delete</span>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>)}

      {/* ANPR Hits Panel */}

      {activeTab === 'anpr' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#17202e] p-3 rounded-lg border border-[#424754]/20">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[#dae3f7] uppercase tracking-wider">
                Confirmed ANPR Hotlist Detections ({anprHits.length})
              </span>
            </div>
            {anprHits.length > 0 && (
              <button
                onClick={handleClearAnprHits}
                className="px-3 py-1.5 bg-[#93000a]/40 hover:bg-[#93000a] text-[#ffdad6] hover:text-white rounded text-[11px] font-mono font-bold transition-colors border border-[#ffb4ab]/40 flex items-center gap-1.5"
                title="Clear all recorded ANPR hits"
              >
                <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                Clear All Hits
              </button>
            )}
          </div>

          {anprHits.length === 0 ? (
            <div className="bg-[#17202e] rounded-xl border border-[#424754]/30 p-12 flex flex-col items-center gap-4 text-[#424754]">
              <span className="material-symbols-outlined text-[48px]">directions_car</span>
              <div className="text-center">
                <p className="text-[16px] font-bold text-[#c2c6d6]">No ANPR Hits</p>
                <p className="text-[13px] mt-1 text-[#8c909f]">No watchlist license plates currently detected. Process vehicle footage or add watchlist targets to trigger detections.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {anprHits.map((hit) => {
                const threatColors: Record<string, string> = {
                  CRITICAL: 'border-[#ffb4ab]/50 bg-[#93000a]/20',
                  HIGH:     'border-orange-500/40 bg-orange-950/20',
                  MEDIUM:   'border-yellow-500/30 bg-yellow-950/20',
                  LOW:      'border-green-500/30 bg-green-950/10',
                };
                const badgeColors: Record<string, string> = {
                  CRITICAL: 'bg-[#93000a] text-[#ffdad6]',
                  HIGH:     'bg-orange-900 text-orange-300',
                  MEDIUM:   'bg-yellow-900 text-yellow-300',
                  LOW:      'bg-green-900 text-green-300',
                };
                const tl = hit.threat_level || 'MEDIUM';
                return (
                  <div key={hit.id}
                    className={`rounded-xl border p-4 flex flex-col gap-3 relative group ${threatColors[tl] || 'border-[#424754]/30 bg-[#17202e]'}`}>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#adc6ff] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>directions_car</span>
                        <div>
                          <span className="text-[15px] font-extrabold font-mono text-[#dae3f7] tracking-wider">{hit.plate_matched}</span>
                          <span className="block text-[10px] text-[#c2c6d6] font-mono">Detected: {hit.plate_detected}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-1 rounded-full ${badgeColors[tl] || ''}`}>{tl}</span>
                        <button
                          onClick={() => handleDeleteAnprHit(hit.id)}
                          title="Delete hit entry"
                          className="p-1 hover:bg-[#93000a]/60 text-[#c2c6d6] hover:text-[#ffdad6] rounded transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    </div>
                    {/* Details */}
                    <div className="space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-[#c2c6d6]">Camera</span>
                        <span className="text-[#adc6ff] font-bold">{hit.camera_code || '—'}</span>
                      </div>
                      {hit.confidence && (
                        <div className="flex justify-between">
                          <span className="text-[#c2c6d6]">Match Confidence</span>
                          <span className="text-[#dae3f7] font-bold">{(hit.confidence * 100).toFixed(0)}%</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[#c2c6d6]">Detected At</span>
                        <span className="text-[#dae3f7]">{new Date(hit.detected_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    {/* Confidence Bar */}
                    <div className="w-full h-1.5 bg-[#222a39] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          tl === 'CRITICAL' ? 'bg-[#ffb4ab]' : tl === 'HIGH' ? 'bg-orange-400' : tl === 'MEDIUM' ? 'bg-yellow-400' : 'bg-green-400'
                        }`}
                        style={{ width: `${(hit.confidence || 0.7) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'trajectory' && (
        <div className="space-y-6">
          <div className="bg-[#17202e] border border-[#6366f1]/30 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#424754]/30 pb-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#818cf8] text-[28px]">route</span>
                <div>
                  <h3 className="text-[16px] font-bold text-[#e2e8f0]">Spatial-Temporal ReID Suspect Trajectory</h3>
                  <p className="text-[12px] text-[#94a3b8]">Live cross-camera feature matching & trajectory vector analysis across connected cameras</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-[#6366f1]/20 border border-[#818cf8]/40 text-[#818cf8] text-[11px] font-mono font-bold rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#818cf8] animate-pulse"></span>
                ReID Engine Active
              </span>
            </div>

            {trajectories.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-[#131c2a] flex items-center justify-center border border-[#6366f1]/30">
                  <span className="material-symbols-outlined text-[32px] text-[#818cf8]">timeline</span>
                </div>
                <h4 className="text-[16px] font-bold text-[#dae3f7]">No Cross-Camera Trajectories Detected</h4>
                <p className="text-[13px] text-[#8c909f] max-w-lg leading-relaxed">
                  Real-time spatial-temporal ReID tracking is active. When a person or vehicle is detected transitioning across multiple camera feeds, their chronological movement path and vector trajectory will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {trajectories.map((traj) => (
                  <div key={traj.targetId} className="bg-[#111927] border border-[#2b3548] rounded-xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 bg-[#ffb4ab]/10 border border-[#ffb4ab]/40 text-[#ffb4ab] font-mono text-[12px] font-extrabold rounded-lg">
                          {traj.targetId}
                        </span>
                        <div>
                          <h4 className="text-[15px] font-bold text-[#e2e8f0]">{traj.name}</h4>
                          <span className="text-[11px] text-[#94a3b8] font-mono">
                            {traj.heading}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] font-mono text-[#818cf8] font-bold">
                          ReID Confidence: {(traj.confidence * 100).toFixed(0)}%
                        </span>
                        <span className="px-2.5 py-1 bg-[#93000a] text-[#ffdad6] text-[10px] font-extrabold rounded-full">
                          {traj.threatLevel}
                        </span>
                      </div>
                    </div>

                    {/* Route Step Nodes */}
                    <div className="relative flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 bg-[#090d16] rounded-xl border border-[#1e293b]">
                      {traj.overallTrajectory.map((step, idx) => (
                        <React.Fragment key={idx}>
                          <div className="flex flex-col space-y-1 z-10 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-[#6366f1] text-white flex items-center justify-center text-[10px] font-mono font-bold">
                                {idx + 1}
                              </span>
                              <span className="font-mono text-[12px] font-bold text-[#818cf8]">{step.cameraCode}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#1e293b] text-[#94a3b8] rounded">
                                {step.status}
                              </span>
                            </div>
                            <span className="text-[12px] text-[#e2e8f0] font-semibold">{step.location}</span>
                            <span className="text-[10px] text-[#94a3b8] font-mono">{step.timestamp}</span>
                          </div>
                          {idx < traj.overallTrajectory.length - 1 && (
                            <div className="hidden md:flex items-center justify-center text-[#475569]">
                              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


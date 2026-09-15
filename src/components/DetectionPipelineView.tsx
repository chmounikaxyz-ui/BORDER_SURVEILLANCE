import React, { useState } from 'react';
import { ASSETS } from '../data/mockData';

export const DetectionPipelineView: React.FC = () => {
  const [selectedModule, setSelectedModule] = useState<'backbone' | 'id' | 'behaviour' | 'priority' | 'trust'>('backbone');
  const [testVideoActive, setTestVideoActive] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'human' | 'vehicle' | 'animal'>('all');

  const pipelineStats = [
    { label: 'Backbone Inference', val: '18ms / frame', icon: 'speed', sub: 'YOLOv8n + ByteTrack' },
    { label: 'Animal Filter', val: 'Active', icon: 'pets', sub: 'Cuts 94% wildlife false alarms' },
    { label: 'Watchlist FRS & ANPR', val: 'Sub-second', icon: 'person_search', sub: 'ArcFace + FAISS + PaddleOCR' },
    { label: 'Explainable AI', val: '100% BBoxes', icon: 'visibility', sub: 'Confidence + Reference Image' }
  ];

  return (
    <div className="flex-1 w-full p-6 overflow-y-auto text-[#dae3f7] space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#131c2a] p-6 rounded-xl border border-[#424754]/30 shadow-lg relative overflow-hidden">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#adc6ff] text-[28px]">schema</span>
            <h1 className="text-[24px] font-bold text-[#adc6ff] tracking-tight">Modular Detection & Neural Pipeline</h1>
          </div>
          <p className="text-[14px] text-[#c2c6d6] max-w-3xl">
            Single shared YOLOv8/v10 + ByteTrack backbone feeding parallel Face Recognition (ArcFace+FAISS), ANPR (PaddleOCR), Zone Intrusion, Pose Recognition, and Priority Scoring Alert Engine.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTestVideoActive(!testVideoActive)}
            className={`px-4 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors shadow-md flex items-center gap-2 ${
              testVideoActive ? 'bg-[#93000a] text-[#ffdad6]' : 'bg-[#4d8eff] text-[#00285d] hover:bg-[#adc6ff]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{testVideoActive ? 'stop_circle' : 'play_circle'}</span>
            {testVideoActive ? 'Stop Pipeline Simulation' : 'Run Pipeline Simulation'}
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {pipelineStats.map((stat, i) => (
          <div key={i} className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/30 flex items-center justify-between shadow-md">
            <div>
              <span className="text-[12px] font-bold uppercase text-[#c2c6d6] tracking-wider block mb-1">{stat.label}</span>
              <span className="text-[20px] font-bold font-mono text-[#adc6ff]">{stat.val}</span>
              <span className="text-[11px] text-[#c2c6d6]/70 block mt-1">{stat.sub}</span>
            </div>
            <span className="material-symbols-outlined text-[#adc6ff] text-[32px] opacity-40">{stat.icon}</span>
          </div>
        ))}
      </div>

      {/* Interactive Architectural Pipeline Diagram */}
      <div className="bg-[#17202e] rounded-xl border border-[#424754]/30 overflow-hidden shadow-xl p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-[#424754]/20 pb-4">
          <div>
            <h2 className="text-[18px] font-bold text-[#dae3f7] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#adc6ff]">account_tree</span>
              IGNITIX End-to-End Architecture Flow
            </h2>
            <p className="text-[12px] text-[#c2c6d6] mt-0.5">Click any stage below to inspect real-time neural weights and logic parameters.</p>
          </div>
          <div className="flex gap-2">
            {(['backbone', 'id', 'behaviour', 'priority', 'trust'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSelectedModule(tab)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${
                  selectedModule === tab ? 'bg-[#4d8eff] text-[#00285d]' : 'bg-[#222a39] text-[#c2c6d6] hover:bg-[#2c3544]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Visual Pipeline Flow Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
          {/* Stage 1: Video Input & Backbone */}
          <div
            onClick={() => setSelectedModule('backbone')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between h-44 ${
              selectedModule === 'backbone' ? 'border-[#adc6ff] bg-[#222a39] shadow-[0_0_15px_rgba(173,198,255,0.2)]' : 'border-[#424754]/30 bg-[#131c2a] hover:border-[#adc6ff]/50'
            }`}
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#00285d] text-[#adc6ff]">STAGE 1</span>
                <span className="material-symbols-outlined text-[#adc6ff] text-[20px]">videocam</span>
              </div>
              <h3 className="text-[14px] font-bold text-[#dae3f7]">Shared Backbone</h3>
              <p className="text-[11px] text-[#c2c6d6] mt-1">YOLOv8 + ByteTrack on 1080p RTSP</p>
            </div>
            <div className="border-t border-[#424754]/30 pt-2 text-[10px] font-mono text-[#adc6ff]">
              ✓ Animal/Non-Threat Filter<br />
              ✓ Camera Health Monitor
            </div>
          </div>

          {/* Stage 2: Identification */}
          <div
            onClick={() => setSelectedModule('id')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between h-44 ${
              selectedModule === 'id' ? 'border-[#adc6ff] bg-[#222a39] shadow-[0_0_15px_rgba(173,198,255,0.2)]' : 'border-[#424754]/30 bg-[#131c2a] hover:border-[#adc6ff]/50'
            }`}
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300">STAGE 2A</span>
                <span className="material-symbols-outlined text-purple-300 text-[20px]">fingerprint</span>
              </div>
              <h3 className="text-[14px] font-bold text-[#dae3f7]">Identification</h3>
              <p className="text-[11px] text-[#c2c6d6] mt-1">ArcFace, PaddleOCR, Geofence</p>
            </div>
            <div className="border-t border-[#424754]/30 pt-2 text-[10px] font-mono text-purple-300">
              ✓ FAISS Vector DB Search<br />
              ✓ Stolen Plate Match
            </div>
          </div>

          {/* Stage 3: Behavioural & Environmental */}
          <div
            onClick={() => setSelectedModule('behaviour')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between h-44 ${
              selectedModule === 'behaviour' ? 'border-[#adc6ff] bg-[#222a39] shadow-[0_0_15px_rgba(173,198,255,0.2)]' : 'border-[#424754]/30 bg-[#131c2a] hover:border-[#adc6ff]/50'
            }`}
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300">STAGE 2B</span>
                <span className="material-symbols-outlined text-amber-300 text-[20px]">directions_run</span>
              </div>
              <h3 className="text-[14px] font-bold text-[#dae3f7]">Behaviour & Night</h3>
              <p className="text-[11px] text-[#c2c6d6] mt-1">Pose estimation & Thermal IR</p>
            </div>
            <div className="border-t border-[#424754]/30 pt-2 text-[10px] font-mono text-amber-300">
              ✓ Loitering / Running<br />
              ✓ Night IR-Aware Pipeline
            </div>
          </div>

          {/* Stage 4: Priority Engine */}
          <div
            onClick={() => setSelectedModule('priority')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between h-44 ${
              selectedModule === 'priority' ? 'border-[#adc6ff] bg-[#222a39] shadow-[0_0_15px_rgba(173,198,255,0.2)]' : 'border-[#424754]/30 bg-[#131c2a] hover:border-[#adc6ff]/50'
            }`}
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#93000a] text-[#ffdad6]">STAGE 3</span>
                <span className="material-symbols-outlined text-[#ffb4ab] text-[20px]">speed</span>
              </div>
              <h3 className="text-[14px] font-bold text-[#dae3f7]">Priority Alert Engine</h3>
              <p className="text-[11px] text-[#c2c6d6] mt-1">Weighted scoring & deduplication</p>
            </div>
            <div className="border-t border-[#424754]/30 pt-2 text-[10px] font-mono text-[#ffb4ab]">
              ✓ Confidence + Sensitivity<br />
              ✓ Time-of-day + Distance
            </div>
          </div>

          {/* Stage 5: Trust & Audit */}
          <div
            onClick={() => setSelectedModule('trust')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between h-44 ${
              selectedModule === 'trust' ? 'border-[#adc6ff] bg-[#222a39] shadow-[0_0_15px_rgba(173,198,255,0.2)]' : 'border-[#424754]/30 bg-[#131c2a] hover:border-[#adc6ff]/50'
            }`}
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-green-950 text-green-300">STAGE 4</span>
                <span className="material-symbols-outlined text-green-300 text-[20px]">verified_user</span>
              </div>
              <h3 className="text-[14px] font-bold text-[#dae3f7]">Trust & Audit Layer</h3>
              <p className="text-[11px] text-[#c2c6d6] mt-1">DPDP Act Privacy & Tamper Log</p>
            </div>
            <div className="border-t border-[#424754]/30 pt-2 text-[10px] font-mono text-green-300">
              ✓ Active-learning Feedback<br />
              ✓ Hash-chained Ledger
            </div>
          </div>
        </div>

        {/* Selected Stage Detail Inspector */}
        <div className="bg-[#131c2a] p-5 rounded-xl border border-[#424754]/30 space-y-4">
          {selectedModule === 'backbone' && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[#adc6ff]">memory</span>
                <h3 className="text-[16px] font-bold text-[#adc6ff]">Shared Detection & Tracking Backbone</h3>
              </div>
              <p className="text-[13px] text-[#c2c6d6]">
                Single-pass YOLOv8/v10 neural detector coupled with ByteTrack multi-object tracking. Runs once per frame and broadcasts track bounding boxes, class vectors, and trajectory vectors to all downstream modules simultaneously.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-[12px] font-mono">
                <div className="bg-[#0b1422] p-3 rounded border border-[#424754]/20">
                  <span className="text-[#adc6ff] font-bold block mb-1">FPS Acceleration</span>
                  <span className="text-[#dae3f7]">30 FPS @ 1080p (TensorRT FP16)</span>
                </div>
                <div className="bg-[#0b1422] p-3 rounded border border-[#424754]/20">
                  <span className="text-[#adc6ff] font-bold block mb-1">Non-Threat Class Filter</span>
                  <span className="text-[#dae3f7]">Ignores stray cattle & vegetation movement</span>
                </div>
                <div className="bg-[#0b1422] p-3 rounded border border-[#424754]/20">
                  <span className="text-[#adc6ff] font-bold block mb-1">Camera Health Check</span>
                  <span className="text-[#dae3f7]">Flags blackout, spray-paint blur, & frozen video</span>
                </div>
              </div>
            </div>
          )}

          {selectedModule === 'id' && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-purple-300">badge</span>
                <h3 className="text-[16px] font-bold text-purple-300">Identification Modules (Per Tracked Object)</h3>
              </div>
              <p className="text-[13px] text-[#c2c6d6]">
                Every tracked person or vehicle is concurrently checked against criminal facial vector databases, ANPR license plate lookup lists, and restricted zone polygons.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-[12px] font-mono">
                <div className="bg-[#0b1422] p-3 rounded border border-[#424754]/20">
                  <span className="text-purple-300 font-bold block mb-1">Face Recognition (ArcFace + FAISS)</span>
                  <span className="text-[#dae3f7]">512-dim embedding cosine similarity lookup</span>
                </div>
                <div className="bg-[#0b1422] p-3 rounded border border-[#424754]/20">
                  <span className="text-purple-300 font-bold block mb-1">ANPR (PaddleOCR)</span>
                  <span className="text-[#dae3f7]">Fuzzy string match vs stolen vehicle DB</span>
                </div>
                <div className="bg-[#0b1422] p-3 rounded border border-[#424754]/20">
                  <span className="text-purple-300 font-bold block mb-1">Zone Geofencing</span>
                  <span className="text-[#dae3f7]">Normalized polygon point-in-polygon check</span>
                </div>
              </div>
            </div>
          )}

          {selectedModule === 'behaviour' && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-amber-300">directions_run</span>
                <h3 className="text-[16px] font-bold text-amber-300">Behavioural & Environmental Analytics</h3>
              </div>
              <p className="text-[13px] text-[#c2c6d6]">
                Analyses temporal keypoint movement to distinguish routine patrol movement from loitering, running, or falling. Seamlessly adapts to thermal/IR night feeds without relying on low-light RGB enhancement.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-[12px] font-mono">
                <div className="bg-[#0b1422] p-3 rounded border border-[#424754]/20">
                  <span className="text-amber-300 font-bold block mb-1">Pose & Activity Recognition</span>
                  <span className="text-[#dae3f7]">Flags stationary dwell (&gt;45s) and sudden rapid sprints</span>
                </div>
                <div className="bg-[#0b1422] p-3 rounded border border-[#424754]/20">
                  <span className="text-amber-300 font-bold block mb-1">Thermal / IR-Aware Pipeline</span>
                  <span className="text-[#dae3f7]">Direct thermal contrast inference for pitch-black border terrain</span>
                </div>
              </div>
            </div>
          )}

          {selectedModule === 'priority' && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[#ffb4ab]">speed</span>
                <h3 className="text-[16px] font-bold text-[#ffb4ab]">Priority Scoring Alert Engine</h3>
              </div>
              <p className="text-[13px] text-[#c2c6d6]">
                Replaces flat alert feeds with dynamic priority ranking. Ranks every threat by confidence, zone tier, time of day, and distance to fence line.
              </p>
              <div className="bg-[#0b1422] p-3.5 rounded border border-[#ffb4ab]/30 mt-3 font-mono text-[11px] text-[#ffdad6]">
                Priority = (Confidence × 0.35) + (Zone Weight × 0.25) + (Time-of-day × 0.15) + (Distance to Border × 0.15) + (Type × 0.10)
              </div>
            </div>
          )}

          {selectedModule === 'trust' && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-green-300">verified_user</span>
                <h3 className="text-[16px] font-bold text-green-300">Trust, Privacy & Audit Layer</h3>
              </div>
              <p className="text-[13px] text-[#c2c6d6]">
                Ensures regulatory compliance with India's DPDP Act by auto-blurring non-flagged bystanders, incorporating operator feedback to tune thresholds, and signing all evidence frames into a hash-chained ledger.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-[12px] font-mono">
                <div className="bg-[#0b1422] p-3 rounded border border-[#424754]/20">
                  <span className="text-green-300 font-bold block mb-1">Active-Learning Feedback</span>
                  <span className="text-[#dae3f7]">Operator true/false positive votes retrain zone weights</span>
                </div>
                <div className="bg-[#0b1422] p-3 rounded border border-[#424754]/20">
                  <span className="text-green-300 font-bold block mb-1">Privacy-by-Design</span>
                  <span className="text-[#dae3f7]">Auto-blurs non-flagged individuals (DPDP Act aligned)</span>
                </div>
                <div className="bg-[#0b1422] p-3 rounded border border-[#424754]/20">
                  <span className="text-green-300 font-bold block mb-1">Tamper-Evident Logging</span>
                  <span className="text-[#dae3f7]">SHA-256 hash-chained court-admissible audit log</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

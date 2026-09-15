import React, { useState, useEffect } from 'react';

interface TransportQueueItem {
  id: string;
  timestamp: string;
  eventType: string;
  cameraCode: string;
  sizeKb: number;
  status: 'PENDING' | 'SENT' | 'BUFFERED';
  attempts: number;
}

export const EdgeTransportView: React.FC = () => {
  const [uplinkStatus, setUplinkStatus] = useState<'ONLINE' | 'DEGRADED' | 'OFFLINE'>('ONLINE');
  const [queueItems, setQueueItems] = useState<TransportQueueItem[]>([
    { id: 'TX-9041', timestamp: '23:38:12', eventType: 'ANPR Watchlist Match', cameraCode: 'BOP-07', sizeKb: 42, status: 'SENT', attempts: 1 },
    { id: 'TX-9042', timestamp: '23:39:05', eventType: 'Personnel Intrusion', cameraCode: 'BOP-01', sizeKb: 128, status: 'SENT', attempts: 1 },
    { id: 'TX-9043', timestamp: '23:39:40', eventType: 'Rapid Movement', cameraCode: 'BOP-04', sizeKb: 86, status: 'PENDING', attempts: 0 },
    { id: 'TX-9044', timestamp: '23:40:10', eventType: 'Loitering Alert', cameraCode: 'BOP-01', sizeKb: 64, status: 'PENDING', attempts: 0 },
  ]);

  const [degradedModeActive, setDegradedModeActive] = useState(false);

  const toggleUplink = () => {
    if (uplinkStatus === 'ONLINE') {
      setUplinkStatus('OFFLINE');
      setDegradedModeActive(true);
      setQueueItems(prev => prev.map(q => q.status === 'PENDING' ? { ...q, status: 'BUFFERED' } : q));
    } else {
      setUplinkStatus('ONLINE');
      setDegradedModeActive(false);
      setQueueItems(prev => prev.map(q => q.status === 'BUFFERED' ? { ...q, status: 'SENT', attempts: q.attempts + 1 } : q));
    }
  };

  return (
    <div className="flex-1 w-full p-6 overflow-y-auto text-[#dae3f7] space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#131c2a] p-6 rounded-xl border border-[#424754]/30 shadow-lg relative overflow-hidden">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#adc6ff] text-[28px]">cell_tower</span>
            <h1 className="text-[24px] font-bold text-[#adc6ff] tracking-tight">Edge Transport & Sector Aggregation</h1>
          </div>
          <p className="text-[14px] text-[#c2c6d6] max-w-3xl">
            Resilient edge-first store-and-forward architecture. Transmits encrypted alert payloads and short clips over low-bandwidth satellite/4G links — never raw video. Autonomously triggers local degraded-mode sirens if uplink drops.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleUplink}
            className={`px-4 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors shadow-md flex items-center gap-2 ${
              uplinkStatus === 'ONLINE'
                ? 'bg-amber-500 text-amber-950 hover:bg-amber-400'
                : 'bg-green-600 text-white hover:bg-green-500'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {uplinkStatus === 'ONLINE' ? 'wifi_off' : 'wifi'}
            </span>
            {uplinkStatus === 'ONLINE' ? 'Simulate Satellite Drop' : 'Restore Satellite Uplink'}
          </button>
        </div>
      </div>

      {/* Uplink Status Banner */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md transition-all ${
        uplinkStatus === 'ONLINE'
          ? 'bg-green-950/40 border-green-500/40 text-green-300'
          : 'bg-[#93000a]/40 border-[#ffb4ab]/50 text-[#ffdad6]'
      }`}>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${
            uplinkStatus === 'ONLINE' ? 'bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-[#ffb4ab] animate-ping'
          }`}></span>
          <div className="flex flex-col">
            <span className="text-[14px] font-bold font-mono uppercase tracking-wider">
              Uplink Status: {uplinkStatus === 'ONLINE' ? 'CONNECTED (4G / SAT-NET)' : 'DISCONNECTED — LOCAL EDGE BUFFER ACTIVE'}
            </span>
            <span className="text-[11px] opacity-80 mt-0.5">
              {uplinkStatus === 'ONLINE'
                ? 'Store-and-forward queue syncing seamlessly with Sector Aggregation Server.'
                : 'Alerts buffered locally in encrypted edge SQLite queue. Local sirens & lights ready.'}
            </span>
          </div>
        </div>

        {degradedModeActive && (
          <div className="flex items-center gap-2 bg-[#93000a] text-[#ffdad6] px-3 py-1.5 rounded-lg border border-[#ffb4ab]/40 animate-pulse text-[11px] font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[16px]">campaign</span>
            Degraded-Mode Local Siren Trigger Ready
          </div>
        )}
      </div>

      {/* Architecture Cards: Edge Buffer vs Aggregation Server vs C2 Output */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Edge Buffer & Local Queue */}
        <div className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/30 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-[#424754]/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#adc6ff]">dns</span>
                <h2 className="text-[16px] font-bold text-[#dae3f7]">Edge Buffer Queue</h2>
              </div>
              <span className="text-[10px] font-mono font-bold bg-[#222a39] px-2 py-0.5 rounded text-[#adc6ff]">PostgreSQL/SQLite</span>
            </div>
            <p className="text-[12px] text-[#c2c6d6] leading-relaxed mb-4">
              Raw video stays on the edge box. Only metadata, bounding boxes, and short 5-second evidence clips cross the narrow satellite uplink.
            </p>
            <div className="space-y-2 text-[11px] font-mono">
              <div className="flex justify-between bg-[#131c2a] p-2.5 rounded border border-[#424754]/20">
                <span className="text-[#c2c6d6]">Bandwidth Economy</span>
                <span className="text-green-400 font-bold">~98% Savings</span>
              </div>
              <div className="flex justify-between bg-[#131c2a] p-2.5 rounded border border-[#424754]/20">
                <span className="text-[#c2c6d6]">Payload Security</span>
                <span className="text-[#adc6ff] font-bold">TLS-1.3 + RSA Signed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Sector Aggregation Server */}
        <div className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/30 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-[#424754]/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-300">hub</span>
                <h2 className="text-[16px] font-bold text-[#dae3f7]">Sector Aggregation</h2>
              </div>
              <span className="text-[10px] font-mono font-bold bg-purple-950 px-2 py-0.5 rounded text-purple-300">FastAPI C2 Hub</span>
            </div>
            <p className="text-[12px] text-[#c2c6d6] leading-relaxed mb-4">
              Receives alerts across multiple Border Outposts (BOPs). Deduplicates repeat alerts and correlates subject movements along border roads.
            </p>
            <div className="space-y-2 text-[11px] font-mono">
              <div className="flex justify-between bg-[#131c2a] p-2.5 rounded border border-[#424754]/20">
                <span className="text-[#c2c6d6]">Cross-Post Re-ID</span>
                <span className="text-purple-300 font-bold">Multi-Camera Track</span>
              </div>
              <div className="flex justify-between bg-[#131c2a] p-2.5 rounded border border-[#424754]/20">
                <span className="text-[#c2c6d6]">Alert Deduplication</span>
                <span className="text-[#adc6ff] font-bold">Spatial/Temporal Window</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Command Centre Outputs */}
        <div className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/30 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-[#424754]/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-300">output</span>
                <h2 className="text-[16px] font-bold text-[#dae3f7]">Command Centre Outputs</h2>
              </div>
              <span className="text-[10px] font-mono font-bold bg-amber-950 px-2 py-0.5 rounded text-amber-300">REST / Webhook API</span>
            </div>
            <p className="text-[12px] text-[#c2c6d6] leading-relaxed mb-4">
              Plugs directly into existing military C2 systems via open standards. Feeds heatmaps, analytics dashboards, and tactical dispatch signals.
            </p>
            <div className="space-y-2 text-[11px] font-mono">
              <div className="flex justify-between bg-[#131c2a] p-2.5 rounded border border-[#424754]/20">
                <span className="text-[#c2c6d6]">C2 Integration</span>
                <span className="text-amber-300 font-bold">REST / Webhook Web Standard</span>
              </div>
              <div className="flex justify-between bg-[#131c2a] p-2.5 rounded border border-[#424754]/20">
                <span className="text-[#c2c6d6]">Analytics Engine</span>
                <span className="text-[#adc6ff] font-bold">Zone Heatmaps</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Store-and-Forward Transport Queue Table */}
      <div className="bg-[#17202e] rounded-xl border border-[#424754]/30 overflow-hidden shadow-xl">
        <div className="p-4 bg-[#131c2a] border-b border-[#424754]/20 flex justify-between items-center">
          <h2 className="text-[16px] font-bold text-[#dae3f7] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#adc6ff]">swap_vert</span>
            Store-and-Forward Alert Payload Queue
          </h2>
          <span className="font-mono text-[11px] text-[#c2c6d6]">{queueItems.length} payloads tracked</span>
        </div>

        <div className="divide-y divide-[#424754]/20 font-mono text-[12px]">
          {queueItems.map(item => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-[#222a39] transition-colors">
              <div className="flex items-center gap-4">
                <span className="font-bold text-[#adc6ff]">{item.id}</span>
                <span className="text-[#c2c6d6]">{item.timestamp}</span>
                <span className="text-[#dae3f7] font-semibold">{item.eventType}</span>
                <span className="px-2 py-0.5 rounded bg-[#0b1422] text-[#c2c6d6] text-[10px]">{item.cameraCode}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[#c2c6d6]/70 text-[11px]">{item.sizeKb} KB</span>
                <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                  item.status === 'SENT' ? 'bg-green-950 text-green-300 border border-green-500/30' :
                  item.status === 'BUFFERED' ? 'bg-[#93000a] text-[#ffdad6] border border-[#ffb4ab]/40 animate-pulse' :
                  'bg-amber-950 text-amber-300 border border-amber-500/30'
                }`}>
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

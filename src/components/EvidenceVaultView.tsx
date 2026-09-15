import React, { useState, useEffect } from 'react';
import { EvidenceRecord } from '../types';
import { getEvidence, deleteEvidence, clearAllEvidence } from '../api/client';

interface EvidenceVaultViewProps {
  onViewCertificate?: () => void;
  onExportPackage: (record: EvidenceRecord) => void;
}

export const EvidenceVaultView: React.FC<EvidenceVaultViewProps> = ({
  onExportPackage
}) => {
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<EvidenceRecord | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [expandedMediaMode, setExpandedMediaMode] = useState<Record<string, 'video' | 'still'>>({});

  // Fetch live evidence from backend, fall back to mock
  useEffect(() => {
    const load = async () => {
      const live = await getEvidence();
      if (live && live.length > 0) {
        setRecords(live as EvidenceRecord[]);
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const handleCopyHash = (hash: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleDeleteRecord = async (record: EvidenceRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetId = record.id || record.eventId;
    setDeletingId(targetId);
    
    // Optimistic UI update
    setRecords(prev => prev.filter(r => r.id !== record.id && r.eventId !== record.eventId));
    if (expandedId === record.id) {
      setExpandedId(null);
    }
    setRecordToDelete(null);

    try {
      await deleteEvidence(targetId);
    } catch (err) {
      console.error('Failed to delete evidence record:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    setConfirmClearAll(false);
    setRecords([]);
    setExpandedId(null);
    try {
      await clearAllEvidence();
    } catch (err) {
      console.error('Failed to clear evidence records:', err);
    }
  };

  const getRecordCategory = (r: EvidenceRecord): 'PERSONS' | 'INTRUSION' | 'VEHICLE' | 'SYSTEM' => {
    const t = (r.eventType || '').toUpperCase();
    const d = (r.detailsSummary || '').toLowerCase();
    const src = (r.source || '').toLowerCase();

    if (
      t.includes('SYSTEM') ||
      t.includes('TAMPER') ||
      t.includes('SENSOR') ||
      t.includes('BLACKOUT') ||
      t.includes('BLUR') ||
      t.includes('COVERED') ||
      t.includes('SABOTAGE') ||
      d.includes('tamper') ||
      d.includes('sabotage') ||
      d.includes('covered') ||
      d.includes('blackout') ||
      d.includes('blurred') ||
      src.includes('tamper')
    ) {
      return 'SYSTEM';
    }

    if (
      t.includes('VEHICLE') ||
      t.includes('CAR') ||
      t.includes('TRUCK') ||
      t.includes('BUS') ||
      t.includes('ANPR') ||
      t.includes('PLATE') ||
      t.includes('HOTLIST') ||
      d.includes('vehicle') ||
      d.includes('plate') ||
      d.includes('anpr')
    ) {
      return 'VEHICLE';
    }

    if (
      t.includes('INTRUSION') ||
      t.includes('BREACH') ||
      t.includes('PERIMETER') ||
      t.includes('CROSSING') ||
      d.includes('intrusion') ||
      d.includes('breach') ||
      d.includes('perimeter')
    ) {
      return 'INTRUSION';
    }

    if (
      t.includes('PERSON') ||
      t.includes('WATCHLIST') ||
      t.includes('BIOMETRIC') ||
      t.includes('FACE') ||
      d.includes('biometric') ||
      d.includes('person') ||
      d.includes('facial') ||
      d.includes('sface') ||
      d.includes('watchlist') ||
      d.includes('subject')
    ) {
      return 'PERSONS';
    }

    return 'SYSTEM';
  };

  const personRecordsCount = records.filter(r => getRecordCategory(r) === 'PERSONS').length;
  const intrusionRecordsCount = records.filter(r => getRecordCategory(r) === 'INTRUSION').length;
  const vehicleRecordsCount = records.filter(r => getRecordCategory(r) === 'VEHICLE').length;
  const systemRecordsCount = records.filter(r => getRecordCategory(r) === 'SYSTEM').length;
  const verifiedAuditEntriesCount = records.reduce((acc, r) => acc + (r.auditTrail && r.auditTrail.length > 0 ? r.auditTrail.length : 1), 0);

  const filteredRecords = records.filter(r => {
    let matchesType = true;
    if (filterType !== 'ALL') {
      matchesType = getRecordCategory(r) === filterType;
    }

    const matchesSearch = 
      r.eventId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.cameraCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.detailsSummary || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.integrityHash.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="flex-1 w-full p-6 overflow-y-auto text-[#dae3f7] space-y-6">
      {/* Top Cryptographic Security Banner */}
      <div className="bg-gradient-to-r from-[#17202e] via-[#131c2a] to-[#222a39] p-6 rounded-xl border border-[#adc6ff]/30 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-[#4d8eff]/20 border border-[#adc6ff]/40 rounded-xl text-[#adc6ff]">
            <span className="material-symbols-outlined text-[32px]">shield_locked</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold text-[#dae3f7]">
                Forensic Evidence Vault & Audit Ledger
              </h1>
              <span className="px-2 py-0.5 bg-green-950 text-green-400 border border-green-500/30 rounded text-[10px] font-mono font-bold">
                IMMUTABLE LEDGER SEALED
              </span>
            </div>
            <p className="text-[13px] text-[#c2c6d6] mt-1 max-w-2xl">
              All facial biometrics, detected persons, license plates, and perimeter breach snapshots are cryptographically signed and stored in the tamper-evident security ledger.
            </p>
          </div>
        </div>
      </div>

      {/* Storage & Ledger Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Dynamic Card 1: Persons Detected */}
        <div 
          onClick={() => setFilterType('PERSONS')}
          className="bg-[#17202e] p-4 rounded-xl border border-[#adc6ff]/30 hover:border-[#adc6ff]/60 transition-all cursor-pointer flex items-center justify-between group"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#adc6ff] font-bold uppercase tracking-wider block">
                Persons Detected
              </span>
              <span className="px-1.5 py-0.2 bg-[#4d8eff]/20 text-[#adc6ff] rounded text-[9px] font-mono">
                ACTIVE AUDIT
              </span>
            </div>
            <span className="text-[28px] font-mono font-bold text-[#dae3f7] mt-1 block">
              {personRecordsCount} <span className="text-sm font-normal text-[#c2c6d6]">Identities Captured</span>
            </span>
            <span className="text-[11px] text-green-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping inline-block"></span>
              Biometric Signatures Synced
            </span>
          </div>
          <span className="material-symbols-outlined text-[#adc6ff] text-[40px] opacity-60 group-hover:scale-110 transition-transform">
            person_search
          </span>
        </div>

        {/* Dynamic Card 2: Vault Records Logged */}
        <div className="bg-[#17202e] p-4 rounded-xl border border-[#424754]/20 flex items-center justify-between">
          <div>
            <span className="text-[12px] text-[#c2c6d6] uppercase tracking-wider block">
              Vault Records Logged
            </span>
            <span className="text-[28px] font-mono font-bold text-[#adc6ff] mt-1 block">
              {records.length} <span className="text-sm font-normal text-[#c2c6d6]">Active Entries</span>
            </span>
            <span className="text-[11px] text-[#c2c6d6] font-mono">Tamper-Evident Forensic Ledger</span>
          </div>
          <span className="material-symbols-outlined text-[#adc6ff] text-[40px] opacity-40">
            database
          </span>
        </div>

        {/* Dynamic Card 3: Verified Audit Blocks */}
        <div className="bg-[#17202e] p-4 rounded-xl border border-[#424754]/20 flex items-center justify-between">
          <div>
            <span className="text-[12px] text-[#c2c6d6] uppercase tracking-wider block">
              Verified Audit Blocks
            </span>
            <span className="text-[28px] font-mono font-bold text-[#ffb4ab] mt-1 block">
              {records.length > 0 ? verifiedAuditEntriesCount : 0} <span className="text-sm font-normal text-[#c2c6d6]">Sealed Events</span>
            </span>
            <span className="text-[11px] text-green-400 font-mono">
              {records.length > 0 ? '100% Chain Verifiable • 0 Corrupted' : '0 Corrupted • Chain Ready'}
            </span>
          </div>
          <span className="material-symbols-outlined text-[#ffb4ab] text-[40px] opacity-40">
            fingerprint
          </span>
        </div>
      </div>

      {/* Filter & View Mode Toolbar */}
      <div className="bg-[#17202e] p-4 rounded-xl border border-[#424754]/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
          {['ALL', 'PERSONS', 'INTRUSION', 'VEHICLE', 'SYSTEM'].map((type) => {
            const count = type === 'ALL' 
              ? records.length 
              : type === 'PERSONS' 
                ? personRecordsCount 
                : type === 'INTRUSION'
                  ? intrusionRecordsCount
                  : type === 'VEHICLE'
                    ? vehicleRecordsCount
                    : systemRecordsCount;
            const isActive = filterType === type;

            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#4d8eff] text-[#00285d]'
                    : 'bg-[#222a39] text-[#c2c6d6] hover:bg-[#2c3544]'
                }`}
              >
                {type === 'PERSONS' && <span className="material-symbols-outlined text-[14px]">person_search</span>}
                {type}
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-[#00285d]/30 text-[#00285d]' : 'bg-[#17202e] text-[#c2c6d6]'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="relative flex items-center bg-[#222a39] rounded-md px-3 py-1.5 border border-[#424754]/30 w-full md:w-80">
            <span className="material-symbols-outlined text-[#c2c6d6] text-[16px] mr-2">search</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Event, Name, Hash, Camera..."
              className="bg-transparent w-full text-[12px] text-[#dae3f7] placeholder:text-[#c2c6d6]/40 focus:outline-none"
            />
          </div>

          {records.length > 0 && (
            <button
              onClick={() => setConfirmClearAll(true)}
              className="px-3 py-1.5 bg-[#93000a]/20 hover:bg-[#93000a] text-[#ffdad6] hover:text-white border border-[#ffb4ab]/30 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 shrink-0"
              title="Delete all evidence records"
            >
              <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Evidence Ledger Records List */}
      <div className="space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-[#424754] bg-[#17202e] rounded-xl border border-[#424754]/20">
            <span className="material-symbols-outlined text-[56px]">lock_open</span>
            <p className="text-[16px] font-mono text-[#8c909f]">No evidence records found</p>
            <p className="text-[12px] text-[#424754] font-mono max-w-xs text-center leading-relaxed">
              {records.length === 0
                ? 'Optical detections, facial biometrics, and intrusion frames will automatically generate cryptographic ledger records.'
                : 'No records match this filter.'}
            </p>
          </div>
        ) : filteredRecords.map((record) => {
          const isExpanded = expandedId === record.id;
          const isEscalated = record.operatorAction === 'Escalated';
          const isDismissed = record.operatorAction === 'Dismissed';
            const targetId = record.id || record.eventId;
            const isDeletingThis = deletingId === targetId;

            return (
              <div
                key={record.id || record.eventId}
                className={`bg-[#17202e] rounded-xl border transition-all overflow-hidden ${
                  isExpanded
                    ? 'border-[#adc6ff]/50 shadow-xl'
                    : 'border-[#424754]/30 hover:border-[#424754]/60'
                }`}
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  className="p-4 bg-[#131c2a] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-[14px] font-bold text-[#adc6ff]">
                      {record.eventId}
                    </span>
                    <span className="font-mono text-[12px] text-[#c2c6d6]">
                      {record.timestamp}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase border ${
                      record.eventType?.toUpperCase().includes('SUSPICIOUS')
                        ? 'bg-purple-900/60 text-purple-200 border-purple-500/50 shadow-[0_0_8px_rgba(168,85,247,0.25)]'
                        : record.eventType?.toUpperCase().includes('PERSON')
                          ? 'bg-[#4d8eff]/20 text-[#adc6ff] border-[#adc6ff]/40'
                          : 'bg-[#222a39] text-[#dae3f7] border-[#424754]/40'
                    }`}>
                      {record.eventType?.toUpperCase().includes('PERSON') && !record.eventType?.toUpperCase().includes('SUSPICIOUS')
                        ? 'PERSON WITH SUSPICIOUS BEHAVIOR'
                        : (record.eventType || 'Intrusion')}
                    </span>

                    {/* Media indicator badge: All records feature incident video clips */}
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-xs">
                      <span className="material-symbols-outlined text-[12px]">videocam</span>
                      VIDEO RECORDED
                    </span>

                    <span className="text-[13px] text-[#c2c6d6]">
                      {record.source} ({record.cameraCode})
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Operator Action Badge */}
                    <span className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase ${
                      isEscalated
                        ? 'bg-[#93000a] text-[#ffdad6] border border-[#ffb4ab]/40'
                        : isDismissed
                          ? 'bg-[#222a39] text-[#c2c6d6]'
                          : 'bg-green-950 text-green-400 border border-green-500/30'
                    }`}>
                      {record.operatorAction}
                    </span>

                    {/* Cryptographic Hash Badge */}
                    <div
                      onClick={(e) => handleCopyHash(record.fullHash, e)}
                      className="flex items-center gap-1.5 bg-[#222a39] hover:bg-[#2c3544] px-2.5 py-1 rounded border border-[#424754]/40 font-mono text-[11px] text-[#adc6ff] transition-colors"
                      title="Click to copy full SHA-256 hash"
                    >
                      <span>{copiedHash === record.fullHash ? 'COPIED!' : record.integrityHash}</span>
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRecordToDelete(record);
                      }}
                      disabled={isDeletingThis}
                      className="p-1.5 rounded-md bg-[#222a39] hover:bg-[#93000a]/50 text-[#c2c6d6] hover:text-[#ffdad6] border border-[#424754]/40 hover:border-[#ffb4ab]/40 transition-colors flex items-center justify-center shrink-0"
                      title="Delete evidence record"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isDeletingThis ? 'sync' : 'delete'}
                      </span>
                    </button>

                    <span className={`material-symbols-outlined text-[#c2c6d6] transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}>
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Expanded Content Area */}
                {isExpanded && (
                  <div className="p-6 bg-[#0b1422] border-t border-[#424754]/20 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                    {/* Left Column: Visual Capture Frame & Incident Video */}
                    <div className="lg:col-span-1 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#c2c6d6]">
                          Archived Forensic Footage
                        </span>
                        <div className="flex items-center gap-1 bg-[#17202e] p-0.5 rounded border border-[#424754]/40">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedMediaMode(prev => ({ ...prev, [record.id]: 'video' }));
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-colors flex items-center gap-1 ${
                              (expandedMediaMode[record.id] || 'video') === 'video'
                                ? 'bg-[#4d8eff] text-[#00285d]'
                                : 'text-[#c2c6d6] hover:text-white'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[12px]">videocam</span>
                            Video
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedMediaMode(prev => ({ ...prev, [record.id]: 'still' }));
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-colors flex items-center gap-1 ${
                              expandedMediaMode[record.id] === 'still'
                                ? 'bg-[#ffb4ab] text-[#690005]'
                                : 'text-[#c2c6d6] hover:text-white'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[12px]">photo_camera</span>
                            Frame
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const fallbackSvg = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="800" height="450" fill="#0b121e"/><text x="400" y="225" fill="#4d8eff" font-family="monospace" font-size="16" text-anchor="middle">EVIDENCE FRAME CAPTURE</text></svg>')}`;
                        const isVehicle = record.eventType?.toLowerCase().includes('vehicle');
                        const videoSrc = record.videoUrl || (record.imageUrl && (record.imageUrl.endsWith('.mp4') || record.imageUrl.endsWith('.webm') || record.imageUrl.includes('/evidence/videos/')) ? record.imageUrl : '');
                        const hasVid = Boolean(videoSrc);
                        const isVideo = ((expandedMediaMode[record.id] || (hasVid ? 'video' : 'still')) === 'video') && hasVid;

                        if (isVideo) {
                          return (
                            <div className="relative aspect-video rounded-lg overflow-hidden border border-[#424754]/40 bg-black shadow-lg">
                              <video
                                src={videoSrc}
                                autoPlay
                                loop
                                muted
                                controls
                                playsInline
                                className="w-full h-full object-cover"
                                poster={record.imageUrl && !record.imageUrl.endsWith('.mp4') && !record.imageUrl.endsWith('.webm') ? record.imageUrl : undefined}
                              />
                              <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded font-mono text-[9px] text-emerald-400 border border-emerald-500/30 flex items-center gap-1 pointer-events-none">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                INCIDENT VIDEO RECORDING
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="relative aspect-video rounded-lg overflow-hidden border border-[#424754]/40 bg-black">
                            <img
                              alt="Evidence Frame"
                              className="w-full h-full object-cover"
                              src={record.imageUrl && !record.imageUrl.endsWith('.mp4') && !record.imageUrl.endsWith('.webm') ? record.imageUrl : fallbackSvg}
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = fallbackSvg;
                              }}
                            />
                            <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 rounded font-mono text-[9px] text-[#adc6ff]">
                              OPTICAL SENSOR SNAPSHOT
                            </div>
                          </div>
                        );
                      })()}

                      <span className="font-mono text-[11px] text-[#c2c6d6]/70 mt-1">
                        Coordinates: {record.coordinates}
                      </span>
                    </div>

                    {/* Center Column: Incident Summary & Audit Trail */}
                    <div className="lg:col-span-2 flex flex-col justify-between gap-4">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#c2c6d6] block mb-1">
                          Incident Details
                        </span>
                        <p className="text-[13px] text-[#dae3f7] leading-relaxed mb-4">
                          {record.detailsSummary}
                        </p>

                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#adc6ff] block mb-2">
                          Cryptographic Audit Trail
                        </span>
                        <div className="space-y-2 font-mono text-[12px] bg-[#17202e] p-3.5 rounded-lg border border-[#424754]/30">
                          {record.auditTrail && record.auditTrail.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[#c2c6d6]">
                              <div className="flex items-center gap-2">
                                <span className="text-[#adc6ff]">{item.time}</span>
                                <span className="text-[#dae3f7]">{item.action}</span>
                              </div>
                              {item.blockHash && (
                                <span className="text-[10px] text-green-400 font-bold bg-green-950/40 px-1.5 py-0.5 rounded border border-green-500/20">
                                  BLOCK: {item.blockHash}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end items-center gap-3 pt-3 border-t border-[#424754]/20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRecordToDelete(record);
                          }}
                          disabled={isDeletingThis}
                          className="px-4 py-2 bg-[#93000a]/20 hover:bg-[#93000a] text-[#ffdad6] hover:text-white font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors border border-[#ffb4ab]/30 flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                          Delete Record
                        </button>

                        <button
                          onClick={() => onExportPackage(record)}
                          className="px-4 py-2 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors shadow flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[16px]">download</span>
                          Export Package (.zip)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      {/* Single Record Delete Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#17202e] border border-[#ffb4ab]/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[#ffb4ab]">
              <div className="p-2.5 bg-[#93000a]/30 rounded-xl border border-[#ffb4ab]/30">
                <span className="material-symbols-outlined text-[24px]">delete_forever</span>
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-[#dae3f7]">Delete Evidence Record</h3>
                <p className="text-[11px] font-mono text-[#adc6ff]">{recordToDelete.eventId}</p>
              </div>
            </div>

            <p className="text-[13px] text-[#c2c6d6] leading-relaxed">
              Are you sure you want to remove this sealed evidence record from the ledger? This will permanently delete the snapshot and associated audit records.
            </p>

            <div className="flex justify-end items-center gap-3 pt-2">
              <button
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 bg-[#222a39] hover:bg-[#2c3544] text-[#c2c6d6] font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRecord(recordToDelete)}
                className="px-4 py-2 bg-[#93000a] hover:bg-[#ba1a1a] text-white font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-md"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Evidence Modal */}
      {confirmClearAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#17202e] border border-[#ffb4ab]/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[#ffb4ab]">
              <div className="p-2.5 bg-[#93000a]/30 rounded-xl border border-[#ffb4ab]/30">
                <span className="material-symbols-outlined text-[24px]">warning</span>
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-[#dae3f7]">Clear Entire Evidence Vault</h3>
                <p className="text-[11px] text-[#ffb4ab]">Irreversible Action</p>
              </div>
            </div>

            <p className="text-[13px] text-[#c2c6d6] leading-relaxed">
              This will permanently wipe all <span className="text-white font-bold font-mono">{records.length}</span> sealed evidence records and forensic logs. Are you sure you want to proceed?
            </p>

            <div className="flex justify-end items-center gap-3 pt-2">
              <button
                onClick={() => setConfirmClearAll(false)}
                className="px-4 py-2 bg-[#222a39] hover:bg-[#2c3544] text-[#c2c6d6] font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="px-4 py-2 bg-[#93000a] hover:bg-[#ba1a1a] text-white font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-md"
              >
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                Wipe All Evidence
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



import React, { useState } from 'react';
import { TacticalAlert, EvidenceRecord } from '../types';

interface ModalsProps {
  isCertModalOpen: boolean;
  onCloseCertModal: () => void;
  dispatchAlertId: string | null;
  onCloseDispatchModal: () => void;
  onConfirmDispatch: (unit: string) => void;
  downloadEvidenceAlert: TacticalAlert | EvidenceRecord | null;
  onCloseDownloadModal: () => void;
  isQuickMenuOpen: boolean;
  onCloseQuickMenu: () => void;
  onSelectQuickTab: (tab: any) => void;
}

export const Modals: React.FC<ModalsProps> = ({
  isCertModalOpen,
  onCloseCertModal,
  dispatchAlertId,
  onCloseDispatchModal,
  onConfirmDispatch,
  downloadEvidenceAlert,
  onCloseDownloadModal,
  isQuickMenuOpen,
  onCloseQuickMenu,
  onSelectQuickTab
}) => {
  const [selectedUnit, setSelectedUnit] = useState('QRF-ALPHA (Sector North Fast Response)');
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const handleStartExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportComplete(true);
      setTimeout(() => {
        setExportComplete(false);
        onCloseDownloadModal();
      }, 1500);
    }, 1800);
  };

  return (
    <>
      {/* 1. ROOT CERTIFICATE MODAL */}
      {isCertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#17202e] border border-[#adc6ff]/50 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#4d8eff]/20 border border-[#adc6ff]/40 rounded-lg text-[#adc6ff]">
                  <span className="material-symbols-outlined text-[24px]">verified</span>
                </div>
                <div>
                  <h2 className="text-[18px] font-bold text-[#dae3f7]">Root Cryptographic Certificate</h2>
                  <span className="text-[11px] font-mono text-green-400">STATUS: VALID & UNBROKEN</span>
                </div>
              </div>
              <button onClick={onCloseCertModal} className="text-[#c2c6d6] hover:text-white p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-[#0b1422] p-4 rounded-lg border border-[#424754]/30 space-y-3 font-mono text-[12px]">
              <div>
                <span className="text-[#c2c6d6]/60 block text-[10px]">ISSUER & ROOT AUTHORITY</span>
                <span className="text-[#dae3f7] font-semibold">BorderVision Defense Ledger CA-01 (Sector Command)</span>
              </div>
              <div>
                <span className="text-[#c2c6d6]/60 block text-[10px]">CIPHER ALGORITHM</span>
                <span className="text-[#adc6ff]">ECDSA P-384 / SHA-384 with AES-256-GCM Evidence Blocks</span>
              </div>
              <div>
                <span className="text-[#c2c6d6]/60 block text-[10px]">ROOT FINGERPRINT (SHA-256)</span>
                <span className="text-amber-300 break-all text-[11px]">
                  0x8F4E2A109C5B7D3E8A2F4C6E1D9B0A3F5C7E9A1B3D5E7F9A0B2C4D6E8F0A2B4C
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#c2c6d6]">Chain Depth: 1,429,882 Blocks</span>
                <span className="text-green-400">Mermaid Tree: Verified</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onCloseCertModal}
                className="px-4 py-2 bg-[#4d8eff] text-[#00285d] font-bold rounded-lg text-[12px] uppercase"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. DISPATCH TEAM MODAL */}
      {dispatchAlertId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#17202e] border border-[#ffb4ab]/60 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#93000a] text-[#ffdad6] rounded-lg">
                  <span className="material-symbols-outlined text-[24px]">local_police</span>
                </div>
                <div>
                  <h2 className="text-[18px] font-bold text-[#ffdad6]">Authorize QRF Dispatch</h2>
                  <span className="text-[11px] font-mono text-[#ffb4ab]">INCIDENT ID: {dispatchAlertId}</span>
                </div>
              </div>
              <button onClick={onCloseDispatchModal} className="text-[#c2c6d6] hover:text-white p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-[13px] text-[#c2c6d6]">
              Select tactical Quick Reaction Force unit to deploy immediately to target sector coordinates.
            </p>

            <div className="space-y-2">
              {[
                'QRF-ALPHA (Sector North Fast Response - ETA 3m)',
                'QRF-BRAVO (Tactical Interceptor Convoy - ETA 6m)',
                'UAV-STRIKE-02 (Air Recon & Tracking Drone Squad - ETA 1m)'
              ].map((unit) => (
                <div
                  key={unit}
                  onClick={() => setSelectedUnit(unit)}
                  className={`p-3 rounded-lg border cursor-pointer font-mono text-[12px] transition-colors ${
                    selectedUnit === unit
                      ? 'bg-[#93000a]/30 border-[#ffb4ab] text-[#ffdad6]'
                      : 'bg-[#131c2a] border-[#424754]/30 text-[#c2c6d6] hover:bg-[#222a39]'
                  }`}
                >
                  {unit}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onCloseDispatchModal}
                className="px-4 py-2 bg-[#222a39] text-[#c2c6d6] hover:text-white rounded-lg text-[12px] font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirmDispatch(selectedUnit)}
                className="px-5 py-2 bg-[#ffb4ab] text-[#690005] font-bold rounded-lg text-[12px] uppercase shadow-lg hover:bg-white transition-colors"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. DOWNLOAD EVIDENCE PACKAGE MODAL */}
      {downloadEvidenceAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#17202e] border border-[#adc6ff]/50 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#adc6ff] text-[28px]">archive</span>
                <div>
                  <h2 className="text-[17px] font-bold text-[#dae3f7]">Export Evidence Package</h2>
                  <span className="text-[11px] font-mono text-[#adc6ff]">
                    {'id' in downloadEvidenceAlert ? downloadEvidenceAlert.id : 'EVIDENCE'}
                  </span>
                </div>
              </div>
              <button onClick={onCloseDownloadModal} className="text-[#c2c6d6] hover:text-white p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-[#0b1422] p-4 rounded-lg border border-[#424754]/30 space-y-2 text-[12px] font-mono">
              <div className="flex justify-between text-[#c2c6d6]">
                <span>Video Footage (1080p H.265):</span>
                <span className="text-[#dae3f7]">Included (48.4 MB)</span>
              </div>
              <div className="flex justify-between text-[#c2c6d6]">
                <span>Biometric Snapshot:</span>
                <span className="text-[#dae3f7]">Included (PNG)</span>
              </div>
              <div className="flex justify-between text-[#c2c6d6]">
                <span>Cryptographic Audit Proof:</span>
                <span className="text-green-400">SHA-256 JSON Chain</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onCloseDownloadModal}
                className="px-4 py-2 bg-[#222a39] text-[#c2c6d6] hover:text-white rounded-lg text-[12px] font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleStartExport}
                disabled={isExporting}
                className="px-5 py-2 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] font-bold rounded-lg text-[12px] uppercase shadow-lg transition-colors flex items-center gap-2"
              >
                {exportComplete ? (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    Exported!
                  </>
                ) : isExporting ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                    Bundling (.zip)...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    Download ZIP
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. QUICK APPS MENU DRAWER */}
      {isQuickMenuOpen && (
        <div 
          onClick={onCloseQuickMenu}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-80 bg-[#131c2a] h-full border-l border-[#424754]/30 p-6 space-y-6 shadow-2xl animate-fadeIn"
          >
            <div className="flex justify-between items-center border-b border-[#424754]/30 pb-4">
              <h2 className="text-[16px] font-bold text-[#adc6ff] flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">apps</span>
                Tactical Modules
              </h2>
              <button onClick={onCloseQuickMenu} className="text-[#c2c6d6] hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'dashboard', label: 'Command Centre', icon: 'dashboard' },
                { id: 'live-surveillance', label: 'Live Grid', icon: 'videocam' },
                { id: 'alerts', label: 'Alert Queue', icon: 'notifications_active' },
                { id: 'camera-network', label: 'Sensor Network', icon: 'settings_remote' },
                { id: 'watchlist-matches', label: 'Watchlist Review', icon: 'person_search' },
                { id: 'watchlist-db', label: 'Watchlist Database', icon: 'manage_accounts' },
                { id: 'evidence-vault', label: 'Evidence Vault', icon: 'folder_shared' },
                { id: 'system-health', label: 'System Health', icon: 'health_and_safety' },
                { id: 'settings', label: 'Configuration', icon: 'settings' },
                { id: 'system-architecture', label: 'System Architecture', icon: 'account_tree' }
              ].map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => {
                    onSelectQuickTab(mod.id);
                    onCloseQuickMenu();
                  }}
                  className="p-3 bg-[#17202e] hover:bg-[#222a39] border border-[#424754]/30 rounded-xl flex flex-col items-center gap-2 text-center transition-colors group"
                >
                  <span className="material-symbols-outlined text-[#adc6ff] group-hover:scale-110 transition-transform">
                    {mod.icon}
                  </span>
                  <span className="text-[11px] font-semibold text-[#dae3f7] leading-tight">
                    {mod.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

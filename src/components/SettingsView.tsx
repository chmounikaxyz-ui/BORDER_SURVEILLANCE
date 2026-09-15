import React, { useState } from 'react';

export const SettingsView: React.FC = () => {
  const [sensitivity, setSensitivity] = useState(85);
  const [personConfidence, setPersonConfidence] = useState(90);
  const [vehicleConfidence, setVehicleConfidence] = useState(85);
  const [droneConfidence, setDroneConfidence] = useState(75);
  const [retentionDays, setRetentionDays] = useState(90);
  const [autoRecordThreats, setAutoRecordThreats] = useState(true);
  const [alertSiren, setAlertSiren] = useState(true);
  const [encryptionStandard, setEncryptionStandard] = useState('AES-256-GCM');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="flex-1 w-full p-6 overflow-y-auto text-[#dae3f7] space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#131c2a] p-6 rounded-xl border border-[#424754]/30 shadow-lg">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#adc6ff] text-[28px]">
              settings
            </span>
            <h1 className="text-[24px] font-bold text-[#adc6ff] tracking-tight">
              Command Centre Configuration
            </h1>
          </div>
          <p className="text-[14px] text-[#c2c6d6] max-w-2xl">
            Configure edge AI threshold sensitivity, video retention periods, cryptographic ledger standards, and siren escalation rules.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors shadow-md flex items-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          Save System Parameters
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-green-950/60 border border-green-500/50 p-4 rounded-xl flex items-center justify-between text-green-300 animate-fadeIn font-mono text-[13px]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined">check_circle</span>
            Parameters successfully committed to Edge Nodes cluster.
          </div>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Edge AI Inference Thresholds */}
        <div className="bg-[#17202e] p-6 rounded-xl border border-[#424754]/30 space-y-5">
          <h3 className="text-[16px] font-bold text-[#dae3f7] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#adc6ff]">psychology</span>
            Edge AI Threat Detection Sensitivities
          </h3>

          <div>
            <div className="flex justify-between text-[13px] font-mono mb-2">
              <span className="text-[#c2c6d6]">Overall Motion Sensitivity:</span>
              <span className="text-[#adc6ff] font-bold">{sensitivity}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              className="w-full accent-[#4d8eff] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[13px] font-mono mb-2">
              <span className="text-[#c2c6d6]">Personnel (Human) Confidence Threshold:</span>
              <span className="text-[#ffb4ab] font-bold">{personConfidence}%</span>
            </div>
            <input
              type="range"
              min="60"
              max="99"
              value={personConfidence}
              onChange={(e) => setPersonConfidence(Number(e.target.value))}
              className="w-full accent-[#ffb4ab] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[13px] font-mono mb-2">
              <span className="text-[#c2c6d6]">Vehicle Classification Threshold:</span>
              <span className="text-[#4d8eff] font-bold">{vehicleConfidence}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              value={vehicleConfidence}
              onChange={(e) => setVehicleConfidence(Number(e.target.value))}
              className="w-full accent-[#4d8eff] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[13px] font-mono mb-2">
              <span className="text-[#c2c6d6]">UAV / Drone Acoustic & Radar Threshold:</span>
              <span className="text-amber-400 font-bold">{droneConfidence}%</span>
            </div>
            <input
              type="range"
              min="40"
              max="95"
              value={droneConfidence}
              onChange={(e) => setDroneConfidence(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Card 2: Cryptographic Security & Video Vault */}
        <div className="bg-[#17202e] p-6 rounded-xl border border-[#424754]/30 space-y-5">
          <h3 className="text-[16px] font-bold text-[#dae3f7] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#adc6ff]">lock</span>
            Cryptographic Vault & Retention Policy
          </h3>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 bg-[#131c2a] rounded-lg border border-[#424754]/20 cursor-pointer">
              <div>
                <span className="text-[13px] font-semibold text-[#dae3f7] block">
                  Automatic Threat Clip Buffering
                </span>
                <span className="text-[11px] text-[#c2c6d6]">
                  Record 30s pre-trigger and 60s post-trigger on critical alert
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoRecordThreats}
                onChange={(e) => setAutoRecordThreats(e.target.checked)}
                className="w-4 h-4 accent-[#4d8eff] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-[#131c2a] rounded-lg border border-[#424754]/20 cursor-pointer">
              <div>
                <span className="text-[13px] font-semibold text-[#dae3f7] block">
                  Audio Siren & Emergency Chime
                </span>
                <span className="text-[11px] text-[#c2c6d6]">
                  Play audible alert chime on Critical / High severity incidents
                </span>
              </div>
              <input
                type="checkbox"
                checked={alertSiren}
                onChange={(e) => setAlertSiren(e.target.checked)}
                className="w-4 h-4 accent-[#4d8eff] cursor-pointer"
              />
            </label>

            <div className="p-3 bg-[#131c2a] rounded-lg border border-[#424754]/20 flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-[#dae3f7]">
                Evidence Vault Encryption Standard
              </span>
              <select
                value={encryptionStandard}
                onChange={(e) => setEncryptionStandard(e.target.value)}
                className="bg-[#222a39] border border-[#424754]/40 rounded p-2 text-[12px] font-mono text-[#dae3f7] focus:outline-none"
              >
                <option value="AES-256-GCM">AES-256-GCM (National Defense Standard)</option>
                <option value="CHACHA20-POLY1305">ChaCha20-Poly1305 (Ultra Low Latency)</option>
                <option value="RSA-4096">RSA-4096 + SHA-512 Digital Seal</option>
              </select>
            </div>

            <div className="p-3 bg-[#131c2a] rounded-lg border border-[#424754]/20 flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-[#dae3f7]">
                Evidence Retention Horizon (Days)
              </span>
              <div className="flex gap-2">
                {[30, 60, 90, 180, 365].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setRetentionDays(d)}
                    className={`flex-1 py-1.5 rounded text-[11px] font-mono font-bold transition-colors ${
                      retentionDays === d
                        ? 'bg-[#4d8eff] text-[#00285d]'
                        : 'bg-[#222a39] text-[#c2c6d6] hover:bg-[#2c3544]'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

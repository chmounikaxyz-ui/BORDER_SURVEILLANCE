import React, { useState } from 'react';
import { CameraNode, DynamicZone } from '../types';
import { addDynamicZone } from '../api/client';

interface CustomZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameras: CameraNode[];
  selectedCamera?: CameraNode | null;
  onZoneCreated?: (zone: DynamicZone) => void;
}

export const CustomZoneModal: React.FC<CustomZoneModalProps> = ({
  isOpen,
  onClose,
  cameras,
  selectedCamera,
  onZoneCreated,
}) => {
  const [targetCameraCode, setTargetCameraCode] = useState(selectedCamera?.code || cameras[0]?.code || 'BOP-01');
  const [zoneName, setZoneName] = useState('');
  const [sensitivity, setSensitivity] = useState('Class A (Restricted)');
  const [speedLimit, setSpeedLimit] = useState(40);
  const [dwellThreshold, setDwellThreshold] = useState(15);
  const [restrictedHours, setRestrictedHours] = useState('22:00-06:00');
  const [points, setPoints] = useState<[number, number][]>([
    [0.1, 0.1],
    [0.9, 0.1],
    [0.9, 0.6],
    [0.1, 0.6],
  ]);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100) / 100;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100) / 100;
    if (points.length >= 8) {
      setPoints([[x, y]]);
    } else {
      setPoints(prev => [...prev, [x, y]]);
    }
  };

  const handleResetPoints = () => {
    setPoints([
      [0.2, 0.2],
      [0.8, 0.2],
      [0.8, 0.8],
      [0.2, 0.8],
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim()) return;
    setSaving(true);

    const activeCam = cameras.find(c => c.code === targetCameraCode);
    const sector = activeCam?.sector || 'Sector North';

    const created = await addDynamicZone({
      name: zoneName,
      camera_code: targetCameraCode,
      sector,
      sensitivity,
      polygon_norm: points,
      cooldown: 30,
      dwell_threshold: dwellThreshold,
      speed_limit_kmh: speedLimit,
      restricted_hours: restrictedHours,
    });

    setSaving(false);
    if (created && onZoneCreated) {
      onZoneCreated(created);
    }
    onClose();
  };

  const polygonSvgPoints = points.map(([x, y]) => `${x * 100}%,${y * 100}%`).join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-4xl bg-[#111927] border border-[#2b3548] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b3548] bg-[#162032]">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#6366f1]">polyline</span>
            <div>
              <h2 className="text-[16px] font-bold text-[#e2e8f0]">Configure Dynamic Restricted Zone</h2>
              <p className="text-[12px] text-[#94a3b8]">Draw custom intrusion polygon bounds & velocity alert rules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#94a3b8] hover:text-[#f87171] hover:bg-[#1e293b] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Interactive Polygon Visualizer */}
            <div className="flex flex-col space-y-2">
              <label className="text-[12px] font-semibold text-[#cbd5e1] flex items-center justify-between">
                <span>1. Zone Boundary Placement (Click to Add Vertices)</span>
                <button
                  type="button"
                  onClick={handleResetPoints}
                  className="text-[11px] text-[#818cf8] hover:underline"
                >
                  Reset Polygon
                </button>
              </label>

              <div
                onClick={handleCanvasClick}
                className="relative w-full aspect-video bg-[#090d16] border-2 border-dashed border-[#334155] rounded-xl overflow-hidden cursor-crosshair group hover:border-[#6366f1] transition-colors"
              >
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

                {/* SVG Polygon overlay */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <polygon
                    points={polygonSvgPoints}
                    fill="rgba(99, 102, 241, 0.25)"
                    stroke="#818cf8"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />
                  {points.map(([px, py], i) => (
                    <circle
                      key={i}
                      cx={`${px * 100}%`}
                      cy={`${py * 100}%`}
                      r="5"
                      fill="#818cf8"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  ))}
                </svg>

                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-[10px] text-[#94a3b8]">
                  Points: {points.length} / 8 (Click canvas to define vertices)
                </div>
              </div>
            </div>

            {/* Zone Rules Configuration */}
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-[#cbd5e1] mb-1">Target Camera Node</label>
                <select
                  value={targetCameraCode}
                  onChange={e => setTargetCameraCode(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d1522] border border-[#2b3548] rounded-xl text-[13px] text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
                >
                  {cameras.map(c => (
                    <option key={c.id} value={c.code}>
                      {c.code} — {c.name} ({c.sector})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#cbd5e1] mb-1">Zone Identifier Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. North Gate Restricted Access Corridor"
                  value={zoneName}
                  onChange={e => setZoneName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d1522] border border-[#2b3548] rounded-xl text-[13px] text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#cbd5e1] mb-1">Sensitivity Class</label>
                  <select
                    value={sensitivity}
                    onChange={e => setSensitivity(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1522] border border-[#2b3548] rounded-xl text-[13px] text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
                  >
                    <option value="Class A (Restricted)">Class A (High Risk)</option>
                    <option value="Class B (Fence Line)">Class B (Fence Line)</option>
                    <option value="Class C (Buffer Zone)">Class C (Buffer Zone)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#cbd5e1] mb-1">Speed Limit (km/h)</label>
                  <input
                    type="number"
                    value={speedLimit}
                    onChange={e => setSpeedLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#0d1522] border border-[#2b3548] rounded-xl text-[13px] text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#cbd5e1] mb-1">Dwell Limit (sec)</label>
                  <input
                    type="number"
                    value={dwellThreshold}
                    onChange={e => setDwellThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#0d1522] border border-[#2b3548] rounded-xl text-[13px] text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#cbd5e1] mb-1">Restricted Hours</label>
                  <input
                    type="text"
                    placeholder="e.g. 22:00-06:00 or 24/7"
                    value={restrictedHours}
                    onChange={e => setRestrictedHours(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1522] border border-[#2b3548] rounded-xl text-[13px] text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2b3548]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#1e293b] hover:bg-[#334155] rounded-xl text-[13px] text-[#cbd5e1] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-gradient-to-r from-[#6366f1] to-[#4f46e5] hover:opacity-90 rounded-xl text-[13px] font-bold text-white shadow-lg flex items-center gap-2 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">add_task</span>
              <span>{saving ? 'Registering Zone...' : 'Save Restricted Zone'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

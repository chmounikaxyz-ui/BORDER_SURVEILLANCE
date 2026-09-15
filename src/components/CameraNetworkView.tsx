import React, { useState } from 'react';
import { CameraNode } from '../types';

interface CameraNetworkViewProps {
  cameras: CameraNode[];
  onSelectCamera: (cam: CameraNode) => void;
  onNavigateToLive: () => void;
  onDeleteCamera?: (camId: string, camCode: string) => void;
  onRebootCamera?: (camId: string, camCode: string) => Promise<void> | void;
  onOpenAddCameraModal?: () => void;
}

export const CameraNetworkView: React.FC<CameraNetworkViewProps> = ({
  cameras,
  onSelectCamera,
  onNavigateToLive,
  onDeleteCamera,
  onRebootCamera,
  onOpenAddCameraModal,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [rebootingId, setRebootingId] = useState<string | null>(null);
  const [disconnectConfirmCam, setDisconnectConfirmCam] = useState<CameraNode | null>(null);

  const handleReboot = async (cam: CameraNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setRebootingId(cam.id);
    try {
      if (onRebootCamera) {
        await onRebootCamera(cam.id, cam.code);
      }
    } finally {
      setTimeout(() => {
        setRebootingId(null);
      }, 1500);
    }
  };

  const promptDelete = (cam: CameraNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setDisconnectConfirmCam(cam);
  };

  const filteredCameras = cameras.filter(c => {
    const matchesType = filterType === 'ALL' || c.type.toUpperCase() === filterType.toUpperCase();
    const matchesSearch = 
      (c.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.sector || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.locationName || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Calculate real dynamic filter counts
  const typeCounts: Record<string, number> = {
    ALL: cameras.length,
    WEBCAM: cameras.filter(c => c.type.toUpperCase() === 'WEBCAM').length,
    OPTICAL: cameras.filter(c => c.type.toUpperCase() === 'OPTICAL').length,
    PTZ: cameras.filter(c => c.type.toUpperCase() === 'PTZ').length,
    THERMAL: cameras.filter(c => c.type.toUpperCase() === 'THERMAL').length,
    ALPR: cameras.filter(c => c.type.toUpperCase() === 'ALPR').length,
  };

  const availableFilterTypes = ['ALL', 'WEBCAM', 'OPTICAL', 'PTZ', 'THERMAL', 'ALPR'];

  return (
    <div className="flex-1 w-full p-6 overflow-y-auto text-[#dae3f7] space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#131c2a] p-6 rounded-xl border border-[#424754]/30 shadow-lg">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#adc6ff] text-[28px]">
              settings_remote
            </span>
            <h1 className="text-[24px] font-bold text-[#adc6ff] tracking-tight">
              Camera Network Fleet ({cameras.length} Active {cameras.length === 1 ? 'Sensor' : 'Sensors'})
            </h1>
          </div>
          <p className="text-[14px] text-[#c2c6d6] max-w-2xl">
            Real-time control and telemetry management for connected optical, thermal, PTZ dome, ALPR, and workstation webcam streams.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onOpenAddCameraModal && (
            <button
              onClick={onOpenAddCameraModal}
              className="px-4 py-2.5 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors shadow-md flex items-center gap-2 shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Connect Camera
            </button>
          )}
          <button
            onClick={onNavigateToLive}
            className="px-4 py-2.5 bg-[#222a39] hover:bg-[#2c3544] border border-[#424754]/40 text-[#dae3f7] font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors shadow-md flex items-center gap-2 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">videocam</span>
            Switch to Live Grid
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#17202e] p-4 rounded-xl border border-[#424754]/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
          {availableFilterTypes.map((t) => {
            const count = typeCounts[t] ?? 0;
            const isActive = filterType === t;
            return (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#4d8eff] text-[#00285d]'
                    : 'bg-[#222a39] text-[#c2c6d6] hover:bg-[#2c3544]'
                }`}
              >
                <span>{t}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isActive ? 'bg-[#00285d]/30 text-[#00285d]' : 'bg-[#131c2a] text-[#8c909f]'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative flex items-center bg-[#222a39] rounded-md px-3 py-1.5 border border-[#424754]/30 w-full md:w-80">
          <span className="material-symbols-outlined text-[#c2c6d6] text-[16px] mr-2">search</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search camera code, location or sector..."
            className="bg-transparent w-full text-[12px] text-[#dae3f7] placeholder:text-[#c2c6d6]/40 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-[#c2c6d6] hover:text-[#dae3f7]">
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredCameras.length === 0 && (
        <div className="bg-[#17202e] border border-[#424754]/30 rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#222a39] flex items-center justify-center border border-[#424754]/40">
            <span className="material-symbols-outlined text-[32px] text-[#8c909f]">videocam_off</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-[16px] font-bold text-[#dae3f7]">No Active Cameras Found</h3>
            <p className="text-[13px] text-[#8c909f] max-w-md">
              {searchQuery
                ? `No sensors match query "${searchQuery}". Try clearing search filter.`
                : `No sensors found for filter "${filterType}". Connect a new IP RTSP stream or local webcam.`}
            </p>
          </div>
          {onOpenAddCameraModal && (
            <button
              onClick={onOpenAddCameraModal}
              className="px-4 py-2 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] text-[12px] font-bold rounded-lg uppercase tracking-wider transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              Connect New Sensor
            </button>
          )}
        </div>
      )}

      {/* Camera Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {filteredCameras.map((cam) => {
          const isOnline = cam.status === 'online';
          const isRebooting = rebootingId === cam.id;

          return (
            <div
              key={cam.id}
              onClick={() => {
                onSelectCamera(cam);
                onNavigateToLive();
              }}
              className="bg-[#17202e] rounded-xl border border-[#424754]/30 hover:border-[#adc6ff]/50 p-4 flex flex-col justify-between gap-4 cursor-pointer transition-all hover:bg-[#222a39]/70 group shadow-md"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[14px] font-bold text-[#adc6ff]">
                      {cam.code}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-[#2c3544] text-[#dae3f7]">
                      {cam.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                      isRebooting
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : isOnline
                          ? 'bg-green-950 text-green-400 border border-green-500/30'
                          : 'bg-[#93000a] text-[#ffdad6]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isRebooting ? 'bg-amber-400 animate-spin' : isOnline ? 'bg-green-400' : 'bg-red-400'
                      }`}></span>
                      {isRebooting ? 'REBOOTING' : cam.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <h3 className="text-[13px] font-semibold text-[#dae3f7] mb-1">
                  {cam.locationName || cam.name}
                </h3>
                <span className="text-[11px] text-[#c2c6d6] block mb-3 font-mono">
                  {cam.sector} • {cam.coordinatesString || `${cam.lat ?? 34.0528}° N, ${Math.abs(cam.lng ?? -118.2415)}° W`}
                </span>

                <div className="grid grid-cols-3 gap-2 bg-[#131c2a] p-2.5 rounded-lg border border-[#424754]/20 font-mono text-[10px] text-center">
                  <div>
                    <span className="text-[#c2c6d6]/60 block">RES</span>
                    <span className="text-[#dae3f7] font-semibold">{cam.resolution || '1080p'}</span>
                  </div>
                  <div>
                    <span className="text-[#c2c6d6]/60 block">FPS</span>
                    <span className="text-[#dae3f7] font-semibold">{cam.fps || 30}</span>
                  </div>
                  <div>
                    <span className="text-[#c2c6d6]/60 block">RATE</span>
                    <span className="text-green-400 font-semibold">{cam.bitrate || '4.2 Mbps'}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center gap-1.5 pt-2 border-t border-[#424754]/20">
                <div className="flex items-center gap-1.5 w-full">
                  <button
                    onClick={(e) => handleReboot(cam, e)}
                    disabled={isRebooting}
                    className="flex-1 px-2 py-1 bg-[#222a39] hover:bg-[#2c3544] text-[#c2c6d6] hover:text-[#dae3f7] rounded text-[11px] font-mono transition-colors border border-[#424754]/30 flex items-center justify-center gap-1"
                  >
                    <span className={`material-symbols-outlined text-[13px] ${isRebooting ? 'animate-spin text-amber-400' : ''}`}>
                      restart_alt
                    </span>
                    {isRebooting ? 'Rebooting...' : 'Reboot'}
                  </button>
                  <button
                    onClick={(e) => promptDelete(cam, e)}
                    title="Disconnect and remove camera"
                    className="flex-1 px-2 py-1 bg-[#93000a]/40 hover:bg-[#93000a] text-[#ffdad6] hover:text-white rounded text-[11px] font-mono transition-colors border border-[#ffb4ab]/40 flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      link_off
                    </span>
                    Disconnect
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Styled Disconnect Confirmation Modal */}
      {disconnectConfirmCam && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-[#17202e] border border-[#ffb4ab]/30 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-[#ffb4ab] text-[28px]">warning</span>
              <h3 className="text-[16px] font-bold text-[#dae3f7]">Confirm Removal</h3>
            </div>
            <p className="text-[13px] text-[#c2c6d6] mb-5 font-mono leading-relaxed">
              This will unbind camera <span className="text-[#adc6ff] font-bold">{disconnectConfirmCam.code}</span> ({disconnectConfirmCam.locationName || disconnectConfirmCam.name}) from the network database. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDisconnectConfirmCam(null)}
                className="flex-1 py-2.5 bg-[#222a39] hover:bg-[#2c3544] border border-[#424754]/30 rounded-lg text-[12px] font-bold uppercase tracking-wider text-[#c2c6d6] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteCamera?.(disconnectConfirmCam.id, disconnectConfirmCam.code);
                  setDisconnectConfirmCam(null);
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

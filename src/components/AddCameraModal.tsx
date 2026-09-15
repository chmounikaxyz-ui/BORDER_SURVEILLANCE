import React, { useState } from 'react';
import { addCameraNode } from '../api/client';

import { CameraNode } from '../types';

interface AddCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCameraAdded: (cam?: CameraNode) => void;
}

export const AddCameraModal: React.FC<AddCameraModalProps> = ({
  isOpen,
  onClose,
  onCameraAdded
}) => {
  const [sourceType, setSourceType] = useState<'webcam' | 'rtsp'>('webcam');
  const [name, setName] = useState('Laptop Webcam');
  const [code, setCode] = useState(`CAM-LIVE-${Math.floor(Math.random() * 90 + 10)}`);
  const [sector, setSector] = useState('Sector South');
  const [camType, setCamType] = useState<'optical' | 'thermal' | 'ptz' | 'alpr' | 'webcam'>('webcam');
  const [streamUrl, setStreamUrl] = useState('0');
  const [locationName, setLocationName] = useState('Command Centre Local Workstation');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSourceTypeChange = (type: 'webcam' | 'rtsp') => {
    setSourceType(type);
    if (type === 'webcam') {
      setStreamUrl('0');
      setName('Laptop Webcam');
      setCamType('webcam');
    } else {
      setStreamUrl('http://192.168.1.50:8080/video');
      setName('Phone / IP CCTV Stream');
      setCamType('optical');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    const createdCamNode: CameraNode = {
      id: `cam-${Date.now()}`,
      name,
      code,
      sector,
      type: camType as any,
      stream_url: streamUrl,
      status: 'online',
      hasAlert: false,
      lat: 34.0528,
      lng: -118.2415,
      coordinatesString: '34.0528° N, 118.2415° W',
      resolution: '1080p',
      fps: 30,
      bitrate: '4.2 Mbps',
      locationName: locationName,
      imageUrl: streamUrl === '0' ? '' : streamUrl,
      ptzSupport: camType === 'ptz',
    };

    try {
      const res = await Promise.race([
        addCameraNode({
          name,
          code,
          sector,
          type: camType,
          stream_url: streamUrl,
          location_name: locationName,
          lat: 34.0528 + (Math.random() * 0.05 - 0.025),
          lng: -118.2415 + (Math.random() * 0.05 - 0.025),
        }),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Backend connection timed out')), 4000))
      ]);

      if (res?.id) {
        createdCamNode.id = res.id;
        createdCamNode.imageUrl = streamUrl === '0' ? '' : `/api/cameras/${res.id}/stream`;
      }
    } catch (err: any) {
      console.warn('[AddCameraModal] Saved locally:', err);
    } finally {
      setIsSubmitting(false);
      onCameraAdded(createdCamNode);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#17202e] border border-[#adc6ff]/50 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
        <div className="flex justify-between items-start border-b border-[#424754]/30 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#4d8eff]/20 border border-[#adc6ff]/40 rounded-lg text-[#adc6ff]">
              <span className="material-symbols-outlined text-[24px]">videocam</span>
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[#dae3f7]">Connect Real CCTV / Stream</h2>
              <span className="text-[11px] font-mono text-[#adc6ff]">LIVE STREAM & WEBCAM REGISTRATION</span>
            </div>
          </div>
          <button onClick={onClose} className="text-[#c2c6d6] hover:text-white p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Source Type Selector */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleSourceTypeChange('webcam')}
            className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
              sourceType === 'webcam'
                ? 'bg-[#4d8eff]/20 border-[#adc6ff] text-[#dae3f7]'
                : 'bg-[#131c2a] border-[#424754]/30 text-[#c2c6d6] hover:bg-[#222a39]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#adc6ff]">laptop_mac</span>
              <span className="text-[13px] font-bold">Laptop Webcam</span>
            </div>
            <span className="text-[10px] text-[#c2c6d6]/70">Use built-in camera (Device 0)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSourceTypeChange('rtsp')}
            className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
              sourceType === 'rtsp'
                ? 'bg-[#4d8eff]/20 border-[#adc6ff] text-[#dae3f7]'
                : 'bg-[#131c2a] border-[#424754]/30 text-[#c2c6d6] hover:bg-[#222a39]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-purple-300">smartphone</span>
              <span className="text-[13px] font-bold">Phone / RTSP CCTV</span>
            </div>
            <span className="text-[10px] text-[#c2c6d6]/70">IP Camera / Phone Stream URL</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-[#93000a]/40 border border-[#ffb4ab]/50 rounded-lg text-[#ffdad6] text-[12px] font-mono">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-[12px]">
          <div>
            <label className="block text-[#c2c6d6] text-[10px] uppercase font-bold mb-1">Camera Display Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0b1422] border border-[#424754]/40 rounded-lg p-2.5 text-[#dae3f7] focus:outline-none focus:border-[#adc6ff]"
              placeholder="e.g. Laptop Webcam or Front Gate CCTV"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#c2c6d6] text-[10px] uppercase font-bold mb-1">Camera Code</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full bg-[#0b1422] border border-[#424754]/40 rounded-lg p-2.5 text-[#dae3f7] focus:outline-none focus:border-[#adc6ff]"
                placeholder="e.g. CAM-01"
              />
            </div>
            <div>
              <label className="block text-[#c2c6d6] text-[10px] uppercase font-bold mb-1">Sector</label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full bg-[#0b1422] border border-[#424754]/40 rounded-lg p-2.5 text-[#dae3f7] focus:outline-none focus:border-[#adc6ff]"
              >
                <option value="Sector North">Sector North</option>
                <option value="Sector South">Sector South</option>
                <option value="Sector East">Sector East</option>
                <option value="Sector West">Sector West</option>
                <option value="Checkpoints">Checkpoints</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[#c2c6d6] text-[10px] uppercase font-bold mb-1">
              {sourceType === 'webcam' ? 'Camera Device Index' : 'RTSP / HTTP Stream URL'}
            </label>
            <input
              type="text"
              required
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              className="w-full bg-[#0b1422] border border-[#424754]/40 rounded-lg p-2.5 text-[#adc6ff] focus:outline-none focus:border-[#adc6ff]"
              placeholder={sourceType === 'webcam' ? '0' : 'rtsp://admin:pass@192.168.1.100:554/stream'}
            />
            <span className="text-[10px] text-[#c2c6d6]/60 mt-1 block">
              {sourceType === 'webcam'
                ? "Enter '0' for built-in laptop camera or '1' for external USB webcam."
                : "Enter your Phone IP Camera URL (e.g., http://192.168.1.50:8080/video) or CCTV RTSP feed."}
            </span>
          </div>

          <div>
            <label className="block text-[#c2c6d6] text-[10px] uppercase font-bold mb-1">Location Description</label>
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="w-full bg-[#0b1422] border border-[#424754]/40 rounded-lg p-2.5 text-[#dae3f7] focus:outline-none focus:border-[#adc6ff]"
              placeholder="e.g. Command Centre Desk"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#424754]/30">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#222a39] text-[#c2c6d6] hover:text-white rounded-lg text-[12px] font-bold uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] font-bold rounded-lg text-[12px] uppercase shadow-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  Registering...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">add_link</span>
                  Connect Camera
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

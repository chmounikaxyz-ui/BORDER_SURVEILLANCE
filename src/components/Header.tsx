import React, { useState, useEffect } from 'react';
import { NavTab } from '../types';

interface HeaderProps {
  activeTab: NavTab;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  alertCount: number;
  cameraCount?: number;
  onOpenQuickMenu: () => void;
  onOpenAddCameraModal: () => void;
  onToggleSound: () => void;
  soundEnabled: boolean;
  apiConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  searchQuery,
  onSearchChange,
  alertCount,
  cameraCount = 1,
  onOpenQuickMenu,
  onOpenAddCameraModal,
  onToggleSound,
  soundEnabled,
  apiConnected = false,
}) => {
  const [timeString, setTimeString] = useState('');
  const [dateString, setDateString] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format 14:22:08
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setTimeString(`${hours}:${minutes}:${seconds}`);

      // Format 24 OCT 2023 | UTC+5:30
      const day = String(now.getDate()).padStart(2, '0');
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const month = monthNames[now.getMonth()];
      const year = now.getFullYear();
      setDateString(`${day} ${month} ${year} | UTC+5:30`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);



  return (
    <header className="fixed top-0 left-72 right-0 h-16 bg-[#0b1422]/90 backdrop-blur-md border-b border-[#424754]/30 z-40 flex items-center px-8 justify-end gap-4">

      {/* Right: Clock & Quick Actions */}
      <div className="flex items-center gap-4 shrink-0">
        {/* API Backend Live Status Pill */}
        <div
          title={apiConnected ? "FastAPI Neural Backend Online" : "Backend Disconnected or Cold-Starting — Running in Local Storage Mode"}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border transition-colors ${
            apiConnected
              ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
              : "bg-amber-950/40 text-amber-300 border-amber-500/30"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${apiConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          {apiConnected ? "API LIVE" : "LOCAL MODE"}
        </div>

        <button
          onClick={onOpenAddCameraModal}
          className="px-3 py-1.5 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] font-bold rounded-lg text-[11px] uppercase tracking-wider transition-colors shadow flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">videocam</span>
          + Connect Camera
        </button>

        {/* UTC Clock */}
        <div className="hidden md:flex flex-col items-end leading-tight">
          <span className="font-mono text-[13px] font-semibold text-[#dae3f7] tracking-wider">
            {timeString || '14:22:08'}
          </span>
          <span className="text-[9px] font-bold uppercase text-[#c2c6d6] opacity-70 tracking-wider">
            {dateString || '24 OCT 2023 | UTC+5:30'}
          </span>
        </div>

        {/* Audio Siren Mute/Unmute */}
        <button
          onClick={onToggleSound}
          title={soundEnabled ? 'Mute Alert Sound Effects' : 'Enable Alert Sound Effects'}
          className={`p-2 rounded-lg transition-colors border ${
            soundEnabled
              ? 'bg-[#4d8eff]/10 border-[#adc6ff]/30 text-[#adc6ff]'
              : 'border-[#424754]/30 text-[#c2c6d6] hover:bg-[#222a39]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {soundEnabled ? 'volume_up' : 'volume_off'}
          </span>
        </button>
        {/* Quick Tools Grid Icon */}
        <button
          onClick={onOpenQuickMenu}
          className="p-1 rounded hover:bg-[#222a39] text-[#c2c6d6] hover:text-[#dae3f7] transition-colors"
          title="Tactical Grid Menu"
        >
          <span className="material-symbols-outlined text-[22px]">apps</span>
        </button>
      </div>
    </header>
  );
};

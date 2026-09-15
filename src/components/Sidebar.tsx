import React from 'react';
import { NavTab } from '../types';
import { ASSETS } from '../data/mockData';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  alertCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  alertCount
}) => {
  const navItems: { id: NavTab; label: string; icon: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'live-surveillance', label: 'Live Surveillance', icon: 'videocam' },
    { id: 'alerts', label: 'Alerts', icon: 'notifications_active', badge: alertCount },
    { id: 'camera-network', label: 'Camera Network', icon: 'settings_remote' },
    { id: 'watchlist-matches', label: 'Watchlist Matches', icon: 'person_search' },
    { id: 'watchlist-db', label: 'Watchlist Database', icon: 'manage_accounts' },
    { id: 'evidence-vault', label: 'Evidence Vault', icon: 'folder_shared' },
    { id: 'system-health', label: 'System Health', icon: 'health_and_safety' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
    { id: 'system-architecture', label: 'System Architecture', icon: 'account_tree' }
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-[#131c2a] border-r border-[#424754]/30 flex flex-col z-50 shadow-2xl">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3 mb-2">
        <img
          alt="IGNITIX Logo"
          className="h-10 w-auto object-contain shrink-0"
          src={ASSETS.logo}
        />
        <div className="flex flex-col">
          <span className="font-sans text-[18px] font-bold text-[#adc6ff] tracking-wider leading-none">
            BorderVision AI
          </span>
          <span className="text-[10px] font-bold uppercase text-[#c2c6d6] opacity-60 tracking-[0.2em] mt-1">
            BORDER INTELLIGENCE
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-1.5 py-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const isSettings = item.id === 'settings';

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-all group ${
                isSettings ? 'border-t border-[#424754]/20 mt-4 pt-3' : ''
              } ${
                isActive
                  ? 'bg-[#4d8eff] text-[#00285d] font-bold shadow-sm'
                  : 'text-[#c2c6d6] hover:bg-[#222a39] hover:text-[#dae3f7]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>
                <span className="text-[14px] leading-tight font-medium tracking-wide">
                  {item.label}
                </span>
              </div>

              {item.badge && item.badge > 0 && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-[#00285d] text-[#4d8eff]'
                      : 'bg-[#93000a] text-[#ffdad6] border border-[#ffb4ab]/40 animate-pulse'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Operator Profile Footer */}
      <div className="p-4 border-t border-[#424754]/20 bg-[#060e1c]">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative shrink-0">
            <img
              alt="Operator Profile"
              className="w-10 h-10 rounded-full object-cover border border-[#adc6ff]/30"
              src={ASSETS.operatorAvatar}
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#060e1c] shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-[14px] font-semibold text-[#dae3f7] truncate">
              Operator A. Kumar
            </span>
            <span className="text-[10px] uppercase font-bold text-[#c2c6d6] opacity-70 tracking-wider truncate">
              Command Centre Analyst
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            alert('Security clearance verified: System Level 4 Active');
          }}
          className="flex items-center justify-between w-full px-4 py-2 text-[#ffb4ab] hover:bg-[#93000a]/20 rounded-lg transition-colors border border-[#ffb4ab]/10"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider">
            System Online
          </span>
          <span className="material-symbols-outlined text-[18px]">logout</span>
        </button>
      </div>
    </aside>
  );
};

import React, { useState } from 'react';
import { DetectionPipelineView } from './DetectionPipelineView';
import { EdgeTransportView } from './EdgeTransportView';

export const SystemArchitectureView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'transport'>('pipeline');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top Selector Bar */}
      <div className="bg-[#131c2a] border-b border-[#424754]/30 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#adc6ff] text-[24px]">account_tree</span>
          <div>
            <h2 className="text-[16px] font-bold text-[#dae3f7]">System Architecture & Technical Approach</h2>
            <span className="text-[11px] font-mono text-[#c2c6d6]">IGNITIX BorderVision AI Specification</span>
          </div>
        </div>

        <div className="flex gap-2 bg-[#0b1422] p-1 rounded-lg border border-[#424754]/30">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[12px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'pipeline'
                ? 'bg-[#4d8eff] text-[#00285d] shadow-md'
                : 'text-[#c2c6d6] hover:bg-[#222a39]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">schema</span>
            Detection Pipeline
          </button>
          <button
            onClick={() => setActiveTab('transport')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[12px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'transport'
                ? 'bg-[#4d8eff] text-[#00285d] shadow-md'
                : 'text-[#c2c6d6] hover:bg-[#222a39]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">cell_tower</span>
            Edge Transport & Buffer
          </button>
        </div>
      </div>

      {/* Content Container */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'pipeline' ? <DetectionPipelineView /> : <EdgeTransportView />}
      </div>
    </div>
  );
};

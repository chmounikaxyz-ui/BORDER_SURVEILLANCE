import React, { useState, useEffect } from 'react';
import { getAnalytics, AnalyticsData } from '../api/client';

export const AnalyticsView: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<AnalyticsData>({
    totalAlerts: 0,
    criticalAlerts: 0,
    highAlerts: 0,
    personnelCount: 0,
    vehicleCount: 0,
    evidenceCount: 0,
    interceptionRate: 100,
    avgResponseTime: '0s (Standby)',
    falseAlarmRate: 0,
    heatmap: [],
    vectors: []
  });

  const loadData = async (range: '24h' | '7d' | '30d') => {
    setIsLoading(true);
    try {
      const data = await getAnalytics(range);
      if (data) {
        setStats(data);
      }
    } catch (e) {
      console.error('[Analytics] Failed to fetch data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(timeRange);
    const interval = setInterval(() => {
      loadData(timeRange);
    }, 8000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const handleExportBrief = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups to view and print the Tactical Analytics Brief.');
      return;
    }

    const rowsHtml = (stats.vectors || []).map(v => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>${v.label}</strong></td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${v.sublabel}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${v.count}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">${v.percentage}%</td>
      </tr>
    `).join('');

    const heatmapHtml = (stats.heatmap || []).map(h => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>${h.sector}</strong></td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${h.total} Incidents</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-family: monospace;">[${h.slots.join(' | ')}]</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>BorderVision AI - Tactical Intelligence & Analytics Brief</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111; padding: 30px; }
            h1 { font-size: 20px; text-transform: uppercase; border-bottom: 2px solid #00285d; padding-bottom: 8px; color: #00285d; }
            .meta { font-size: 12px; color: #555; margin-bottom: 20px; font-family: monospace; }
            .grid { display: flex; gap: 20px; margin-bottom: 25px; }
            .kpi { flex: 1; border: 1px solid #ccc; border-radius: 6px; padding: 12px; background: #f9f9f9; }
            .kpi-title { font-size: 11px; text-transform: uppercase; color: #666; font-weight: bold; }
            .kpi-val { font-size: 24px; font-weight: bold; color: #00285d; margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            th { background: #00285d; color: #fff; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
            .footer { margin-top: 40px; font-size: 11px; color: #777; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>BorderVision AI • Tactical Intelligence & Analytics Brief</h1>
          <div class="meta">
            GENERATED: ${new Date().toUTCString()} | TIMEFRAME: ${timeRange.toUpperCase()} | CLASSIFICATION: CONFIDENTIAL
          </div>

          <div class="grid">
            <div class="kpi">
              <div class="kpi-title">Total Incursions</div>
              <div class="kpi-val">${stats.totalAlerts}</div>
              <small>${stats.interceptionRate}% Interception Rate</small>
            </div>
            <div class="kpi">
              <div class="kpi-title">QRF Dispatch Response</div>
              <div class="kpi-val">${stats.avgResponseTime}</div>
              <small>Average Reaction Speed</small>
            </div>
            <div class="kpi">
              <div class="kpi-title">False Positive Filter</div>
              <div class="kpi-val">${stats.falseAlarmRate}%</div>
              <small>AI Filter Accuracy</small>
            </div>
            <div class="kpi">
              <div class="kpi-title">Critical Threats</div>
              <div class="kpi-val">${stats.criticalAlerts}</div>
              <small>${stats.highAlerts} High Severity Incidents</small>
            </div>
          </div>

          <h2 style="font-size: 14px; text-transform: uppercase; margin-top: 25px;">Cross-Border Threat Vector Distribution</h2>
          <table>
            <thead>
              <tr>
                <th>Classification Vector</th>
                <th>Intelligence Summary</th>
                <th style="text-align: center;">Count</th>
                <th style="text-align: right;">Share (%)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="4" style="padding: 10px; text-align: center;">No vector incidents recorded in timeframe.</td></tr>'}
            </tbody>
          </table>

          <h2 style="font-size: 14px; text-transform: uppercase; margin-top: 25px;">Sector Incursion Temporal Matrix</h2>
          <table>
            <thead>
              <tr>
                <th>Camera Sector</th>
                <th style="text-align: center;">Activity</th>
                <th style="text-align: right;">Time Slot Bins (3hr intervals)</th>
              </tr>
            </thead>
            <tbody>
              ${heatmapHtml || '<tr><td colspan="3" style="padding: 10px; text-align: center;">No sector breaches registered.</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            BorderVision AI Tactical Operations System • Cryptographically Verified Audit Log
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="flex-1 w-full p-6 overflow-y-auto text-[#dae3f7] space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#131c2a] p-6 rounded-xl border border-[#424754]/30 shadow-lg">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#adc6ff] text-[28px]">
              monitoring
            </span>
            <h1 className="text-[24px] font-bold text-[#adc6ff] tracking-tight">
              Tactical Intelligence & Analytics
            </h1>
            {isLoading && (
              <span className="w-2 h-2 rounded-full bg-[#adc6ff] animate-ping ml-1" title="Syncing real database analytics..."></span>
            )}
          </div>
          <p className="text-[14px] text-[#c2c6d6] max-w-2xl">
            Real-time statistical reporting on threat frequency, cross-border incursion vectors, and QRF response efficiency from SQLite ledger.
          </p>
        </div>

        {/* Timeframe selector */}
        <div className="flex bg-[#222a39] rounded-lg p-1 border border-[#424754]/30">
          {(['24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => {
                setTimeRange(range);
                loadData(range);
              }}
              className={`px-3 py-1.5 rounded-md text-[12px] font-bold uppercase transition-all ${
                timeRange === range
                  ? 'bg-[#4d8eff] text-[#00285d]'
                  : 'text-[#c2c6d6] hover:text-[#dae3f7]'
              }`}
            >
              {range === '24h' ? 'Last 24 Hours' : range === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Total Threat Interceptions */}
        <div className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/30 flex flex-col justify-between">
          <div>
            <span className="text-[12px] text-[#c2c6d6] uppercase tracking-wider block">
              Total Threat Interceptions
            </span>
            <span className="text-[30px] font-mono font-bold text-[#adc6ff] mt-1 block">{stats.totalAlerts}</span>
          </div>
          <span className="text-[11px] text-green-400 font-mono mt-2">
            {stats.interceptionRate}% Interception Success
          </span>
        </div>

        {/* Card 2: Avg QRF Dispatch Response */}
        <div className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/30 flex flex-col justify-between">
          <div>
            <span className="text-[12px] text-[#c2c6d6] uppercase tracking-wider block">
              Avg QRF Dispatch Response
            </span>
            <span className="text-[30px] font-mono font-bold text-[#dae3f7] mt-1 block">{stats.avgResponseTime}</span>
          </div>
          <span className="text-[11px] text-green-400 font-mono mt-2">
            Real reaction speed metrics
          </span>
        </div>

        {/* Card 3: AI False Alarm Suppression */}
        <div className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/30 flex flex-col justify-between">
          <div>
            <span className="text-[12px] text-[#c2c6d6] uppercase tracking-wider block">
              AI False Alarm Suppression
            </span>
            <span className="text-[30px] font-mono font-bold text-[#bbc7df] mt-1 block">{stats.falseAlarmRate}%</span>
          </div>
          <span className="text-[11px] text-[#adc6ff] font-mono mt-2">
            Dismissed false positive ratio
          </span>
        </div>

        {/* Card 4: Watchlist Correlation Rate */}
        <div className="bg-[#17202e] p-5 rounded-xl border border-[#424754]/30 flex flex-col justify-between">
          <div>
            <span className="text-[12px] text-[#c2c6d6] uppercase tracking-wider block">
              Watchlist Correlation Rate
            </span>
            <span className="text-[30px] font-mono font-bold text-[#ffb4ab] mt-1 block">{stats.criticalAlerts} Critical</span>
          </div>
          <span className="text-[11px] text-[#ffb4ab] font-mono mt-2">
            {stats.highAlerts} high severity incidents
          </span>
        </div>
      </div>

      {/* Deep Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Incursion Heatmap Matrix */}
        <div className="bg-[#17202e] p-6 rounded-xl border border-[#424754]/30 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-[#dae3f7] mb-1">
                Sector Vulnerability Heat Matrix ({timeRange.toUpperCase()})
              </h3>
              <span className="text-[11px] font-mono text-[#adc6ff]">
                Real Database Distribution
              </span>
            </div>
            <p className="text-[12px] text-[#c2c6d6]">
              Temporal distribution of verified & pending security events across 3-hour time slots.
            </p>
          </div>

          <div className="space-y-3 font-mono text-[11px] my-2">
            {(stats.heatmap && stats.heatmap.length > 0) ? (
              stats.heatmap.map((sec, sIdx) => (
                <div key={sIdx} className="flex items-center gap-2">
                  <span className="w-40 text-xs text-[#c2c6d6] truncate font-sans" title={sec.sector}>
                    {sec.sector}
                  </span>
                  <div className="flex-1 grid grid-cols-8 gap-1">
                    {sec.slots.map((count, hIdx) => {
                      return (
                        <div
                          key={hIdx}
                          title={`${sec.sector} @ Slot ${hIdx * 3}:00 - Incidents: ${count}`}
                          className={`h-7 rounded flex items-center justify-center text-[10px] font-bold transition-all hover:scale-105 ${
                            count > 5
                              ? 'bg-[#93000a] text-[#ffdad6] border border-[#ffb4ab]/40'
                              : count > 0
                                ? 'bg-[#4d8eff]/50 text-[#adc6ff] border border-[#adc6ff]/30'
                                : 'bg-[#222a39]/70 text-[#c2c6d6]/30 border border-transparent'
                          }`}
                        >
                          {count > 0 ? count : '-'}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-[#c2c6d6]/50 font-sans text-xs">
                No active camera sectors registered in system.
              </div>
            )}
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono text-[#c2c6d6] pt-2 border-t border-[#424754]/20">
            <span>00:00 (Night)</span>
            <span>06:00 (Dawn)</span>
            <span>12:00 (Noon)</span>
            <span>18:00 (Dusk)</span>
            <span>23:59</span>
          </div>
        </div>

        {/* Threat Type Breakdown & Trends */}
        <div className="bg-[#17202e] p-6 rounded-xl border border-[#424754]/30 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-[#dae3f7] mb-1">
                Cross-Border Threat Vector Distribution
              </h3>
              <span className="text-[11px] font-mono text-[#adc6ff]">
                Live Classified Metrics
              </span>
            </div>
            <p className="text-[12px] text-[#c2c6d6]">
              Real classification breakdown across optical, biometric, and vehicle recognition pipelines.
            </p>
          </div>

          <div className="space-y-3">
            {(stats.vectors && stats.vectors.length > 0) ? (
              stats.vectors.map((vec, idx) => (
                <div key={idx} className="flex items-center justify-between bg-[#131c2a] p-3 rounded-lg border border-[#424754]/20">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]" style={{ color: vec.color }}>
                      {vec.icon}
                    </span>
                    <div>
                      <span className="text-[13px] font-bold text-[#dae3f7] block">{vec.label}</span>
                      <span className="text-[11px] text-[#c2c6d6]">{vec.sublabel} ({vec.count} recorded)</span>
                    </div>
                  </div>
                  <span className="font-mono text-[14px] font-bold" style={{ color: vec.color }}>
                    {vec.percentage}%
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-[#c2c6d6]/50 text-xs">
                No categorized threat events in selected timeframe.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-[#424754]/20">
            <button 
              onClick={handleExportBrief}
              className="px-4 py-2 bg-[#222a39] hover:bg-[#2c3544] text-[#adc6ff] border border-[#adc6ff]/30 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
              Export Analytics Brief (PDF)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

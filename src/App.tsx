import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavTab, TacticalAlert, CameraNode, EvidenceRecord } from './types';
import { checkHealth, getAlerts, getCameras, updateAlertStatus, deleteAlert, clearAllAlerts, deleteCameraNode, rebootCameraNode, submitAlertFeedback } from './api/client';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { LiveSurveillanceView } from './components/LiveSurveillanceView';
import { AlertsView } from './components/AlertsView';
import { WatchlistMatchesView } from './components/WatchlistMatchesView';
import { WatchlistDbView } from './components/WatchlistDbView';
import { EvidenceVaultView } from './components/EvidenceVaultView';
import { SystemHealthView } from './components/SystemHealthView';
import { CameraNetworkView } from './components/CameraNetworkView';
import { SystemArchitectureView } from './components/SystemArchitectureView';
import { SettingsView } from './components/SettingsView';
import { Modals } from './components/Modals';
import { AddCameraModal } from './components/AddCameraModal';
import { CustomZoneModal } from './components/CustomZoneModal';

import { DEFAULT_CAMERAS } from './data/mockData';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [alerts, setAlerts] = useState<TacticalAlert[]>([]);
  const [cameras, setCameras] = useState<CameraNode[]>(DEFAULT_CAMERAS);
  
  const [selectedCamera, setSelectedCamera] = useState<CameraNode | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<TacticalAlert | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Live API state
  const [apiConnected, setApiConnected] = useState(false);
  const prevAlertCountRef = useRef(0);

  // Modals state
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [dispatchAlertId, setDispatchAlertId] = useState<string | null>(null);
  const [downloadEvidenceAlert, setDownloadEvidenceAlert] = useState<TacticalAlert | EvidenceRecord | null>(null);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [isAddCameraModalOpen, setIsAddCameraModalOpen] = useState(false);
  const [isCustomZoneModalOpen, setIsCustomZoneModalOpen] = useState(false);

  // Banner Toast Notifications
  const [toastMessage, setToastMessage] = useState<{ title: string; subtitle: string; type: 'success' | 'warn' | 'info' } | null>(null);

  const showToast = (title: string, subtitle: string, type: 'success' | 'warn' | 'info' = 'success') => {
    setToastMessage({ title, subtitle, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Synthesize sound effects using Web Audio API when sirens trigger
  const playTacticalChime = (type: 'alert' | 'dispatch' | 'success') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'alert') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'dispatch') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1040, audioCtx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      }
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  };

  // Handlers for Dispatching and Dismissing Alerts
  const handleOpenDispatchModal = (alertId: string) => {
    setDispatchAlertId(alertId);
    playTacticalChime('alert');
  };

  const handleConfirmDispatch = (unit: string) => {
    if (dispatchAlertId) {
      setAlerts(prev => prev.map(a => a.id === dispatchAlertId ? { ...a, status: 'ESCALATED' } : a));
      showToast('Tactical QRF Dispatched', `${unit} en route to target coordinates.`, 'success');
      playTacticalChime('dispatch');
      setDispatchAlertId(null);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    const targetAlert = alerts.find(a => a.id === alertId);
    const baseTitle = targetAlert?.title.replace(/\(\d+%\)/g, '').trim();
    const camCode = targetAlert?.cameraCode;

    const idsToDismiss = alerts
      .filter(a => a.id === alertId || (baseTitle && a.cameraCode === camCode && a.title.replace(/\(\d+%\)/g, '').trim() === baseTitle))
      .map(a => a.id);

    setAlerts(prev => prev.map(a => idsToDismiss.includes(a.id) ? { ...a, status: 'DISMISSED' } : a));
    showToast('Alert Dismissed', `Incident ${alertId} logged as false positive and archived.`, 'info');
    playTacticalChime('success');

    if (apiConnected) {
      for (const id of idsToDismiss) {
        await updateAlertStatus(id, 'DISMISSED');
        await submitAlertFeedback(id, false);
      }
    }
  };

  const handleVerifyAlert = async (alertId: string) => {
    const targetAlert = alerts.find(a => a.id === alertId);
    const baseTitle = targetAlert?.title.replace(/\(\d+%\)/g, '').trim();
    const camCode = targetAlert?.cameraCode;

    const idsToVerify = alerts
      .filter(a => a.id === alertId || (baseTitle && a.cameraCode === camCode && a.title.replace(/\(\d+%\)/g, '').trim() === baseTitle))
      .map(a => a.id);

    setAlerts(prev => prev.map(a => idsToVerify.includes(a.id) ? { ...a, status: 'VERIFIED' } : a));
    showToast('Threat Verified', `Incident ${alertId} marked as verified breach.`, 'success');
    playTacticalChime('alert');

    if (apiConnected) {
      for (const id of idsToVerify) {
        await updateAlertStatus(id, 'VERIFIED');
        await submitAlertFeedback(id, true);
      }
    }
  };

  const handleEscalateAlert = (alertId: string) => {
    handleOpenDispatchModal(alertId);
  };

  const handleDeleteAlert = async (alertId: string) => {
    const targetAlert = alerts.find(a => a.id === alertId);
    const baseTitle = targetAlert?.title.replace(/\(\d+%\)/g, '').trim();
    const camCode = targetAlert?.cameraCode;

    const idsToDelete = alerts
      .filter(a => a.id === alertId || (baseTitle && a.cameraCode === camCode && a.title.replace(/\(\d+%\)/g, '').trim() === baseTitle))
      .map(a => a.id);

    setAlerts(prev => prev.filter(a => !idsToDelete.includes(a.id)));
    if (selectedAlert && idsToDelete.includes(selectedAlert.id)) setSelectedAlert(null);
    showToast('Alert Deleted', `Alert ${alertId} removed from database.`, 'info');

    if (apiConnected) {
      for (const id of idsToDelete) {
        await deleteAlert(id);
      }
    }
  };

  const handleClearAllAlerts = async () => {
    setAlerts([]);
    setSelectedAlert(null);
    showToast('Alerts Cleared', `All alerts removed from database.`, 'info');
    if (apiConnected) await clearAllAlerts();
  };

  const handleDeleteCamera = async (camId: string, camCode: string) => {
    setCameras(prev => prev.filter(c => c.id !== camId));
    if (selectedCamera?.id === camId) setSelectedCamera(null);
    showToast('Camera Disconnected', `Camera ${camCode} has been unlinked from network.`, 'info');
    if (apiConnected) await deleteCameraNode(camId);
  };

  const handleRebootCamera = async (camId: string, camCode: string) => {
    showToast('Rebooting Sensor', `Sending power cycle & RTSP re-sync signal to ${camCode}...`, 'info');
    if (apiConnected) {
      const res = await rebootCameraNode(camId);
      if (res) {
        showToast('Sensor Online', `${camCode} completed reboot cycle and verified live stream.`, 'success');
        playTacticalChime('success');
      }
    } else {
      setTimeout(() => {
        showToast('Sensor Online', `${camCode} reboot cycle finished.`, 'success');
      }, 1500);
    }
  };

  const handleEscalateWatchlist = (id: string) => {
    showToast('Watchlist Hit Escalated', `Biometric candidate ${id} forwarded to Central Command.`, 'warn');
    playTacticalChime('alert');
  };

  const handleRejectWatchlist = (id: string) => {
    showToast('Biometric Match Dismissed', `Candidate ${id} rejected as low facial landmark match.`, 'info');
  };

  // ── Live API polling (1.5-second interval) ──────────────────────────────────
  const pollApi = useCallback(async () => {
    const [healthy, liveAlerts, liveCameras] = await Promise.all([
      checkHealth(),
      getAlerts(),
      getCameras(),
    ]);

    const isConnected = healthy || Array.isArray(liveAlerts);
    setApiConnected(isConnected);

    if (Array.isArray(liveAlerts)) {
      setAlerts(liveAlerts as TacticalAlert[]);
      const newCount = liveAlerts.filter(a => a.status === 'PENDING VERIFICATION').length;
      if (newCount > prevAlertCountRef.current) {
        playTacticalChime('alert');
      }
      prevAlertCountRef.current = newCount;
    }

    if (Array.isArray(liveCameras) && liveCameras.length > 0) {
      setCameras(liveCameras as CameraNode[]);
    }
  }, [soundEnabled]);

  useEffect(() => {
    pollApi();                          // immediate first check
    const id = setInterval(pollApi, 1000); // 1.0s interval for snappy alert sync
    return () => clearInterval(id);
  }, [pollApi]);

  // Real-time instant alert listener from live webcam detection
  useEffect(() => {
    const handleAlertTriggered = (e: any) => {
      const newAlert = e.detail;
      if (newAlert && newAlert.id) {
        setAlerts(prev => [newAlert, ...prev.filter(a => a.id !== newAlert.id)]);
      }
      pollApi();
      playTacticalChime('alert');
      if (newAlert && newAlert.title) {
        showToast(
          newAlert.severity === 'CRITICAL' ? 'CRITICAL WATCHLIST MATCH' : 'SECURITY ALERT DETECTED',
          newAlert.title,
          'warn'
        );
      }
    };
    window.addEventListener('border_vision_alert_triggered', handleAlertTriggered);
    return () => window.removeEventListener('border_vision_alert_triggered', handleAlertTriggered);
  }, [pollApi, soundEnabled]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCertModalOpen(false);
        setDispatchAlertId(null);
        setDownloadEvidenceAlert(null);
        setIsQuickMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0b1422] text-[#dae3f7] font-sans antialiased select-none">
      {/* Left Fixed Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
        }}
        alertCount={alerts.filter(a => a.status !== 'DISMISSED').length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col pl-72 h-screen overflow-hidden">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          alertCount={alerts.filter(a => a.severity === 'CRITICAL').length}
          cameraCount={cameras.length}
          onOpenQuickMenu={() => setIsQuickMenuOpen(true)}
          onOpenAddCameraModal={() => setIsAddCameraModalOpen(true)}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          soundEnabled={soundEnabled}
          apiConnected={apiConnected}
        />

        {/* Global Toast Alert Banner */}
        {toastMessage && (
          <div className="fixed top-20 right-8 z-50 animate-bounce">
            <div className={`p-4 rounded-xl border shadow-2xl flex items-center gap-3 backdrop-blur-md ${
              toastMessage.type === 'warn'
                ? 'bg-[#93000a]/90 border-[#ffb4ab] text-[#ffdad6]'
                : toastMessage.type === 'info'
                  ? 'bg-[#222a39]/95 border-[#424754] text-[#dae3f7]'
                  : 'bg-green-950/95 border-green-500/80 text-green-200'
            }`}>
              <span className="material-symbols-outlined text-[24px]">
                {toastMessage.type === 'warn' ? 'crisis_alert' : toastMessage.type === 'info' ? 'info' : 'check_circle'}
              </span>
              <div className="flex flex-col">
                <span className="text-[13px] font-bold">{toastMessage.title}</span>
                <span className="text-[11px] opacity-80">{toastMessage.subtitle}</span>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Route View Switching */}
        <div className="flex-1 flex flex-col pt-16 min-h-0 h-[calc(100vh)] overflow-y-auto no-scrollbar">
          {activeTab === 'dashboard' && (
            <DashboardView
              cameras={cameras}
              alerts={alerts}
              onSelectCamera={(cam) => {
                setSelectedCamera(cam);
                setActiveTab('live-surveillance');
              }}
              onNavigate={(tab) => setActiveTab(tab)}
              onOpenAddCameraModal={() => setIsAddCameraModalOpen(true)}
            />
          )}

          {activeTab === 'live-surveillance' && (
            <LiveSurveillanceView
              cameras={cameras}
              selectedCamera={selectedCamera}
              onSelectCamera={setSelectedCamera}
              onOpenAlertModal={(alert) => {
                setSelectedAlert(alert);
                setActiveTab('alerts');
              }}
              onOpenCustomZoneModal={() => setIsCustomZoneModalOpen(true)}
              onDeleteCamera={handleDeleteCamera}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertsView
              alerts={alerts}
              selectedAlert={selectedAlert}
              onSelectAlert={setSelectedAlert}
              onVerifyAlert={handleVerifyAlert}
              onEscalateAlert={handleEscalateAlert}
              onDismissAlert={handleDismissAlert}
              onDeleteAlert={handleDeleteAlert}
              onClearAllAlerts={handleClearAllAlerts}
              onDownloadEvidence={(alert) => setDownloadEvidenceAlert(alert)}
              onNavigateToLiveFeed={(camCode) => {
                const targetCam = cameras.find(c => c.code === camCode || c.id === camCode);
                if (targetCam) setSelectedCamera(targetCam);
                setActiveTab('live-surveillance');
              }}
            />
          )}

          {activeTab === 'camera-network' && (
            <CameraNetworkView
              cameras={cameras}
              onSelectCamera={(cam) => {
                setSelectedCamera(cam);
                setActiveTab('live-surveillance');
              }}
              onNavigateToLive={() => setActiveTab('live-surveillance')}
              onDeleteCamera={handleDeleteCamera}
              onRebootCamera={handleRebootCamera}
              onOpenAddCameraModal={() => setIsAddCameraModalOpen(true)}
            />
          )}

          {activeTab === 'watchlist-matches' && (
            <WatchlistMatchesView
              onEscalateMatch={handleEscalateWatchlist}
              onRejectMatch={handleRejectWatchlist}
              onDeleteMatch={(id) => {
                showToast('Match Record Removed', `Biometric candidate ${id} deleted from database.`, 'info');
              }}
            />
          )}

          {activeTab === 'watchlist-db' && (
            <WatchlistDbView />
          )}

          {activeTab === 'evidence-vault' && (
            <EvidenceVaultView
              onViewCertificate={() => setIsCertModalOpen(true)}
              onExportPackage={(record) => setDownloadEvidenceAlert(record)}
            />
          )}

          {activeTab === 'system-health' && (
            <SystemHealthView />
          )}

          {activeTab === 'settings' && (
            <SettingsView />
          )}

          {activeTab === 'system-architecture' && (
            <SystemArchitectureView />
          )}
        </div>
      </div>

      {/* Global Modals (Certificate, Dispatch, Download, Quick Apps Menu) */}
      <Modals
        isCertModalOpen={isCertModalOpen}
        onCloseCertModal={() => setIsCertModalOpen(false)}
        dispatchAlertId={dispatchAlertId}
        onCloseDispatchModal={() => setDispatchAlertId(null)}
        onConfirmDispatch={handleConfirmDispatch}
        downloadEvidenceAlert={downloadEvidenceAlert}
        onCloseDownloadModal={() => setDownloadEvidenceAlert(null)}
        isQuickMenuOpen={isQuickMenuOpen}
        onCloseQuickMenu={() => setIsQuickMenuOpen(false)}
        onSelectQuickTab={(tab) => setActiveTab(tab)}
      />

      {/* Real Camera Connection Modal */}
      <AddCameraModal
        isOpen={isAddCameraModalOpen}
        onClose={() => setIsAddCameraModalOpen(false)}
        onCameraAdded={(newCam) => {
          if (newCam) {
            setCameras(prev => [newCam, ...prev.filter(c => c.id !== newCam.id)]);
            setSelectedCamera(newCam);
            showToast('Camera Connected', `Camera ${newCam.code} (${newCam.name}) registered & live.`, 'success');
          } else {
            showToast('Camera Connected', 'Real stream registered and saved to database.', 'success');
          }
          pollApi();
        }}
      />

      {/* Dynamic Restricted Zone Configuration Modal */}
      <CustomZoneModal
        isOpen={isCustomZoneModalOpen}
        onClose={() => setIsCustomZoneModalOpen(false)}
        cameras={cameras}
        selectedCamera={selectedCamera}
        onZoneCreated={() => {
          pollApi();
          showToast('Restricted Zone Active', 'Custom zone rule configured and saved to database.', 'success');
        }}
      />
    </div>
  );
};

export default App;

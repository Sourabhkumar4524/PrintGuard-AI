import React from 'react';
import { FlaskConical, Play, RefreshCw, Usb } from 'lucide-react';
import { usePrintGuard } from '../context/PrintGuardContext';
import { MobileMenuTrigger } from './AppSidebar';
import { StatusBadge } from './StatusBadge';

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  onOpenMobileMenu: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title = 'Production Dashboard',
  subtitle = 'Real-time sensor health, camera analysis and physical alert control.',
  onOpenMobileMenu,
}) => {
  const {
    activeSource,
    usbConnected,
    connectUsbSerial,
    webSerialSupported,
    isRefreshing,
    refreshAll,
    demoCheckRunning,
    runDemoCheck,
    settings,
  } = usePrintGuard();

  const espStatusBadge =
    activeSource === 'web-serial' ? (
      <StatusBadge label="ESP32 USB ONLINE" tone="normal" size="sm" />
    ) : activeSource === 'backend' ? (
      <StatusBadge label="ESP32 ONLINE" tone="normal" size="sm" />
    ) : activeSource === 'demo' ? (
      <StatusBadge label="ESP32 DEMO MODE" tone="demo" size="sm" />
    ) : (
      <StatusBadge label="ESP32 OFFLINE" tone="critical" size="sm" />
    );

  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800/90">
      <div className="flex items-start gap-3 min-w-0">
        <MobileMenuTrigger onOpen={onOpenMobileMenu} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-50">
              {title}
            </h1>
            {settings.demoMode && !usbConnected && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300">
                <FlaskConical className="w-3 h-3" aria-hidden="true" />
                <span>SIMULATED DATA</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {espStatusBadge}

        {webSerialSupported && !usbConnected && (
          <button
            type="button"
            onClick={() => void connectUsbSerial()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <Usb className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Connect USB</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-[#0D1526] hover:bg-slate-800 text-slate-200 border border-slate-700/90 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 shrink-0 ${
              isRefreshing ? 'animate-spin text-cyan-400' : 'text-slate-400'
            }`}
            aria-hidden="true"
          />
          <span>Refresh</span>
        </button>

        <button
          type="button"
          onClick={() => void runDemoCheck()}
          disabled={demoCheckRunning}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{demoCheckRunning ? 'Running Demo Check...' : 'Run Demo Check'}</span>
        </button>
      </div>
    </header>
  );
};

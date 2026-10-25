import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  Bell,
  BookOpen,
  Camera,
  Cpu,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { usePrintGuard } from '../context/PrintGuardContext';
import { ConnectionIndicator } from './ConnectionIndicator';

interface AppSidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  mobileOpen,
  onCloseMobile,
}) => {
  const {
    settings,
    updateSettings,
    activeSource,
    usbConnected,
    visionStatus,
    unacknowledgedCount,
    setSetupModalOpen,
  } = usePrintGuard();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/camera', label: 'AI Camera', icon: Camera },
    { to: '/sensors', label: 'Sensors', icon: Activity },
    { to: '/hardware', label: 'Hardware', icon: Cpu },
    {
      to: '/alerts',
      label: 'Alerts',
      icon: Bell,
      count: unacknowledgedCount,
    },
    { to: '/settings', label: 'System Settings', icon: Settings },
  ];

  const espState: 'live' | 'demo' | 'offline' =
    activeSource === 'web-serial' || activeSource === 'backend'
      ? 'live'
      : activeSource === 'demo'
      ? 'demo'
      : 'offline';

  const espDetail =
    activeSource === 'web-serial'
      ? 'USB LIVE'
      : activeSource === 'backend'
      ? 'ONLINE'
      : activeSource === 'demo'
      ? 'DEMO SIM'
      : 'OFFLINE';

  const aiHostState: 'live' | 'demo' | 'offline' | 'standby' =
    visionStatus.online && visionStatus.modelLoaded
      ? 'live'
      : visionStatus.online
      ? 'standby'
      : settings.demoMode
      ? 'demo'
      : 'offline';

  const aiHostDetail =
    visionStatus.online && visionStatus.modelLoaded
      ? 'READY'
      : visionStatus.online
      ? 'NO MODEL'
      : settings.demoMode
      ? 'DEMO ONLY'
      : 'OFFLINE';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#050811] border-r border-slate-800/90 w-60 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-400 shrink-0">
            <ShieldCheck className="w-4.5 h-4.5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight text-slate-100 truncate">
              PrintGuard AI
            </div>
            <div className="text-[10px] font-mono tracking-wider text-cyan-400/90 truncate">
              AI + IoT MONITOR
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden text-slate-400 hover:text-slate-200 p-1 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
                }`
              }
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.count === 'number' && item.count > 0 && (
                <span className="font-mono text-[11px] tabular-nums text-amber-300">
                  {item.count}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Connection & Demo Mode Panel */}
      <div className="p-3.5 border-t border-slate-800/90 space-y-2.5 bg-[#060A15]">
        <div className="space-y-1">
          <ConnectionIndicator
            label="ESP32 Controller"
            state={espState}
            detail={espDetail}
            viaUsb={usbConnected}
          />
          <ConnectionIndicator
            label="AI Vision Host"
            state={aiHostState}
            detail={aiHostDetail}
          />
        </div>

        {/* Clearly Labeled DEMO MODE Indicator & Toggle */}
        {settings.demoMode && !usbConnected ? (
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-amber-300">
                <FlaskConical className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                DEMO MODE ACTIVE
              </span>
              <button
                type="button"
                onClick={() => void updateSettings({ demoMode: false })}
                className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2 whitespace-nowrap shrink-0"
              >
                Go Live
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Showing deterministic sample data (40.0 °C threshold). Connect USB or turn off Demo Mode for live hardware.
            </p>
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              {usbConnected ? 'USB Hardware Stream' : 'Live Backend Mode'}
            </span>
            {!usbConnected && (
              <button
                type="button"
                onClick={() => void updateSettings({ demoMode: true })}
                className="text-[11px] font-medium text-amber-400 hover:text-amber-300 underline underline-offset-2 whitespace-nowrap shrink-0"
              >
                Enable Demo
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setSetupModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-300 transition-colors whitespace-nowrap"
        >
          <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
          <span>Setup & Wiring Guide</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};

export const MobileMenuTrigger: React.FC<{ onOpen: () => void }> = ({
  onOpen,
}) => (
  <button
    type="button"
    onClick={onOpen}
    aria-label="Open navigation menu"
    className="lg:hidden inline-flex items-center justify-center p-2 rounded-md bg-[#0D1526] border border-slate-800 text-slate-200 hover:bg-slate-800 shrink-0"
  >
    <Menu className="w-4 h-4" />
  </button>
);

import React from 'react';
import {
  ExternalLink,
  Gauge,
  Plug,
  PowerOff,
  RefreshCw,
  Server,
  Terminal,
  Trash2,
  Usb,
  Volume2,
} from 'lucide-react';
import { DashboardHeader } from '../components/DashboardHeader';
import { HardwareStatusCard } from '../components/HardwareStatusCard';
import { StatusBadge } from '../components/StatusBadge';
import { usePrintGuard } from '../context/PrintGuardContext';
import { ESP32_PINOUT_MAPPING } from '../utils/esp32SerialParser';

interface HardwarePageProps {
  onOpenMobileMenu: () => void;
}

export const HardwarePage: React.FC<HardwarePageProps> = ({
  onOpenMobileMenu,
}) => {
  const {
    hardwareComponents,
    latestTelemetry,
    settings,
    webSerialSupported,
    isEmbeddedIframe,
    usbConnected,
    usbPortLabel,
    serialLogs,
    clearSerialLogs,
    connectUsbSerial,
    disconnectUsbSerial,
    backendConnected,
    backendSerialPorts,
    backendSerialConnected,
    selectedBackendPort,
    setSelectedBackendPort,
    fetchBackendSerialPorts,
    connectBackendSerialPort,
    disconnectBackendSerialPort,
    activeSource,
  } = usePrintGuard();

  const servoAngle = latestTelemetry?.servoAngleDeg ?? 0;
  const isDemo = activeSource === 'demo';
  const isOffline = activeSource === 'offline';

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Hardware & ESP32 Serial Control"
        subtitle="Direct Browser Web Serial USB streaming (115200 baud), backend serial port control, and peripheral verification."
        onOpenMobileMenu={onOpenMobileMenu}
      />

      {/* Connection Panels: Browser Web Serial USB + External Backend Serial */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Direct Browser Web Serial USB */}
        <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Usb className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Browser Web Serial USB (Direct ESP32)
                </h3>
              </div>
              {usbConnected ? (
                <StatusBadge label="CONNECTED" tone="normal" />
              ) : webSerialSupported ? (
                <StatusBadge label="READY" tone="info" />
              ) : (
                <StatusBadge label="UNSUPPORTED" tone="neutral" />
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Reads your Arduino sketch&apos;s <span className="font-mono text-slate-200">------ LIVE STATUS ------</span> output directly over USB at{' '}
              <span className="font-mono text-slate-200">{settings.esp32BaudRate} baud</span> (Temperature, Simulated Vibration, Alert state, Servo angle, and Wi-Fi IP).
            </p>

            {isEmbeddedIframe && !usbConnected && (
              <div className="mt-2.5 flex items-center justify-between gap-2 rounded-md bg-slate-900/90 border border-slate-800 px-3 py-2 text-[11px] text-slate-300">
                <span>
                  If your browser blocks USB selection inside an embedded preview, open the app in a full tab.
                </span>
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium whitespace-nowrap shrink-0"
                >
                  <span>Full Tab</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono text-slate-400 truncate">
              {usbConnected
                ? usbPortLabel
                : webSerialSupported
                ? 'Close Arduino Serial Monitor before connecting'
                : 'Requires Chrome or Edge desktop browser'}
            </span>

            {!usbConnected ? (
              <button
                type="button"
                onClick={() => void connectUsbSerial()}
                disabled={!webSerialSupported}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-45 whitespace-nowrap shrink-0"
              >
                <Plug className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Connect ESP32 USB</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void disconnectUsbSerial()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border border-rose-500/40 transition-colors whitespace-nowrap shrink-0"
              >
                <PowerOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Disconnect USB</span>
              </button>
            )}
          </div>
        </section>

        {/* Backend Serial Port Management (/api/serial/*) */}
        <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-100">
                  External Backend Serial Bridge
                </h3>
              </div>
              {backendSerialConnected ? (
                <StatusBadge label="CONNECTED" tone="normal" />
              ) : backendConnected ? (
                <StatusBadge label="STANDBY" tone="info" />
              ) : (
                <StatusBadge label="BACKEND OFFLINE" tone="neutral" />
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Manage COM / ttyUSB ports via your external server&apos;s{' '}
              <span className="font-mono text-slate-300">/api/serial/ports</span> and{' '}
              <span className="font-mono text-slate-300">/api/serial/connect</span> endpoints.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={selectedBackendPort}
                onChange={(e) => setSelectedBackendPort(e.target.value)}
                aria-label="Select backend serial port"
                className="flex-1 min-w-[180px] px-3 py-1.5 text-xs font-mono rounded-md bg-slate-900 border border-slate-700 text-slate-200"
              >
                {backendSerialPorts.length === 0 ? (
                  <option value="">No backend ports queried</option>
                ) : (
                  backendSerialPorts.map((p) => (
                    <option key={p.path} value={p.path}>
                      {p.path} {p.description ? `(${p.description})` : ''}
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                onClick={() => void fetchBackendSerialPorts()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Scan Ports</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-slate-500 truncate">
              Host: {settings.apiBaseUrl || 'Built-in Server (:3000)'}
            </span>
            {!backendSerialConnected ? (
              <button
                type="button"
                onClick={() => void connectBackendSerialPort()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Connect Port</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void disconnectBackendSerialPort()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-rose-950/50 hover:bg-rose-900/60 text-rose-200 border border-rose-500/40 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Disconnect Port</span>
              </button>
            )}
          </div>
        </section>
      </div>

      {/* 6 Hardware Status Cards */}
      <section aria-label="Hardware component cards">
        <h3 className="text-xs font-semibold tracking-wide text-slate-300 uppercase mb-2.5">
          Component Verification Matrix
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {hardwareComponents.map((comp) => (
            <HardwareStatusCard key={comp.id} component={comp} />
          ))}
        </div>
      </section>

      {/* Actuator Sweep Visualizer & Raw USB Serial Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* SG90 Actuator & Physical Alarm Readout */}
        <section className="lg:col-span-5 rounded-lg bg-[#0D1526] border border-slate-800/90 p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-100">
                SG90 Servo &amp; Physical Outputs
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {latestTelemetry?.servoVerified && !isDemo
                ? 'VERIFIED'
                : isDemo
                ? 'DEMO SIM'
                : 'UNVERIFIED'}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-slate-400">Sweep Angle (GPIO 18):</span>
              <span className="text-cyan-300 font-bold">
                {isOffline ? '--' : `${servoAngle}° / 180°`}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-opacity"
                style={{
                  width: `${
                    isOffline ? 0 : Math.min(100, Math.max(0, (servoAngle / 180) * 100))
                  }%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0°</span>
              <span>90°</span>
              <span>180°</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
              <span>Digital Pin States (Thermal Alarm Logic)</span>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-center">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">GREEN_LED (26)</div>
                <div
                  className={
                    isOffline
                      ? 'text-slate-500'
                      : latestTelemetry?.alertActive
                      ? 'text-slate-500'
                      : 'text-emerald-400 font-bold'
                  }
                >
                  {isOffline
                    ? 'UNKNOWN'
                    : latestTelemetry?.alertActive
                    ? 'LOW'
                    : 'HIGH'}
                </div>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">RED_LED (27)</div>
                <div
                  className={
                    latestTelemetry?.alertActive
                      ? 'text-rose-400 font-bold'
                      : 'text-slate-500'
                  }
                >
                  {isOffline
                    ? 'UNKNOWN'
                    : latestTelemetry?.alertActive
                    ? 'HIGH'
                    : 'LOW'}
                </div>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">BUZZER (25)</div>
                <div
                  className={
                    latestTelemetry?.alertActive
                      ? 'text-rose-400 font-bold'
                      : 'text-slate-500'
                  }
                >
                  {isOffline
                    ? 'UNKNOWN'
                    : latestTelemetry?.alertActive
                    ? 'HIGH'
                    : 'LOW'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Live USB Serial Monitor Console */}
        <section className="lg:col-span-7 rounded-lg bg-[#0D1526] border border-slate-800/90 p-4 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <Terminal
                className="w-4 h-4 text-emerald-400"
                aria-hidden="true"
              />
              <h3 className="text-sm font-semibold text-slate-100">
                USB Serial Monitor (115200 baud)
              </h3>
            </div>
            {serialLogs.length > 0 && (
              <button
                type="button"
                onClick={clearSerialLogs}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
              >
                <Trash2 className="w-3 h-3" aria-hidden="true" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="flex-1 min-h-[165px] max-h-[220px] overflow-y-auto rounded-md bg-[#050811] border border-slate-800 p-3 font-mono text-[11px] text-slate-300 space-y-0.5">
            {serialLogs.length === 0 ? (
              <p className="text-slate-500">
                {usbConnected
                  ? 'Connected — awaiting serial lines from ESP32...'
                  : 'No live USB serial output yet. Click "Connect ESP32 USB" above to stream Serial.println() lines from your ESP32.'}
              </p>
            ) : (
              serialLogs.map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ESP32 Pinout Mapping Reference */}
      <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          ESP32 Firmware Pinout &amp; Timing Specification
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400">
                <th className="py-2 pr-4">Hardware Module</th>
                <th className="py-2 px-4">ESP32 GPIO</th>
                <th className="py-2 px-4">Protocol / Timing</th>
                <th className="py-2 pl-4">Operational Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {ESP32_PINOUT_MAPPING.map((item) => (
                <tr key={item.component} className="hover:bg-slate-800/30">
                  <td className="py-2.5 pr-4 font-medium text-slate-200">
                    {item.component}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-cyan-300 whitespace-nowrap">
                    {item.gpio}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                    {item.protocol}
                  </td>
                  <td className="py-2.5 pl-4 text-slate-300">{item.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

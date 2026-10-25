import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Layers,
  PowerOff,
} from 'lucide-react';
import { usePrintGuard } from '../context/PrintGuardContext';

export const SystemStatusBanner: React.FC = () => {
  const {
    activeSource,
    latestTelemetry,
    latestVision,
    settings,
    connectUsbSerial,
    webSerialSupported,
    updateSettings,
  } = usePrintGuard();

  const isOffline = activeSource === 'offline' || !latestTelemetry;
  const isDemo = activeSource === 'demo';

  // Evaluate active causes
  const causes: { label: string; critical: boolean }[] = [];

  if (latestTelemetry) {
    if (!latestTelemetry.temperatureValid || latestTelemetry.temperatureC === null) {
      causes.push({
        label: 'DS18B20 temperature sensor disconnected / invalid reading (GPIO 4)',
        critical: true,
      });
    } else if (latestTelemetry.temperatureC >= settings.tempWarningC) {
      causes.push({
        label: `${isDemo ? '[DEMO] ' : ''}DS18B20 temperature (${latestTelemetry.temperatureC.toFixed(
          1
        )} °C) exceeded ${settings.tempWarningC.toFixed(1)} °C threshold`,
        critical: true,
      });
    }

    if (
      latestTelemetry.vibrationMs2 !== null &&
      latestTelemetry.vibrationMs2 >= settings.vibrationWarningMs2
    ) {
      causes.push({
        label: `${
          isDemo || latestTelemetry.vibrationSimulated ? '[SIMULATED] ' : ''
        }Vibration (${latestTelemetry.vibrationMs2.toFixed(
          2
        )} m/s²) exceeded ${settings.vibrationWarningMs2.toFixed(2)} m/s² limit`,
        critical: false,
      });
    }
  }

  if (
    latestVision &&
    latestVision.isDefect &&
    (latestVision.confidence === null ||
      latestVision.confidence >= settings.aiConfidenceThreshold)
  ) {
    causes.push({
      label: `${
        latestVision.isSimulated ? '[DEMO SIMULATION] ' : '[AI VISION] '
      }Detected ${latestVision.detectedClass} (${
        latestVision.confidence !== null
          ? `${latestVision.confidence.toFixed(1)}%`
          : 'flagged'
      })`,
      critical: !latestVision.isSimulated,
    });
  }

  // Disconnected / Unavailable state (never show NORMAL when disconnected)
  if (isOffline) {
    return (
      <section
        aria-label="System operational status"
        className="rounded-lg bg-[#0D1526] border border-slate-700/90 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
            <PowerOff className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400 mb-0.5">
              <span className="font-semibold text-rose-400">TELEMETRY UNAVAILABLE</span>
              <span aria-hidden="true">·</span>
              <span>No active ESP32 Serial or Backend stream</span>
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-100">
              Awaiting live ESP32 hardware telemetry
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Connect your ESP32 over USB Serial (115200 baud), stream over Wi-Fi to{' '}
              <span className="font-mono text-slate-300">
                {settings.apiBaseUrl || ''}/api/telemetry
              </span>
              , or enable Demo Mode to inspect sample workflows.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {webSerialSupported && (
            <button
              type="button"
              onClick={() => void connectUsbSerial()}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-cyan-600 hover:bg-cyan-500 text-white transition-colors whitespace-nowrap shrink-0"
            >
              Connect ESP32 USB
            </button>
          )}
          <button
            type="button"
            onClick={() => void updateSettings({ demoMode: true })}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition-colors whitespace-nowrap shrink-0"
          >
            Enable Demo Mode
          </button>
        </div>
      </section>
    );
  }

  // Warning / Critical State
  if (causes.length > 0) {
    const hasCritical = causes.some((c) => c.critical);
    const borderTone = hasCritical
      ? 'border-rose-500/40 bg-rose-950/20'
      : 'border-amber-500/40 bg-amber-950/20';
    const iconTone = hasCritical
      ? 'bg-rose-500/15 border-rose-500/35 text-rose-400'
      : 'bg-amber-500/15 border-amber-500/35 text-amber-400';

    return (
      <section
        aria-label="System operational status"
        className={`rounded-lg border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${borderTone}`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${iconTone}`}
          >
            {hasCritical ? (
              <AlertOctagon className="w-5 h-5" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono mb-0.5">
              <span
                className={`font-semibold ${
                  hasCritical ? 'text-rose-400' : 'text-amber-300'
                }`}
              >
                {hasCritical ? 'CRITICAL ALERT' : 'WARNING'}
              </span>
              {isDemo && (
                <>
                  <span className="text-slate-500" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-amber-300 inline-flex items-center gap-1">
                    <FlaskConical className="w-3 h-3" aria-hidden="true" />
                    DEMO SCENARIO
                  </span>
                </>
              )}
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-100">
              {causes[0].label}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              {causes.length > 1
                ? `Additional active condition: ${causes
                    .slice(1)
                    .map((c) => c.label)
                    .join(' · ')}`
                : latestTelemetry.alertActive
                ? 'ESP32 physical outputs: Red LED HIGH and Buzzer HIGH (GPIO 27 / GPIO 25).'
                : 'Review sensor trend and AI Camera inspection feed before resuming unattended operation.'}
            </p>
          </div>
        </div>

        {isDemo && typeof latestTelemetry.layerCount === 'number' && (
          <div className="flex items-center gap-2 font-mono text-xs text-slate-300 shrink-0 md:pl-4 md:border-l md:border-slate-800">
            <Layers className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>
              Simulated Layer:{' '}
              <strong className="text-slate-100 tabular-nums">
                #{latestTelemetry.layerCount}
              </strong>{' '}
              / 240
            </span>
          </div>
        )}
      </section>
    );
  }

  // Normal Operating State
  return (
    <section
      aria-label="System operational status"
      className="rounded-lg bg-[#0B1723] border border-emerald-500/30 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
    >
      <div className="flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
          <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono mb-0.5">
            <span className="font-semibold text-emerald-400">NORMAL</span>
            <span className="text-slate-500" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-400">
              {isDemo
                ? 'DEMO MODE SAMPLE STREAM'
                : activeSource === 'web-serial'
                ? 'LIVE USB SERIAL STREAM'
                : 'LIVE BACKEND TELEMETRY'}
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-semibold text-slate-50">
            Printer prototype operating normally
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            DS18B20 temperature below {settings.tempWarningC.toFixed(1)} °C threshold,{' '}
            {latestTelemetry.vibrationSimulated
              ? 'firmware-simulated vibration nominal'
              : 'MPU6050 vibration within range'}
            , Green LED active (GPIO 26), and camera inspection standby.
          </p>
        </div>
      </div>

      {isDemo && typeof latestTelemetry.layerCount === 'number' && (
        <div className="flex items-center gap-2 font-mono text-xs text-slate-300 shrink-0 md:pl-4 md:border-l md:border-slate-800">
          <Layers className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
          <span>
            Simulated Layer:{' '}
            <strong className="text-slate-100 tabular-nums">
              #{latestTelemetry.layerCount}
            </strong>{' '}
            / 240
          </span>
        </div>
      )}
    </section>
  );
};

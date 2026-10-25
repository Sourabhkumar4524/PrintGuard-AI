import React, { useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  FlaskConical,
  Sliders,
  Thermometer,
  XCircle,
} from 'lucide-react';
import { DashboardHeader } from '../components/DashboardHeader';
import { SensorTrendChart } from '../components/SensorTrendChart';
import { StatusBadge } from '../components/StatusBadge';
import { usePrintGuard } from '../context/PrintGuardContext';

interface SensorsPageProps {
  onOpenMobileMenu: () => void;
}

export const SensorsPage: React.FC<SensorsPageProps> = ({
  onOpenMobileMenu,
}) => {
  const {
    activeSource,
    latestTelemetry,
    telemetryHistory,
    settings,
    updateSettings,
  } = usePrintGuard();

  const isDemo = activeSource === 'demo';
  const isOffline = activeSource === 'offline';

  const statsSummary = useMemo(() => {
    const validTemps = telemetryHistory
      .filter((p) => p.temperatureValid && p.temperatureC !== null)
      .map((p) => p.temperatureC as number);
    const validVibs = telemetryHistory
      .filter((p) => p.vibrationMs2 !== null)
      .map((p) => p.vibrationMs2 as number);

    const calc = (arr: number[]) => {
      if (arr.length === 0) return { min: null, max: null, avg: null };
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      return { min, max, avg };
    };

    return {
      temp: calc(validTemps),
      vib: calc(validVibs),
      sampleCount: telemetryHistory.length,
    };
  }, [telemetryHistory]);

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Sensors & Telemetry"
        subtitle="Live DS18B20 thermal probe and vibration metrics, historical curves, and threshold calibration."
        onOpenMobileMenu={onOpenMobileMenu}
      />

      {/* Sensor Health & Statistical Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DS18B20 Detailed Card */}
        <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Thermometer
                className="w-4 h-4 text-cyan-400"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  DS18B20 Digital Temperature Probe
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  GPIO 4 (1-Wire Bus · 10-bit async · 1000 ms interval)
                </p>
              </div>
            </div>
            {isOffline ? (
              <StatusBadge label="DISCONNECTED" tone="neutral" />
            ) : !latestTelemetry?.temperatureValid ? (
              <StatusBadge label="SENSOR ERROR" tone="critical" />
            ) : isDemo ? (
              <StatusBadge label="DEMO STREAM" tone="demo" />
            ) : (
              <StatusBadge label="HEALTHY" tone="normal" />
            )}
          </div>

          <div className="grid grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 font-mono tabular-nums">
            <div>
              <span className="text-[10px] text-slate-500 block">CURRENT</span>
              <span className="text-lg font-bold text-slate-50">
                {latestTelemetry?.temperatureValid &&
                latestTelemetry.temperatureC !== null
                  ? `${latestTelemetry.temperatureC.toFixed(2)} °C`
                  : '--'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">MIN</span>
              <span className="text-sm font-semibold text-slate-200">
                {statsSummary.temp.min !== null
                  ? `${statsSummary.temp.min.toFixed(1)} °C`
                  : '--'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">AVG</span>
              <span className="text-sm font-semibold text-slate-200">
                {statsSummary.temp.avg !== null
                  ? `${statsSummary.temp.avg.toFixed(1)} °C`
                  : '--'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">MAX</span>
              <span className="text-sm font-semibold text-slate-200">
                {statsSummary.temp.max !== null
                  ? `${statsSummary.temp.max.toFixed(1)} °C`
                  : '--'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>
              Hardware Alarm Output:{' '}
              <strong className="font-mono text-slate-200">
                &ge; {settings.tempWarningC.toFixed(1)} °C
              </strong>
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px]">
              {latestTelemetry?.alertActive ? (
                <>
                  <XCircle className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
                  <span className="text-rose-400">RED LED + BUZZER ON</span>
                </>
              ) : (
                <>
                  <CheckCircle2
                    className="w-3.5 h-3.5 text-emerald-400"
                    aria-hidden="true"
                  />
                  <span className="text-emerald-400">GREEN LED ON</span>
                </>
              )}
            </span>
          </div>
        </section>

        {/* Vibration Detailed Card */}
        <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity
                className="w-4 h-4 text-purple-400"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Vibration / Motion Channel (MPU6050)
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  500 ms interval ·{' '}
                  {latestTelemetry?.vibrationSimulated ?? true
                    ? 'ESP32 getRandomVibration() simulation'
                    : 'Verified accelerometer feed'}
                </p>
              </div>
            </div>
            {isOffline ? (
              <StatusBadge label="DISCONNECTED" tone="neutral" />
            ) : latestTelemetry?.vibrationSimulated || isDemo ? (
              <StatusBadge label="SIMULATED" tone="demo" />
            ) : (
              <StatusBadge label="VERIFIED" tone="normal" />
            )}
          </div>

          <div className="grid grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 font-mono tabular-nums">
            <div>
              <span className="text-[10px] text-slate-500 block">CURRENT</span>
              <span className="text-lg font-bold text-slate-50">
                {latestTelemetry?.vibrationMs2 !== null &&
                latestTelemetry?.vibrationMs2 !== undefined
                  ? `${latestTelemetry.vibrationMs2.toFixed(2)} m/s²`
                  : '--'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">MIN</span>
              <span className="text-sm font-semibold text-slate-200">
                {statsSummary.vib.min !== null
                  ? `${statsSummary.vib.min.toFixed(2)}`
                  : '--'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">AVG</span>
              <span className="text-sm font-semibold text-slate-200">
                {statsSummary.vib.avg !== null
                  ? `${statsSummary.vib.avg.toFixed(2)}`
                  : '--'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">MAX</span>
              <span className="text-sm font-semibold text-slate-200">
                {statsSummary.vib.max !== null
                  ? `${statsSummary.vib.max.toFixed(2)}`
                  : '--'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <FlaskConical
                className="w-3.5 h-3.5 text-amber-300 shrink-0"
                aria-hidden="true"
              />
              <span>
                Per firmware sketch, vibration never triggers the physical buzzer.
              </span>
            </span>
            <span className="font-mono tabular-nums text-slate-300 shrink-0">
              Samples: {statsSummary.sampleCount}
            </span>
          </div>
        </section>
      </div>

      {/* Main Historical Dual-Axis Chart */}
      <SensorTrendChart
        history={telemetryHistory}
        tempWarningC={settings.tempWarningC}
        vibrationWarningMs2={settings.vibrationWarningMs2}
        activeSource={activeSource}
        onEnableDemo={
          !settings.demoMode
            ? () => void updateSettings({ demoMode: true })
            : undefined
        }
        height={340}
      />

      {/* Quick Threshold Calibration Controls */}
      <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sliders className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-slate-100">
            Live Threshold Calibration
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label
                htmlFor="sensor-temp-slider"
                className="font-medium text-slate-300"
              >
                Temperature Warning Threshold (DS18B20)
              </label>
              <span className="font-mono font-semibold text-cyan-300 tabular-nums">
                {settings.tempWarningC.toFixed(1)} °C
              </span>
            </div>
            <input
              id="sensor-temp-slider"
              type="range"
              min={25}
              max={110}
              step={0.5}
              value={settings.tempWarningC}
              onChange={(e) =>
                void updateSettings({
                  tempWarningC: parseFloat(e.target.value),
                })
              }
              className="w-full accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>25.0 °C</span>
              <span>ESP32 Sketch Default: 40.0 °C</span>
              <span>110.0 °C</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label
                htmlFor="sensor-vib-slider"
                className="font-medium text-slate-300"
              >
                Vibration UI Warning Threshold
              </label>
              <span className="font-mono font-semibold text-purple-300 tabular-nums">
                {settings.vibrationWarningMs2.toFixed(2)} m/s²
              </span>
            </div>
            <input
              id="sensor-vib-slider"
              type="range"
              min={0.3}
              max={3.0}
              step={0.05}
              value={settings.vibrationWarningMs2}
              onChange={(e) =>
                void updateSettings({
                  vibrationWarningMs2: parseFloat(e.target.value),
                })
              }
              className="w-full accent-purple-400"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>0.30 m/s²</span>
              <span>Default: 1.00 m/s²</span>
              <span>3.00 m/s²</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

import React from 'react';
import {
  Activity,
  ArrowRight,
  BellRing,
  Camera,
  FlaskConical,
  Thermometer,
  Volume2,
} from 'lucide-react';
import { usePrintGuard } from '../context/PrintGuardContext';

export const AlertDecisionFlow: React.FC = () => {
  const { settings, latestTelemetry, latestVision } = usePrintGuard();

  const tempTriggered =
    Boolean(latestTelemetry?.temperatureValid) &&
    latestTelemetry?.temperatureC !== null &&
    (latestTelemetry?.temperatureC ?? 0) >= settings.tempWarningC;

  const vibTriggered =
    latestTelemetry?.vibrationMs2 !== null &&
    (latestTelemetry?.vibrationMs2 ?? 0) >= settings.vibrationWarningMs2;

  const visionTriggered =
    Boolean(latestVision?.isDefect) &&
    (latestVision?.confidence === null ||
      (latestVision?.confidence ?? 0) >= settings.aiConfidenceThreshold);

  const anyTriggered = tempTriggered || vibTriggered || visionTriggered;

  return (
    <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Alert Decision Logic
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Active threshold routing separating sensor anomalies, CV defect inference, and demo checks.
          </p>
        </div>
        <span className="text-[11px] font-mono text-slate-400 tabular-nums">
          Cooldown: {settings.alertCooldownSec}s
        </span>
      </div>

      {/* Connected Node Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_auto_0.85fr_auto_1fr] items-center gap-2.5 py-1">
        {/* Stage 1: Input Conditions */}
        <div className="space-y-2">
          <div
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-xs ${
              tempTriggered
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                : 'bg-slate-900/80 border-slate-800 text-slate-300'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Thermometer
                className={`w-3.5 h-3.5 shrink-0 ${
                  tempTriggered ? 'text-rose-400' : 'text-cyan-400'
                }`}
                aria-hidden="true"
              />
              <span className="truncate">DS18B20 Thermal Threshold</span>
            </span>
            <span className="font-mono text-[11px] tabular-nums shrink-0">
              &ge; {settings.tempWarningC.toFixed(1)} °C
            </span>
          </div>

          <div
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-xs ${
              vibTriggered
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                : 'bg-slate-900/80 border-slate-800 text-slate-300'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Activity
                className={`w-3.5 h-3.5 shrink-0 ${
                  vibTriggered ? 'text-amber-400' : 'text-purple-400'
                }`}
                aria-hidden="true"
              />
              <span className="truncate">Vibration Anomaly Limit</span>
            </span>
            <span className="font-mono text-[11px] tabular-nums shrink-0">
              &ge; {settings.vibrationWarningMs2.toFixed(2)} m/s²
            </span>
          </div>

          <div
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-xs ${
              visionTriggered
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                : 'bg-slate-900/80 border-slate-800 text-slate-300'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Camera
                className={`w-3.5 h-3.5 shrink-0 ${
                  visionTriggered ? 'text-rose-400' : 'text-emerald-400'
                }`}
                aria-hidden="true"
              />
              <span className="truncate">Visual Print Defect (CV)</span>
            </span>
            <span className="font-mono text-[11px] tabular-nums shrink-0">
              &ge; {settings.aiConfidenceThreshold}% conf
            </span>
          </div>
        </div>

        {/* Arrow 1 */}
        <div className="hidden lg:flex flex-col items-center justify-center text-slate-500 px-1">
          <span className="text-[10px] font-mono mb-0.5">OR</span>
          <ArrowRight className="w-4 h-4 text-cyan-400" aria-hidden="true" />
        </div>

        {/* Stage 2: Alert Gate */}
        <div
          className={`rounded-md border p-3 text-center ${
            anyTriggered
              ? 'bg-amber-950/25 border-amber-500/45'
              : 'bg-slate-900/80 border-slate-800'
          }`}
        >
          <BellRing
            className={`w-4 h-4 mx-auto mb-1 ${
              anyTriggered ? 'text-amber-400' : 'text-slate-400'
            }`}
            aria-hidden="true"
          />
          <div className="text-xs font-semibold text-slate-100">
            Alert Evaluator
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Classifies source provenance &amp; applies cooldown
          </div>
        </div>

        {/* Arrow 2 */}
        <div className="hidden lg:flex items-center justify-center text-slate-500 px-1">
          <ArrowRight className="w-4 h-4 text-cyan-400" aria-hidden="true" />
        </div>

        {/* Stage 3: Actions */}
        <div className="rounded-md bg-slate-900/80 border border-slate-800 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
            <span>Alert &amp; Physical Output</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Logs event in timeline; ESP32 drives{' '}
            <span className="font-mono text-slate-300">RED_LED (27)</span> &amp;{' '}
            <span className="font-mono text-slate-300">BUZZER (25)</span> HIGH strictly on thermal breach.
          </p>
        </div>
      </div>

      {/* Provenance Distinction Legend */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-amber-300 font-medium">Sensor Warning</span>
          <span aria-hidden="true">·</span>
          <span className="text-rose-400 font-medium">
            Computer-Vision Defect
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 text-slate-300">
            <FlaskConical className="w-3 h-3 text-amber-300" aria-hidden="true" />
            Simulated Demo Event
          </span>
        </div>
        <span className="text-slate-500">
          Note: Sensor threshold crossings indicate environmental risk and do not independently confirm a visual print defect.
        </span>
      </div>
    </section>
  );
};

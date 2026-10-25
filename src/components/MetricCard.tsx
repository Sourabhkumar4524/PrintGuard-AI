import React from 'react';
import { LucideIcon, FlaskConical } from 'lucide-react';

interface ThresholdMetricCardProps {
  variant: 'threshold';
  title: string;
  sensorName: string;
  value: number | null;
  unit: string;
  threshold: number;
  maxScale: number;
  icon: LucideIcon;
  isSimulated?: boolean;
  simulatedLabel?: string;
  unavailableText?: string;
}

interface GaugeMetricCardProps {
  variant: 'gauge';
  title: string;
  confidence: number | null;
  detectedClass: string;
  icon: LucideIcon;
  isSimulated?: boolean;
  isDefect?: boolean;
}

interface ActuatorMetricCardProps {
  variant: 'actuator';
  title: string;
  stateLabel: 'RUNNING' | 'STANDBY' | 'DISCONNECTED';
  latestAction: string;
  alertCount: number;
  servoAngle: number | null;
  isVerified: boolean;
  isDemo: boolean;
  icon: LucideIcon;
}

export type MetricCardProps =
  | ThresholdMetricCardProps
  | GaugeMetricCardProps
  | ActuatorMetricCardProps;

export const MetricCard: React.FC<MetricCardProps> = (props) => {
  if (props.variant === 'threshold') {
    const {
      title,
      sensorName,
      value,
      unit,
      threshold,
      maxScale,
      icon: Icon,
      isSimulated,
      simulatedLabel = 'SIM',
      unavailableText = 'Unavailable',
    } = props;

    const isExceeded = value !== null && value >= threshold;
    const fillPct =
      value !== null
        ? Math.min(100, Math.max(2, (value / maxScale) * 100))
        : 0;
    const markerPct = Math.min(98, Math.max(4, (threshold / maxScale) * 100));

    return (
      <div className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-3.5 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-medium text-slate-400 truncate">
              {title}
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-[11px] font-mono text-slate-500 truncate">
              {sensorName}
            </span>
          </div>
          <Icon
            className={`w-4 h-4 shrink-0 ${
              value === null
                ? 'text-slate-500'
                : isExceeded
                ? 'text-rose-400'
                : 'text-cyan-400'
            }`}
            aria-hidden="true"
          />
        </div>

        <div className="my-1">
          {value !== null ? (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span
                className={`text-2xl font-mono font-bold tabular-nums tracking-tight ${
                  isExceeded ? 'text-rose-400' : 'text-slate-50'
                }`}
              >
                {value.toFixed(unit === '°C' ? 1 : 2)}
              </span>
              <span className="text-xs font-mono text-slate-400">{unit}</span>
              {isSimulated && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-amber-300 ml-auto">
                  <FlaskConical className="w-3 h-3" aria-hidden="true" />
                  {simulatedLabel}
                </span>
              )}
            </div>
          ) : (
            <div className="text-sm font-mono font-medium text-slate-500 py-1">
              {unavailableText}
            </div>
          )}
        </div>

        {/* Horizontal Threshold Bar */}
        <div className="pt-2 space-y-1">
          <div className="relative h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-opacity duration-150 ${
                isExceeded ? 'bg-rose-500' : 'bg-cyan-400'
              }`}
              style={{ width: `${fillPct}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
              style={{ left: `${markerPct}%` }}
              title={`Threshold: ${threshold} ${unit}`}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
            <span>
              Warn: {threshold.toFixed(unit === '°C' ? 1 : 2)} {unit}
            </span>
            <span
              className={
                value === null
                  ? 'text-slate-500'
                  : isExceeded
                  ? 'text-rose-400'
                  : 'text-emerald-400'
              }
            >
              {value === null ? 'NO DATA' : isExceeded ? 'EXCEEDED' : 'OK'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (props.variant === 'gauge') {
    const {
      title,
      confidence,
      detectedClass,
      icon: Icon,
      isSimulated,
      isDefect,
    } = props;

    // Semicircular SVG arc math (radius 34, circumference of half-circle = pi * 34 ≈ 106.8)
    const radius = 34;
    const arcLen = Math.PI * radius;
    const pct = confidence !== null ? Math.min(100, Math.max(0, confidence)) : 0;
    const dashOffset = arcLen - (pct / 100) * arcLen;

    const strokeColor =
      confidence === null
        ? '#334155'
        : isDefect
        ? '#F43F5E'
        : '#10B981';

    return (
      <div className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-3.5 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-medium text-slate-400 truncate">
            {title}
          </span>
          <Icon className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
        </div>

        <div className="flex items-center justify-between gap-2 my-0.5">
          <div>
            <div className="text-xl font-mono font-bold tabular-nums text-slate-50">
              {confidence !== null ? `${confidence.toFixed(1)}%` : '--'}
            </div>
            <div className="text-[11px] text-slate-400 truncate max-w-[110px]">
              {detectedClass}
            </div>
          </div>

          {/* Compact Semicircular Gauge */}
          <svg
            width="82"
            height="46"
            viewBox="0 0 82 46"
            className="shrink-0 overflow-visible"
            aria-label={
              confidence !== null
                ? `AI confidence ${confidence.toFixed(1)} percent`
                : 'No AI inference confidence available'
            }
          >
            <path
              d="M 7 41 A 34 34 0 0 1 75 41"
              fill="none"
              stroke="#1E293B"
              strokeWidth="7"
              strokeLinecap="round"
            />
            {confidence !== null && (
              <path
                d="M 7 41 A 34 34 0 0 1 75 41"
                fill="none"
                stroke={strokeColor}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={arcLen}
                strokeDashoffset={dashOffset}
              />
            )}
          </svg>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>{confidence !== null ? 'Model Score' : 'Model Offline'}</span>
          {isSimulated ? (
            <span className="text-amber-300 inline-flex items-center gap-1">
              <FlaskConical className="w-3 h-3" aria-hidden="true" />
              SIMULATED
            </span>
          ) : (
            <span className="text-slate-500">
              {confidence !== null ? 'VERIFIED' : 'UNAVAILABLE'}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Actuator Card
  const {
    title,
    stateLabel,
    latestAction,
    alertCount,
    servoAngle,
    isVerified,
    isDemo,
    icon: Icon,
  } = props;

  return (
    <div className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-3.5 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-slate-400 truncate">
            {title}
          </span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="text-[11px] font-mono text-slate-500 truncate">
            SG90
          </span>
        </div>
        <Icon
          className={`w-4 h-4 shrink-0 ${
            stateLabel === 'RUNNING'
              ? 'text-emerald-400'
              : stateLabel === 'STANDBY'
              ? 'text-amber-300'
              : 'text-slate-500'
          }`}
          aria-hidden="true"
        />
      </div>

      <div className="my-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`text-lg font-mono font-bold tracking-tight ${
              stateLabel === 'RUNNING'
                ? 'text-emerald-400'
                : stateLabel === 'STANDBY'
                ? 'text-slate-200'
                : 'text-slate-500'
            }`}
          >
            {stateLabel}
          </span>
          {servoAngle !== null && (
            <span className="text-xs font-mono tabular-nums text-cyan-300">
              {servoAngle}°
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
          {latestAction}
        </p>
      </div>

      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono tabular-nums">
        <span className="text-slate-400">
          Alerts: <strong className="text-slate-200">{alertCount}</strong>
        </span>
        <span
          className={
            isVerified
              ? 'text-emerald-400'
              : isDemo
              ? 'text-amber-300'
              : 'text-slate-500'
          }
        >
          {isVerified ? 'VERIFIED' : isDemo ? 'DEMO SIM' : 'UNVERIFIED'}
        </span>
      </div>
    </div>
  );
};

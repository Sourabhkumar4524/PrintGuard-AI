import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, FlaskConical } from 'lucide-react';
import {
  DataSource,
  TelemetryPoint,
  TimeRangeOption,
} from '../types/printguard';
import { EmptyState } from './EmptyState';

interface SensorTrendChartProps {
  history: TelemetryPoint[];
  tempWarningC: number;
  vibrationWarningMs2: number;
  activeSource: DataSource;
  onEnableDemo?: () => void;
  height?: number;
}

export const SensorTrendChart: React.FC<SensorTrendChartProps> = ({
  history,
  tempWarningC,
  vibrationWarningMs2,
  activeSource,
  onEnableDemo,
  height = 270,
}) => {
  const [range, setRange] = useState<TimeRangeOption>('5m');

  const filteredData = useMemo(() => {
    if (history.length === 0) return [];
    const latestEpoch = history[history.length - 1].epochMs;
    const windowMs =
      range === '1m'
        ? 60_000
        : range === '5m'
        ? 5 * 60_000
        : range === '15m'
        ? 15 * 60_000
        : Infinity;

    return history
      .filter((pt) =>
        windowMs === Infinity ? true : latestEpoch - pt.epochMs <= windowMs
      )
      .map((pt) => {
        const d = new Date(pt.epochMs);
        const timeStr = d.toLocaleTimeString([], {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        return {
          time: timeStr,
          temperature: pt.temperatureValid ? pt.temperatureC : null,
          vibration: pt.vibrationMs2,
          vibrationSimulated: pt.vibrationSimulated,
        };
      });
  }, [history, range]);

  const isLive = activeSource === 'web-serial' || activeSource === 'backend';
  const isDemo = activeSource === 'demo';

  const rangeOptions: { id: TimeRangeOption; label: string }[] = [
    { id: '1m', label: '1m' },
    { id: '5m', label: '5m' },
    { id: '15m', label: '15m' },
    { id: 'all', label: 'All' },
  ];

  return (
    <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-slate-100">
              Sensor Trend
            </h3>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                <span
                  className="w-2 h-2 rounded-full bg-emerald-400"
                  aria-hidden="true"
                />
                LIVE
              </span>
            )}
            {isDemo && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300">
                <FlaskConical className="w-3 h-3" aria-hidden="true" />
                DEMO SAMPLE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Dual-axis telemetry: DS18B20 Temperature (°C, left) & Vibration (m/s², right)
          </p>
        </div>

        {/* Historical Time-Range Selector */}
        <div
          className="inline-flex items-center gap-1 p-0.5 rounded-md bg-slate-900 border border-slate-800"
          role="group"
          aria-label="Chart time range"
        >
          {rangeOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRange(opt.id)}
              className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                range === opt.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filteredData.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No sensor telemetry recorded"
          description="Connect your ESP32 over USB Serial, start your external backend server, or enable Demo Mode to populate real-time temperature and vibration series."
          actionLabel={onEnableDemo ? 'Enable Demo Mode' : undefined}
          onAction={onEnableDemo}
        />
      ) : (
        <div style={{ width: '100%', height }} className="mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={filteredData}
              margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1E293B"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                stroke="#64748B"
                tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                minTickGap={28}
              />
              <YAxis
                yAxisId="temp"
                stroke="#38BDF8"
                domain={[
                  (dataMin: number) =>
                    Math.max(0, Math.floor(Math.min(dataMin, 24) - 4)),
                  (dataMax: number) =>
                    Math.ceil(Math.max(dataMax, tempWarningC + 5)),
                ]}
                tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickFormatter={(v) => `${v}°`}
                width={44}
              />
              <YAxis
                yAxisId="vib"
                orientation="right"
                stroke="#A78BFA"
                domain={[
                  0,
                  (dataMax: number) =>
                    Number(Math.max(dataMax + 0.3, vibrationWarningMs2 + 0.4, 1.6).toFixed(1)),
                ]}
                tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickFormatter={(v) => `${v}`}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#090F1D',
                  borderColor: '#1E293B',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
                labelStyle={{ color: '#94A3B8', marginBottom: '4px' }}
                formatter={(value: unknown, name: string | number | undefined) => {
                  const num = typeof value === 'number' ? value : null;
                  const labelStr = String(name ?? '');
                  if (labelStr.includes('Temperature')) {
                    return [
                      num !== null ? `${num.toFixed(2)} °C` : 'Unavailable',
                      'Temperature (DS18B20)',
                    ];
                  }
                  return [
                    num !== null ? `${num.toFixed(2)} m/s²` : '--',
                    'Vibration',
                  ];
                }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: '11px',
                  paddingTop: '6px',
                }}
              />
              <ReferenceLine
                yAxisId="temp"
                y={tempWarningC}
                stroke="#EF4444"
                strokeDasharray="4 4"
                label={{
                  value: `Warn ${tempWarningC.toFixed(1)}°C`,
                  position: 'insideTopLeft',
                  fill: '#FCA5A5',
                  fontSize: 10,
                }}
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperature"
                name="Temperature (°C)"
                stroke="#06B6D4"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                connectNulls={false}
              />
              <Line
                yAxisId="vib"
                type="monotone"
                dataKey="vibration"
                name="Vibration (m/s²)"
                stroke="#A78BFA"
                strokeWidth={1.75}
                dot={false}
                activeDot={{ r: 3.5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};

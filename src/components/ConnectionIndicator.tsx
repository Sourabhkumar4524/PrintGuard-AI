import React from 'react';
import { Usb, Wifi, WifiOff, FlaskConical } from 'lucide-react';

interface ConnectionIndicatorProps {
  label: string;
  state: 'live' | 'demo' | 'offline' | 'standby';
  detail?: string;
  viaUsb?: boolean;
}

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  label,
  state,
  detail,
  viaUsb = false,
}) => {
  const isLive = state === 'live';
  const isDemo = state === 'demo';
  const isOffline = state === 'offline';

  return (
    <div className="flex items-center justify-between gap-2 text-xs py-1">
      <div className="flex items-center gap-2 min-w-0">
        {isLive ? (
          <span
            className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
            aria-hidden="true"
          />
        ) : isDemo ? (
          <FlaskConical
            className="w-3.5 h-3.5 text-amber-400 shrink-0"
            aria-hidden="true"
          />
        ) : isOffline ? (
          <WifiOff
            className="w-3.5 h-3.5 text-slate-500 shrink-0"
            aria-hidden="true"
          />
        ) : (
          <Wifi
            className="w-3.5 h-3.5 text-cyan-400 shrink-0"
            aria-hidden="true"
          />
        )}
        <span className="text-slate-300 font-medium truncate">{label}</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
        {viaUsb && isLive && (
          <Usb className="w-3 h-3 text-emerald-400" aria-hidden="true" />
        )}
        <span
          className={
            isLive
              ? 'text-emerald-400'
              : isDemo
              ? 'text-amber-300'
              : isOffline
              ? 'text-slate-500'
              : 'text-cyan-400'
          }
        >
          {detail ||
            (isLive
              ? 'ONLINE'
              : isDemo
              ? 'SIMULATED'
              : isOffline
              ? 'OFFLINE'
              : 'STANDBY')}
        </span>
      </div>
    </div>
  );
};

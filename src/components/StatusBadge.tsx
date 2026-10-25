import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FlaskConical,
  HelpCircle,
  PowerOff,
  XCircle,
} from 'lucide-react';
import { HardwareComponentState } from '../types/printguard';

export type StatusTone =
  | 'normal'
  | 'warning'
  | 'critical'
  | 'info'
  | 'neutral'
  | 'demo';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  size?: 'xs' | 'sm';
  showIcon?: boolean;
}

export function mapHardwareStateToTone(
  state: HardwareComponentState,
  isDemo?: boolean
): StatusTone {
  if (state === 'ERROR') return 'critical';
  if (state === 'WARNING') return 'warning';
  if (state === 'DISCONNECTED') return 'neutral';
  if (state === 'UNVERIFIED' || state === 'STANDBY') {
    return isDemo ? 'demo' : 'neutral';
  }
  if (isDemo) return 'demo';
  return 'normal';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  tone = 'neutral',
  size = 'xs',
  showIcon = true,
}) => {
  const toneStyles: Record<StatusTone, string> = {
    normal: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
    critical: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
    info: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
    demo: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    neutral: 'text-slate-400 bg-slate-800/70 border-slate-700/70',
  };

  const Icon =
    tone === 'normal'
      ? CheckCircle2
      : tone === 'warning'
      ? AlertTriangle
      : tone === 'critical'
      ? XCircle
      : tone === 'demo'
      ? FlaskConical
      : tone === 'info'
      ? Clock
      : label.toUpperCase().includes('DISCONNECTED') ||
        label.toUpperCase().includes('OFFLINE')
      ? PowerOff
      : HelpCircle;

  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded font-mono font-medium whitespace-nowrap shrink-0 ${
        size === 'xs' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } ${toneStyles[tone]}`}
    >
      {showIcon && <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
};

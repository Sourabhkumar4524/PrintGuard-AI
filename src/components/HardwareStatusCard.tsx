import React from 'react';
import {
  Activity,
  Cpu,
  Gauge,
  Monitor,
  Thermometer,
  Volume2,
} from 'lucide-react';
import { HardwareComponentInfo } from '../types/printguard';
import { mapHardwareStateToTone, StatusBadge } from './StatusBadge';

interface HardwareStatusCardProps {
  component: HardwareComponentInfo;
}

export const HardwareStatusCard: React.FC<HardwareStatusCardProps> = ({
  component,
}) => {
  const Icon =
    component.id === 'esp32'
      ? Cpu
      : component.id === 'mpu6050'
      ? Activity
      : component.id === 'ds18b20'
      ? Thermometer
      : component.id === 'oled'
      ? Monitor
      : component.id === 'servo'
      ? Gauge
      : Volume2;

  const tone = mapHardwareStateToTone(component.status, component.isDemo);

  const badgeLabel =
    component.isDemo &&
    component.status !== 'DISCONNECTED' &&
    !component.verified
      ? `DEMO · ${component.status}`
      : !component.verified &&
        component.status === 'STANDBY' &&
        (component.id === 'oled' || component.id === 'servo')
      ? 'UNVERIFIED'
      : component.status;

  return (
    <div className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-3.5 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon
              className="w-4 h-4 text-cyan-400 shrink-0"
              aria-hidden="true"
            />
            <h4 className="text-xs font-semibold text-slate-100 truncate">
              {component.name}
            </h4>
          </div>
          <StatusBadge label={badgeLabel} tone={tone} />
        </div>

        <p className="text-[11px] text-slate-400 leading-snug">
          {component.shortDescription}
        </p>
        <p className="text-[11px] text-slate-300 mt-1.5 leading-snug">
          {component.detailText}
        </p>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[10px] font-mono tabular-nums text-slate-500">
        <span className="truncate">{component.pinInfo}</span>
        <span className="shrink-0">
          {component.lastUpdated
            ? new Date(component.lastUpdated).toLocaleTimeString([], {
                hour12: false,
              })
            : 'No sync'}
        </span>
      </div>
    </div>
  );
};

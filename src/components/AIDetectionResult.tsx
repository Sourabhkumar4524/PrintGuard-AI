import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FlaskConical,
  HelpCircle,
  ScanEye,
} from 'lucide-react';
import { VisionDetectionResult, VisionHostStatus } from '../types/printguard';

interface AIDetectionResultProps {
  result: VisionDetectionResult | null;
  visionStatus: VisionHostStatus;
  demoMode: boolean;
}

export const AIDetectionResult: React.FC<AIDetectionResultProps> = ({
  result,
  visionStatus,
  demoMode,
}) => {
  if (!result) {
    return (
      <div className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-3.5 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-slate-400">
            AI Detection Result
          </span>
          <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
        </div>

        <div className="my-1">
          <div className="text-sm font-semibold text-slate-300">
            {visionStatus.online && visionStatus.modelLoaded
              ? 'Awaiting Frame'
              : 'No Model Inference'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
            {visionStatus.online && visionStatus.modelLoaded
              ? 'Capture or upload a print frame in AI Camera to run defect detection.'
              : 'External vision model is offline. Connect backend or use Demo Mode to test.'}
          </p>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>Conf: --</span>
          <span>Latency: --</span>
        </div>
      </div>
    );
  }

  const isDefect = result.isDefect;
  const isSim = result.isSimulated || demoMode;

  return (
    <div className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-3.5 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-medium text-slate-400 truncate">
          AI Detection Result
        </span>
        {isDefect ? (
          <AlertTriangle
            className="w-4 h-4 text-rose-400 shrink-0"
            aria-hidden="true"
          />
        ) : (
          <CheckCircle2
            className="w-4 h-4 text-emerald-400 shrink-0"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="my-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-base font-bold tracking-tight ${
              isDefect ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {result.detectedClass}
          </span>
          {isSim && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-300">
              <FlaskConical className="w-3 h-3" aria-hidden="true" />
              SIM
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-snug">
          {result.explanation}
        </p>
      </div>

      <div className="pt-2 mt-1 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-300">
        <span className="inline-flex items-center gap-1">
          <ScanEye className="w-3 h-3 text-cyan-400" aria-hidden="true" />
          {result.confidence !== null ? `${result.confidence.toFixed(1)}%` : '--'}
        </span>
        <span className="inline-flex items-center gap-1 text-slate-400">
          <Clock className="w-3 h-3" aria-hidden="true" />
          {result.latencyMs !== null ? `${result.latencyMs} ms` : '--'}
        </span>
      </div>
    </div>
  );
};

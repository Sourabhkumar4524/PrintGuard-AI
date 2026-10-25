import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from 'lucide-react';
import { usePrintGuard } from '../context/PrintGuardContext';

export const ToastNotifications: React.FC = () => {
  const { toasts, dismissToast } = usePrintGuard();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.variant === 'success'
            ? CheckCircle2
            : toast.variant === 'warning'
            ? AlertTriangle
            : toast.variant === 'error'
            ? XCircle
            : Info;

        const borderClass =
          toast.variant === 'success'
            ? 'border-emerald-500/40'
            : toast.variant === 'warning'
            ? 'border-amber-500/40'
            : toast.variant === 'error'
            ? 'border-rose-500/40'
            : 'border-cyan-500/40';

        const iconColor =
          toast.variant === 'success'
            ? 'text-emerald-400'
            : toast.variant === 'warning'
            ? 'text-amber-400'
            : toast.variant === 'error'
            ? 'text-rose-400'
            : 'text-cyan-400';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start justify-between gap-2.5 rounded-lg bg-[#0D1526]/95 border ${borderClass} px-3.5 py-2.5 shadow-lg`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <Icon
                className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-100 leading-snug">
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed break-words">
                    {toast.description}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="text-slate-500 hover:text-slate-200 p-0.5 rounded shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  AlertTriangle,
  BellOff,
  Check,
  CheckCheck,
  Info,
  Trash2,
} from 'lucide-react';
import { usePrintGuard } from '../context/PrintGuardContext';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';

interface AlertHistoryProps {
  maxItems?: number;
}

export const AlertHistory: React.FC<AlertHistoryProps> = ({
  maxItems = 8,
}) => {
  const {
    alerts,
    acknowledgeAlert,
    acknowledgeAllAlerts,
    clearAlerts,
    unacknowledgedCount,
  } = usePrintGuard();

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const visibleAlerts = alerts.slice(0, maxItems);

  return (
    <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4 flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">
              Alert History
            </h3>
            {unacknowledgedCount > 0 && (
              <span className="text-[11px] font-mono tabular-nums text-amber-300">
                ({unacknowledgedCount} unread)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Chronological sensor, vision &amp; hardware timeline
          </p>
        </div>

        {alerts.length > 0 && (
          <div className="flex items-center gap-1.5">
            {unacknowledgedCount > 0 && (
              <button
                type="button"
                onClick={() => void acknowledgeAllAlerts()}
                title="Acknowledge all alerts"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                <CheckCheck className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                <span>Ack All</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmClearOpen(true)}
              title="Clear alert history"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-slate-900 hover:bg-rose-950/50 text-slate-300 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" />
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>

      {/* Timeline Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/70 my-1 max-h-[560px]">
        {visibleAlerts.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="No alerts recorded"
            description="Threshold breaches, computer-vision defect detections, and labeled demo checks will appear here chronologically."
          />
        ) : (
          visibleAlerts.map((alert) => {
            const Icon =
              alert.severity === 'critical'
                ? AlertOctagon
                : alert.severity === 'warning'
                ? AlertTriangle
                : Info;

            const iconTone =
              alert.severity === 'critical'
                ? 'text-rose-400'
                : alert.severity === 'warning'
                ? 'text-amber-400'
                : 'text-cyan-400';

            const severityText =
              alert.severity === 'critical'
                ? 'CRITICAL'
                : alert.severity === 'warning'
                ? 'WARNING'
                : 'INFO';

            return (
              <div
                key={alert.id}
                className={`py-3 first:pt-2.5 last:pb-1 transition-opacity ${
                  alert.acknowledged ? 'opacity-65' : 'opacity-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Icon
                      className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${iconTone}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-400 tabular-nums">
                        <span className={iconTone}>{severityText}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {new Date(alert.timestamp).toLocaleTimeString([], {
                            hour12: false,
                          })}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="uppercase">{alert.category}</span>
                      </div>
                      <h4 className="text-xs font-semibold text-slate-100 mt-0.5 leading-snug">
                        {alert.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        {alert.description}
                      </p>
                    </div>
                  </div>

                  {!alert.acknowledged ? (
                    <button
                      type="button"
                      onClick={() => void acknowledgeAlert(alert.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Check className="w-3 h-3" aria-hidden="true" />
                      <span>Ack</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-500 shrink-0 pt-0.5">
                      ACKED
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {alerts.length > maxItems && (
        <div className="pt-2.5 border-t border-slate-800/80 text-right">
          <Link
            to="/alerts"
            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
          >
            View all {alerts.length} events &rarr;
          </Link>
        </div>
      )}

      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear Alert History"
        description="Are you sure you want to remove all events from the alert timeline? This action clears the displayed log."
        confirmLabel="Clear Alerts"
        variant="danger"
        onConfirm={() => void clearAlerts()}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </section>
  );
};

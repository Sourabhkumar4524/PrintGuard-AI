import React, { useMemo, useState } from 'react';
import {
  BellOff,
  Check,
  CheckCheck,
  Search,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DashboardHeader } from '../components/DashboardHeader';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { usePrintGuard } from '../context/PrintGuardContext';
import { AlertCategory, AlertSeverity } from '../types/printguard';

interface AlertsPageProps {
  onOpenMobileMenu: () => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ onOpenMobileMenu }) => {
  const {
    alerts,
    unacknowledgedCount,
    acknowledgeAlert,
    acknowledgeAllAlerts,
    clearAlerts,
  } = usePrintGuard();

  const [query, setQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | AlertSeverity>(
    'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<'all' | AlertCategory>(
    'all'
  );
  const [ackFilter, setAckFilter] = useState<'all' | 'unread' | 'acked'>('all');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const filteredAlerts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts.filter((a) => {
      if (severityFilter !== 'all' && a.severity !== severityFilter)
        return false;
      if (categoryFilter !== 'all' && a.category !== categoryFilter)
        return false;
      if (ackFilter === 'unread' && a.acknowledged) return false;
      if (ackFilter === 'acked' && !a.acknowledged) return false;
      if (
        q &&
        !a.title.toLowerCase().includes(q) &&
        !a.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [alerts, query, severityFilter, categoryFilter, ackFilter]);

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Alerts & Event Log"
        subtitle="Searchable and severity-filterable audit log of sensor warnings, AI detections, and demo verifications."
        onOpenMobileMenu={onOpenMobileMenu}
      />

      {/* Filter & Action Toolbar */}
      <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search event title or description..."
              aria-label="Search alerts"
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Severity Filter */}
            <div
              className="inline-flex items-center gap-1 p-0.5 rounded-md bg-slate-900 border border-slate-800"
              role="group"
              aria-label="Filter by severity"
            >
              {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded capitalize transition-colors whitespace-nowrap shrink-0 ${
                    severityFilter === sev
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as 'all' | AlertCategory)
              }
              aria-label="Filter by source category"
              className="px-2.5 py-1.5 text-xs rounded-md bg-slate-900 border border-slate-800 text-slate-200"
            >
              <option value="all">All Sources</option>
              <option value="sensor">Sensor Warning</option>
              <option value="vision">AI Vision</option>
              <option value="hardware">Hardware</option>
              <option value="demo">Demo Scenario</option>
            </select>

            {/* Ack Filter */}
            <select
              value={ackFilter}
              onChange={(e) =>
                setAckFilter(e.target.value as 'all' | 'unread' | 'acked')
              }
              aria-label="Filter by acknowledgement state"
              className="px-2.5 py-1.5 text-xs rounded-md bg-slate-900 border border-slate-800 text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="unread">Unacknowledged</option>
              <option value="acked">Acknowledged</option>
            </select>

            {unacknowledgedCount > 0 && (
              <button
                type="button"
                onClick={() => void acknowledgeAllAlerts()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                <CheckCheck
                  className="w-3.5 h-3.5 text-emerald-400"
                  aria-hidden="true"
                />
                <span>Acknowledge All ({unacknowledgedCount})</span>
              </button>
            )}

            {alerts.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/35 transition-colors whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear Alerts</span>
              </button>
            )}
          </div>
        </div>

        {/* Event Table */}
        {filteredAlerts.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={
              alerts.length === 0
                ? 'No alert events logged'
                : 'No alerts match active filters'
            }
            description={
              alerts.length === 0
                ? 'Threshold alerts, AI defect detections, and Demo Check events will populate this audit table.'
                : 'Adjust your search query or severity/category filters to view matching events.'
            }
            actionLabel={alerts.length > 0 ? 'Reset Filters' : undefined}
            onAction={
              alerts.length > 0
                ? () => {
                    setQuery('');
                    setSeverityFilter('all');
                    setCategoryFilter('all');
                    setAckFilter('all');
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto pt-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400">
                  <th className="py-2.5 pr-3">Timestamp</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Event &amp; Description</th>
                  <th className="py-2.5 pl-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {filteredAlerts.map((alert) => {
                  const tone =
                    alert.severity === 'critical'
                      ? 'critical'
                      : alert.severity === 'warning'
                      ? 'warning'
                      : 'info';

                  return (
                    <tr
                      key={alert.id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        alert.acknowledged ? 'opacity-65' : ''
                      }`}
                    >
                      <td className="py-2.5 pr-3 font-mono text-[11px] tabular-nums text-slate-400 whitespace-nowrap align-top">
                        {new Date(alert.timestamp).toLocaleString([], {
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false,
                        })}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap align-top">
                        <StatusBadge
                          label={alert.severity.toUpperCase()}
                          tone={tone}
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] uppercase text-slate-300 whitespace-nowrap align-top">
                        {alert.isSimulated ? 'DEMO' : alert.category}
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-semibold text-slate-100">
                          {alert.title}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                          {alert.description}
                        </div>
                      </td>
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap align-top">
                        {!alert.acknowledged ? (
                          <button
                            type="button"
                            onClick={() => void acknowledgeAlert(alert.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors"
                          >
                            <Check className="w-3 h-3" aria-hidden="true" />
                            <span>Acknowledge</span>
                          </button>
                        ) : (
                          <span className="font-mono text-[11px] text-slate-500">
                            Acknowledged
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear All Alert Records"
        description="Are you sure you want to clear all events from the alert history log?"
        confirmLabel="Clear Alerts"
        variant="danger"
        onConfirm={() => void clearAlerts()}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
};

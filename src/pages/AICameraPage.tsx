import React from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  FlaskConical,
  ScanEye,
  Server,
} from 'lucide-react';
import { AICameraPanel } from '../components/AICameraPanel';
import { DashboardHeader } from '../components/DashboardHeader';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { usePrintGuard } from '../context/PrintGuardContext';

interface AICameraPageProps {
  onOpenMobileMenu: () => void;
}

export const AICameraPage: React.FC<AICameraPageProps> = ({
  onOpenMobileMenu,
}) => {
  const {
    visionStatus,
    latestVision,
    visionHistory,
    settings,
    testBackendConnection,
  } = usePrintGuard();

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="AI Camera Inspection"
        subtitle="Full-size webcam preview, frame capture, image upload, and computer-vision defect inspection."
        onOpenMobileMenu={onOpenMobileMenu}
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Full-Size Camera & Upload Panel */}
        <div className="xl:col-span-8">
          <AICameraPanel expanded />
        </div>

        {/* Model Host Diagnostics & Latest Detection Detail */}
        <div className="xl:col-span-4 space-y-4">
          <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Vision Model Host
                </h3>
              </div>
              {visionStatus.online && visionStatus.modelLoaded ? (
                <StatusBadge label="ONLINE" tone="normal" />
              ) : visionStatus.online ? (
                <StatusBadge label="NO MODEL" tone="warning" />
              ) : (
                <StatusBadge label="OFFLINE" tone="neutral" />
              )}
            </div>

            <div className="text-xs space-y-1.5 text-slate-300 font-mono">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Endpoint:</span>
                <span className="truncate">{settings.apiBaseUrl}/api/vision/analyze</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Loaded Model:</span>
                <span>{visionStatus.modelName || 'None reported'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Min Confidence:</span>
                <span className="tabular-nums">{settings.aiConfidenceThreshold}%</span>
              </div>
            </div>

            {visionStatus.errorMessage && (
              <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 leading-relaxed">
                {visionStatus.errorMessage}
              </p>
            )}

            <button
              type="button"
              onClick={() => void testBackendConnection()}
              className="w-full px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              Check Vision Host Status
            </button>
          </section>

          {/* Latest Analysis Card */}
          <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">
              Latest Inspection Summary
            </h3>

            {!latestVision ? (
              <EmptyState
                icon={Camera}
                title="No frame analyzed yet"
                description="Capture a frame from your webcam or upload a JPG/PNG print photo and click Analyze Frame."
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {latestVision.isDefect ? (
                      <AlertTriangle
                        className="w-4 h-4 text-rose-400"
                        aria-hidden="true"
                      />
                    ) : (
                      <CheckCircle2
                        className="w-4 h-4 text-emerald-400"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`text-base font-bold ${
                        latestVision.isDefect
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {latestVision.detectedClass}
                    </span>
                  </div>
                  {latestVision.isSimulated ? (
                    <StatusBadge label="DEMO SIMULATED" tone="demo" />
                  ) : (
                    <StatusBadge label="MODEL INFERENCE" tone="info" />
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {latestVision.explanation}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono tabular-nums">
                  <div>
                    <span className="text-slate-500 block text-[10px]">
                      CONFIDENCE
                    </span>
                    <span className="text-slate-100 font-semibold">
                      {latestVision.confidence !== null
                        ? `${latestVision.confidence.toFixed(1)}%`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">
                      LATENCY
                    </span>
                    <span className="text-slate-100 font-semibold">
                      {latestVision.latencyMs !== null
                        ? `${latestVision.latencyMs} ms`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Recent Detections Gallery */}
      <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Recent Detections
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Session history of analyzed camera frames and annotated results
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            {visionHistory.length} frames
          </span>
        </div>

        {visionHistory.length === 0 ? (
          <EmptyState
            icon={ScanEye}
            title="No recent detections"
            description="Analyzed print bed frames and annotated defect overlays will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {visionHistory.map((item) => (
              <div
                key={item.id}
                className="rounded-md bg-[#090F1D] border border-slate-800 overflow-hidden flex flex-col"
              >
                {item.annotatedImageUrl || item.sourceImageUrl ? (
                  <img
                    src={item.annotatedImageUrl || item.sourceImageUrl || ''}
                    alt={`Inspection result: ${item.detectedClass}`}
                    referrerPolicy="no-referrer"
                    className="w-full aspect-video object-cover bg-black"
                  />
                ) : (
                  <div className="w-full aspect-video bg-slate-900 flex items-center justify-center text-xs text-slate-500">
                    No thumbnail
                  </div>
                )}

                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={`text-xs font-bold ${
                          item.isDefect ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {item.detectedClass}
                      </span>
                      {item.isSimulated && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-amber-300">
                          <FlaskConical className="w-3 h-3" aria-hidden="true" />
                          DEMO
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {item.explanation}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400">
                    <span>
                      {item.confidence !== null
                        ? `${item.confidence.toFixed(1)}%`
                        : '--'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour12: false,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

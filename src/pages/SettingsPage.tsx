import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  FlaskConical,
  RotateCcw,
  Save,
  Server,
  Sliders,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DashboardHeader } from '../components/DashboardHeader';
import { usePrintGuard } from '../context/PrintGuardContext';
import { SystemSettings } from '../types/printguard';

interface SettingsPageProps {
  onOpenMobileMenu: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onOpenMobileMenu,
}) => {
  const {
    settings,
    updateSettings,
    resetSettingsToSketchDefaults,
    testBackendConnection,
    backendConnected,
    addToast,
  } = usePrintGuard();

  const [form, setForm] = useState<SystemSettings>(settings);
  const [testingConn, setTestingConn] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings(form);
    addToast(
      'System settings saved',
      'success',
      backendConnected
        ? 'Persisted locally and synced with backend /api/settings.'
        : 'Saved locally (will sync when backend connects).'
    );
  };

  const handleTestBackend = async () => {
    setTestingConn(true);
    try {
      await testBackendConnection(form.apiBaseUrl);
    } finally {
      setTestingConn(false);
    }
  };

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="System Settings"
        subtitle="Configure ESP32 sensor thresholds, AI confidence gates, external backend endpoints, and Demo Mode."
        onOpenMobileMenu={onOpenMobileMenu}
      />

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Thresholds & Timing */}
          <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <Sliders className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-100">
                Sensor &amp; AI Thresholds
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label
                  htmlFor="cfg-temp"
                  className="block font-medium text-slate-300 mb-1"
                >
                  Temperature Warning (°C)
                </label>
                <input
                  id="cfg-temp"
                  type="number"
                  step="0.5"
                  min="0"
                  max="300"
                  value={form.tempWarningC}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tempWarningC: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 font-mono tabular-nums text-slate-100"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  ESP32 sketch default: 40.0 °C
                </span>
              </div>

              <div>
                <label
                  htmlFor="cfg-vib"
                  className="block font-medium text-slate-300 mb-1"
                >
                  Vibration Warning (m/s²)
                </label>
                <input
                  id="cfg-vib"
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="20"
                  value={form.vibrationWarningMs2}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      vibrationWarningMs2: parseFloat(e.target.value) || 0.1,
                    })
                  }
                  className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 font-mono tabular-nums text-slate-100"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  UI alert threshold (default 1.00 m/s²)
                </span>
              </div>

              <div>
                <label
                  htmlFor="cfg-ai-conf"
                  className="block font-medium text-slate-300 mb-1"
                >
                  AI Confidence Threshold (%)
                </label>
                <input
                  id="cfg-ai-conf"
                  type="number"
                  step="1"
                  min="10"
                  max="99"
                  value={form.aiConfidenceThreshold}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      aiConfidenceThreshold: parseInt(e.target.value, 10) || 75,
                    })
                  }
                  className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 font-mono tabular-nums text-slate-100"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Minimum model score to trigger CV defect alert
                </span>
              </div>

              <div>
                <label
                  htmlFor="cfg-cooldown"
                  className="block font-medium text-slate-300 mb-1"
                >
                  Alert Cooldown (seconds)
                </label>
                <input
                  id="cfg-cooldown"
                  type="number"
                  step="1"
                  min="2"
                  max="600"
                  value={form.alertCooldownSec}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      alertCooldownSec: parseInt(e.target.value, 10) || 15,
                    })
                  }
                  className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 font-mono tabular-nums text-slate-100"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Prevents duplicate alerts per channel
                </span>
              </div>

              <div>
                <label
                  htmlFor="cfg-cam-interval"
                  className="block font-medium text-slate-300 mb-1"
                >
                  Camera Frame Interval (sec)
                </label>
                <input
                  id="cfg-cam-interval"
                  type="number"
                  step="1"
                  min="1"
                  max="120"
                  value={form.cameraIntervalSec}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cameraIntervalSec: parseInt(e.target.value, 10) || 5,
                    })
                  }
                  className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 font-mono tabular-nums text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-baud"
                  className="block font-medium text-slate-300 mb-1"
                >
                  ESP32 USB Baud Rate
                </label>
                <select
                  id="cfg-baud"
                  value={form.esp32BaudRate}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      esp32BaudRate: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 font-mono tabular-nums text-slate-100"
                >
                  <option value={9600}>9600</option>
                  <option value={57600}>57600</option>
                  <option value={115200}>115200 (ESP32 Sketch)</option>
                  <option value={230400}>230400</option>
                </select>
              </div>
            </div>
          </section>

          {/* External Backend & Operating Mode */}
          <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <Server className="w-4 h-4 text-purple-400" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-100">
                External Backend &amp; Mode Controls
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label
                  htmlFor="cfg-api-url"
                  className="block font-medium text-slate-300 mb-1"
                >
                  REST API Base URL (blank = Built-in Server)
                </label>
                <div className="flex gap-2">
                  <input
                    id="cfg-api-url"
                    type="text"
                    value={form.apiBaseUrl}
                    onChange={(e) =>
                      setForm({ ...form, apiBaseUrl: e.target.value })
                    }
                    placeholder="Same-origin built-in server (/api/*)"
                    className="flex-1 px-3 py-2 rounded-md bg-slate-900 border border-slate-700 font-mono text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => void handleTestBackend()}
                    disabled={testingConn}
                    className="px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-medium whitespace-nowrap shrink-0"
                  >
                    {testingConn ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="cfg-ws-url"
                  className="block font-medium text-slate-300 mb-1"
                >
                  Live Telemetry WebSocket URL (/ws/live)
                </label>
                <input
                  id="cfg-ws-url"
                  type="text"
                  value={form.wsUrl}
                  onChange={(e) => setForm({ ...form, wsUrl: e.target.value })}
                  placeholder="ws://localhost:8000/ws/live"
                  className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 font-mono text-slate-100"
                />
              </div>

              {/* Demo Mode Toggle */}
              <div className="pt-2 border-t border-slate-800/80 space-y-3">
                <label className="flex items-start justify-between gap-3 cursor-pointer">
                  <div>
                    <span className="flex items-center gap-1.5 font-semibold text-slate-100">
                      <FlaskConical
                        className="w-3.5 h-3.5 text-amber-300"
                        aria-hidden="true"
                      />
                      Enable Labeled Demo Mode
                    </span>
                    <span className="block text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      Generates deterministic sample telemetry and unlocks labeled Simulate Defect camera testing when hardware is offline.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.demoMode}
                    onChange={(e) =>
                      setForm({ ...form, demoMode: e.target.checked })
                    }
                    className="mt-1 w-4 h-4 accent-amber-400 shrink-0"
                  />
                </label>

                <label className="flex items-start justify-between gap-3 cursor-pointer">
                  <div>
                    <span className="flex items-center gap-1.5 font-semibold text-slate-100">
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-cyan-400"
                        aria-hidden="true"
                      />
                      Compact Industrial Panel Density
                    </span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">
                      Optimizes spacing for 1440px workbench displays without excessive whitespace.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.compactDensity}
                    onChange={(e) =>
                      setForm({ ...form, compactDensity: e.target.checked })
                    }
                    className="mt-1 w-4 h-4 accent-cyan-400 shrink-0"
                  />
                </label>
              </div>
            </div>
          </section>
        </div>

        {/* Save & Reset Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#0D1526] border border-slate-800/90 px-4 py-3">
          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset to ESP32 Sketch Defaults (40.0 °C)</span>
          </button>

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmResetOpen}
        title="Restore ESP32 Sketch Defaults"
        description="Reset temperature warning threshold to 40.0 °C, vibration threshold to 1.00 m/s², AI confidence to 75%, and baud rate to 115200?"
        confirmLabel="Restore Defaults"
        variant="warning"
        onConfirm={() => void resetSettingsToSketchDefaults()}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </div>
  );
};

import React from 'react';
import { Server, Terminal, Usb, Wifi, X } from 'lucide-react';
import { usePrintGuard } from '../context/PrintGuardContext';
import { ESP32_PINOUT_MAPPING } from '../utils/esp32SerialParser';

export const SetupGuideModal: React.FC = () => {
  const { setupModalOpen, setSetupModalOpen, settings } = usePrintGuard();

  if (!setupModalOpen) return null;

  const originUrl =
    settings.apiBaseUrl ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-guide-title"
    >
      <div className="w-full max-w-2xl rounded-lg bg-[#0D1526] border border-slate-700 p-5 my-8 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h2
              id="setup-guide-title"
              className="text-base font-bold text-slate-100"
            >
              PrintGuard AI — Full-Stack Server, ESP32 USB &amp; Wi-Fi Guide
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Built-in Express + WebSocket + Vision backend with direct USB Serial &amp; Wi-Fi ESP32 telemetry.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSetupModalOpen(false)}
            aria-label="Close setup guide"
            className="text-slate-400 hover:text-slate-200 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5 mt-4 text-xs text-slate-300">
          {/* 1. Full-Stack Installation & Startup */}
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-100 mb-1.5">
              <Terminal className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              <span>1. Full-Stack Installation &amp; Startup</span>
            </div>
            <pre className="p-3 rounded-md bg-[#060A13] border border-slate-800 font-mono text-[11px] text-slate-200 overflow-x-auto">
{`npm install
# Runs Express REST API + WebSocket (/ws/live) + Vite on port 3000
npm run dev

# Production build & start
npm run build
npm start`}
            </pre>
          </div>

          {/* 2. Direct USB Web Serial Connection */}
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-100 mb-1.5">
              <Usb className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>2. Option A — Direct ESP32 USB Serial (Zero Firmware Changes)</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Your existing Arduino sketch outputs <span className="font-mono text-slate-200">------ LIVE STATUS ------</span> blocks at{' '}
              <span className="font-mono text-slate-200">115200 baud</span>. Plug the ESP32 into USB, close the Arduino Serial Monitor, and click{' '}
              <strong className="text-slate-200">Connect USB</strong> in Chrome or Edge. Live readings are also forwarded automatically to the backend history &amp; WebSocket stream.
            </p>
          </div>

          {/* 3. Optional ESP32 Wi-Fi HTTP POST Snippet */}
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-100 mb-1.5">
              <Wifi className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              <span>3. Option B — Wireless ESP32 HTTP POST to Built-In Backend</span>
            </div>
            <p className="text-slate-400 mb-1.5 leading-relaxed">
              Add <span className="font-mono text-slate-200">#include &lt;WiFiClientSecure.h&gt;</span> and <span className="font-mono text-slate-200">#include &lt;HTTPClient.h&gt;</span> at the top of your sketch, then call this inside your <span className="font-mono text-slate-200">OLED_INTERVAL</span> block to stream wirelessly to Render or local backend:
            </p>
            <pre className="p-3 rounded-md bg-[#060A13] border border-slate-800 font-mono text-[11px] text-slate-200 overflow-x-auto">
{`if (WiFi.status() == WL_CONNECTED) {
  WiFiClientSecure client;
  client.setInsecure(); // Required for https:// Render endpoints
  HTTPClient http;
  http.begin(client, "${originUrl}/api/telemetry");
  http.addHeader("Content-Type", "application/json");
  String json = "{\\"temperatureC\\":" + String(temperatureValid ? temperatureC : -999) +
                ",\\"temperatureValid\\":" + String(temperatureValid ? "true" : "false") +
                ",\\"vibration\\":" + String(vibration, 2) +
                ",\\"vibrationSimulated\\":true" +
                ",\\"servoAngle\\":" + String(servoAngle) +
                ",\\"oledAvailable\\":" + String(oledAvailable ? "true" : "false") +
                ",\\"alertActive\\":" + String(alertActive ? "true" : "false") +
                ",\\"ipAddress\\":\\"" + WiFi.localIP().toString() + "\\"}";
  int httpCode = http.POST(json);
  Serial.printf("Backend POST status: %d\\n", httpCode);
  http.end();
}`}
            </pre>
          </div>

          {/* 4. ESP32 GPIO Pinout Table */}
          <div>
            <h3 className="font-semibold text-slate-100 mb-2">
              4. Verified ESP32 Sketch Pinout Reference
            </h3>
            <div className="overflow-x-auto rounded-md border border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-[11px] font-mono text-slate-400 border-b border-slate-800">
                    <th className="py-2 px-3">Component</th>
                    <th className="py-2 px-3">ESP32 Pin</th>
                    <th className="py-2 px-3">Behavior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-[11px]">
                  {ESP32_PINOUT_MAPPING.map((row) => (
                    <tr key={row.component}>
                      <td className="py-2 px-3 font-medium text-slate-200">
                        {row.component}
                      </td>
                      <td className="py-2 px-3 font-mono text-cyan-300 whitespace-nowrap">
                        {row.gpio}
                      </td>
                      <td className="py-2 px-3 text-slate-400">{row.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Built-In Backend Endpoints */}
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-100 mb-1.5">
              <Server className="w-4 h-4 text-purple-400" aria-hidden="true" />
              <span>5. Active Built-In Backend Routes</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Served on port 3000:{' '}
              <span className="font-mono text-slate-300">/api/health</span>,{' '}
              <span className="font-mono text-slate-300">/api/settings</span>,{' '}
              <span className="font-mono text-slate-300">/api/serial/*</span>,{' '}
              <span className="font-mono text-slate-300">/api/telemetry/*</span>,{' '}
              <span className="font-mono text-slate-300">/api/vision/analyze</span>,{' '}
              <span className="font-mono text-slate-300">/api/vision/status</span>,{' '}
              <span className="font-mono text-slate-300">/api/alerts</span>,{' '}
              <span className="font-mono text-slate-300">/api/stats</span>, and{' '}
              <span className="font-mono text-slate-300">WS /ws/live</span>.
            </p>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={() => setSetupModalOpen(false)}
            className="px-4 py-2 text-xs font-semibold rounded-md bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DEFAULT_API_BASE_URL,
  DEFAULT_WS_URL,
  printGuardApi,
} from '../services/api';
import {
  AlertEvent,
  BackendHealthResponse,
  DataSource,
  HardwareComponentInfo,
  SerialPortInfo,
  SystemSettings,
  SystemStats,
  TelemetryPoint,
  ToastMessage,
  VisionDetectionResult,
  VisionHostStatus,
} from '../types/printguard';
import {
  DEMO_SAMPLE_IMAGES,
  generateInitialDemoHistory,
  generateNextDemoPoint,
  getInitialDemoAlerts,
  getInitialDemoVisionResult,
  renderModelBoundingBoxesOverlay,
  renderSimulatedDefectOverlay,
} from '../utils/demoEngine';
import {
  createInitialAccumulator,
  parseEsp32SerialLine,
} from '../utils/esp32SerialParser';

const SETTINGS_STORAGE_KEY = 'printguard_ai_settings_v2';

export const DEFAULT_SETTINGS: SystemSettings = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  wsUrl: DEFAULT_WS_URL,
  tempWarningC: 40.0, // Matches user's ESP32 sketch: const float TEMP_WARNING_C = 40.0;
  vibrationWarningMs2: 1.0,
  aiConfidenceThreshold: 75,
  cameraIntervalSec: 5,
  alertCooldownSec: 15,
  demoMode: true, // Confirmed in Phase 1: Start in labeled Demo Mode with 40C defaults
  compactDensity: true,
  esp32BaudRate: 115200,
};

// Minimal Web Serial API type declarations for TypeScript
interface BrowserSerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
}

interface NavigatorWithSerial extends Navigator {
  serial?: {
    requestPort(): Promise<BrowserSerialPort>;
    getPorts(): Promise<BrowserSerialPort[]>;
  };
}

interface PrintGuardContextValue {
  settings: SystemSettings;
  updateSettings: (partial: Partial<SystemSettings>) => Promise<void>;
  resetSettingsToSketchDefaults: () => Promise<void>;
  activeSource: DataSource;

  // Telemetry
  latestTelemetry: TelemetryPoint | null;
  telemetryHistory: TelemetryPoint[];

  // Vision
  visionStatus: VisionHostStatus;
  latestVision: VisionDetectionResult | null;
  visionHistory: VisionDetectionResult[];
  isAnalyzingFrame: boolean;
  analyzeFrameBlob: (
    blob: Blob,
    filename: string,
    previewUrl: string,
    isVideoStream?: boolean
  ) => Promise<VisionDetectionResult | null>;
  simulateDemoDefect: (
    defectClass?: 'Spaghetti' | 'Layer Shift' | 'Warping',
    customPreviewUrl?: string | null
  ) => Promise<VisionDetectionResult | null>;

  // Hardware & Connections
  hardwareComponents: HardwareComponentInfo[];
  backendConnected: boolean;
  backendError: string | null;
  wsConnected: boolean;
  backendHealth: BackendHealthResponse | null;
  stats: SystemStats | null;

  // Browser Web Serial USB
  webSerialSupported: boolean;
  isEmbeddedIframe: boolean;
  usbConnected: boolean;
  usbPortLabel: string | null;
  serialLogs: string[];
  clearSerialLogs: () => void;
  connectUsbSerial: () => Promise<void>;
  disconnectUsbSerial: () => Promise<void>;

  // Backend Serial Endpoints
  backendSerialPorts: SerialPortInfo[];
  backendSerialConnected: boolean;
  selectedBackendPort: string;
  setSelectedBackendPort: (port: string) => void;
  fetchBackendSerialPorts: () => Promise<void>;
  connectBackendSerialPort: (portPath?: string) => Promise<void>;
  disconnectBackendSerialPort: () => Promise<void>;

  // Alerts
  alerts: AlertEvent[];
  unacknowledgedCount: number;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  acknowledgeAllAlerts: () => Promise<void>;
  clearAlerts: () => Promise<void>;

  // Global Actions
  isRefreshing: boolean;
  refreshAll: () => Promise<void>;
  demoCheckRunning: boolean;
  runDemoCheck: () => Promise<void>;
  testBackendConnection: (customUrl?: string) => Promise<boolean>;

  // Toasts & Setup Modal
  toasts: ToastMessage[];
  addToast: (
    title: string,
    variant?: ToastMessage['variant'],
    description?: string
  ) => void;
  dismissToast: (id: string) => void;
  setupModalOpen: boolean;
  setSetupModalOpen: (open: boolean) => void;
}

const PrintGuardContext = createContext<PrintGuardContextValue | null>(null);

function loadStoredSettings(): SystemSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SystemSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const PrintGuardProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<SystemSettings>(loadStoredSettings);

  // Initialize Demo Mode state cleanly if demoMode is active
  const initialDemoHistory = useMemo(() => generateInitialDemoHistory(36), []);

  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>(
    () => (settings.demoMode ? initialDemoHistory : [])
  );
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryPoint | null>(
    () =>
      settings.demoMode
        ? initialDemoHistory[initialDemoHistory.length - 1]
        : null
  );

  const [visionStatus, setVisionStatus] = useState<VisionHostStatus>({
    online: false,
    modelLoaded: false,
    modelName: null,
    lastChecked: new Date().toISOString(),
    errorMessage: 'External vision backend not connected',
  });

  const [latestVision, setLatestVision] =
    useState<VisionDetectionResult | null>(() =>
      settings.demoMode ? getInitialDemoVisionResult() : null
    );
  const [visionHistory, setVisionHistory] = useState<VisionDetectionResult[]>(
    () => (settings.demoMode ? [getInitialDemoVisionResult()] : [])
  );
  const [isAnalyzingFrame, setIsAnalyzingFrame] = useState(false);

  const [alerts, setAlerts] = useState<AlertEvent[]>(() =>
    settings.demoMode ? getInitialDemoAlerts() : []
  );

  const [backendConnected, setBackendConnected] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [backendHealth, setBackendHealth] =
    useState<BackendHealthResponse | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);

  // Browser Web Serial USB state
  const webSerialSupported =
    typeof navigator !== 'undefined' && 'serial' in navigator;
  const isEmbeddedIframe =
    typeof window !== 'undefined' && window.self !== window.top;
  const [usbConnected, setUsbConnected] = useState(false);
  const [usbPortLabel, setUsbPortLabel] = useState<string | null>(null);
  const [serialLogs, setSerialLogs] = useState<string[]>([]);
  const usbPortRef = useRef<BrowserSerialPort | null>(null);
  const usbReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null
  );
  const usbKeepReadingRef = useRef(false);
  const oledErrorFromSerialRef = useRef(false);

  // Backend Serial API state
  const [backendSerialPorts, setBackendSerialPorts] = useState<
    SerialPortInfo[]
  >([]);
  const [backendSerialConnected, setBackendSerialConnected] = useState(false);
  const [selectedBackendPort, setSelectedBackendPort] = useState('');

  // Action states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [demoCheckRunning, setDemoCheckRunning] = useState(false);
  const demoTickRef = useRef(40);
  const demoOverrideRef = useRef<{ temp?: number; vib?: number } | null>(null);

  // Alert cooldown map
  const lastAlertByKeyRef = useRef<Record<string, number>>({});
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Toasts & Setup Guide Modal
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (
      title: string,
      variant: ToastMessage['variant'] = 'info',
      description?: string
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, variant, description }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const pushAlertIfCooledDown = useCallback(
    (
      key: string,
      alertData: Omit<AlertEvent, 'id' | 'timestamp' | 'acknowledged'>
    ) => {
      const now = Date.now();
      const cooldownMs = settingsRef.current.alertCooldownSec * 1000;
      const prevTime = lastAlertByKeyRef.current[key] || 0;
      if (now - prevTime < cooldownMs) return;

      lastAlertByKeyRef.current[key] = now;
      const newAlert: AlertEvent = {
        ...alertData,
        id: `alt-${now}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date(now).toISOString(),
        acknowledged: false,
      };
      setAlerts((prev) => [newAlert, ...prev].slice(0, 100));
    },
    []
  );

  const ingestTelemetryPoint = useCallback(
    (point: TelemetryPoint) => {
      setLatestTelemetry(point);
      setTelemetryHistory((prev) => {
        if (prev.some((p) => p.id === point.id)) return prev;
        return [...prev.slice(-119), point];
      });

      const cfg = settingsRef.current;
      const isSim = point.source === 'demo';
      const prefix = isSim ? '[DEMO] ' : '';

      if (!point.temperatureValid || point.temperatureC === null) {
        pushAlertIfCooledDown('temp-disconnected', {
          title: `${prefix}DS18B20 temperature sensor unavailable`,
          severity: 'warning',
          category: isSim ? 'demo' : 'hardware',
          description:
            'ESP32 reported DS18B20 disconnected or out-of-range reading on GPIO 4.',
          isSimulated: isSim,
        });
      } else if (point.temperatureC >= cfg.tempWarningC) {
        pushAlertIfCooledDown('temp-threshold', {
          title: `${prefix}Temperature threshold exceeded (${point.temperatureC.toFixed(
            1
          )} °C)`,
          severity: 'critical',
          category: isSim ? 'demo' : 'sensor',
          description: `DS18B20 reading (${point.temperatureC.toFixed(
            2
          )} °C) reached configured ${cfg.tempWarningC.toFixed(
            1
          )} °C warning threshold. Red LED & Buzzer active.`,
          isSimulated: isSim,
        });
      }

      if (
        point.vibrationMs2 !== null &&
        point.vibrationMs2 >= cfg.vibrationWarningMs2
      ) {
        pushAlertIfCooledDown('vib-threshold', {
          title: `${prefix}${
            point.vibrationSimulated ? 'Simulated vibration' : 'High vibration'
          } spike (${point.vibrationMs2.toFixed(2)} m/s²)`,
          severity: 'warning',
          category: isSim ? 'demo' : 'sensor',
          description: point.vibrationSimulated
            ? `ESP32 sketch simulated vibration (${point.vibrationMs2.toFixed(
                2
              )} m/s²) exceeded ${cfg.vibrationWarningMs2.toFixed(
                2
              )} m/s² display threshold. Physical alarm not triggered.`
            : `MPU6050 vibration (${point.vibrationMs2.toFixed(
                2
              )} m/s²) exceeded ${cfg.vibrationWarningMs2.toFixed(
                2
              )} m/s² threshold.`,
          isSimulated: isSim || point.vibrationSimulated,
        });
      }
    },
    [pushAlertIfCooledDown]
  );

  // Active data source resolution
  const activeSource: DataSource = useMemo(() => {
    if (usbConnected) return 'web-serial';
    if (settings.demoMode) return 'demo';
    if (
      (backendConnected || wsConnected) &&
      (backendSerialConnected || Boolean(latestTelemetry))
    ) {
      return 'backend';
    }
    return 'offline';
  }, [
    usbConnected,
    settings.demoMode,
    backendConnected,
    wsConnected,
    backendSerialConnected,
    latestTelemetry,
  ]);

  // Persist settings locally + push to external backend if connected
  const updateSettings = useCallback(
    async (partial: Partial<SystemSettings>) => {
      const prevMode = settingsRef.current.demoMode;
      const next: SystemSettings = {
        ...settingsRef.current,
        ...partial,
      };
      setSettings(next);
      try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }

      // Handle switching into or out of Demo Mode cleanly
      if (partial.demoMode !== undefined && partial.demoMode !== prevMode) {
        if (partial.demoMode) {
          const freshDemo = generateInitialDemoHistory(36);
          setTelemetryHistory(freshDemo);
          setLatestTelemetry(freshDemo[freshDemo.length - 1]);
          const demoVis = getInitialDemoVisionResult();
          setLatestVision(demoVis);
          setVisionHistory([demoVis]);
          setAlerts((prev) =>
            prev.length > 0 ? prev : getInitialDemoAlerts()
          );
          addToast(
            'Demo Mode enabled',
            'warning',
            'Showing deterministic simulated telemetry and demo controls.'
          );
        } else {
          // Clear synthetic demo telemetry when leaving Demo Mode so fake values never linger!
          setTelemetryHistory((prev) =>
            prev.filter((p) => p.source !== 'demo')
          );
          setLatestTelemetry((prev) =>
            prev?.source === 'demo' ? null : prev
          );
          setLatestVision((prev) => (prev?.isSimulated ? null : prev));
          setVisionHistory((prev) => prev.filter((v) => !v.isSimulated));
          addToast(
            'Switched to Live Mode',
            'info',
            'Demo data cleared. Connect ESP32 via USB Serial or start your local backend.'
          );
        }
      }

      if (backendConnected) {
        try {
          await printGuardApi.updateSettings(next.apiBaseUrl, partial);
        } catch (err) {
          addToast(
            'Saved locally only',
            'warning',
            err instanceof Error
              ? err.message
              : 'Could not sync settings to backend.'
          );
        }
      }
    },
    [addToast, backendConnected]
  );

  const resetSettingsToSketchDefaults = useCallback(async () => {
    await updateSettings({
      ...DEFAULT_SETTINGS,
      apiBaseUrl: settingsRef.current.apiBaseUrl,
      wsUrl: settingsRef.current.wsUrl,
    });
    addToast(
      'Restored ESP32 sketch defaults',
      'success',
      'Temperature warning reset to 40.0 °C and Baud Rate to 115200.'
    );
  }, [addToast, updateSettings]);

  // Demo Mode deterministic ticker (runs ONLY when demoMode === true and USB Serial is not active)
  useEffect(() => {
    if (!settings.demoMode || usbConnected) return;

    const timer = window.setInterval(() => {
      demoTickRef.current += 1;
      const ov = demoOverrideRef.current;
      const pt = generateNextDemoPoint(
        demoTickRef.current,
        settingsRef.current.tempWarningC,
        ov?.temp,
        ov?.vib
      );
      ingestTelemetryPoint(pt);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [settings.demoMode, usbConnected, ingestTelemetryPoint]);

  // Poll backend health & vision status
  const probeBackend = useCallback(
    async (baseUrl: string, silent = true): Promise<boolean> => {
      try {
        const health = await printGuardApi.getHealth(baseUrl);
        setBackendConnected(true);
        setBackendError(null);
        setBackendHealth(health);
        if (typeof health.esp32Connected === 'boolean') {
          setBackendSerialConnected(health.esp32Connected);
        }

        // Also query vision status
        try {
          const vStatus = await printGuardApi.getVisionStatus(baseUrl);
          setVisionStatus(vStatus);
        } catch {
          setVisionStatus({
            online: true,
            modelLoaded: Boolean(health.aiReady),
            modelName: health.modelName || null,
            lastChecked: new Date().toISOString(),
            errorMessage: health.aiReady
              ? null
              : 'Vision model endpoint not configured on backend',
          });
        }

        // Fetch stats if available
        try {
          const st = await printGuardApi.getStats(baseUrl);
          setStats(st);
        } catch {
          // Optional stats route
        }

        if (!silent) {
          addToast(
            'Backend connected',
            'success',
            `Connected to ${baseUrl || 'built-in server (:3000)'}`
          );
        }
        return true;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : `Cannot reach backend at ${baseUrl}`;
        setBackendConnected(false);
        setBackendError(msg);
        setVisionStatus({
          online: false,
          modelLoaded: false,
          modelName: null,
          lastChecked: new Date().toISOString(),
          errorMessage: msg,
        });
        if (!silent) {
          addToast('Backend unreachable', 'error', msg);
        }
        return false;
      }
    },
    [addToast]
  );

  // Initial & periodic backend check when not in Demo Mode
  useEffect(() => {
    probeBackend(settings.apiBaseUrl, true);
    if (settings.demoMode) return;

    const interval = window.setInterval(() => {
      probeBackend(settingsRef.current.apiBaseUrl, true);
    }, 12000);
    return () => window.clearInterval(interval);
  }, [settings.apiBaseUrl, settings.demoMode, probeBackend]);

  // WebSocket `/ws/live` client with auto-reconnection
  useEffect(() => {
    const resolvedWsUrl =
      settings.wsUrl ||
      (typeof window !== 'undefined'
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/live`
        : '');

    if (!resolvedWsUrl) {
      setWsConnected(false);
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let attempt = 0;
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      try {
        ws = new WebSocket(resolvedWsUrl);
      } catch {
        setWsConnected(false);
        return;
      }

      ws.onopen = () => {
        if (unmounted) return;
        attempt = 0;
        setWsConnected(true);
        setBackendConnected(true);
        setBackendError(null);
      };

      ws.onmessage = (event) => {
        if (unmounted) return;
        try {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          const type = String(payload.type || payload.event || 'telemetry');

          if (type === 'init') {
            if (
              !settingsRef.current.demoMode &&
              !usbPortRef.current &&
              typeof payload.latestTelemetry === 'object' &&
              payload.latestTelemetry !== null
            ) {
              ingestTelemetryPoint(
                printGuardApi.normalizeTelemetry(
                  payload.latestTelemetry as Record<string, unknown>
                )
              );
            }
          } else if (
            type === 'telemetry' ||
            'temperatureC' in payload ||
            'temperature' in payload
          ) {
            const dataObj =
              typeof payload.data === 'object' && payload.data !== null
                ? (payload.data as Record<string, unknown>)
                : payload;
            if (!usbPortRef.current && !settingsRef.current.demoMode) {
              ingestTelemetryPoint(printGuardApi.normalizeTelemetry(dataObj));
            }
          } else if (type === 'vision' || 'detectedClass' in payload) {
            const dataObj =
              typeof payload.data === 'object' && payload.data !== null
                ? (payload.data as Record<string, unknown>)
                : payload;
            const vis = printGuardApi.normalizeVisionResult(dataObj);
            setLatestVision((prev) => (prev?.id === vis.id ? prev : vis));
            setVisionHistory((prev) =>
              prev.some((v) => v.id === vis.id) ? prev : [vis, ...prev].slice(0, 30)
            );
          } else if (type === 'alert') {
            const dataObj =
              typeof payload.data === 'object' && payload.data !== null
                ? (payload.data as Record<string, unknown>)
                : payload;
            const alt = printGuardApi.normalizeAlert(dataObj);
            setAlerts((prev) =>
              prev.some((a) => a.id === alt.id) ? prev : [alt, ...prev].slice(0, 100)
            );
          } else if (type === 'alert_ack') {
            const dataObj =
              typeof payload.data === 'object' && payload.data !== null
                ? (payload.data as Record<string, unknown>)
                : payload;
            const ackId = String(dataObj.id || '');
            if (ackId) {
              setAlerts((prev) =>
                prev.map((a) => (a.id === ackId ? { ...a, acknowledged: true } : a))
              );
            }
          } else if (type === 'alerts_cleared') {
            setAlerts((prev) => prev.filter((a) => a.isSimulated));
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      ws.onerror = () => {
        if (!unmounted) setWsConnected(false);
      };

      ws.onclose = () => {
        if (unmounted) return;
        setWsConnected(false);
        const delay = Math.min(10000, 1500 * Math.pow(2, attempt));
        attempt += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      setWsConnected(false);
    };
  }, [settings.wsUrl, ingestTelemetryPoint]);

  // Browser Web Serial USB Connect / Disconnect
  const disconnectUsbSerial = useCallback(async () => {
    usbKeepReadingRef.current = false;
    try {
      if (usbReaderRef.current) {
        await usbReaderRef.current.cancel();
        usbReaderRef.current.releaseLock();
        usbReaderRef.current = null;
      }
    } catch {
      // Ignore reader cancel error
    }
    try {
      if (usbPortRef.current) {
        await usbPortRef.current.close();
        usbPortRef.current = null;
      }
    } catch {
      // Ignore close error
    }
    setUsbConnected(false);
    setUsbPortLabel(null);
    addToast('ESP32 USB disconnected', 'info', 'Serial port closed cleanly.');
  }, [addToast]);

  const connectUsbSerial = useCallback(async () => {
    const nav = navigator as NavigatorWithSerial;
    if (!nav.serial) {
      addToast(
        'Web Serial unavailable',
        'error',
        'Use Chrome or Edge on desktop to connect directly over USB.'
      );
      return;
    }

    try {
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: settingsRef.current.esp32BaudRate || 115200 });

      usbPortRef.current = port;
      usbKeepReadingRef.current = true;
      oledErrorFromSerialRef.current = false;

      const info = port.getInfo ? port.getInfo() : {};
      const vidPid =
        info.usbVendorId && info.usbProductId
          ? `USB ${info.usbVendorId.toString(16).toUpperCase()}:${info.usbProductId
              .toString(16)
              .toUpperCase()}`
          : 'ESP32 USB Serial';

      setUsbPortLabel(`${vidPid} @ ${settingsRef.current.esp32BaudRate} baud`);
      setUsbConnected(true);

      // Automatically exit Demo Mode so live ESP32 serial readings stand on their own
      if (settingsRef.current.demoMode) {
        await updateSettings({ demoMode: false });
      }

      addToast(
        'ESP32 connected via USB Serial',
        'success',
        `Streaming live status blocks at ${settingsRef.current.esp32BaudRate} baud.`
      );

      // Start asynchronous line reader
      const decoder = new TextDecoder();
      let buffer = '';
      const acc = createInitialAccumulator();

      const readLoop = async () => {
        while (port.readable && usbKeepReadingRef.current) {
          const reader = port.readable.getReader();
          usbReaderRef.current = reader;
          try {
            while (usbKeepReadingRef.current) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) {
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() ?? '';

                for (const rawLine of lines) {
                  const trimmed = rawLine.trim();
                  if (trimmed) {
                    setSerialLogs((prev) => [...prev.slice(-119), trimmed]);
                  }
                  const point = parseEsp32SerialLine(rawLine, acc);
                  if (acc.oledError) {
                    oledErrorFromSerialRef.current = true;
                  }
                  if (point) {
                    ingestTelemetryPoint(point);
                    // Forward USB serial telemetry to backend so history & other tabs sync
                    void printGuardApi
                      .postTelemetry(settingsRef.current.apiBaseUrl, point)
                      .catch(() => {});
                  }
                }
              }
            }
          } catch (readErr) {
            if (usbKeepReadingRef.current) {
              addToast(
                'ESP32 serial stream interrupted',
                'error',
                readErr instanceof Error ? readErr.message : 'Device unplugged'
              );
            }
            break;
          } finally {
            try {
              reader.releaseLock();
            } catch {
              // ignore
            }
            usbReaderRef.current = null;
          }
        }

        if (usbKeepReadingRef.current) {
          usbKeepReadingRef.current = false;
          setUsbConnected(false);
          setUsbPortLabel(null);
          usbPortRef.current = null;
        }
      };

      void readLoop();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Serial port selection cancelled';
      if (!message.toLowerCase().includes('no port selected')) {
        addToast('Could not open USB Serial port', 'error', message);
      }
    }
  }, [addToast, ingestTelemetryPoint, updateSettings]);

  // Cleanup USB port on page unload
  useEffect(() => {
    return () => {
      usbKeepReadingRef.current = false;
      if (usbReaderRef.current) {
        void usbReaderRef.current.cancel();
      }
      if (usbPortRef.current) {
        void usbPortRef.current.close();
      }
    };
  }, []);

  const clearSerialLogs = useCallback(() => setSerialLogs([]), []);

  // Backend Serial API handlers
  const fetchBackendSerialPorts = useCallback(async () => {
    try {
      const ports = await printGuardApi.getSerialPorts(
        settingsRef.current.apiBaseUrl
      );
      setBackendSerialPorts(ports);
      if (ports.length > 0 && !selectedBackendPort) {
        setSelectedBackendPort(ports[0].path);
      }
    } catch (err) {
      addToast(
        'Cannot list backend serial ports',
        'error',
        err instanceof Error ? err.message : 'Backend offline'
      );
    }
  }, [addToast, selectedBackendPort]);

  const connectBackendSerialPort = useCallback(
    async (portPath?: string) => {
      const target = portPath || selectedBackendPort;
      if (!target) {
        addToast('Select a serial port first', 'warning');
        return;
      }
      try {
        const res = await printGuardApi.connectSerial(
          settingsRef.current.apiBaseUrl,
          target,
          settingsRef.current.esp32BaudRate
        );
        setBackendSerialConnected(res.connected);
        addToast('Backend connected to ESP32', 'success', `Port ${target}`);
      } catch (err) {
        addToast(
          'Backend serial connect failed',
          'error',
          err instanceof Error ? err.message : 'Request failed'
        );
      }
    },
    [addToast, selectedBackendPort]
  );

  const disconnectBackendSerialPort = useCallback(async () => {
    try {
      await printGuardApi.disconnectSerial(settingsRef.current.apiBaseUrl);
      setBackendSerialConnected(false);
      addToast('Backend serial disconnected', 'info');
    } catch (err) {
      addToast(
        'Backend serial disconnect failed',
        'error',
        err instanceof Error ? err.message : 'Request failed'
      );
    }
  }, [addToast]);

  // Refresh all displayed data
  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (settingsRef.current.demoMode && !usbConnected) {
        demoTickRef.current += 1;
        const pt = generateNextDemoPoint(
          demoTickRef.current,
          settingsRef.current.tempWarningC
        );
        ingestTelemetryPoint(pt);
        await probeBackend(settingsRef.current.apiBaseUrl, true);
        addToast(
          'Demo telemetry refreshed',
          'info',
          'Sample sensor snapshot updated.'
        );
        return;
      }

      const ok = await probeBackend(settingsRef.current.apiBaseUrl, true);
      if (ok) {
        const [latestRes, histRes, alertsRes, visEventsRes] =
          await Promise.allSettled([
            printGuardApi.getLatestTelemetry(settingsRef.current.apiBaseUrl),
            printGuardApi.getTelemetryHistory(
              settingsRef.current.apiBaseUrl,
              '15m'
            ),
            printGuardApi.getAlerts(settingsRef.current.apiBaseUrl),
            printGuardApi.getVisionEvents(settingsRef.current.apiBaseUrl),
          ]);

        if (latestRes.status === 'fulfilled' && !usbConnected) {
          setLatestTelemetry(latestRes.value);
        }
        if (histRes.status === 'fulfilled' && !usbConnected) {
          setTelemetryHistory(histRes.value);
        }
        if (alertsRes.status === 'fulfilled') {
          setAlerts(alertsRes.value);
        }
        if (
          visEventsRes.status === 'fulfilled' &&
          visEventsRes.value.length > 0
        ) {
          setVisionHistory(visEventsRes.value);
          setLatestVision(visEventsRes.value[0]);
        }
        addToast('Live data synchronized', 'success', 'Fetched latest telemetry and alerts.');
      } else if (usbConnected) {
        addToast(
          'USB Serial streaming active',
          'info',
          'External vision backend is offline, but ESP32 USB telemetry is live.'
        );
      } else {
        addToast(
          'Backend offline',
          'warning',
          'Connect ESP32 via USB Serial, start your backend server, or enable Demo Mode.'
        );
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [addToast, ingestTelemetryPoint, probeBackend, usbConnected]);

  // Run Demo Check — executes a clearly labeled test scenario without pretending real hardware detected a defect
  const runDemoCheck = useCallback(async () => {
    if (demoCheckRunning) return;
    setDemoCheckRunning(true);

    const prevDemo = settingsRef.current.demoMode;
    if (!prevDemo && !usbConnected) {
      await updateSettings({ demoMode: true });
    }

    const triggerTemp = Number((settingsRef.current.tempWarningC + 3.2).toFixed(1));
    const triggerVib = Number(
      (settingsRef.current.vibrationWarningMs2 + 0.24).toFixed(2)
    );

    addToast(
      'Running labeled Demo Check...',
      'warning',
      `Injecting 5-second test scenario (${triggerTemp} °C & simulated spaghetti frame).`
    );

    demoOverrideRef.current = { temp: triggerTemp, vib: triggerVib };
    const testPoint = generateNextDemoPoint(
      demoTickRef.current + 1,
      settingsRef.current.tempWarningC,
      triggerTemp,
      triggerVib
    );
    if (!usbConnected) {
      ingestTelemetryPoint(testPoint);
    }

    const annotatedUrl = await renderSimulatedDefectOverlay(
      DEMO_SAMPLE_IMAGES.defect,
      'Spaghetti + Layer Shift (Test Scenario)'
    );

    const demoDetection: VisionDetectionResult = {
      id: `demo-check-${Date.now()}`,
      timestamp: new Date().toISOString(),
      detectedClass: 'Spaghetti',
      confidence: 91.6,
      latencyMs: 74,
      explanation:
        'DEMO CHECK SCENARIO: Synthetic test verification of thermal warning + visual defect alert pipeline (no real hardware fault).',
      sourceImageUrl: DEMO_SAMPLE_IMAGES.defect,
      annotatedImageUrl: annotatedUrl,
      isDefect: true,
      isSimulated: true,
      modelName: 'Demo Verification Scenario',
    };

    setLatestVision(demoDetection);
    setVisionHistory((prev) => [demoDetection, ...prev].slice(0, 30));

    const checkAlert: AlertEvent = {
      id: `demo-check-alert-${Date.now()}`,
      timestamp: new Date().toISOString(),
      title: `[DEMO CHECK] Pipeline verification triggered (${triggerTemp} °C + Spaghetti)`,
      severity: 'critical',
      category: 'demo',
      description:
        'Operator executed "Run Demo Check". Verified thermal threshold & vision alert routing using simulated test inputs.',
      acknowledged: false,
      isSimulated: true,
    };
    setAlerts((prev) => [checkAlert, ...prev].slice(0, 100));

    window.setTimeout(() => {
      demoOverrideRef.current = null;
      setDemoCheckRunning(false);
      addToast(
        'Demo Check completed',
        'success',
        'Simulated thermal spike cleared; review tagged [DEMO CHECK] entry in Alert History.'
      );
    }, 5000);
  }, [addToast, demoCheckRunning, ingestTelemetryPoint, updateSettings, usbConnected]);

  // Analyze Frame via real external backend vision endpoint
  const analyzeFrameBlob = useCallback(
    async (
      blob: Blob,
      filename: string,
      previewUrl: string,
      isVideoStream = false
    ): Promise<VisionDetectionResult | null> => {
      setIsAnalyzingFrame(true);
      try {
        const result = isVideoStream
          ? await printGuardApi.analyzeVideoFrame(
              settingsRef.current.apiBaseUrl,
              blob
            )
          : await printGuardApi.analyzeImage(
              settingsRef.current.apiBaseUrl,
              blob,
              filename
            );

        const renderedBoxesUrl =
          result.boxes && result.boxes.length > 0
            ? await renderModelBoundingBoxesOverlay(
                previewUrl,
                result.boxes,
                result.isDefect
              )
            : null;

        const enriched: VisionDetectionResult = {
          ...result,
          sourceImageUrl: previewUrl,
          annotatedImageUrl:
            result.annotatedImageUrl || renderedBoxesUrl || previewUrl,
          isSimulated: false,
        };

        setLatestVision(enriched);
        setVisionHistory((prev) =>
          prev.some((v) => v.id === enriched.id)
            ? prev.map((v) => (v.id === enriched.id ? enriched : v))
            : [enriched, ...prev].slice(0, 30)
        );
        setBackendConnected(true);
        setVisionStatus((prev) => ({
          ...prev,
          online: true,
          modelLoaded: true,
          modelName: enriched.modelName || prev.modelName || 'Backend Vision Model',
          lastChecked: new Date().toISOString(),
          errorMessage: null,
        }));

        if (
          enriched.isDefect &&
          (enriched.confidence === null ||
            enriched.confidence >= settingsRef.current.aiConfidenceThreshold)
        ) {
          pushAlertIfCooledDown(`vision-${enriched.detectedClass}`, {
            title: `AI detected ${enriched.detectedClass}`,
            severity: 'critical',
            category: 'vision',
            description: `${enriched.explanation} (Confidence: ${
              enriched.confidence !== null
                ? `${enriched.confidence.toFixed(1)}%`
                : 'N/A'
            })`,
            isSimulated: false,
          });
        }

        addToast(
          `Analysis complete: ${enriched.detectedClass}`,
          enriched.isDefect ? 'warning' : 'success',
          enriched.confidence !== null
            ? `Model confidence ${enriched.confidence.toFixed(1)}%`
            : undefined
        );
        return enriched;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Vision backend could not be reached.';
        setVisionStatus((prev) => ({
          ...prev,
          online: false,
          modelLoaded: false,
          lastChecked: new Date().toISOString(),
          errorMessage: msg,
        }));
        addToast(
          'AI Vision backend unavailable',
          'error',
          `${msg}. Start your local server or use "Simulate Defect (Demo)" in Demo Mode.`
        );
        return null;
      } finally {
        setIsAnalyzingFrame(false);
      }
    },
    [addToast, pushAlertIfCooledDown]
  );

  // Simulate Defect — ONLY allowed in DEMO MODE and clearly marked as DEMO
  const simulateDemoDefect = useCallback(
    async (
      defectClass: 'Spaghetti' | 'Layer Shift' | 'Warping' = 'Spaghetti',
      customPreviewUrl?: string | null
    ): Promise<VisionDetectionResult | null> => {
      if (!settingsRef.current.demoMode) {
        addToast(
          'Demo Mode is disabled',
          'warning',
          'Enable Demo Mode in System Settings to run simulated defect previews.'
        );
        return null;
      }

      setIsAnalyzingFrame(true);
      try {
        const baseImg = customPreviewUrl || DEMO_SAMPLE_IMAGES.defect;
        const annotated = await renderSimulatedDefectOverlay(
          baseImg,
          `${defectClass} (Simulated)`
        );

        const simResult: VisionDetectionResult = {
          id: `demo-sim-${Date.now()}`,
          timestamp: new Date().toISOString(),
          detectedClass: defectClass,
          confidence: defectClass === 'Spaghetti' ? 93.4 : defectClass === 'Layer Shift' ? 88.7 : 84.1,
          latencyMs: 62,
          explanation: `DEMO SIMULATION: Synthetic "${defectClass}" overlay generated locally for UI workflow testing. Not a live model inference.`,
          sourceImageUrl: baseImg,
          annotatedImageUrl: annotated,
          isDefect: true,
          isSimulated: true,
          modelName: 'Demo UI Simulator (No Model)',
        };

        setLatestVision(simResult);
        setVisionHistory((prev) => [simResult, ...prev].slice(0, 30));

        const simAlert: AlertEvent = {
          id: `demo-vis-alert-${Date.now()}`,
          timestamp: new Date().toISOString(),
          title: `[DEMO] Simulated ${defectClass} event`,
          severity: 'warning',
          category: 'demo',
          description: `User triggered Simulate Defect (${defectClass}) in Demo Mode.`,
          acknowledged: false,
          isSimulated: true,
        };
        setAlerts((prev) => [simAlert, ...prev].slice(0, 100));

        addToast(
          `[DEMO] Simulated ${defectClass}`,
          'warning',
          'Labeled as Demo Simulation — not a real computer-vision prediction.'
        );
        return simResult;
      } finally {
        setIsAnalyzingFrame(false);
      }
    },
    [addToast]
  );

  // Alert management
  const acknowledgeAlert = useCallback(
    async (alertId: string) => {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
      );

      const target = alerts.find((a) => a.id === alertId);
      if (backendConnected && target && !target.isSimulated) {
        try {
          await printGuardApi.acknowledgeAlert(
            settingsRef.current.apiBaseUrl,
            alertId
          );
        } catch (err) {
          addToast(
            'Acknowledged locally only',
            'warning',
            err instanceof Error ? err.message : 'Backend sync failed'
          );
          return;
        }
      }
      addToast('Alert acknowledged', 'info');
    },
    [addToast, alerts, backendConnected]
  );

  const acknowledgeAllAlerts = useCallback(async () => {
    const unacked = alerts.filter((a) => !a.acknowledged);
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));

    if (backendConnected) {
      await Promise.allSettled(
        unacked
          .filter((a) => !a.isSimulated)
          .map((a) =>
            printGuardApi.acknowledgeAlert(settingsRef.current.apiBaseUrl, a.id)
          )
      );
    }
    addToast('All alerts acknowledged', 'success');
  }, [addToast, alerts, backendConnected]);

  const clearAlerts = useCallback(async () => {
    setAlerts([]);
    if (backendConnected) {
      try {
        await printGuardApi.clearAlerts(settingsRef.current.apiBaseUrl);
      } catch {
        // Ignore clear sync error
      }
    }
    addToast('Alert history cleared', 'info');
  }, [addToast, backendConnected]);

  const testBackendConnection = useCallback(
    async (customUrl?: string) => {
      const target = customUrl || settingsRef.current.apiBaseUrl;
      return probeBackend(target, false);
    },
    [probeBackend]
  );

  // Compute Hardware Status Cards (honoring strict verification rules for OLED & Servo)
  const hardwareComponents: HardwareComponentInfo[] = useMemo(() => {
    const isDemo = activeSource === 'demo';
    const isLiveSerial = activeSource === 'web-serial';
    const isLiveBackend = activeSource === 'backend';
    const lastTs = latestTelemetry?.timestamp ?? null;

    // 1. ESP32
    const espConnected =
      isLiveSerial ||
      (isLiveBackend &&
        (backendSerialConnected || Boolean(latestTelemetry))) ||
      isDemo;

    const espCard: HardwareComponentInfo = {
      id: 'esp32',
      name: 'ESP32',
      shortDescription: 'Wi-Fi / microcontroller host',
      pinInfo: 'UART 115200 · Wi-Fi STA',
      status: isLiveSerial
        ? 'CONNECTED'
        : isLiveBackend && espConnected
        ? 'CONNECTED'
        : isDemo
        ? 'ACTIVE'
        : 'DISCONNECTED',
      verified: isLiveSerial || (isLiveBackend && espConnected),
      isDemo,
      lastUpdated: espConnected ? lastTs : null,
      detailText: isLiveSerial
        ? `${usbPortLabel || 'USB Serial'} ${
            latestTelemetry?.ipAddress
              ? `· IP ${latestTelemetry.ipAddress}`
              : '· Wi-Fi offline'
          }`
        : isDemo
        ? 'DEMO: Simulated Wi-Fi STA (192.168.43.108)'
        : espConnected
        ? `Backend telemetry link${
            latestTelemetry?.ipAddress ? ` · ${latestTelemetry.ipAddress}` : ''
          }`
        : 'Not connected over USB Serial or Backend',
    };

    // 2. MPU6050 (Note: ESP32 sketch uses simulated vibration unless verified hardware stream)
    const vibVal = latestTelemetry?.vibrationMs2 ?? null;
    const vibSim = latestTelemetry?.vibrationSimulated ?? true;
    const vibWarn =
      vibVal !== null && vibVal >= settings.vibrationWarningMs2;

    const mpuCard: HardwareComponentInfo = {
      id: 'mpu6050',
      name: 'MPU6050',
      shortDescription: 'Vibration / motion sensor',
      pinInfo: vibSim ? 'Firmware random() sim' : 'I2C Accelerometer',
      status: !espConnected
        ? 'DISCONNECTED'
        : vibSim
        ? vibWarn
          ? 'WARNING'
          : 'STANDBY'
        : vibWarn
        ? 'WARNING'
        : 'ACTIVE',
      verified: espConnected && !vibSim,
      isDemo: isDemo || vibSim,
      lastUpdated: espConnected ? lastTs : null,
      detailText: !espConnected
        ? 'No telemetry stream'
        : vibSim
        ? `Firmware simulated (${vibVal?.toFixed(2) ?? '--'} m/s²) — physical MPU6050 unverified`
        : `Verified reading: ${vibVal?.toFixed(2) ?? '--'} m/s²`,
    };

    // 3. DS18B20 Temperature Sensor
    const tempValid = Boolean(latestTelemetry?.temperatureValid);
    const tempVal = latestTelemetry?.temperatureC ?? null;
    const tempWarn =
      tempValid && tempVal !== null && tempVal >= settings.tempWarningC;

    const dsCard: HardwareComponentInfo = {
      id: 'ds18b20',
      name: 'DS18B20',
      shortDescription: '1-Wire temperature probe',
      pinInfo: 'GPIO 4 (10-bit async)',
      status: !espConnected
        ? 'DISCONNECTED'
        : !tempValid
        ? 'ERROR'
        : tempWarn
        ? 'WARNING'
        : 'ACTIVE',
      verified: (isLiveSerial || isLiveBackend) && tempValid,
      isDemo,
      lastUpdated: espConnected ? lastTs : null,
      detailText: !espConnected
        ? 'Awaiting ESP32 connection'
        : !tempValid
        ? 'Sensor disconnected / invalid reading on GPIO 4'
        : `${isDemo ? 'DEMO: ' : ''}${tempVal?.toFixed(2)} °C (Warn >= ${settings.tempWarningC.toFixed(
            1
          )} °C)`,
    };

    // 4. SSD1306 OLED — Do NOT report verified unless backend/serial explicitly verifies it
    const oledVerified =
      !isDemo && Boolean(latestTelemetry?.oledVerified);
    const oledSerialErr = isLiveSerial && oledErrorFromSerialRef.current;

    const oledCard: HardwareComponentInfo = {
      id: 'oled',
      name: 'SSD1306 OLED',
      shortDescription: '128x64 I2C status display',
      pinInfo: 'SDA 21 · SCL 22 (0x3C)',
      status: !espConnected
        ? 'DISCONNECTED'
        : oledSerialErr
        ? 'ERROR'
        : oledVerified
        ? 'ACTIVE'
        : 'STANDBY',
      verified: oledVerified,
      isDemo,
      lastUpdated: oledVerified ? lastTs : null,
      detailText: !espConnected
        ? 'ESP32 offline'
        : oledSerialErr
        ? 'Serial reported: OLED not detected on 0x3C/0x3D'
        : oledVerified
        ? 'Verified 128x64 I2C display active'
        : isDemo
        ? 'DEMO: Unverified peripheral (simulated standby)'
        : 'Unverified — serial status block does not confirm I2C ACK',
    };

    // 5. SG90 Servo — Do NOT report verified unless backend or live serial provides angle
    const servoVerified =
      !isDemo && Boolean(latestTelemetry?.servoVerified);
    const servoAngle = latestTelemetry?.servoAngleDeg ?? null;

    const servoCard: HardwareComponentInfo = {
      id: 'servo',
      name: 'SG90 Servo',
      shortDescription: 'PWM sweep actuator',
      pinInfo: 'GPIO 18 (50 Hz PWM)',
      status: !espConnected
        ? 'DISCONNECTED'
        : servoVerified
        ? 'ACTIVE'
        : 'STANDBY',
      verified: servoVerified,
      isDemo,
      lastUpdated: servoVerified || isDemo ? lastTs : null,
      detailText: !espConnected
        ? 'Actuator offline'
        : servoVerified
        ? `Verified sweep: ${servoAngle}° (0°–180° step)`
        : isDemo
        ? `DEMO: Simulated sweep (${servoAngle ?? 0}°) — unverified hardware`
        : 'Unverified — awaiting actuator telemetry from host',
    };

    // 6. LED + Buzzer Physical Alert Output
    const alarmOn = Boolean(latestTelemetry?.alertActive);
    const alarmCard: HardwareComponentInfo = {
      id: 'alarm',
      name: 'LED + Buzzer',
      shortDescription: 'Physical thermal alarm output',
      pinInfo: 'Green 26 · Red 27 · Buz 25',
      status: !espConnected
        ? 'DISCONNECTED'
        : alarmOn
        ? 'WARNING'
        : 'READY',
      verified: isLiveSerial || (isLiveBackend && Boolean(latestTelemetry)),
      isDemo,
      lastUpdated: espConnected ? lastTs : null,
      detailText: !espConnected
        ? 'Outputs inactive (disconnected)'
        : alarmOn
        ? `${isDemo ? 'DEMO: ' : ''}ALARM ON — Red LED HIGH, Buzzer HIGH`
        : `${isDemo ? 'DEMO: ' : ''}NORMAL — Green LED HIGH, Buzzer LOW`,
    };

    return [espCard, mpuCard, dsCard, oledCard, servoCard, alarmCard];
  }, [
    activeSource,
    backendSerialConnected,
    latestTelemetry,
    settings.tempWarningC,
    settings.vibrationWarningMs2,
    usbPortLabel,
  ]);

  const unacknowledgedCount = useMemo(
    () => alerts.filter((a) => !a.acknowledged).length,
    [alerts]
  );

  const value: PrintGuardContextValue = {
    settings,
    updateSettings,
    resetSettingsToSketchDefaults,
    activeSource,
    latestTelemetry,
    telemetryHistory,
    visionStatus,
    latestVision,
    visionHistory,
    isAnalyzingFrame,
    analyzeFrameBlob,
    simulateDemoDefect,
    hardwareComponents,
    backendConnected,
    backendError,
    wsConnected,
    backendHealth,
    stats,
    webSerialSupported,
    isEmbeddedIframe,
    usbConnected,
    usbPortLabel,
    serialLogs,
    clearSerialLogs,
    connectUsbSerial,
    disconnectUsbSerial,
    backendSerialPorts,
    backendSerialConnected,
    selectedBackendPort,
    setSelectedBackendPort,
    fetchBackendSerialPorts,
    connectBackendSerialPort,
    disconnectBackendSerialPort,
    alerts,
    unacknowledgedCount,
    acknowledgeAlert,
    acknowledgeAllAlerts,
    clearAlerts,
    isRefreshing,
    refreshAll,
    demoCheckRunning,
    runDemoCheck,
    testBackendConnection,
    toasts,
    addToast,
    dismissToast,
    setupModalOpen,
    setSetupModalOpen,
  };

  return (
    <PrintGuardContext.Provider value={value}>
      {children}
    </PrintGuardContext.Provider>
  );
};

export function usePrintGuard(): PrintGuardContextValue {
  const ctx = useContext(PrintGuardContext);
  if (!ctx) {
    throw new Error('usePrintGuard must be used inside PrintGuardProvider');
  }
  return ctx;
}

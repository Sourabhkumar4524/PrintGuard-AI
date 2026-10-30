import {
  AlertEvent,
  BackendHealthResponse,
  SerialPortInfo,
  SystemSettings,
  SystemStats,
  TelemetryPoint,
  VisionDetectionResult,
  VisionHostStatus,
} from '../types/printguard';

export function normalizeApiBaseUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  return rawUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api(?:\/telemetry)?$/i, '');
}

export const DEFAULT_API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL as string | undefined
);

export const DEFAULT_WS_URL = (
  (import.meta.env.VITE_WS_URL as string | undefined) || ''
).trim();

export function resolveWsUrl(apiBaseUrl: string, customWsUrl?: string): string {
  const trimmedWs = (customWsUrl || '').trim();
  if (trimmedWs) {
    if (
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1' &&
      /^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(trimmedWs)
    ) {
      // Ignore stale localhost wsUrl persisted in browser storage when running on a live cloud host
    } else {
      return trimmedWs;
    }
  }

  const cleanApi = normalizeApiBaseUrl(apiBaseUrl);
  if (cleanApi) {
    return `${cleanApi.replace(/^http/i, 'ws')}/ws/live`;
  }

  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws/live`;
  }
  return 'ws://localhost:3000/ws/live';
}

export class ApiRequestError extends Error {
  status?: number;
  endpoint: string;

  constructor(message: string, endpoint: string, status?: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.endpoint = endpoint;
    this.status = status;
  }
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {},
  timeoutMs = 35000
): Promise<T> {
  const cleanBase = normalizeApiBaseUrl(baseUrl);
  const url = `${cleanBase}${path}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers(options.headers || {});
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = response.statusText;
      try {
        const errBody = await response.json();
        detail = errBody.detail || errBody.message || errBody.error || detail;
      } catch {
        // Non-JSON error body
      }
      throw new ApiRequestError(
        `HTTP ${response.status}: ${detail}`,
        path,
        response.status
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof ApiRequestError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiRequestError(
        `Request timed out after ${Math.round(timeoutMs / 1000)}s (${url})`,
        path
      );
    }
    const targetLabel = cleanBase || 'built-in server';
    throw new ApiRequestError(
      err instanceof Error
        ? `Unable to reach ${targetLabel} (${err.message})`
        : `Unable to reach ${targetLabel}`,
      path
    );
  } finally {
    window.clearTimeout(timer);
  }
}

function normalizeTelemetry(raw: Record<string, unknown>): TelemetryPoint {
  const ts =
    typeof raw.timestamp === 'string'
      ? raw.timestamp
      : new Date().toISOString();
  const tempVal =
    typeof raw.temperatureC === 'number'
      ? raw.temperatureC
      : typeof raw.temperature === 'number'
      ? raw.temperature
      : typeof raw.temp_c === 'number'
      ? raw.temp_c
      : null;

  const vibVal =
    typeof raw.vibrationMs2 === 'number'
      ? raw.vibrationMs2
      : typeof raw.vibration === 'number'
      ? raw.vibration
      : typeof raw.vibration_ms2 === 'number'
      ? raw.vibration_ms2
      : null;

  const servoVal =
    typeof raw.servoAngleDeg === 'number'
      ? raw.servoAngleDeg
      : typeof raw.servoAngle === 'number'
      ? raw.servoAngle
      : typeof raw.servo_angle === 'number'
      ? raw.servo_angle
      : null;

  return {
    id:
      typeof raw.id === 'string'
        ? raw.id
        : `tel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: ts,
    epochMs: new Date(ts).getTime() || Date.now(),
    temperatureC: tempVal !== null && !Number.isNaN(tempVal) ? tempVal : null,
    temperatureValid:
      typeof raw.temperatureValid === 'boolean'
        ? raw.temperatureValid
        : tempVal !== null && !Number.isNaN(tempVal),
    vibrationMs2: vibVal !== null && !Number.isNaN(vibVal) ? vibVal : null,
    vibrationSimulated: Boolean(
      raw.vibrationSimulated ?? raw.vibration_simulated ?? false
    ),
    servoAngleDeg: servoVal,
    servoVerified: Boolean(raw.servoVerified ?? servoVal !== null),
    oledVerified: Boolean(raw.oledVerified ?? raw.oledAvailable ?? false),
    alertActive: Boolean(raw.alertActive ?? raw.alert_active ?? false),
    wifiConnected: Boolean(raw.wifiConnected ?? raw.wifi_connected ?? true),
    ipAddress:
      typeof raw.ipAddress === 'string'
        ? raw.ipAddress
        : typeof raw.ip_address === 'string'
        ? raw.ip_address
        : null,
    layerCount: typeof raw.layerCount === 'number' ? raw.layerCount : null,
    source: 'backend',
  };
}

function normalizeVisionResult(raw: Record<string, unknown>): VisionDetectionResult {
  const detectedClass = String(
    raw.detectedClass ?? raw.detected_class ?? raw.label ?? 'Normal'
  );
  const confidenceRaw =
    typeof raw.confidence === 'number'
      ? raw.confidence <= 1 && raw.confidence > 0
        ? raw.confidence * 100
        : raw.confidence
      : null;

  const lowerClass = detectedClass.toLowerCase();
  const isDefect =
    typeof raw.isDefect === 'boolean'
      ? raw.isDefect
      : typeof raw.is_defect === 'boolean'
      ? raw.is_defect
      : !lowerClass.includes('normal') &&
        !lowerClass.includes('ok') &&
        !lowerClass.includes('healthy') &&
        !lowerClass.includes('no model');

  return {
    id:
      typeof raw.id === 'string'
        ? raw.id
        : `vis-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp:
      typeof raw.timestamp === 'string'
        ? raw.timestamp
        : new Date().toISOString(),
    detectedClass,
    confidence: confidenceRaw,
    latencyMs:
      typeof raw.latencyMs === 'number'
        ? raw.latencyMs
        : typeof raw.latency_ms === 'number'
        ? raw.latency_ms
        : null,
    explanation: String(
      raw.explanation ??
        raw.summary ??
        `Model reported class "${detectedClass}".`
    ),
    annotatedImageUrl:
      typeof raw.annotatedImageUrl === 'string'
        ? raw.annotatedImageUrl
        : typeof raw.annotated_image === 'string'
        ? raw.annotated_image
        : null,
    boxes: Array.isArray(raw.boxes) ? (raw.boxes as VisionDetectionResult['boxes']) : undefined,
    isDefect,
    isSimulated: false,
    modelName:
      typeof raw.modelName === 'string'
        ? raw.modelName
        : typeof raw.model === 'string'
        ? raw.model
        : null,
  };
}

function normalizeAlert(raw: Record<string, unknown>): AlertEvent {
  const sev = String(raw.severity ?? 'warning').toLowerCase();
  const severity: AlertEvent['severity'] =
    sev === 'critical' || sev === 'error' || sev === 'high'
      ? 'critical'
      : sev === 'info' || sev === 'low'
      ? 'info'
      : 'warning';

  const cat = String(raw.category ?? raw.source ?? 'sensor').toLowerCase();
  const category: AlertEvent['category'] =
    cat.includes('vision') || cat.includes('ai') || cat.includes('camera')
      ? 'vision'
      : cat.includes('demo')
      ? 'demo'
      : cat.includes('hardware') || cat.includes('serial')
      ? 'hardware'
      : 'sensor';

  return {
    id:
      typeof raw.id === 'string' || typeof raw.id === 'number'
        ? String(raw.id)
        : `alt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp:
      typeof raw.timestamp === 'string'
        ? raw.timestamp
        : new Date().toISOString(),
    title: String(raw.title ?? raw.event ?? 'System Event'),
    severity,
    category,
    description: String(raw.description ?? raw.message ?? ''),
    acknowledged: Boolean(raw.acknowledged ?? false),
    isSimulated: Boolean(raw.isSimulated ?? category === 'demo'),
  };
}

/**
 * Dedicated API Service Layer for PrintGuard AI Backend Integration
 */
export const printGuardApi = {
  // 1. GET /api/health
  getHealth(baseUrl: string): Promise<BackendHealthResponse> {
    return requestJson<BackendHealthResponse>(baseUrl, '/api/health');
  },

  // 2. GET /api/settings
  getSettings(baseUrl: string): Promise<Partial<SystemSettings>> {
    return requestJson<Partial<SystemSettings>>(baseUrl, '/api/settings');
  },

  // 3. PUT /api/settings
  updateSettings(
    baseUrl: string,
    settings: Partial<SystemSettings>
  ): Promise<Partial<SystemSettings>> {
    return requestJson<Partial<SystemSettings>>(baseUrl, '/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  // 4. GET /api/serial/ports
  async getSerialPorts(baseUrl: string): Promise<SerialPortInfo[]> {
    const data = await requestJson<SerialPortInfo[] | { ports: SerialPortInfo[] }>(
      baseUrl,
      '/api/serial/ports'
    );
    return Array.isArray(data) ? data : data.ports || [];
  },

  // 5. POST /api/serial/connect
  connectSerial(
    baseUrl: string,
    portPath: string,
    baudRate = 115200
  ): Promise<{ connected: boolean; port: string }> {
    return requestJson(baseUrl, '/api/serial/connect', {
      method: 'POST',
      body: JSON.stringify({ port: portPath, baudRate, baud_rate: baudRate }),
    });
  },

  // 6. POST /api/serial/disconnect
  disconnectSerial(baseUrl: string): Promise<{ connected: boolean }> {
    return requestJson(baseUrl, '/api/serial/disconnect', {
      method: 'POST',
    });
  },

  // 7. GET /api/telemetry/latest
  async getLatestTelemetry(baseUrl: string): Promise<TelemetryPoint> {
    const raw = await requestJson<Record<string, unknown>>(
      baseUrl,
      '/api/telemetry/latest'
    );
    return normalizeTelemetry(raw);
  },

  // 8. GET /api/telemetry/history
  async getTelemetryHistory(
    baseUrl: string,
    range: string = '5m'
  ): Promise<TelemetryPoint[]> {
    const raw = await requestJson<
      Record<string, unknown>[] | { history: Record<string, unknown>[] }
    >(baseUrl, `/api/telemetry/history?range=${encodeURIComponent(range)}`);
    const list = Array.isArray(raw) ? raw : raw.history || [];
    return list.map(normalizeTelemetry);
  },

  // 9. POST /api/vision/analyze
  async analyzeImage(
    baseUrl: string,
    imageBlob: Blob,
    filename = 'capture.jpg'
  ): Promise<VisionDetectionResult> {
    const formData = new FormData();
    formData.append('file', imageBlob, filename);
    formData.append('image', imageBlob, filename);

    const raw = await requestJson<Record<string, unknown>>(
      baseUrl,
      '/api/vision/analyze',
      {
        method: 'POST',
        body: formData,
      },
      20000
    );
    return normalizeVisionResult(raw);
  },

  // 10. POST /api/vision/video/analyze
  async analyzeVideoFrame(
    baseUrl: string,
    frameBlob: Blob
  ): Promise<VisionDetectionResult> {
    const formData = new FormData();
    formData.append('frame', frameBlob, 'video_frame.jpg');
    formData.append('file', frameBlob, 'video_frame.jpg');

    const raw = await requestJson<Record<string, unknown>>(
      baseUrl,
      '/api/vision/video/analyze',
      {
        method: 'POST',
        body: formData,
      },
      20000
    );
    return normalizeVisionResult(raw);
  },

  // 11. GET /api/vision/status
  async getVisionStatus(baseUrl: string): Promise<VisionHostStatus> {
    const raw = await requestJson<Record<string, unknown>>(
      baseUrl,
      '/api/vision/status'
    );
    return {
      online: Boolean(raw.online ?? raw.ready ?? true),
      modelLoaded: Boolean(raw.modelLoaded ?? raw.model_loaded ?? raw.ready ?? false),
      modelName:
        typeof raw.modelName === 'string'
          ? raw.modelName
          : typeof raw.model_name === 'string'
          ? raw.model_name
          : null,
      device: typeof raw.device === 'string' ? raw.device : undefined,
      lastChecked: new Date().toISOString(),
    };
  },

  // 12. GET /api/vision/events
  async getVisionEvents(baseUrl: string): Promise<VisionDetectionResult[]> {
    const raw = await requestJson<
      Record<string, unknown>[] | { events: Record<string, unknown>[] }
    >(baseUrl, '/api/vision/events');
    const list = Array.isArray(raw) ? raw : raw.events || [];
    return list.map(normalizeVisionResult);
  },

  // 13. GET /api/alerts
  async getAlerts(baseUrl: string): Promise<AlertEvent[]> {
    const raw = await requestJson<
      Record<string, unknown>[] | { alerts: Record<string, unknown>[] }
    >(baseUrl, '/api/alerts');
    const list = Array.isArray(raw) ? raw : raw.alerts || [];
    return list.map(normalizeAlert);
  },

  // 14. POST /api/alerts/{alert_id}/acknowledge
  acknowledgeAlert(
    baseUrl: string,
    alertId: string
  ): Promise<{ acknowledged: boolean }> {
    return requestJson(
      baseUrl,
      `/api/alerts/${encodeURIComponent(alertId)}/acknowledge`,
      { method: 'POST' }
    );
  },

  // 14b. DELETE /api/alerts
  clearAlerts(baseUrl: string): Promise<{ cleared: boolean }> {
    return requestJson(baseUrl, '/api/alerts', { method: 'DELETE' });
  },

  // 14c. POST /api/telemetry (ingest live USB Serial or ESP32 telemetry to backend)
  postTelemetry(
    baseUrl: string,
    point: Partial<TelemetryPoint>
  ): Promise<TelemetryPoint> {
    return requestJson<TelemetryPoint>(baseUrl, '/api/telemetry', {
      method: 'POST',
      body: JSON.stringify(point),
    });
  },

  // 15. GET /api/stats
  async getStats(baseUrl: string): Promise<SystemStats> {
    const raw = await requestJson<Record<string, unknown>>(baseUrl, '/api/stats');
    return {
      totalFramesAnalyzed: Number(
        raw.totalFramesAnalyzed ?? raw.total_frames_analyzed ?? 0
      ),
      defectsDetected: Number(raw.defectsDetected ?? raw.defects_detected ?? 0),
      sensorWarningsCount: Number(
        raw.sensorWarningsCount ?? raw.sensor_warnings_count ?? 0
      ),
      uptimeMinutes: Number(raw.uptimeMinutes ?? raw.uptime_minutes ?? 0),
      avgInferenceMs:
        typeof raw.avgInferenceMs === 'number'
          ? raw.avgInferenceMs
          : typeof raw.avg_inference_ms === 'number'
          ? raw.avg_inference_ms
          : null,
    };
  },

  normalizeTelemetry,
  normalizeVisionResult,
  normalizeAlert,
};

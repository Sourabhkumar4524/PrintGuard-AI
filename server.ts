import 'dotenv/config';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import http from 'http';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_VISION_MODEL = 'gemini-3.8-flash';

// ---------- Types (Erasable TS for native Node 22 + tsx compatibility) ----------
interface BoundingBox {
  label: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TelemetryRecord {
  id: string;
  timestamp: string;
  epochMs: number;
  temperatureC: number | null;
  temperatureValid: boolean;
  vibrationMs2: number | null;
  vibrationSimulated: boolean;
  servoAngleDeg: number | null;
  servoVerified: boolean;
  oledVerified: boolean;
  alertActive: boolean;
  wifiConnected: boolean;
  ipAddress: string | null;
  layerCount?: number | null;
  source: 'backend' | 'web-serial';
}

interface VisionEventRecord {
  id: string;
  timestamp: string;
  detectedClass: string;
  confidence: number | null;
  latencyMs: number | null;
  explanation: string;
  boxes: BoundingBox[];
  isDefect: boolean;
  isSimulated: boolean;
  modelName: string;
}

interface AlertRecord {
  id: string;
  timestamp: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'sensor' | 'vision' | 'hardware' | 'demo';
  description: string;
  acknowledged: boolean;
  isSimulated: boolean;
}

interface ServerSettings {
  tempWarningC: number;
  vibrationWarningMs2: number;
  aiConfidenceThreshold: number;
  cameraIntervalSec: number;
  alertCooldownSec: number;
  demoMode: boolean;
  compactDensity: boolean;
  esp32BaudRate: number;
}

interface PersistedStore {
  settings: ServerSettings;
  alerts: AlertRecord[];
  visionEvents: VisionEventRecord[];
  stats: {
    totalFramesAnalyzed: number;
    defectsDetected: number;
    sensorWarningsCount: number;
    inferenceLatencies: number[];
  };
}

// ---------- Persistent JSON Store ----------
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'printguard-store.json');

const DEFAULT_SERVER_SETTINGS: ServerSettings = {
  tempWarningC: 40.0,
  vibrationWarningMs2: 1.0,
  aiConfidenceThreshold: 75,
  cameraIntervalSec: 5,
  alertCooldownSec: 15,
  demoMode: true,
  compactDensity: true,
  esp32BaudRate: 115200,
};

function loadStore(): PersistedStore {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as Partial<PersistedStore>;
      return {
        settings: { ...DEFAULT_SERVER_SETTINGS, ...(raw.settings || {}) },
        alerts: Array.isArray(raw.alerts) ? raw.alerts.slice(0, 200) : [],
        visionEvents: Array.isArray(raw.visionEvents) ? raw.visionEvents.slice(0, 40) : [],
        stats: {
          totalFramesAnalyzed: raw.stats?.totalFramesAnalyzed ?? 0,
          defectsDetected: raw.stats?.defectsDetected ?? 0,
          sensorWarningsCount: raw.stats?.sensorWarningsCount ?? 0,
          inferenceLatencies: Array.isArray(raw.stats?.inferenceLatencies)
            ? raw.stats.inferenceLatencies.slice(-100)
            : [],
        },
      };
    }
  } catch {
    // Fallback to clean state if store file is unreadable
  }
  return {
    settings: { ...DEFAULT_SERVER_SETTINGS },
    alerts: [],
    visionEvents: [],
    stats: {
      totalFramesAnalyzed: 0,
      defectsDetected: 0,
      sensorWarningsCount: 0,
      inferenceLatencies: [],
    },
  };
}

const store: PersistedStore = loadStore();
const telemetryHistory: TelemetryRecord[] = [];
const serverStartedAt = Date.now();
const lastAlertCooldownMap = new Map<string, number>();

// Optional active OS serial stream state
let activeSerialPortPath: string | null = null;
let activeSerialStream: fs.ReadStream | null = null;
let lastEsp32PacketMs = 0;

let saveTimer: NodeJS.Timeout | null = null;
function schedulePersist(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
    } catch {
      // Non-fatal in read-only filesystems
    }
  }, 400);
}

// ---------- Gemini Client Initialization ----------
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ---------- Express & HTTP + WebSocket Setup ----------
const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

function broadcastWs(message: Record<string, unknown>): void {
  const encoded = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(encoded);
    }
  }
}

function recordAlertWithCooldown(
  cooldownKey: string,
  alertInput: Omit<AlertRecord, 'id' | 'timestamp' | 'acknowledged'>
): AlertRecord | null {
  const now = Date.now();
  const cooldownMs = store.settings.alertCooldownSec * 1000;
  const prev = lastAlertCooldownMap.get(cooldownKey) || 0;
  if (now - prev < cooldownMs) {
    return null;
  }
  lastAlertCooldownMap.set(cooldownKey, now);

  const alert: AlertRecord = {
    ...alertInput,
    id: `srv-alt-${now}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date(now).toISOString(),
    acknowledged: false,
  };

  store.alerts = [alert, ...store.alerts].slice(0, 200);
  if (alert.category === 'sensor') {
    store.stats.sensorWarningsCount += 1;
  }
  schedulePersist();
  broadcastWs({ type: 'alert', data: alert });
  return alert;
}

function ingestServerTelemetry(raw: Record<string, unknown>): TelemetryRecord {
  const now = Date.now();
  lastEsp32PacketMs = now;

  const tempVal =
    typeof raw.temperatureC === 'number'
      ? raw.temperatureC
      : typeof raw.temperature === 'number'
      ? raw.temperature
      : typeof raw.temp_c === 'number'
      ? raw.temp_c
      : null;

  const tempValid =
    typeof raw.temperatureValid === 'boolean'
      ? raw.temperatureValid
      : tempVal !== null && !Number.isNaN(tempVal) && tempVal > -55 && tempVal <= 125;

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

  const point: TelemetryRecord = {
    id:
      typeof raw.id === 'string'
        ? raw.id
        : `srv-tel-${now}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp:
      typeof raw.timestamp === 'string'
        ? raw.timestamp
        : new Date(now).toISOString(),
    epochMs: now,
    temperatureC: tempValid && tempVal !== null ? Number(tempVal) : null,
    temperatureValid: tempValid,
    vibrationMs2: vibVal !== null && !Number.isNaN(vibVal) ? Number(vibVal) : null,
    vibrationSimulated: Boolean(
      raw.vibrationSimulated ?? raw.vibration_simulated ?? true
    ),
    servoAngleDeg: servoVal !== null && !Number.isNaN(servoVal) ? Number(servoVal) : null,
    servoVerified: Boolean(raw.servoVerified ?? servoVal !== null),
    oledVerified: Boolean(raw.oledVerified ?? raw.oledAvailable ?? false),
    alertActive: Boolean(
      raw.alertActive ??
        raw.alert_active ??
        (tempValid && tempVal !== null && tempVal >= store.settings.tempWarningC)
    ),
    wifiConnected: Boolean(raw.wifiConnected ?? raw.wifi_connected ?? true),
    ipAddress:
      typeof raw.ipAddress === 'string'
        ? raw.ipAddress
        : typeof raw.ip === 'string'
        ? raw.ip
        : null,
    layerCount: typeof raw.layerCount === 'number' ? raw.layerCount : null,
    source: raw.source === 'web-serial' ? 'web-serial' : 'backend',
  };

  if (!telemetryHistory.some((p) => p.id === point.id)) {
    telemetryHistory.push(point);
    if (telemetryHistory.length > 500) {
      telemetryHistory.shift();
    }
  }

  // Evaluate server-side alert thresholds
  if (!point.temperatureValid || point.temperatureC === null) {
    recordAlertWithCooldown('srv-temp-invalid', {
      title: 'DS18B20 temperature sensor disconnected',
      severity: 'warning',
      category: 'hardware',
      description: 'ESP32 reported invalid or disconnected DS18B20 sensor on GPIO 4.',
      isSimulated: false,
    });
  } else if (point.temperatureC >= store.settings.tempWarningC) {
    recordAlertWithCooldown('srv-temp-high', {
      title: `Temperature threshold exceeded (${point.temperatureC.toFixed(1)} °C)`,
      severity: 'critical',
      category: 'sensor',
      description: `DS18B20 reading (${point.temperatureC.toFixed(
        2
      )} °C) reached configured ${store.settings.tempWarningC.toFixed(
        1
      )} °C warning threshold.`,
      isSimulated: false,
    });
  }

  if (
    point.vibrationMs2 !== null &&
    point.vibrationMs2 >= store.settings.vibrationWarningMs2
  ) {
    recordAlertWithCooldown('srv-vib-high', {
      title: `${
        point.vibrationSimulated ? 'Simulated vibration' : 'High vibration'
      } spike (${point.vibrationMs2.toFixed(2)} m/s²)`,
      severity: 'warning',
      category: 'sensor',
      description: `Vibration reading (${point.vibrationMs2.toFixed(
        2
      )} m/s²) exceeded configured ${store.settings.vibrationWarningMs2.toFixed(
        2
      )} m/s² limit.`,
      isSimulated: point.vibrationSimulated,
    });
  }

  broadcastWs({ type: 'telemetry', data: point });
  return point;
}

// ---------- Gemini Vision 3D-Print Defect Analysis Helper ----------
async function analyzePrintFrameWithGemini(
  imageBuffer: Buffer,
  mimeType: string
): Promise<VisionEventRecord> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Configure GEMINI_API_KEY in Settings > Secrets.'
    );
  }

  const started = Date.now();
  const base64Data = imageBuffer.toString('base64');

  const response = await ai.models.generateContent({
    model: GEMINI_VISION_MODEL,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: base64Data,
          },
        },
        {
          text:
            'Inspect this 3D printing camera frame for print quality and manufacturing defects. ' +
            'Classify into exactly one primary class: "Normal", "Spaghetti", "Layer Shift", "Warping", "Stringing", or "Under-Extrusion". ' +
            'If the image does not show a 3D print defect, classify as "Normal" with isDefect=false. ' +
            'If a defect is visible, set isDefect=true, provide a realistic confidence percentage (0-100), ' +
            'a concise 1-2 sentence technical explanation of what is visible, and normalized bounding boxes (x, y, width, height in 0.0-1.0) around defective regions.',
        },
      ],
    },
    config: {
      systemInstruction:
        'You are PrintGuard AI, an industrial computer-vision inspector for FDM/FFF 3D printers. ' +
        'Be objective and accurate: never invent defects on clean prints or non-defective scenes, and accurately localize tangled filament (Spaghetti), horizontal misalignment (Layer Shift), corner lifting (Warping), fine cobwebs (Stringing), or gaps (Under-Extrusion). Keep explanations concise (under 35 words).',
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detectedClass: {
            type: Type.STRING,
            description:
              'One of: Normal, Spaghetti, Layer Shift, Warping, Stringing, Under-Extrusion.',
          },
          confidence: {
            type: Type.NUMBER,
            description: 'Confidence score from 0 to 100.',
          },
          isDefect: {
            type: Type.BOOLEAN,
            description: 'True only if an actual 3D-printing defect is detected.',
          },
          explanation: {
            type: Type.STRING,
            description: 'Short technical summary of the visual inspection finding.',
          },
          boxes: {
            type: Type.ARRAY,
            description: 'Normalized bounding boxes (0.0 to 1.0) for detected defects.',
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                width: { type: Type.NUMBER },
                height: { type: Type.NUMBER },
              },
              required: ['label', 'confidence', 'x', 'y', 'width', 'height'],
            },
          },
        },
        required: ['detectedClass', 'confidence', 'isDefect', 'explanation', 'boxes'],
      },
    },
  });

  const latencyMs = Date.now() - started;
  const rawText = response.text;
  if (!rawText) {
    throw new Error('Model returned an empty vision inspection response.');
  }

  const parsed = JSON.parse(rawText) as {
    detectedClass: string;
    confidence: number;
    isDefect: boolean;
    explanation: string;
    boxes?: BoundingBox[];
  };

  const confidenceClamped = Math.min(
    100,
    Math.max(0, Number(parsed.confidence ?? 0))
  );

  const eventRecord: VisionEventRecord = {
    id: `vis-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    detectedClass: parsed.detectedClass || 'Normal',
    confidence: Number(confidenceClamped.toFixed(1)),
    latencyMs,
    explanation: parsed.explanation || 'Frame analyzed successfully.',
    boxes: Array.isArray(parsed.boxes) ? parsed.boxes : [],
    isDefect: Boolean(parsed.isDefect),
    isSimulated: false,
    modelName: GEMINI_VISION_MODEL,
  };

  store.visionEvents = [eventRecord, ...store.visionEvents].slice(0, 40);
  store.stats.totalFramesAnalyzed += 1;
  store.stats.inferenceLatencies = [
    ...store.stats.inferenceLatencies.slice(-99),
    latencyMs,
  ];

  if (eventRecord.isDefect) {
    store.stats.defectsDetected += 1;
    if ((eventRecord.confidence ?? 0) >= store.settings.aiConfidenceThreshold) {
      recordAlertWithCooldown(`vision-${eventRecord.detectedClass}`, {
        title: `AI detected ${eventRecord.detectedClass}`,
        severity: 'critical',
        category: 'vision',
        description: `${eventRecord.explanation} (${eventRecord.confidence}% confidence, ${latencyMs} ms)`,
        isSimulated: false,
      });
    }
  }

  schedulePersist();
  broadcastWs({ type: 'vision', data: eventRecord });
  return eventRecord;
}

// ==================== REST API ROUTES ====================

// 1. GET /api/health
app.get('/api/health', (_req: Request, res: Response) => {
  const aiReady = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );
  const espRecentlyActive =
    Boolean(activeSerialPortPath) || Date.now() - lastEsp32PacketMs < 15000;

  res.json({
    status: 'ok',
    esp32Connected: espRecentlyActive,
    serialPort: activeSerialPortPath,
    aiReady,
    modelName: aiReady ? GEMINI_VISION_MODEL : null,
    uptimeSec: Math.floor((Date.now() - serverStartedAt) / 1000),
  });
});

// 2. GET /api/settings
app.get('/api/settings', (_req: Request, res: Response) => {
  res.json(store.settings);
});

// 3. PUT /api/settings
app.put('/api/settings', (req: Request, res: Response) => {
  const body = (req.body || {}) as Partial<ServerSettings>;
  store.settings = {
    ...store.settings,
    ...(typeof body.tempWarningC === 'number'
      ? { tempWarningC: body.tempWarningC }
      : {}),
    ...(typeof body.vibrationWarningMs2 === 'number'
      ? { vibrationWarningMs2: body.vibrationWarningMs2 }
      : {}),
    ...(typeof body.aiConfidenceThreshold === 'number'
      ? { aiConfidenceThreshold: body.aiConfidenceThreshold }
      : {}),
    ...(typeof body.cameraIntervalSec === 'number'
      ? { cameraIntervalSec: body.cameraIntervalSec }
      : {}),
    ...(typeof body.alertCooldownSec === 'number'
      ? { alertCooldownSec: body.alertCooldownSec }
      : {}),
    ...(typeof body.demoMode === 'boolean' ? { demoMode: body.demoMode } : {}),
    ...(typeof body.compactDensity === 'boolean'
      ? { compactDensity: body.compactDensity }
      : {}),
    ...(typeof body.esp32BaudRate === 'number'
      ? { esp32BaudRate: body.esp32BaudRate }
      : {}),
  };
  schedulePersist();
  broadcastWs({ type: 'settings', data: store.settings });
  res.json(store.settings);
});

// 4. GET /api/serial/ports
app.get('/api/serial/ports', (_req: Request, res: Response) => {
  const ports: { path: string; description: string; baudRate: number }[] = [];
  try {
    if (fs.existsSync('/dev')) {
      const entries = fs.readdirSync('/dev');
      for (const name of entries) {
        if (
          name.startsWith('ttyUSB') ||
          name.startsWith('ttyACM') ||
          name.startsWith('cu.usb') ||
          name.startsWith('cu.SLAB') ||
          name.startsWith('tty.usb')
        ) {
          ports.push({
            path: `/dev/${name}`,
            description: 'USB UART Serial Controller',
            baudRate: store.settings.esp32BaudRate,
          });
        }
      }
    }
  } catch {
    // Ignore /dev scan failure on restricted hosts
  }
  res.json({ ports });
});

// 5. POST /api/serial/connect
app.post('/api/serial/connect', (req: Request, res: Response) => {
  const portPath = String(req.body?.port || '').trim();
  if (!portPath) {
    res.status(400).json({ error: 'Serial port path is required.' });
    return;
  }

  if (!fs.existsSync(portPath)) {
    res.status(404).json({
      error: `Serial device ${portPath} not found on server host. When running in a remote container, use Browser Web Serial USB or ESP32 Wi-Fi POST /api/telemetry.`,
    });
    return;
  }

  try {
    if (activeSerialStream) {
      activeSerialStream.destroy();
      activeSerialStream = null;
    }

    const stream = fs.createReadStream(portPath, { encoding: 'utf-8' });
    activeSerialStream = stream;
    activeSerialPortPath = portPath;

    let buffer = '';
    let accTemp: number | null = null;
    let accTempValid = false;
    let accVib: number | null = null;
    let accVibSim = true;
    let accAlert = false;
    let accServo: number | null = null;
    let accIp: string | null = null;
    let accWifi = false;
    let seenFields = false;

    stream.on('data', (chunk: string | Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line.startsWith('Temperature:')) {
          const val = line.replace('Temperature:', '').trim();
          if (val.toLowerCase().includes('unavailable')) {
            accTemp = null;
            accTempValid = false;
          } else {
            const m = val.match(/(-?\d+(\.\d+)?)/);
            if (m) {
              accTemp = parseFloat(m[1]);
              accTempValid = true;
            }
          }
          seenFields = true;
        } else if (
          line.startsWith('Simulated vibration:') ||
          line.startsWith('Vibration:')
        ) {
          accVibSim = line.startsWith('Simulated vibration:');
          const m = line.match(/(-?\d+(\.\d+)?)/);
          if (m) accVib = parseFloat(m[1]);
          seenFields = true;
        } else if (line.startsWith('Temperature alert:')) {
          accAlert = line.toUpperCase().includes('ON');
          seenFields = true;
        } else if (line.startsWith('Servo angle:')) {
          const m = line.match(/(-?\d+)/);
          if (m) accServo = parseInt(m[1], 10);
          seenFields = true;
        } else if (line.startsWith('IP Address:')) {
          accIp = line.replace('IP Address:', '').trim();
          accWifi = true;
          seenFields = true;
        } else if (line.startsWith('---------') && seenFields) {
          seenFields = false;
          ingestServerTelemetry({
            temperatureC: accTemp,
            temperatureValid: accTempValid,
            vibrationMs2: accVib,
            vibrationSimulated: accVibSim,
            alertActive: accAlert,
            servoAngleDeg: accServo,
            servoVerified: accServo !== null,
            wifiConnected: accWifi,
            ipAddress: accIp,
          });
        }
      }
    });

    stream.on('error', () => {
      activeSerialPortPath = null;
      activeSerialStream = null;
    });

    stream.on('close', () => {
      activeSerialPortPath = null;
      activeSerialStream = null;
    });

    res.json({ connected: true, port: portPath });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to open serial port.',
    });
  }
});

// 6. POST /api/serial/disconnect
app.post('/api/serial/disconnect', (_req: Request, res: Response) => {
  if (activeSerialStream) {
    activeSerialStream.destroy();
    activeSerialStream = null;
  }
  activeSerialPortPath = null;
  res.json({ connected: false });
});

// 7. POST /api/telemetry & /api/esp32/telemetry (ESP32 Wi-Fi HTTP & USB Bridge Ingestion)
app.post('/api/telemetry', (req: Request, res: Response) => {
  const point = ingestServerTelemetry((req.body || {}) as Record<string, unknown>);
  res.status(201).json(point);
});

app.post('/api/esp32/telemetry', (req: Request, res: Response) => {
  const point = ingestServerTelemetry((req.body || {}) as Record<string, unknown>);
  res.status(201).json(point);
});

// 8. GET /api/telemetry/latest
app.get('/api/telemetry/latest', (_req: Request, res: Response) => {
  if (telemetryHistory.length === 0) {
    res.status(404).json({
      error: 'No live telemetry received yet from ESP32 USB or Wi-Fi.',
    });
    return;
  }
  res.json(telemetryHistory[telemetryHistory.length - 1]);
});

// 9. GET /api/telemetry/history
app.get('/api/telemetry/history', (req: Request, res: Response) => {
  const range = String(req.query.range || '15m');
  if (telemetryHistory.length === 0) {
    res.json({ history: [] });
    return;
  }

  const latestMs = telemetryHistory[telemetryHistory.length - 1].epochMs;
  const windowMs =
    range === '1m'
      ? 60_000
      : range === '5m'
      ? 5 * 60_000
      : range === '15m'
      ? 15 * 60_000
      : Infinity;

  const filtered =
    windowMs === Infinity
      ? telemetryHistory
      : telemetryHistory.filter((p) => latestMs - p.epochMs <= windowMs);

  res.json({ history: filtered });
});

// Helper to extract uploaded image buffer from multipart or JSON base64
function extractUploadedImage(
  req: Request
): { buffer: Buffer; mimeType: string } | null {
  const filesMap = req.files as Record<string, Express.Multer.File[]> | undefined;
  const singleFile =
    req.file ||
    filesMap?.file?.[0] ||
    filesMap?.image?.[0] ||
    filesMap?.frame?.[0];

  if (singleFile && singleFile.buffer) {
    return {
      buffer: singleFile.buffer,
      mimeType: singleFile.mimetype || 'image/jpeg',
    };
  }

  if (typeof req.body?.imageBase64 === 'string') {
    const cleaned = req.body.imageBase64.replace(/^data:[^;]+;base64,/, '');
    return {
      buffer: Buffer.from(cleaned, 'base64'),
      mimeType: String(req.body.mimeType || 'image/jpeg'),
    };
  }

  return null;
}

// 10. POST /api/vision/analyze
app.post(
  '/api/vision/analyze',
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'frame', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    const extracted = extractUploadedImage(req);
    if (!extracted) {
      res.status(400).json({
        error: 'No image file provided. Upload a JPG or PNG frame.',
      });
      return;
    }

    try {
      const result = await analyzePrintFrameWithGemini(
        extracted.buffer,
        extracted.mimeType
      );
      res.json(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Vision model inference failed.';
      res.status(502).json({ error: message });
    }
  }
);

// 11. POST /api/vision/video/analyze
app.post(
  '/api/vision/video/analyze',
  upload.fields([
    { name: 'frame', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    const extracted = extractUploadedImage(req);
    if (!extracted) {
      res.status(400).json({
        error: 'No video frame provided.',
      });
      return;
    }

    try {
      const result = await analyzePrintFrameWithGemini(
        extracted.buffer,
        extracted.mimeType
      );
      res.json(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Video frame inference failed.';
      res.status(502).json({ error: message });
    }
  }
);

// 12. GET /api/vision/status
app.get('/api/vision/status', (_req: Request, res: Response) => {
  const modelReady = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );
  res.json({
    online: true,
    modelLoaded: modelReady,
    modelName: modelReady ? GEMINI_VISION_MODEL : null,
    device: 'Server-Side Gemini Vision',
  });
});

// 13. GET /api/vision/events
app.get('/api/vision/events', (_req: Request, res: Response) => {
  res.json({ events: store.visionEvents });
});

// 14. GET /api/alerts & DELETE /api/alerts
app.get('/api/alerts', (_req: Request, res: Response) => {
  res.json({ alerts: store.alerts });
});

app.delete('/api/alerts', (_req: Request, res: Response) => {
  store.alerts = [];
  schedulePersist();
  broadcastWs({ type: 'alerts_cleared' });
  res.json({ cleared: true });
});

// 15. POST /api/alerts/:alert_id/acknowledge
app.post('/api/alerts/:alert_id/acknowledge', (req: Request, res: Response) => {
  const alertId = req.params.alert_id;
  let updated: AlertRecord | null = null;

  store.alerts = store.alerts.map((a) => {
    if (a.id === alertId) {
      updated = { ...a, acknowledged: true };
      return updated;
    }
    return a;
  });

  schedulePersist();
  if (updated) {
    broadcastWs({ type: 'alert_ack', data: updated });
  }
  res.json({ acknowledged: true, id: alertId });
});

// 16. GET /api/stats
app.get('/api/stats', (_req: Request, res: Response) => {
  const latencies = store.stats.inferenceLatencies;
  const avgInferenceMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

  res.json({
    totalFramesAnalyzed: store.stats.totalFramesAnalyzed,
    defectsDetected: store.stats.defectsDetected,
    sensorWarningsCount: store.stats.sensorWarningsCount,
    uptimeMinutes: Math.max(
      1,
      Math.round((Date.now() - serverStartedAt) / 60000)
    ),
    avgInferenceMs,
  });
});

// ==================== WEBSOCKET /ws/live ====================
httpServer.on('upgrade', (request, socket, head) => {
  const pathname = request.url ? request.url.split('?')[0] : '';
  if (pathname === '/ws/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

wss.on('connection', (clientWs: WebSocket) => {
  // Initial authoritative state sync on connect
  const latestTelemetry =
    telemetryHistory.length > 0
      ? telemetryHistory[telemetryHistory.length - 1]
      : null;

  clientWs.send(
    JSON.stringify({
      type: 'init',
      settings: store.settings,
      latestTelemetry,
      latestVision: store.visionEvents[0] || null,
    })
  );

  clientWs.on('message', (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg.toString()) as Record<string, unknown>;
      if (msg.type === 'telemetry' && typeof msg.data === 'object' && msg.data !== null) {
        ingestServerTelemetry(msg.data as Record<string, unknown>);
      } else if ('temperatureC' in msg || 'temperature' in msg) {
        ingestServerTelemetry(msg);
      }
    } catch {
      // Ignore non-JSON frames
    }
  });
});

// ==================== VITE DEV / STATIC PROD SERVING ====================
async function startServer(): Promise<void> {
  const distPath = path.join(__dirname, 'dist');
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/ws/')) {
        next();
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`PrintGuard AI Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();

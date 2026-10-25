export type DataSource = 'demo' | 'web-serial' | 'backend' | 'offline';

export type HardwareComponentState =
  | 'CONNECTED'
  | 'ACTIVE'
  | 'READY'
  | 'STANDBY'
  | 'WARNING'
  | 'ERROR'
  | 'DISCONNECTED'
  | 'UNVERIFIED';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertCategory = 'sensor' | 'vision' | 'hardware' | 'demo';

export type DefectClass =
  | 'Normal'
  | 'Spaghetti'
  | 'Layer Shift'
  | 'Warping'
  | 'Stringing'
  | 'Under-Extrusion'
  | 'No Model Configured';

export interface TelemetryPoint {
  id: string;
  timestamp: string; // ISO string
  epochMs: number;
  temperatureC: number | null;
  temperatureValid: boolean;
  vibrationMs2: number | null;
  vibrationSimulated: boolean;
  servoAngleDeg: number | null;
  servoVerified: boolean;
  oledVerified: boolean;
  alertActive: boolean; // Hardware LED/Buzzer state from ESP32 sketch
  wifiConnected: boolean;
  ipAddress: string | null;
  gatewayIp?: string | null;
  subnetMask?: string | null;
  wifiSsid?: string | null;
  layerCount?: number | null;
  source: DataSource;
}

export interface BoundingBox {
  label: string;
  confidence: number;
  x: number; // normalized 0-1
  y: number;
  width: number;
  height: number;
}

export interface VisionDetectionResult {
  id: string;
  timestamp: string;
  detectedClass: DefectClass | string;
  confidence: number | null; // 0-100, null when unavailable
  latencyMs: number | null;
  explanation: string;
  annotatedImageUrl?: string | null;
  sourceImageUrl?: string | null;
  boxes?: BoundingBox[];
  isDefect: boolean;
  isSimulated: boolean;
  modelName?: string | null;
}

export interface VisionHostStatus {
  online: boolean;
  modelLoaded: boolean;
  modelName: string | null;
  device?: string;
  lastChecked: string;
  errorMessage?: string | null;
}

export interface HardwareComponentInfo {
  id: 'esp32' | 'mpu6050' | 'ds18b20' | 'oled' | 'servo' | 'alarm';
  name: string;
  shortDescription: string;
  pinInfo: string;
  status: HardwareComponentState;
  verified: boolean;
  isDemo: boolean;
  lastUpdated: string | null;
  detailText: string;
}

export interface AlertEvent {
  id: string;
  timestamp: string;
  title: string;
  severity: AlertSeverity;
  category: AlertCategory;
  description: string;
  acknowledged: boolean;
  isSimulated: boolean;
}

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  description?: string;
  baudRate?: number;
}

export interface SystemSettings {
  apiBaseUrl: string;
  wsUrl: string;
  tempWarningC: number;
  vibrationWarningMs2: number;
  aiConfidenceThreshold: number; // percentage 0-100
  cameraIntervalSec: number;
  alertCooldownSec: number;
  demoMode: boolean;
  compactDensity: boolean;
  esp32BaudRate: number;
}

export interface BackendHealthResponse {
  status: string;
  esp32Connected?: boolean;
  serialPort?: string | null;
  aiReady?: boolean;
  modelName?: string | null;
  uptimeSec?: number;
}

export interface SystemStats {
  totalFramesAnalyzed: number;
  defectsDetected: number;
  sensorWarningsCount: number;
  uptimeMinutes: number;
  avgInferenceMs: number | null;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: 'info' | 'success' | 'warning' | 'error';
}

export type TimeRangeOption = '1m' | '5m' | '15m' | 'all';

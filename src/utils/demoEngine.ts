import normalBedImg from '../assets/images/fdm_print_normal_bed_1792870180710.jpg';
import defectSpaghettiImg from '../assets/images/fdm_print_defect_spaghetti_1792870179217.jpg';
import {
  AlertEvent,
  BoundingBox,
  TelemetryPoint,
  VisionDetectionResult,
} from '../types/printguard';

export const DEMO_SAMPLE_IMAGES = {
  normal: normalBedImg,
  defect: defectSpaghettiImg,
};

/**
 * Generates deterministic initial history matching the user's ESP32 sketch:
 * - DS18B20 temperature oscillating cleanly around 31.5°C - 35.8°C (below 40.0°C threshold)
 * - Sketch-simulated vibration around 0.22 - 0.64 m/s² with occasional brief peaks
 * - SG90 servo sweeping 0° - 180°
 */
export function generateInitialDemoHistory(count = 36): TelemetryPoint[] {
  const now = Date.now();
  const points: TelemetryPoint[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const epochMs = now - i * 2000;
    const step = count - i;
    const tempWave = 32.4 + Math.sin(step * 0.28) * 2.1 + Math.cos(step * 0.13) * 0.7;
    const isSpike = step % 11 === 0;
    const vibWave = isSpike
      ? 0.88 + ((step * 7) % 25) / 100
      : 0.28 + Math.abs(Math.sin(step * 0.45)) * 0.31;
    const servoAngle = Math.round(Math.abs(((step * 18) % 360) - 180));

    points.push({
      id: `demo-init-${i}`,
      timestamp: new Date(epochMs).toISOString(),
      epochMs,
      temperatureC: Number(tempWave.toFixed(2)),
      temperatureValid: true,
      vibrationMs2: Number(vibWave.toFixed(2)),
      vibrationSimulated: true,
      servoAngleDeg: servoAngle,
      servoVerified: false, // Unverified in demo mode per prompt specification
      oledVerified: false,
      alertActive: tempWave >= 40.0,
      wifiConnected: true,
      ipAddress: '192.168.43.108 (Demo)',
      wifiSsid: 'moto g32 (Demo)',
      layerCount: 42 + Math.floor(step / 6),
      source: 'demo',
    });
  }

  return points;
}

export function generateNextDemoPoint(
  tick: number,
  tempThresholdC: number,
  overrideTempC?: number,
  overrideVibMs2?: number
): TelemetryPoint {
  const now = Date.now();
  const baseTemp =
    overrideTempC !== undefined
      ? overrideTempC
      : 33.1 + Math.sin(tick * 0.24) * 2.3 + Math.cos(tick * 0.11) * 0.6;

  const isSpike = tick % 10 === 0;
  const baseVib =
    overrideVibMs2 !== undefined
      ? overrideVibMs2
      : isSpike
      ? 0.92 + ((tick * 13) % 32) / 100
      : 0.24 + Math.abs(Math.sin(tick * 0.41)) * 0.36;

  const servoAngle = Math.round(Math.abs(((tick * 16) % 360) - 180));
  const tempRounded = Number(baseTemp.toFixed(2));
  const vibRounded = Number(baseVib.toFixed(2));

  return {
    id: `demo-${now}-${tick}`,
    timestamp: new Date(now).toISOString(),
    epochMs: now,
    temperatureC: tempRounded,
    temperatureValid: true,
    vibrationMs2: vibRounded,
    vibrationSimulated: true,
    servoAngleDeg: servoAngle,
    servoVerified: false,
    oledVerified: false,
    alertActive: tempRounded >= tempThresholdC,
    wifiConnected: true,
    ipAddress: '192.168.43.108 (Demo)',
    wifiSsid: 'moto g32 (Demo)',
    layerCount: 48 + Math.floor(tick / 8),
    source: 'demo',
  };
}

export function getInitialDemoVisionResult(): VisionDetectionResult {
  return {
    id: 'demo-vis-initial',
    timestamp: new Date(Date.now() - 18000).toISOString(),
    detectedClass: 'Normal',
    confidence: 94.2,
    latencyMs: 68,
    explanation:
      'DEMO SIMULATION: Sample print bed shows uniform PLA layer adhesion with no spaghetti extrusion or horizontal shift.',
    sourceImageUrl: DEMO_SAMPLE_IMAGES.normal,
    annotatedImageUrl: DEMO_SAMPLE_IMAGES.normal,
    isDefect: false,
    isSimulated: true,
    modelName: 'Demo Scenario Preset (Not Live Model)',
  };
}

export function getInitialDemoAlerts(): AlertEvent[] {
  const now = Date.now();
  return [
    {
      id: 'demo-alert-1',
      timestamp: new Date(now - 14 * 60 * 1000).toISOString(),
      title: '[DEMO] Sample telemetry initialized',
      severity: 'info',
      category: 'demo',
      description:
        'Demo Mode started with DS18B20 warning threshold at 40.0 °C matching ESP32 firmware defaults.',
      acknowledged: true,
      isSimulated: true,
    },
    {
      id: 'demo-alert-2',
      timestamp: new Date(now - 6 * 60 * 1000).toISOString(),
      title: '[DEMO] Simulated vibration transient (1.14 m/s²)',
      severity: 'warning',
      category: 'demo',
      description:
        'Synthetic vibration spike exceeded 1.00 m/s² reference threshold. Per ESP32 firmware logic, physical buzzer remained OFF.',
      acknowledged: false,
      isSimulated: true,
    },
  ];
}

/**
 * Renders a clearly labeled [DEMO SIMULATION] annotated canvas image
 * so simulated defect previews never pretend to be live model predictions.
 */
export async function renderSimulatedDefectOverlay(
  sourceUrl: string,
  defectLabel = 'Spaghetti / Layer Detachment'
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 960;
      canvas.height = img.naturalHeight || 540;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(sourceUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw simulated bounding box
      const bx = Math.round(canvas.width * 0.23);
      const by = Math.round(canvas.height * 0.27);
      const bw = Math.round(canvas.width * 0.52);
      const bh = Math.round(canvas.height * 0.45);

      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = Math.max(3, Math.round(canvas.width * 0.004));
      ctx.setLineDash([10, 6]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);

      // Semi-transparent fill
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      ctx.fillRect(bx, by, bw, bh);

      // Top-left label bar clearly stating DEMO SIMULATION
      const tagText = `DEMO SIMULATION: ${defectLabel}`;
      ctx.font = `600 ${Math.max(14, Math.round(canvas.width * 0.018))}px "JetBrains Mono", monospace`;
      const metrics = ctx.measureText(tagText);
      const padX = 12;
      const boxH = Math.max(28, Math.round(canvas.height * 0.055));

      ctx.fillStyle = 'rgba(127, 29, 29, 0.92)';
      ctx.fillRect(bx, Math.max(0, by - boxH), metrics.width + padX * 2, boxH);
      ctx.fillStyle = '#FECACA';
      ctx.fillText(tagText, bx + padX, Math.max(18, by - Math.round(boxH * 0.28)));

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(sourceUrl);
    img.src = sourceUrl;
  });
}

/**
 * Renders verified server-side AI Vision bounding boxes onto the source image
 */
export async function renderModelBoundingBoxesOverlay(
  sourceUrl: string,
  boxes: BoundingBox[],
  isDefect: boolean
): Promise<string> {
  if (!boxes || boxes.length === 0) return sourceUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 960;
      canvas.height = img.naturalHeight || 540;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(sourceUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const stroke = isDefect ? '#F43F5E' : '#10B981';
      const fill = isDefect ? 'rgba(244, 63, 94, 0.14)' : 'rgba(16, 185, 129, 0.12)';
      const badgeBg = isDefect ? 'rgba(136, 19, 55, 0.92)' : 'rgba(6, 78, 59, 0.92)';

      for (const box of boxes) {
        const bx = Math.round(Math.max(0, Math.min(1, box.x)) * canvas.width);
        const by = Math.round(Math.max(0, Math.min(1, box.y)) * canvas.height);
        const bw = Math.round(
          Math.max(0.04, Math.min(1 - box.x, box.width)) * canvas.width
        );
        const bh = Math.round(
          Math.max(0.04, Math.min(1 - box.y, box.height)) * canvas.height
        );

        ctx.strokeStyle = stroke;
        ctx.lineWidth = Math.max(3, Math.round(canvas.width * 0.0035));
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = fill;
        ctx.fillRect(bx, by, bw, bh);

        const confNum =
          box.confidence <= 1 && box.confidence > 0
            ? box.confidence * 100
            : box.confidence;
        const label = `${box.label} (${confNum.toFixed(0)}%)`;
        ctx.font = `600 ${Math.max(13, Math.round(canvas.width * 0.016))}px "JetBrains Mono", monospace`;
        const metrics = ctx.measureText(label);
        const padX = 10;
        const tagH = Math.max(24, Math.round(canvas.height * 0.048));
        const tagY = by >= tagH ? by - tagH : by;

        ctx.fillStyle = badgeBg;
        ctx.fillRect(bx, tagY, metrics.width + padX * 2, tagH);
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(label, bx + padX, tagY + Math.round(tagH * 0.72));
      }

      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => resolve(sourceUrl);
    img.src = sourceUrl;
  });
}


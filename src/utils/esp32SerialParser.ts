import { TelemetryPoint } from '../types/printguard';

export interface Esp32Accumulator {
  temperatureC: number | null;
  temperatureValid: boolean;
  vibrationMs2: number | null;
  vibrationSimulated: boolean;
  alertActive: boolean;
  servoAngleDeg: number | null;
  servoVerified: boolean;
  oledVerified: boolean;
  oledError: boolean;
  wifiConnected: boolean;
  ipAddress: string | null;
  gatewayIp: string | null;
  subnetMask: string | null;
  wifiSsid: string | null;
  hasStatusFields: boolean;
}

export function createInitialAccumulator(): Esp32Accumulator {
  return {
    temperatureC: null,
    temperatureValid: false,
    vibrationMs2: null,
    vibrationSimulated: true,
    alertActive: false,
    servoAngleDeg: null,
    servoVerified: false,
    oledVerified: false,
    oledError: false,
    wifiConnected: false,
    ipAddress: null,
    gatewayIp: null,
    subnetMask: null,
    wifiSsid: null,
    hasStatusFields: false,
  };
}

/**
 * Parses individual serial lines emitted by the user's ESP32 Arduino sketch (115200 baud):
 *
 * ------ LIVE STATUS ------
 * Temperature: 28.50 C   OR   Temperature: Sensor unavailable
 * Simulated vibration: 0.42 m/s2
 * Temperature alert: OFF
 * Servo angle: 124
 * IP Address: 192.168.43.105   OR   WiFi: Disconnected
 * -------------------------
 *
 * Also supports JSON telemetry lines if firmware is upgraded later.
 */
export function parseEsp32SerialLine(
  rawLine: string,
  acc: Esp32Accumulator
): TelemetryPoint | null {
  const line = rawLine.trim();
  if (!line) return null;

  // Support optional single-line JSON format as well
  if (line.startsWith('{') && line.endsWith('}')) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const now = new Date();
      const temp =
        typeof parsed.temperatureC === 'number'
          ? parsed.temperatureC
          : typeof parsed.temp === 'number'
          ? parsed.temp
          : null;
      const vib =
        typeof parsed.vibration === 'number'
          ? parsed.vibration
          : typeof parsed.vibrationMs2 === 'number'
          ? parsed.vibrationMs2
          : null;
      const servo =
        typeof parsed.servoAngle === 'number' ? parsed.servoAngle : null;

      return {
        id: `ser-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now.toISOString(),
        epochMs: now.getTime(),
        temperatureC: temp,
        temperatureValid: temp !== null && !Number.isNaN(temp),
        vibrationMs2: vib,
        vibrationSimulated: Boolean(parsed.vibrationSimulated ?? true),
        servoAngleDeg: servo,
        servoVerified: servo !== null,
        oledVerified: Boolean(parsed.oledAvailable ?? acc.oledVerified),
        alertActive: Boolean(parsed.alertActive ?? false),
        wifiConnected: Boolean(parsed.wifiConnected ?? Boolean(parsed.ip)),
        ipAddress: typeof parsed.ip === 'string' ? parsed.ip : acc.ipAddress,
        wifiSsid: acc.wifiSsid,
        source: 'web-serial',
      };
    } catch {
      // Fall through to text parser
    }
  }

  // Startup & WiFi block lines from connectWiFi() / setup()
  if (line.includes('OLED not detected')) {
    acc.oledVerified = false;
    acc.oledError = true;
    return null;
  }

  if (line.startsWith('WiFi Name:')) {
    acc.wifiSsid = line.replace('WiFi Name:', '').trim();
    acc.wifiConnected = true;
    return null;
  }

  if (line.startsWith('ESP32 IP Address:')) {
    acc.ipAddress = line.replace('ESP32 IP Address:', '').trim();
    acc.wifiConnected = true;
    return null;
  }

  if (line.startsWith('Gateway IP:')) {
    acc.gatewayIp = line.replace('Gateway IP:', '').trim();
    return null;
  }

  if (line.startsWith('Subnet Mask:')) {
    acc.subnetMask = line.replace('Subnet Mask:', '').trim();
    return null;
  }

  // Status block start
  if (line.includes('------ LIVE STATUS ------')) {
    acc.hasStatusFields = false;
    return null;
  }

  // Temperature: 29.75 C  OR  Temperature: Sensor unavailable
  if (line.startsWith('Temperature:')) {
    const valPart = line.replace('Temperature:', '').trim();
    if (valPart.toLowerCase().includes('unavailable')) {
      acc.temperatureC = null;
      acc.temperatureValid = false;
    } else {
      const match = valPart.match(/(-?\d+(\.\d+)?)/);
      if (match) {
        acc.temperatureC = parseFloat(match[1]);
        acc.temperatureValid = true;
      }
    }
    acc.hasStatusFields = true;
    return null;
  }

  // Simulated vibration: 0.42 m/s2  OR  Vibration: 0.42 m/s2
  if (
    line.startsWith('Simulated vibration:') ||
    line.startsWith('Vibration:')
  ) {
    const isSim = line.startsWith('Simulated vibration:');
    const match = line.match(/(-?\d+(\.\d+)?)/);
    if (match) {
      acc.vibrationMs2 = parseFloat(match[1]);
      acc.vibrationSimulated = isSim;
    }
    acc.hasStatusFields = true;
    return null;
  }

  // Temperature alert: ON | OFF
  if (line.startsWith('Temperature alert:')) {
    const val = line.replace('Temperature alert:', '').trim().toUpperCase();
    acc.alertActive = val === 'ON' || val === '1' || val === 'TRUE';
    acc.hasStatusFields = true;
    return null;
  }

  // Servo angle: 126
  if (line.startsWith('Servo angle:')) {
    const match = line.match(/(-?\d+)/);
    if (match) {
      acc.servoAngleDeg = parseInt(match[1], 10);
      acc.servoVerified = true;
    }
    acc.hasStatusFields = true;
    return null;
  }

  // IP Address: 192.168.x.x
  if (line.startsWith('IP Address:')) {
    acc.ipAddress = line.replace('IP Address:', '').trim();
    acc.wifiConnected = true;
    acc.hasStatusFields = true;
    return null;
  }

  // WiFi: Disconnected
  if (line.startsWith('WiFi:')) {
    const val = line.replace('WiFi:', '').trim().toLowerCase();
    acc.wifiConnected = !val.includes('disconnected') && !val.includes('offline');
    if (!acc.wifiConnected) {
      acc.ipAddress = null;
    }
    acc.hasStatusFields = true;
    return null;
  }

  // End of LIVE STATUS block: -------------------------
  if (line.startsWith('---------') && acc.hasStatusFields) {
    acc.hasStatusFields = false;
    const now = new Date();
    return {
      id: `ser-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now.toISOString(),
      epochMs: now.getTime(),
      temperatureC: acc.temperatureC,
      temperatureValid: acc.temperatureValid,
      vibrationMs2: acc.vibrationMs2,
      vibrationSimulated: acc.vibrationSimulated,
      servoAngleDeg: acc.servoAngleDeg,
      servoVerified: acc.servoVerified,
      oledVerified: acc.oledVerified,
      alertActive: acc.alertActive,
      wifiConnected: acc.wifiConnected,
      ipAddress: acc.ipAddress,
      gatewayIp: acc.gatewayIp,
      subnetMask: acc.subnetMask,
      wifiSsid: acc.wifiSsid,
      layerCount: null,
      source: 'web-serial',
    };
  }

  return null;
}

export const ESP32_PINOUT_MAPPING = [
  {
    component: 'DS18B20 Temperature Sensor',
    gpio: 'GPIO 4 (ONE_WIRE_BUS)',
    protocol: '1-Wire (10-bit async, 1000 ms)',
    role: 'Primary thermal monitor; >= 40.0 °C triggers hardware alarm',
  },
  {
    component: 'SSD1306 128x64 OLED',
    gpio: 'GPIO 21 (SDA), GPIO 22 (SCL)',
    protocol: 'I2C (0x3C / fallback 0x3D)',
    role: 'Local status readout every 1000 ms',
  },
  {
    component: 'SG90 Micro Servo',
    gpio: 'GPIO 18 (SERVO_PIN)',
    protocol: '50 Hz PWM (500–2400 us)',
    role: 'Continuous 0°–180° sweep (2° step every 20 ms)',
  },
  {
    component: 'Green Status LED',
    gpio: 'GPIO 26 (GREEN_LED)',
    protocol: 'Digital Output',
    role: 'HIGH during normal operation (< 40.0 °C)',
  },
  {
    component: 'Red Alert LED',
    gpio: 'GPIO 27 (RED_LED)',
    protocol: 'Digital Output',
    role: 'HIGH when temperatureC >= 40.0 °C',
  },
  {
    component: 'Active Buzzer',
    gpio: 'GPIO 25 (BUZZER_PIN)',
    protocol: 'Digital Output',
    role: 'HIGH audible alarm on thermal threshold breach',
  },
];

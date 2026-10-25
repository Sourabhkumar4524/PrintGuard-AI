# PrintGuard AI — Full-Stack AI + IoT Monitor

Full-stack React + Express + WebSocket monitoring and computer-vision defect detection console for **PrintGuard AI**.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start full-stack Express + WebSocket + Vite dev server on port 3000
npm run dev

# Production build & run
npm run build
npm start
```

Configure `GEMINI_API_KEY` in **Settings > Secrets** (or `.env` locally) to power live server-side computer-vision 3D-print defect detection on `/api/vision/analyze`.

## Connecting Your ESP32

1. **Direct USB Web Serial (No Firmware Edits)**: Plug your ESP32 into USB, close the Arduino Serial Monitor, and click **Connect USB** (`115200` baud) in Chrome or Edge.
2. **Wireless Wi-Fi HTTP POST**: Post JSON readings from your ESP32 `loop()` to `POST /api/telemetry` (see **Setup & Wiring Guide** inside the sidebar for the ready-to-paste `HTTPClient` snippet).

## Built-In Backend Endpoints (`server.ts`)

- `GET /api/health`
- `GET /api/settings` & `PUT /api/settings`
- `GET /api/serial/ports`, `POST /api/serial/connect`, `POST /api/serial/disconnect`
- `POST /api/telemetry` (`POST /api/esp32/telemetry`), `GET /api/telemetry/latest`, `GET /api/telemetry/history`
- `POST /api/vision/analyze` & `POST /api/vision/video/analyze`
- `GET /api/vision/status` & `GET /api/vision/events`
- `GET /api/alerts`, `DELETE /api/alerts`, `POST /api/alerts/:alert_id/acknowledge`
- `GET /api/stats`
- `WS /ws/live`

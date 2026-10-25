# PrintGuard AI — AI + IoT 3D-Printing Monitor

PrintGuard AI is a dark-themed industrial monitoring and defect-detection frontend for 3D-printing prototypes, unifying live ESP32 sensor telemetry, browser webcam capture, computer-vision defect inspection, and physical alert tracking in a dense, operator-focused console. It launches in a clearly marked Demo Mode calibrated to your `40.0 °C` sketch defaults while supporting direct Browser Web Serial USB streaming from your ESP32 and full REST/WebSocket integration with your external local backend.

## User Review & Critical Decisions

> [!IMPORTANT]
> The plan incorporates your confirmed architecture and hardware preferences from clarification. Review the summary below and click **Proceed** when ready to build.

- **Confirmed Decision 1 — Frontend-Only Architecture**: Built strictly as a client-side web application targeting your external local backend (`REST` + `/ws/live` WebSocket) via a configurable base URL, without bundling an internal server. When Demo Mode is turned off and your local backend is offline, the interface displays honest connection diagnostics rather than fabricated values.
- **Confirmed Decision 2 — Direct Browser Web Serial USB Bridge**: Connects directly to your ESP32 over USB (`115200` baud via the Browser Web Serial API) to parse the exact status output printed by your Arduino sketch (`Temperature`, `Simulated vibration`, `Temperature alert`, `Servo angle`, `IP Address`, and `OLED` startup messages), alongside support for your backend's serial endpoints.
- **Confirmed Decision 3 — Labeled Demo Mode Startup with `40.0 °C` Sketch Defaults**: Starts in an explicitly badged **DEMO MODE** pre-configured with your firmware's `40.0 °C` DS18B20 warning threshold so all charts, camera workflows, and test scenarios are immediately interactive, with a single-click switch to live hardware/backend operation.

---

## 1. Overview & Core Concept

- **What It Does**: Provides a centralized mission-control workspace to monitor 3D-printer thermal stability (`DS18B20`), motion/vibration (`MPU6050` or ESP32 sketch simulation), actuator sweep (`SG90 Servo`), physical alarm outputs (`Green/Red LED + Buzzer`), and camera-based print quality (`AI Camera` frame capture and defect analysis).
- **Target Audience / Persona**: Makers, hardware engineers, and additive-manufacturing researchers testing an ESP32 + AI computer-vision defect detection prototype at the workbench.
- **Key Value**: Bridges microcontroller serial telemetry and vision model inference in one honest, high-contrast console—strictly separating verified sensor warnings, genuine vision model detections, and simulated demo checks so operators never mistake threshold alerts or demo data for confirmed print failures.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Immediate Dashboard Assessment & Demo Scenario Execution**
   - On launch, the operator lands on the **Production Dashboard** with a prominent **DEMO MODE** indicator in the sidebar footer and top workspace.
   - The **System Status Banner** reflects overall prototype health (`NORMAL` in emerald when within bounds, shifting to `WARNING` or `CRITICAL` in amber/crimson with explicit cause attribution when temperature, vibration, or vision thresholds trigger).
   - Clicking **Run Demo Check** executes a clearly labeled multi-step test scenario (thermal spike or simulated visual anomaly) that walks through the Alert Decision Logic and logs a demo-tagged event in Alert History without claiming hardware detection.
2. **Live ESP32 USB Telemetry via Browser Web Serial**
   - Opening **Hardware** (or using the quick connection control) lets the operator click **Connect ESP32 via USB Serial** (`115200` baud).
   - Once authorized in the browser port picker, PrintGuard AI disables Demo Mode (or switches to live serial stream) and parses incoming `------ LIVE STATUS ------` blocks in real time—updating DS18B20 temperature, sketch-simulated vibration (`m/s²`), `TEMP_WARNING_C` (`40.0 °C`) LED/buzzer alert state, `0°–180°` SG90 servo sweep angle, and Wi-Fi IP status.
3. **Webcam Streaming, Frame Capture & Vision Defect Inspection**
   - In the **AI Camera** panel (on the Dashboard or full-screen **AI Camera** page), the operator starts the laptop webcam via `getUserMedia`, captures a still frame (or uploads a `.jpg`/`.jpeg`/`.png`), and clicks **Analyze Frame**.
   - When connected to the external local backend, the image is sent to `/api/vision/analyze` and displays returned annotated imagery, detected class, confidence gauge, and inference latency. If the vision backend is offline, a clear status message explains that no model host is reachable; in Demo Mode, a separate **Simulate Defect (Demo)** action allows testing UI overlays with an explicit `SIMULATED` badge.
4. **Historical Investigation, Alert Triage & Calibration**
   - Operators switch seamlessly via the left sidebar across **Dashboard**, **AI Camera**, **Sensors** (dual-axis historical trends & sensor health), **Hardware** (6 component cards, USB Web Serial monitor, and backend serial port controls), **Alerts** (searchable, severity-filtered table with confirmation-guarded Acknowledge and Clear actions), and **System Settings** (editable backend URL, temperature/vibration/AI thresholds, frame interval, alert cooldown, and Demo Mode toggle).

### Visual Identity & Theme

- **Aesthetic Direction**: Compact, utilitarian industrial telemetry console inspired by precision lab and CNC/additive-manufacturing instrumentation—dense information panels, crisp geometric alignment, thin blue-gray borders, and zero decorative clutter.
- **Color Palette & Mood (60-30-10 Discipline)**:
  - *60% Dominant Canvas*: Deep navy-obsidian workspace (`#070B14` / `--background`) with a darker anchored sidebar (`#050811`).
  - *30% Structural Surfaces*: Elevated dark slate-navy cards (`#0F172A` / `--card`) bounded by `1px` blue-gray hairline borders (`#1E293B` / `--border`), crisp white headings (`#F8FAFC`), and muted slate secondary labels (`#94A3B8`).
  - *10% Precision Accents & Semantic States*: Cyan/blue interactive highlights (`#06B6D4` / `#3B82F6`), paired with non-hue-only semantic status indicators (always accompanied by explicit text labels and icons):
    - **Normal / Connected / Ready**: Emerald (`#10B981`)
    - **Warning / Threshold / Demo**: Amber (`#F59E0B`)
    - **Critical / Defect / Disconnected Error**: Crimson-Red (`#EF4444`)
- **Typography & Hierarchy**:
  - *UI & Headings*: `Plus Jakarta Sans` in tight, industrial scale (`18px–22px` page titles, `13px–14px` card titles, `12px` dense controls) with balanced headline wrapping.
  - *Telemetry & Metrics*: `JetBrains Mono` with `tabular-nums` (`font-variant-numeric: tabular-nums`) across all live readings (`°C`, `m/s²`, `%`, `deg`, `ms`), thresholds, layer counts, IP addresses, and alert timestamps so numbers never shift horizontally as readings update.
- **Component Styling & Layout**:
  - Desktop-first `1440px` layout featuring a fixed `248px` left vertical sidebar and a scrollable main canvas that adapts cleanly to 2-column tablet and 1-column mobile viewports without horizontal overflow.
  - Dashboard grid structure:
    1. **Top Header**: Title, subtitle, live ESP32 connection status, **Refresh**, and **Run Demo Check**.
    2. **System Status Banner**: Full-width operational summary with active layer counter (when in Demo Mode) or exact fault/disconnection reason.
    3. **5-Card Metric Strip**: `Temperature (DS18B20)`, `Vibration (MPU6050 / Sketch Sim)`, `AI Confidence` (semicircular SVG gauge), `Actuator (SG90 Servo)`, and `AI Detection Result`.
    4. **Main Telemetry & Vision Split**: Left/center column housing the dual-axis **Sensor Trend** Recharts graph, **AI Camera** panel, and **Alert Decision Logic** node-flow diagram; right column housing the chronological **Alert History** timeline.
    5. **Hardware Status Strip**: Horizontal 6-card collection (`ESP32`, `MPU6050`, `DS18B20`, `SSD1306 OLED`, `SG90 Servo`, `LED + Buzzer`).

### Interactive Feedback & Motion

- **Snappy Instrumentation Response**: `150ms` opacity/transform hover and active transitions on controls; zero layout-shifting animations.
- **Honest Loading, Offline & Empty States**: Spinner/progress bar during frame analysis, structured empty states when alert history or telemetry buffers are empty, confirmation modal before clearing alerts, and non-blocking toast notifications for settings updates, USB connection events, and acknowledgements.
- **Media & Serial Cleanup**: Automatic release of webcam `MediaStreamTrack`s and graceful closing of `SerialPort` readers when stopping feeds or leaving the page.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual Hardware Ingestion (Browser Web Serial + External Backend API)**
  - *Chosen Approach*: Support direct in-browser USB reading via `navigator.serial` tailored to your Arduino sketch's `115200`-baud serial output, while also wiring the dedicated REST/WebSocket client for `/api/serial/*`, `/api/telemetry/*`, and `/ws/live`.
  - *Why*: Your current ESP32 code outputs rich status blocks over USB Serial without needing firmware changes, while keeping the frontend 100% ready for your local Python/Node vision and telemetry server. *(Note: Because some sandboxed preview iframes restrict Web Serial until opened in a top-level browser tab, the Hardware page will also detect iframe/browser support and provide a one-click "Open in Full Tab" hint if blocked by browser policy).*
  - *Alternatives Considered*: Requiring Wi-Fi firmware modifications before testing—passed over because direct Web Serial works immediately with your existing ESP32 sketch.

- **Decision 2: Strict Provenance & Verification Boundaries**
  - *Chosen Approach*: Tag every reading and alert with its true source (`LIVE SERIAL`, `LIVE BACKEND`, or `DEMO SIMULATED`), and mark `SSD1306 OLED` and `SG90 Servo` states as `UNVERIFIED` / `STANDBY` unless explicitly reported by the serial parser or backend telemetry. Furthermore, mirror your sketch's rule where vibration readings from the ESP32 sketch are labeled as firmware-simulated and do not falsely claim verified MPU6050 hardware defects.
  - *Why*: Prevents misleading operators during hardware debugging and satisfies strict engineering integrity.

- **Decision 3: Dual-Axis Sensor Trend Visualization**
  - *Chosen Approach*: Render Temperature (`°C`, left Y-axis, `0–60+ °C` range with `40.0 °C` reference threshold) and Vibration (`m/s²`, right Y-axis, `0.0–2.0 m/s²` range) on independent calibrated axes in Recharts with time-range filtering (`1m`, `5m`, `15m`, `All`).
  - *Why*: Temperature (`~25–45 °C`) and acceleration (`~0.15–1.30 m/s²`) differ by nearly two orders of magnitude; plotting them on a single axis would flatten vibration spikes into an unreadable line.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                        PrintGuard AI Frontend Console                        │
├──────────────────┬───────────────────────────────────────────────────────────┤
│   AppSidebar     │  Main Workspace (React Router Views)                      │
│  ┌────────────┐  │  ┌─────────────────────────────────────────────────────┐  │
│  │ Navigation │  │  │ DashboardHeader + SystemStatusBanner                │  │
│  │ • Dashboard│  │  ├─────────────────────────────────────────────────────┤  │
│  │ • AI Camera│  │  │ 1. Dashboard: 5 MetricCards • SensorTrendChart      │  │
│  │ • Sensors  │  │  │    AICameraPanel • AlertDecisionFlow • AlertHistory │  │
│  │ • Hardware │  │  │    6 HardwareStatusCards                            │  │
│  │ • Alerts   │  │  │ 2. AI Camera: Full Viewport, Upload, Detections     │  │
│  │ • Settings │  │  │ 3. Sensors: Dual-Axis History, Thresholds, Health   │  │
│  ├────────────┤  │  │ 4. Hardware: USB Web Serial + Backend Port Controls │  │
│  │ Live Status│  │  │ 5. Alerts: Searchable & Severity-Filtered Log Table │  │
│  │ • ESP32    │  │  │ 6. System Settings: Thresholds, API URL, Demo Mode  │  │
│  │ • AI Host  │  │  └──────────────────────────┬──────────────────────────┘  │
│  │ • DEMO TAG │  │                             │                             │
│  └────────────┘  │                             ▼                             │
├──────────────────┴───────────────────────────────────────────────────────────┤
│                 Unified Telemetry, Vision & Settings Context                 │
│   • Provenance Tracking (Demo vs. USB Web Serial vs. Backend API/WS)         │
│   • Threshold Evaluator & Alert Timeline Manager                             │
└────────┬───────────────────────────────┬────────────────────────────┬────────┘
         │                               │                            │
         ▼                               ▼                            ▼
┌─────────────────────┐    ┌──────────────────────────┐    ┌───────────────────┐
│ Browser Hardware IO │    │ External Backend Service │    │ Deterministic     │
│ • Web Serial API    │    │ • REST (/api/health,     │    │ Demo Engine       │
│   (115200 ESP32)    │    │   /settings, /telemetry, │    │ • 40.0°C Default  │
│ • MediaDevices API  │    │   /vision/*, /alerts)    │    │ • Demo Check Run  │
│   (Laptop Webcam)   │    │ • WebSocket (/ws/live)   │    │ • Defect Sim      │
└─────────────────────┘    └──────────────────────────┘    └───────────────────┘
```

### Data Model & State

- **Telemetry Snapshot**: Timestamp, `temperatureC` (nullable when `Sensor unavailable`), `temperatureValid`, `vibrationMs2` (with `isSimulated` flag), `servoAngleDeg` (`0–180` or unverified), `alertActive` (hardware LED/buzzer state), `wifiConnected`, `ipAddress`, `layerCount` (demo only), and `source` (`demo` | `web-serial` | `backend`).
- **Vision Inference Record**: `id`, `timestamp`, `detectedClass` (e.g., `Normal`, `Spaghetti`, `Layer Shift`, `Warping`, `Stringing`), `confidence` (`0–100%`), `latencyMs`, `explanation`, `annotatedImageUrl`, and `isSimulated`.
- **Hardware Status Registry**: Keyed states (`CONNECTED`, `ACTIVE`, `READY`, `STANDBY`, `WARNING`, `ERROR`, `DISCONNECTED`, `UNVERIFIED`) + `lastUpdated` timestamps for `ESP32`, `MPU6050`, `DS18B20`, `SSD1306 OLED`, `SG90 Servo`, and `LED + Buzzer`.
- **Alert Event**: `id`, `timestamp`, `title`, `severity` (`info` | `warning` | `critical`), `category` (`sensor` | `vision` | `hardware` | `demo`), `description`, and `acknowledged` boolean.
- **System Settings**: `apiBaseUrl`, `wsUrl`, `tempWarningC` (default `40.0`), `vibrationWarningMs2` (default `1.00`), `aiConfidenceThreshold` (default `75%`), `cameraIntervalSec` (default `5`), `alertCooldownSec` (default `15`), and `demoMode` (default `true`). Synced with `GET/PUT /api/settings` when the backend is reachable and cached locally so settings survive page reloads.

### Interactive Component & State Mapping

- **Header Refresh & Run Demo Check**: `Refresh` re-polls `/api/health`, `/api/telemetry/latest`, `/api/vision/status`, and `/api/alerts` (or refreshes the active stream snapshot) with loading feedback; `Run Demo Check` steps through a 6-second clearly badged thermal + visual check sequence and appends a `[DEMO]` alert entry.
- **Web Serial Stream Parser**: Buffers incoming UTF-8 serial chunks from `navigator.serial`, extracts key-value readings from your ESP32 `LIVE STATUS` and `WIFI DETAILS` serial blocks, updates live cards and trend history every 500–1000 ms, and auto-generates threshold alerts when `Temperature >= tempWarningC` or `Temperature: Sensor unavailable`.
- **AI Camera Lifecycle**: Manages `Idle → Requesting Permission → Streaming → Frame Captured / Image Uploaded → Analyzing → Result / Error`. Releases camera tracks immediately on **Stop Webcam** or route unmount.
- **WebSocket Reconnection (`/ws/live`)**: Uses exponential backoff (`1s → 2s → 4s → 10s max`) when Demo Mode is off and a backend URL is configured, deduplicating incoming alert and telemetry IDs on reconnect.
- **Alert Governance**: Individual **Acknowledge** buttons call `POST /api/alerts/{id}/acknowledge` (with optimistic UI update in Demo/Serial mode), while **Clear Alerts** opens a `ConfirmDialog` before purging acknowledged/demo entries.

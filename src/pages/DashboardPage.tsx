import React from 'react';
import { Activity, Gauge, ScanEye, Thermometer } from 'lucide-react';
import { AICameraPanel } from '../components/AICameraPanel';
import { AIDetectionResult } from '../components/AIDetectionResult';
import { AlertDecisionFlow } from '../components/AlertDecisionFlow';
import { AlertHistory } from '../components/AlertHistory';
import { DashboardHeader } from '../components/DashboardHeader';
import { HardwareStatusCard } from '../components/HardwareStatusCard';
import { MetricCard } from '../components/MetricCard';
import { SensorTrendChart } from '../components/SensorTrendChart';
import { SystemStatusBanner } from '../components/SystemStatusBanner';
import { usePrintGuard } from '../context/PrintGuardContext';

interface DashboardPageProps {
  onOpenMobileMenu: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenMobileMenu,
}) => {
  const {
    activeSource,
    latestTelemetry,
    telemetryHistory,
    latestVision,
    visionStatus,
    hardwareComponents,
    unacknowledgedCount,
    settings,
    updateSettings,
  } = usePrintGuard();

  const isDemo = activeSource === 'demo';
  const isOffline = activeSource === 'offline';

  const tempVal =
    latestTelemetry && latestTelemetry.temperatureValid
      ? latestTelemetry.temperatureC
      : null;

  const vibVal = latestTelemetry ? latestTelemetry.vibrationMs2 : null;

  const actuatorState: 'RUNNING' | 'STANDBY' | 'DISCONNECTED' = isOffline
    ? 'DISCONNECTED'
    : latestTelemetry?.servoVerified
    ? 'RUNNING'
    : 'STANDBY';

  const actuatorLatestAction = isOffline
    ? 'Controller disconnected'
    : latestTelemetry?.servoVerified
    ? `Sweep 0°–180° (${latestTelemetry.servoAngleDeg ?? 0}°)`
    : isDemo
    ? `Demo sweep (${latestTelemetry?.servoAngleDeg ?? 0}°) · Unverified`
    : 'Awaiting verified servo state';

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Production Dashboard"
        subtitle="Real-time sensor health, camera analysis and physical alert control."
        onOpenMobileMenu={onOpenMobileMenu}
      />

      {/* System Status Banner */}
      <SystemStatusBanner />

      {/* 5 Sensor & AI Metric Cards */}
      <section
        aria-label="Key telemetry and AI metrics"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5"
      >
        <MetricCard
          variant="threshold"
          title="Temperature"
          sensorName="DS18B20"
          value={tempVal}
          unit="°C"
          threshold={settings.tempWarningC}
          maxScale={Math.max(60, settings.tempWarningC * 1.4)}
          icon={Thermometer}
          isSimulated={isDemo}
          simulatedLabel="DEMO"
          unavailableText={isOffline ? 'Disconnected' : 'Sensor error'}
        />

        <MetricCard
          variant="threshold"
          title="Vibration"
          sensorName="MPU6050"
          value={vibVal}
          unit="m/s²"
          threshold={settings.vibrationWarningMs2}
          maxScale={Math.max(2.0, settings.vibrationWarningMs2 * 1.6)}
          icon={Activity}
          isSimulated={isDemo || Boolean(latestTelemetry?.vibrationSimulated)}
          simulatedLabel={isDemo ? 'DEMO' : 'FW SIM'}
          unavailableText="Disconnected"
        />

        <MetricCard
          variant="gauge"
          title="AI Confidence"
          confidence={latestVision ? latestVision.confidence : null}
          detectedClass={
            latestVision ? latestVision.detectedClass : 'No active inference'
          }
          icon={ScanEye}
          isSimulated={Boolean(latestVision?.isSimulated)}
          isDefect={Boolean(latestVision?.isDefect)}
        />

        <MetricCard
          variant="actuator"
          title="Actuator"
          stateLabel={actuatorState}
          latestAction={actuatorLatestAction}
          alertCount={unacknowledgedCount}
          servoAngle={latestTelemetry?.servoAngleDeg ?? null}
          isVerified={Boolean(latestTelemetry?.servoVerified) && !isDemo}
          isDemo={isDemo}
          icon={Gauge}
        />

        <AIDetectionResult
          result={latestVision}
          visionStatus={visionStatus}
          demoMode={isDemo}
        />
      </section>

      {/* Main Workspace Split: Left/Center Telemetry + Camera + Logic | Right Alert History */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        <div className="xl:col-span-8 space-y-4">
          <SensorTrendChart
            history={telemetryHistory}
            tempWarningC={settings.tempWarningC}
            vibrationWarningMs2={settings.vibrationWarningMs2}
            activeSource={activeSource}
            onEnableDemo={
              !settings.demoMode
                ? () => void updateSettings({ demoMode: true })
                : undefined
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
            <AICameraPanel />
            <AlertDecisionFlow />
          </div>
        </div>

        <div className="xl:col-span-4">
          <AlertHistory maxItems={9} />
        </div>
      </div>

      {/* Bottom Horizontal Collection of 6 Hardware Status Cards */}
      <section aria-label="Hardware component status">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <h3 className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
            Hardware Component Status
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            {isDemo
              ? 'Demo states labeled · Unverified peripherals marked STANDBY/UNVERIFIED'
              : 'Showing verified controller & sensor states'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {hardwareComponents.map((comp) => (
            <HardwareStatusCard key={comp.id} component={comp} />
          ))}
        </div>
      </section>
    </div>
  );
};

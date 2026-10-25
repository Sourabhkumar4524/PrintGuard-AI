/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppSidebar } from './components/AppSidebar';
import { SetupGuideModal } from './components/SetupGuideModal';
import { ToastNotifications } from './components/ToastNotifications';
import { PrintGuardProvider, usePrintGuard } from './context/PrintGuardContext';
import { AICameraPage } from './pages/AICameraPage';
import { AlertsPage } from './pages/AlertsPage';
import { DashboardPage } from './pages/DashboardPage';
import { HardwarePage } from './pages/HardwarePage';
import { SensorsPage } from './pages/SensorsPage';
import { SettingsPage } from './pages/SettingsPage';

const PrintGuardShell: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { settings } = usePrintGuard();

  return (
    <div className="min-h-screen w-full bg-[#070B14] text-slate-100 flex">
      <AppSidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <main
        className={`flex-1 min-w-0 ${
          settings.compactDensity ? 'p-4 lg:p-5' : 'p-5 lg:p-7'
        }`}
      >
        <div className="max-w-[1440px] mx-auto">
          <Routes>
            <Route
              path="/"
              element={
                <DashboardPage
                  onOpenMobileMenu={() => setMobileMenuOpen(true)}
                />
              }
            />
            <Route
              path="/camera"
              element={
                <AICameraPage
                  onOpenMobileMenu={() => setMobileMenuOpen(true)}
                />
              }
            />
            <Route
              path="/sensors"
              element={
                <SensorsPage
                  onOpenMobileMenu={() => setMobileMenuOpen(true)}
                />
              }
            />
            <Route
              path="/hardware"
              element={
                <HardwarePage
                  onOpenMobileMenu={() => setMobileMenuOpen(true)}
                />
              }
            />
            <Route
              path="/alerts"
              element={
                <AlertsPage
                  onOpenMobileMenu={() => setMobileMenuOpen(true)}
                />
              }
            />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  onOpenMobileMenu={() => setMobileMenuOpen(true)}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      <ToastNotifications />
      <SetupGuideModal />
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <PrintGuardProvider>
        <PrintGuardShell />
      </PrintGuardProvider>
    </BrowserRouter>
  );
}

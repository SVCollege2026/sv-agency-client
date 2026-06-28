import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import AnalyticsLayout from "./components/AnalyticsLayout.jsx";
import StrategyLayout from "./components/StrategyLayout.jsx";
import PortalHome from "./pages/PortalHome.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import EcosystemPage from "./pages/EcosystemPage.jsx";
import CampaignManagementPage from "./pages/CampaignManagementPage.jsx";
import ForecastingPage from "./pages/ForecastingPage.jsx";
import GoalsPage from "./pages/GoalsPage.jsx";
import { ToastProvider } from "./components/campaign/Toast.jsx";

export default function App() {
  return (
    <ToastProvider>
    <Routes>
      {/* All routes share the global Layout (fixed top bar + bug button) */}
      <Route element={<Layout />}>

        {/* Portal home — department selector */}
        <Route index element={<PortalHome />} />

        {/* Analytics department — current scope: dashboard, executive, saved reports. */}
        <Route path="/analytics" element={<AnalyticsLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"  element={<Dashboard />} />
          <Route path="ecosystem"  element={<EcosystemPage />} />
          <Route path="reports"    element={<ReportsPage />} />
        </Route>

        {/* Campaign Management — canonical (Spec 03 §2.2). */}
        <Route path="/campaign-management"  element={<CampaignManagementPage />} />
        <Route path="/media-reports"        element={<CampaignManagementPage />} />

        {/* Strategy department — חיזוי + יעדים פעילים */}
        <Route path="/strategy" element={<StrategyLayout />}>
          <Route index element={<Navigate to="forecasting" replace />} />
          <Route path="forecasting" element={<ForecastingPage />} />
          <Route path="goals"       element={<GoalsPage />} />
        </Route>

        {/* Legacy redirects */}
        <Route path="/forecasting"     element={<Navigate to="/strategy/forecasting" replace />} />
        <Route path="/dashboard"       element={<Navigate to="/analytics/dashboard" replace />} />
        <Route path="/reports"         element={<Navigate to="/analytics/reports"   replace />} />
        <Route path="/analysis"        element={<Navigate to="/analytics/dashboard" replace />} />
        <Route path="/goals"           element={<Navigate to="/analytics/dashboard" replace />} />
        <Route path="/analytics/goals" element={<Navigate to="/analytics/dashboard" replace />} />
        <Route path="/media"           element={<Navigate to="/" replace />} />
        <Route path="/manager"         element={<Navigate to="/" replace />} />

      </Route>
    </Routes>
    </ToastProvider>
  );
}

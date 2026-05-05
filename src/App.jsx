import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import AnalyticsLayout from "./components/AnalyticsLayout.jsx";
import PortalHome from "./pages/PortalHome.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import EcosystemPage from "./pages/EcosystemPage.jsx";
import MediaReportsPage from "./pages/MediaReportsPage.jsx";
import ForecastingPage from "./pages/ForecastingPage.jsx";

export default function App() {
  return (
    <Routes>
      {/* All routes share the global Layout (fixed top bar + bug button) */}
      <Route element={<Layout />}>

        {/* Portal home — department selector */}
        <Route index element={<PortalHome />} />

        {/* Analytics department — current scope: dashboard, executive, saved reports.
            ניתוח שלב 0 / ניתוח נקודתי / יעדים הוסרו (ראה AnalyticsLayout.jsx + README). */}
        <Route path="/analytics" element={<AnalyticsLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"  element={<Dashboard />} />
          <Route path="ecosystem"  element={<EcosystemPage />} />
          <Route path="reports"    element={<ReportsPage />} />
        </Route>

        {/* Media department — phase A: only the reports page */}
        <Route path="/media-reports" element={<MediaReportsPage />} />

        {/* Strategy department — Forecasting (Phase 1+2) */}
        <Route path="/forecasting" element={<ForecastingPage />} />

        {/* Legacy redirects — old bookmarks → לעמודים הקיימים */}
        <Route path="/dashboard"           element={<Navigate to="/analytics/dashboard" replace />} />
        <Route path="/reports"             element={<Navigate to="/analytics/reports"   replace />} />
        <Route path="/analysis"            element={<Navigate to="/analytics/dashboard" replace />} />
        <Route path="/goals"               element={<Navigate to="/analytics/dashboard" replace />} />
        <Route path="/analytics/analysis"    element={<Navigate to="/analytics/dashboard" replace />} />
        <Route path="/analytics/quick-table" element={<Navigate to="/analytics/dashboard" replace />} />
        <Route path="/analytics/goals"       element={<Navigate to="/analytics/dashboard" replace />} />

      </Route>
    </Routes>
  );
}

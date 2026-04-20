import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import AnalyticsLayout from "./components/AnalyticsLayout.jsx";
import PortalHome from "./pages/PortalHome.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AnalysisPage from "./pages/AnalysisPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import GoalsPage from "./pages/GoalsPage.jsx";
import EcosystemPage from "./pages/EcosystemPage.jsx";
import MediaReportsPage from "./pages/MediaReportsPage.jsx";

export default function App() {
  return (
    <Routes>
      {/* All routes share the global Layout (fixed top bar + bug button) */}
      <Route element={<Layout />}>

        {/* Portal home — department selector */}
        <Route index element={<PortalHome />} />

        {/* Analytics department */}
        <Route path="/analytics" element={<AnalyticsLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"  element={<Dashboard />} />
          <Route path="analysis"   element={<AnalysisPage />} />
          <Route path="ecosystem"  element={<EcosystemPage />} />
          <Route path="reports"    element={<ReportsPage />} />
          <Route path="goals"      element={<GoalsPage />} />
        </Route>

        {/* Media department — phase A: only the reports page */}
        <Route path="/media-reports" element={<MediaReportsPage />} />

        {/* Legacy redirects — keep old bookmarks working */}
        <Route path="/dashboard" element={<Navigate to="/analytics/dashboard" replace />} />
        <Route path="/analysis"  element={<Navigate to="/analytics/analysis"  replace />} />
        <Route path="/reports"   element={<Navigate to="/analytics/reports"   replace />} />
        <Route path="/goals"     element={<Navigate to="/analytics/goals"     replace />} />

      </Route>
    </Routes>
  );
}

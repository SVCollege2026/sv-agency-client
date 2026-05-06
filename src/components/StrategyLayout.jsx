/**
 * StrategyLayout.jsx — Layout למחלקת אסטרטגיה
 * ============================================
 * שכבת ניווט פנימית למחלקת אסטרטגיה. כיום פעיל רק "חיזוי" — עוד מודולים
 * (יעדים, 3 תרחישים, המלצות) יתווספו בהמשך.
 *
 * מבנה:
 *   /strategy              → redirect ל-/strategy/forecasting
 *   /strategy/forecasting  → ForecastingPage (קיים)
 *   /strategy/goals        → (בפיתוח — מצריך תוצרי חקירה ראשונים)
 *   /strategy/scenarios    → (בפיתוח — דורש יעדים מוגדרים)
 *   /strategy/recommendations → (בפיתוח — דורש יעדים + פערים)
 */
import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";

const TABS = [
  { id: "forecasting",     label: "חיזוי",        path: "/strategy/forecasting",     active: true  },
  { id: "goals",           label: "יעדים",        path: "/strategy/goals",           active: false },
  { id: "scenarios",       label: "תרחישים",      path: "/strategy/scenarios",       active: false },
  { id: "recommendations", label: "המלצות",       path: "/strategy/recommendations", active: false },
];

export default function StrategyLayout() {
  const loc = useLocation();

  return (
    <div dir="rtl" style={{ minHeight: "calc(100vh - 56px)", background: "#f8fafc" }}>
      {/* ── Sub-nav ── */}
      <nav
        style={{
          background:    "#ffffff",
          borderBottom:  "1px solid #e5e7eb",
          padding:       "0 24px",
          display:       "flex",
          alignItems:    "center",
          gap:           4,
          height:        48,
          overflowX:     "auto",
        }}
      >
        <span style={{
          fontSize: 13, fontWeight: 700, color: "#0f172a",
          paddingLeft: 16, borderLeft: "1px solid #e5e7eb", marginLeft: 8,
        }}>
          🧭 מחלקת אסטרטגיה
        </span>
        {TABS.map((t) => {
          if (!t.active) {
            return (
              <span
                key={t.id}
                title="בפיתוח — דורש תוצרי חקירה / יעדים מוגדרים"
                style={{
                  padding:       "8px 14px",
                  fontSize:      13,
                  color:         "#94a3b8",
                  cursor:        "not-allowed",
                  borderRadius:  6,
                }}
              >
                {t.label} <span style={{ fontSize: 10, color: "#cbd5e1", marginRight: 4 }}>(בפיתוח)</span>
              </span>
            );
          }
          const isActive = loc.pathname.startsWith(t.path);
          return (
            <NavLink
              key={t.id}
              to={t.path}
              style={{
                padding:       "8px 14px",
                fontSize:      13,
                fontWeight:    600,
                color:         isActive ? "#1d4ed8" : "#475569",
                textDecoration: "none",
                borderRadius:  6,
                background:    isActive ? "#eff6ff" : "transparent",
                transition:    "all 0.15s",
              }}
            >
              {t.label}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Page content ── */}
      <div>
        <Outlet />
      </div>
    </div>
  );
}

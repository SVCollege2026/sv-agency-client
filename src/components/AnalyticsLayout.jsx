/**
 * AnalyticsLayout.jsx — shell של מחלקת אנליזה
 * Secondary nav: לוח בקרה · ניתוח שלב 0 · ניתוח נקודתי · אקו-סיסטם · דוחות · יעדים
 */
import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

const NAV = [
  { to: "/analytics/dashboard",   icon: "📊", label: "לוח בקרה"      },
  { to: "/analytics/analysis",    icon: "⚙️",  label: "ניתוח שלב 0"   },
  { to: "/analytics/quick-table", icon: "🎯", label: "ניתוח נקודתי" },
  { to: "/analytics/ecosystem",   icon: "🌐", label: "אקו-סיסטם"    },
  { to: "/analytics/reports",     icon: "📄", label: "דוחות"        },
  { to: "/analytics/goals",       icon: "🚀", label: "יעדים"        },
];

export default function AnalyticsLayout() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "calc(100vh - 56px)", background: "#ffffff", direction: "rtl" }}>

      {/* ── Secondary nav ── */}
      <div
        style={{
          background:   "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          padding:      "0 16px",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "space-between",
        }}
      >
        <nav className="secondary-nav" style={{ flex: 1 }}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display:        "inline-flex",
                alignItems:     "center",
                gap:            5,
                padding:        "11px 14px",
                fontSize:       13,
                fontWeight:     isActive ? 600 : 400,
                color:          isActive ? "#1e40af" : "#64748b",
                borderBottom:   isActive ? "2px solid #1e3a5f" : "2px solid transparent",
                textDecoration: "none",
                whiteSpace:     "nowrap",
                transition:     "color 0.15s",
                flexShrink:     0,
              })}
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          5,
            padding:      "7px 12px",
            marginRight:  8,
            fontSize:     12,
            color:        "#64748b",
            background:   "#ffffff",
            border:       "1px solid #cbd5e1",
            borderRadius: 7,
            cursor:       "pointer",
            whiteSpace:   "nowrap",
            flexShrink:   0,
            transition:   "color 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#1e40af"; e.currentTarget.style.borderColor = "#1e3a5f"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
          title="חזרה לפורטל הראשי"
        >
          ⌂ פורטל
        </button>
      </div>

      <Outlet />
    </div>
  );
}

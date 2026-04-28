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
    <div style={{ minHeight: "calc(100vh - 56px)", background: "#060d1a", direction: "rtl" }}>

      {/* ── Secondary nav ── */}
      <div
        style={{
          background:   "#0a1628",
          borderBottom: "1px solid #1e293b",
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
                color:          isActive ? "#93c5fd" : "#64748b",
                borderBottom:   isActive ? "2px solid #3b82f6" : "2px solid transparent",
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
            color:        "#475569",
            background:   "none",
            border:       "1px solid #1e293b",
            borderRadius: 7,
            cursor:       "pointer",
            whiteSpace:   "nowrap",
            flexShrink:   0,
            transition:   "color 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#93c5fd"; e.currentTarget.style.borderColor = "#3b82f6"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#475569"; e.currentTarget.style.borderColor = "#1e293b"; }}
          title="חזרה לפורטל הראשי"
        >
          ⌂ פורטל
        </button>
      </div>

      <Outlet />
    </div>
  );
}

/**
 * AnalyticsLayout.jsx — shell של מחלקת אנליזה
 * Secondary nav: לוח בקרה · ניתוח (▾ שלב 0 / נקודתי) · אקו-סיסטם · דוחות · יעדים
 */
import React, { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

const NAV = [
  { to: "/analytics/dashboard",  icon: "📊", label: "לוח בקרה" },
  {
    icon: "⚙️",
    label: "ניתוח",
    children: [
      { to: "/analytics/analysis",    label: "ניתוח שלב 0" },
      { to: "/analytics/quick-table", label: "ניתוח נקודתי" },
    ],
  },
  { to: "/analytics/ecosystem", icon: "🌐", label: "אקו-סיסטם" },
  { to: "/analytics/reports",   icon: "📄", label: "דוחות"     },
  { to: "/analytics/goals",     icon: "🎯", label: "יעדים"     },
];

function NavItem({ item }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Single-link item
  if (item.to) {
    return (
      <NavLink
        to={item.to}
        style={({ isActive }) => ({
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "11px 14px",
          fontSize: 13,
          fontWeight: isActive ? 600 : 400,
          color: isActive ? "#93c5fd" : "#64748b",
          borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
        })}
      >
        <span>{item.icon}</span>
        {item.label}
      </NavLink>
    );
  }

  // Dropdown item — has children
  const isActiveBranch = (item.children || []).some((c) =>
    location.pathname.startsWith(c.to)
  );

  return (
    <span
      style={{ position: "relative" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "11px 14px",
          fontSize: 13,
          fontWeight: isActiveBranch ? 600 : 400,
          color: isActiveBranch ? "#93c5fd" : "#64748b",
          borderBottom: isActiveBranch ? "2px solid #3b82f6" : "2px solid transparent",
          whiteSpace: "nowrap",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span>{item.icon}</span>
        {item.label}
        <span style={{ fontSize: 10, marginRight: 2, opacity: 0.7 }}>▾</span>
      </span>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            background: "#0f1d33",
            border: "1px solid #1e293b",
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
            minWidth: 160,
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              style={({ isActive }) => ({
                display: "block",
                padding: "9px 14px",
                fontSize: 13,
                color: isActive ? "#93c5fd" : "#94a3b8",
                background: isActive ? "#1e293b" : "transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "background 0.1s",
              })}
              onMouseEnter={(e) => {
                if (!e.currentTarget.style.background.includes("rgb(30, 41, 59)")) {
                  e.currentTarget.style.background = "#172033";
                }
              }}
              onMouseLeave={(e) => {
                const isActive = location.pathname.startsWith(child.to);
                e.currentTarget.style.background = isActive ? "#1e293b" : "transparent";
              }}
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </span>
  );
}

export default function AnalyticsLayout() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "calc(100vh - 56px)", background: "#060d1a", direction: "rtl" }}>
      <div
        style={{
          background: "#0a1628",
          borderBottom: "1px solid #1e293b",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <nav className="secondary-nav" style={{ flex: 1 }}>
          {NAV.map((item) => (
            <NavItem key={item.label} item={item} />
          ))}
        </nav>

        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "7px 12px",
            marginRight: 8,
            fontSize: 12,
            color: "#475569",
            background: "none",
            border: "1px solid #1e293b",
            borderRadius: 7,
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#93c5fd";
            e.currentTarget.style.borderColor = "#3b82f6";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#475569";
            e.currentTarget.style.borderColor = "#1e293b";
          }}
          title="חזרה לפורטל הראשי"
        >
          ⌂ פורטל
        </button>
      </div>

      <Outlet />
    </div>
  );
}

/**
 * AnalyticsLayout.jsx — shell של מחלקת אנליזה
 * Secondary nav: לוח בקרה · ניתוח (▾ שלב 0 / נקודתי) · אקו-סיסטם · דוחות · יעדים
 */
import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

const NAV = [
  { to: "/analytics/dashboard",  icon: "📊", label: "לוח בקרה" },
  {
    icon: "⚙️",
    label: "ניתוח",
    // קליק על "ניתוח" מנווט לברירת מחדל; ה-dropdown נפתח ב-hover (וגם בקליק על החץ)
    defaultTo: "/analytics/analysis",
    children: [
      { to: "/analytics/analysis",    label: "ניתוח שלב 0" },
      { to: "/analytics/quick-table", label: "ניתוח נקודתי" },
    ],
  },
  { to: "/analytics/ecosystem", icon: "🌐", label: "אקו-סיסטם" },
  { to: "/analytics/reports",   icon: "📄", label: "דוחות"     },
  { to: "/analytics/goals",     icon: "🎯", label: "יעדים"     },
];

const linkStyle = (isActive) => ({
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
  cursor: "pointer",
});

function SimpleNavLink({ item }) {
  return (
    <NavLink to={item.to} style={({ isActive }) => linkStyle(isActive)}>
      <span>{item.icon}</span>
      {item.label}
    </NavLink>
  );
}

function DropdownNavItem({ item }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);
  const wrapperRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const isActiveBranch = (item.children || []).some((c) =>
    location.pathname.startsWith(c.to)
  );

  // hover עם grace period — מונע סגירה בזמן מעבר בין הכותרת ל-dropdown
  const onEnter = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };
  const onLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };

  // קליק מחוץ ל-dropdown סוגר אותו
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <span
        style={linkStyle(isActiveBranch)}
        onClick={() => {
          // קליק על הכותרת — פותח/סוגר dropdown ויאפשר ניווט לברירת מחדל אם דרושה
          if (open && item.defaultTo) {
            navigate(item.defaultTo);
            setOpen(false);
          } else {
            setOpen((v) => !v);
          }
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
            top: "calc(100% - 2px)",
            right: 0,
            background: "#0f1d33",
            border: "1px solid #1e293b",
            borderRadius: "0 0 6px 6px",
            minWidth: 170,
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            overflow: "hidden",
          }}
        >
          {item.children.map((child) => {
            const childActive = location.pathname.startsWith(child.to);
            return (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  padding: "10px 14px",
                  fontSize: 13,
                  color: childActive ? "#93c5fd" : "#cbd5e1",
                  background: childActive ? "#1e293b" : "transparent",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  borderBottom: "1px solid #172033",
                }}
                onMouseEnter={(e) => {
                  if (!childActive) e.currentTarget.style.background = "#172033";
                }}
                onMouseLeave={(e) => {
                  if (!childActive) e.currentTarget.style.background = "transparent";
                }}
              >
                {child.label}
              </NavLink>
            );
          })}
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
          {NAV.map((item) =>
            item.children
              ? <DropdownNavItem key={item.label} item={item} />
              : <SimpleNavLink   key={item.label} item={item} />
          )}
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

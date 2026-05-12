/**
 * UserAvatar.jsx — avatar in the top bar with a small dropdown menu.
 */
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const USER = {
  initials: "מ",
  name:     "מנהלת השיווק",
  role:     "SVCollege Marketing",
};

export default function UserAvatar() {
  const [open, setOpen] = useState(false);
  const ref = useNavigate();
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={`${USER.name} — ${USER.role}`}
        style={{
          width: 32, height: 32, background: "#1e3a5f", borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 14, color: "#93c5fd",
          border: `1px solid ${open ? "#60a5fa" : "#2d4a6e"}`,
          fontFamily: "'Segoe UI', sans-serif", flexShrink: 0,
          cursor: "pointer", padding: 0,
          boxShadow: open ? "0 0 0 2px rgba(96, 165, 250, 0.3)" : "none",
          transition: "box-shadow 150ms ease, border-color 150ms ease",
        }}
      >
        {USER.initials}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: 40, insetInlineEnd: 0,
          minWidth: 220,
          background: "#fff",
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          boxShadow: "0 12px 32px rgba(15,23,42,0.15)",
          padding: 8,
          zIndex: 60,
          direction: "rtl",
          fontFamily: "'Heebo', 'Segoe UI', sans-serif",
        }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9", marginBottom: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{USER.name}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{USER.role}</div>
          </div>

          <MenuItem icon="⚙" label="הגדרות מערכת" onClick={() => { ref("/campaign-management?tab=marketing"); setOpen(false); }} />
          <MenuItem icon="❓" label="איך זה עובד?" onClick={() => {
            window.dispatchEvent(new CustomEvent("sv:open-help"));
            setOpen(false);
          }} />
          <MenuItem icon="⌘" label="חיפוש מהיר (Ctrl+K)" onClick={() => {
            window.dispatchEvent(new CustomEvent("sv:open-palette"));
            setOpen(false);
          }} />

          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 6, paddingTop: 6 }}>
            <MenuItem icon="🌙" label="מצב כהה (בקרוב)" disabled />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", padding: "8px 12px",
        background: "transparent", border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "right", direction: "rtl",
        fontFamily: "'Heebo', 'Segoe UI', sans-serif",
        fontSize: 13, color: disabled ? "#cbd5e1" : "#374151",
        borderRadius: 6,
        transition: "background 100ms ease",
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = "#f1f5f9"; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/**
 * Layout.jsx — Global shell: fixed top bar + Outlet
 * Top bar: SVCollege logo (left) | SV Agency branding (right)
 * Bug reporting lives in PortalHome, not here.
 */
import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import svcollegeLogo from "../assets/svcollege-logo.png";
import UserAvatar from "./UserAvatar.jsx";
import CommandPalette from "./CommandPalette.jsx";
import EmmaChat from "./EmmaChat.jsx";

export default function Layout() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", display: "flex", flexDirection: "column" }}>

      {/* ── Fixed top bar ──
          direction: ltr → logo LEFT, SV Agency RIGHT
      */}
      <header
        style={{
          background:     "#0a1628",
          borderBottom:   "1px solid #1e293b",
          height:         56,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "0 20px",
          position:       "sticky",
          top:            0,
          zIndex:         50,
          flexShrink:     0,
          direction:      "ltr",
        }}
      >
        {/* LEFT — SVCollege logo (click → home) */}
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}
          title="חזרה לפורטל"
        >
          <img
            src={svcollegeLogo}
            alt="SVCollege"
            className="header-logo"
            style={{ height: 34, maxWidth: 150, objectFit: "contain" }}
          />
        </button>

        {/* RIGHT — SV Agency branding */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ lineHeight: 1.2, textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Segoe UI', sans-serif" }}>
              SV Agency
            </p>
            <p
              className="header-subtitle"
              style={{ margin: 0, fontSize: 11, color: "#475569", fontFamily: "'Segoe UI', sans-serif" }}
            >
              פורטל ניהול מחלקות
            </p>
          </div>
          <UserAvatar />
        </div>
      </header>

      {/* ── Page content ── */}
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>

      {/* Global Cmd+K palette */}
      <CommandPalette />

      {/* אמה — העוזרת התפעולית, זמינה בכל מסך */}
      <EmmaChat />
    </div>
  );
}

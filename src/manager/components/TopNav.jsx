/**
 * TopNav.jsx — התפריט העליון הנפתח של ממשק המנהלת.
 * שלב-1: "הסקירה שלי" + "אישורים" חיים; שאר האזורים מוצגים מושבתים עם
 * "בקרוב" (בלי כפתורים מתים — שקיפות במקום קישור שבור).
 * "+ בקשה חדשה" מפנה בינתיים לבריף הקיים — הממשק החדש חי לצד הישן.
 */
import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

const COMING_SOON = [
  ["קורסים", "סביבת קורס — בשלב הבא"],
  ["פעילות בית-ספרית", "בשלב הבא"],
  ["תוכנית ותקציב", "בשלב הבא"],
  ["דוחות", "בשלב הבא"],
];

export default function TopNav({ pendingCount = 0 }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    drawerRef.current?.querySelector("a,button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const links = (
    <>
      <NavLink to="/media" end
        className={({ isActive }) => `mi-navlink${isActive ? " mi-navlink-active" : ""}`}
        onClick={() => setDrawerOpen(false)}>
        הסקירה שלי
      </NavLink>
      <NavLink to="/media/approvals"
        className={({ isActive }) => `mi-navlink${isActive ? " mi-navlink-active" : ""}`}
        onClick={() => setDrawerOpen(false)}>
        אישורים
        {pendingCount > 0 && <span className="mi-nav-badge">{pendingCount}</span>}
      </NavLink>
      {COMING_SOON.map(([label, title]) => (
        <span key={label} className="mi-navlink" title={title}
              style={{ opacity: 0.45, cursor: "default" }}>
          {label}
        </span>
      ))}
    </>
  );

  return (
    <nav className="mi-topnav" aria-label="ניווט ראשי">
      <div className="mi-topnav-inner">
        {/* המבורגר — מובייל */}
        <button className="mi-btn mi-btn-ghost mi-nav-burger" aria-label="פתיחת תפריט"
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen(true)}>
          ☰
        </button>

        <span style={{ fontWeight: 800, color: "var(--mi-ink)", fontSize: 16 }}>
          המשרד שלי
        </span>

        <div className="mi-nav-desktop" style={{ flex: 1 }}>{links}</div>
        <div style={{ flex: 1 }} className="mi-nav-burger" />

        <button className="mi-btn mi-btn-primary"
                onClick={() => navigate("/media-reports?tab=marketing&sub=intake")}>
          + בקשה חדשה
        </button>
      </div>

      {drawerOpen && (
        <div className="mi-nav-drawer" ref={drawerRef} role="dialog" aria-modal="true"
             aria-label="תפריט ניווט">
          <button className="mi-btn mi-btn-ghost" aria-label="סגירת תפריט"
                  onClick={() => setDrawerOpen(false)}
                  style={{ alignSelf: "flex-start" }}>
            ✕ סגירה
          </button>
          {links}
        </div>
      )}
    </nav>
  );
}

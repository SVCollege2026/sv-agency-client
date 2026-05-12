/**
 * CommandPalette.jsx — Cmd+K / Ctrl+K quick navigation.
 *
 * Global modal that lists every page + sub-tab + common action.
 * Filters as the user types. Arrow keys + Enter to navigate.
 * Escape to close.
 *
 * Mounted once in Layout. Listens to:
 *   • keydown Cmd+K / Ctrl+K     — open
 *   • CustomEvent "sv:open-palette" — open (from UserAvatar)
 *   • Escape                      — close
 */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const COMMANDS = [
  { icon: "🏠", label: "פורטל מחלקות",            keywords: "portal home דף הבית",      path: "/" },
  // Marketing / Campaign Management
  { icon: "🎯", label: "פעילות שיווקית",          keywords: "marketing campaigns",       path: "/campaign-management?tab=marketing" },
  { icon: "🗂", label: "לוח קמפיינים",            keywords: "board kanban folders",      path: "/campaign-management?tab=marketing&sub=board" },
  { icon: "📝", label: "בריף חדש",                keywords: "brief intake new",          path: "/campaign-management?tab=marketing&sub=intake" },
  { icon: "✋", label: "תוצרים לאישור",           keywords: "artifacts approve deliverables", path: "/campaign-management?tab=marketing&sub=approvals" },
  { icon: "✅", label: "דורש פעולה",              keywords: "blockers tasks todo",       path: "/campaign-management?tab=marketing&sub=tasks" },
  { icon: "💰", label: "תקציב בית-ספרי",          keywords: "budget school",             path: "/campaign-management?tab=marketing&sub=budget" },
  { icon: "🔌", label: "MAKE — אינטגרציות",       keywords: "make scenarios integrations", path: "/campaign-management?tab=marketing&sub=make" },
  { icon: "⚙",  label: "הגדרות מערכת",            keywords: "settings config",           path: "/campaign-management?tab=marketing&sub=settings" },
  // Media reports
  { icon: "📊", label: "דוחות יומיים",            keywords: "daily reports media",       path: "/campaign-management?tab=daily" },
  { icon: "📈", label: "דוחות שבועיים",           keywords: "weekly",                    path: "/campaign-management?tab=weekly" },
  { icon: "📉", label: "Y-o-Y חודשי",              keywords: "monthly yoy",               path: "/campaign-management?tab=monthly" },
  { icon: "📋", label: "ריצות אחרונות",            keywords: "runs history",              path: "/campaign-management?tab=runs" },
  // Analytics
  { icon: "📊", label: "דאשבורד אנליטיקה",        keywords: "analytics dashboard",       path: "/analytics/dashboard" },
  { icon: "🌐", label: "מערכת אקו-סיסטם",         keywords: "ecosystem",                 path: "/analytics/ecosystem" },
  { icon: "🗄", label: "דוחות שמורים",            keywords: "saved reports",             path: "/analytics/reports" },
  // Strategy
  { icon: "🔮", label: "חיזוי",                    keywords: "forecasting predict",       path: "/strategy/forecasting" },
  { icon: "🎯", label: "יעדים",                    keywords: "goals targets",             path: "/strategy/goals" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Global keyboard handler
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (open && e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    const onOpenEvt = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("sv:open-palette", onOpenEvt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("sv:open-palette", onOpenEvt);
    };
  }, [open]);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Focus input after render
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.keywords.toLowerCase().includes(q)
    );
  }, [query]);

  // Clamp activeIdx whenever the filtered list shrinks
  useEffect(() => {
    setActiveIdx(idx => Math.min(idx, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  function onKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[activeIdx];
      if (cmd) { navigate(cmd.path); setOpen(false); }
    }
  }

  if (!open) return null;

  return (
    <div onClick={() => setOpen(false)} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)",
      zIndex: 300,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: "12vh", padding: 24,
      direction: "rtl",
      fontFamily: "'Heebo', 'Segoe UI', sans-serif",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 12, width: "100%", maxWidth: 600,
        boxShadow: "0 24px 64px rgba(15,23,42,0.30)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        maxHeight: "72vh",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 16px",
          borderBottom: "1px solid #e5e7eb",
        }}>
          <span style={{ fontSize: 18 }}>🔎</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="חיפוש מסך, פעולה, או הגדרה..."
            style={{
              flex: 1, border: "none", outline: "none",
              fontSize: 16, color: "#0f172a",
              direction: "rtl",
              fontFamily: "'Heebo', 'Segoe UI', sans-serif",
            }}
          />
          <span style={{ fontSize: 11, color: "#64748b" }}>ESC לסגירה</span>
        </div>

        <div ref={listRef} style={{ overflowY: "auto", padding: 6, flex: 1 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>
              לא נמצאו תוצאות.
            </div>
          )}
          {filtered.map((c, i) => {
            const active = i === activeIdx;
            return (
              <button
                key={c.path}
                onClick={() => { navigate(c.path); setOpen(false); }}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  width: "100%", padding: "10px 14px",
                  background: active ? "#eff6ff" : "transparent",
                  border: "none",
                  cursor: "pointer", textAlign: "right",
                  borderRadius: 8,
                  fontFamily: "'Heebo', 'Segoe UI', sans-serif",
                  fontSize: 14, color: "#0f172a",
                  transition: "background 80ms ease",
                }}
              >
                <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{c.icon}</span>
                <span style={{ flex: 1, fontWeight: active ? 700 : 500 }}>{c.label}</span>
                {active && <span style={{ fontSize: 11, color: "#1e40af" }}>Enter ↵</span>}
              </button>
            );
          })}
        </div>

        <div style={{
          padding: "8px 16px", borderTop: "1px solid #e5e7eb",
          fontSize: 11, color: "#94a3b8",
          display: "flex", justifyContent: "space-between",
        }}>
          <span>↑ ↓ לניווט · Enter לפתיחה</span>
          <span>{filtered.length} {filtered.length === 1 ? "תוצאה" : "תוצאות"}</span>
        </div>
      </div>
    </div>
  );
}

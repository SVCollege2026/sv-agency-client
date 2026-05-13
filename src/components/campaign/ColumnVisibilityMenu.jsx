/**
 * ColumnVisibilityMenu — 👁 popover with checkboxes per column.
 */
import React, { useState, useRef, useEffect } from "react";
import { color, radius, shadow, space, fontFamily, transition } from "./_tokens.js";

export default function ColumnVisibilityMenu({ columns, hidden, onToggle }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (!btnRef.current?.contains(e.target) && !document.getElementById("col-vis-menu")?.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function openMenu() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: Math.max(8, r.left - 120) });
    setOpen(true);
  }

  return (
    <>
      <button ref={btnRef} onClick={openMenu} style={{
        background: color.surfaceMuted, border: `1px solid ${color.borderDefault}`,
        borderRadius: radius.sm, padding: `${space(1.5)} ${space(2.5)}`,
        fontSize: 13, fontWeight: 600, cursor: "pointer", color: color.fgMuted,
        fontFamily, display: "inline-flex", alignItems: "center", gap: space(1),
        transition: transition.fast,
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#e5e7eb"}
      onMouseLeave={e => e.currentTarget.style.background = color.surfaceMuted}
      >
        👁 עמודות
      </button>

      {open && pos && (
        <div id="col-vis-menu" style={{
          position: "fixed", top: pos.top, left: pos.left,
          background: color.surface, border: `1px solid ${color.borderDefault}`,
          borderRadius: radius.md, boxShadow: shadow.lg,
          zIndex: 9999, padding: space(2), minWidth: 200,
        }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 11, fontWeight: 700, color: color.fgSubtle, padding: `${space(1)} ${space(2)}`, textTransform: "uppercase", fontFamily }}>
            הצג / הסתר עמודות
          </div>
          {columns.map(col => (
            <label key={col.id} style={{
              display: "flex", alignItems: "center", gap: space(2),
              padding: `${space(1.5)} ${space(2)}`, cursor: "pointer",
              borderRadius: 4, fontSize: 13, fontFamily, color: color.fgDefault,
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <input
                type="checkbox"
                checked={!hidden[col.id]}
                onChange={() => onToggle(col.id)}
                style={{ cursor: "pointer", width: 14, height: 14 }}
              />
              {col.label || col.id}
            </label>
          ))}
        </div>
      )}
    </>
  );
}

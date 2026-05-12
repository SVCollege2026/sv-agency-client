/**
 * Breadcrumb.jsx — שורת ניווט עקבית.
 * Usage: <Breadcrumb items={[{ label: 'A', onClick: () => {} }, { label: 'B' }]} />
 */
import React from "react";
import { color, space, type, transition, fontFamily } from "./_tokens.js";

export default function Breadcrumb({ items = [] }) {
  return (
    <nav style={{
      display: "flex", alignItems: "center", gap: space(1.5),
      flexWrap: "wrap", direction: "rtl", fontFamily,
      ...type.bodySmall,
    }}>
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        const clickable = !isLast && typeof it.onClick === "function";
        return (
          <React.Fragment key={i}>
            {clickable ? (
              <button onClick={it.onClick} style={{
                border: "none", background: "transparent",
                cursor: "pointer", padding: 0, fontFamily,
                color: color.fgMuted, ...type.bodySmall,
                transition: transition.fast,
              }}
                onMouseEnter={e => e.currentTarget.style.color = color.primary}
                onMouseLeave={e => e.currentTarget.style.color = color.fgMuted}
              >{it.label}</button>
            ) : (
              <span style={{
                color: isLast ? color.fgDefault : color.fgMuted,
                fontWeight: isLast ? 700 : 400,
              }}>{it.label}</span>
            )}
            {!isLast && (
              <span style={{ color: color.fgSubtle, fontSize: 12 }}>›</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/**
 * EvidencePackView.jsx — תצוגת Evidence Pack
 * ============================================
 * חמישה שדות: sources / date_ranges / calculations / limitations / confidence.
 * RTL, סקיצה: cards מקופלות + expand.
 */
import React, { useState } from "react";

const conf2color = { high: "#16a34a", medium: "#ca8a04", low: "#9ca3af" };
const conf2he    = { high: "גבוה", medium: "בינוני", low: "נמוך" };

export default function EvidencePackView({ pack, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!pack) return null;

  const sources       = pack.sources || [];
  const dateRanges    = pack.date_ranges || [];
  const calculations  = pack.calculations || [];
  const limitations   = pack.limitations || [];
  const confLevel     = pack.confidence || "low";
  const confScore     = typeof pack.confidence_score === "number" ? pack.confidence_score : 0;

  return (
    <div dir="rtl" style={{
      border: "1px solid #1e3a5f",
      borderRadius: 10,
      background: "#f8fafc",
      marginTop: 12,
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "transparent", border: "none", color: "#0f172a",
          padding: "12px 16px", cursor: "pointer", fontSize: 14, fontWeight: 600, textAlign: "right",
        }}
      >
        <span>📋 Evidence Pack</span>
        <span style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12 }}>
          <span style={{ color: conf2color[confLevel] }}>
            ביטחון {conf2he[confLevel]} ({confScore.toFixed(2)})
          </span>
          <span style={{ color: "#64748b" }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", fontSize: 13, color: "#0f172a" }}>
          <Section title="מקורות" items={sources} empty="לא צוינו מקורות" />
          <Section
            title="טווחי תאריכים"
            items={dateRanges.map(r => `${r.label || ""}: ${r.start || ""} → ${r.end || ""}`.trim())}
            empty="לא צוינו"
          />
          <Section title="חישובים" items={calculations} empty="לא צוינו" />
          <Section title="מגבלות" items={limitations} color="#f59e0b" empty="—" />
        </div>
      )}
    </div>
  );
}

function Section({ title, items, color = "#e2e8f0", empty = "—" }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: "#64748b", fontWeight: 600, marginBottom: 6, fontSize: 12 }}>{title}</div>
      {!items || items.length === 0 ? (
        <div style={{ color: "#64748b", fontSize: 12 }}>{empty}</div>
      ) : (
        <ul style={{ margin: 0, padding: "0 18px 0 0", color }}>
          {items.map((it, i) => (
            <li key={i} style={{ marginBottom: 3, lineHeight: 1.5 }}>{String(it)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * SignalChip.jsx — chip צבעוני לכל אחד מ-8 ה-Signal types
 * ===========================================================
 */
import React from "react";

const SIGNAL_META = {
  interest:        { label: "Interest",        emoji: "📈", color: "#3b82f6" },
  closing:         { label: "Closing",         emoji: "✓",  color: "#16a34a" },
  lag:             { label: "Lag",             emoji: "⏱️", color: "#8b5cf6" },
  seasonality:     { label: "Seasonality",     emoji: "🔄", color: "#0ea5e9" },
  budget_pressure: { label: "Budget Pressure", emoji: "💰", color: "#f59e0b" },
  source_quality:  { label: "Source Quality",  emoji: "⭐", color: "#10b981" },
  denial:          { label: "Denial",          emoji: "❌", color: "#dc2626" },
  demand:          { label: "Demand",          emoji: "🔍", color: "#ec4899" },
};

export default function SignalChip({ signal }) {
  if (!signal) return null;
  const meta = SIGNAL_META[signal.type] || { label: signal.type, emoji: "•", color: "#64748b" };
  const valueText = signal.value != null
    ? typeof signal.value === "number" ? signal.value.toFixed(2) : String(signal.value)
    : null;

  return (
    <div
      title={signal.label || ""}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: meta.color + "20",
        border: `1px solid ${meta.color}50`,
        borderRadius: 999,
        padding: "5px 12px",
        fontSize: 12,
        color: "#0f172a",
        margin: "0 4px 4px 0",
      }}
    >
      <span>{meta.emoji}</span>
      <span style={{ fontWeight: 600 }}>{meta.label}</span>
      {signal.label && (
        <span style={{ color: meta.color, fontWeight: 600 }}>· {signal.label}</span>
      )}
      {valueText && (
        <span style={{ color: "#64748b" }}>({valueText})</span>
      )}
    </div>
  );
}

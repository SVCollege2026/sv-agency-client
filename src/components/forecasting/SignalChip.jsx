/**
 * SignalChip.jsx — chip צבעוני לכל אחד מ-8 ה-Signal types
 * ===========================================================
 * tooltip בהובר: מסביר מה ה-signal מודד, מה הערך הנוכחי אומר,
 * ומה התחומים הסבירים. נדרש כי ערכי הסיגנל לא ברורים מעצמם
 * (למשל: 0.00 = low? medium? — בלי tooltip זה ג'יבריש).
 */
import React, { useState } from "react";

const SIGNAL_META = {
  interest: {
    label: "Interest",
    emoji: "📈",
    color: "#3b82f6",
    description: "מגמת לידים — slope של רגרסיה לינארית על מספר הלידים החודשי. value = שינוי לידים לחודש.",
    ranges:      "rising > +0.05 · flat ±0.05 · falling < -0.05",
  },
  closing: {
    label: "Closing",
    emoji: "✓",
    color: "#16a34a",
    description: "אחוז הלידים שהפכו לנרשמים בתקופה הנמדדת. value = יחס נרשמים/לידים.",
    ranges:      "rising > +0.05 · flat ±0.05 · falling < -0.05 (השינוי, לא הערך המוחלט)",
  },
  lag: {
    label: "Lag",
    emoji: "⏱️",
    color: "#8b5cf6",
    description: "חציון ימים מהרגע שהליד נכנס עד לרישום בפועל.",
    ranges:      "fast ≤ 14 ימים · normal 15-60 · slow > 60",
  },
  seasonality: {
    label: "Seasonality",
    emoji: "🔄",
    color: "#0ea5e9",
    description: "עוצמת דפוס שנתי חוזר (אוטוקורלציה ב-lag 12 חודשים). דורש 24+ חודשי דאטה.",
    ranges:      "strong ≥ 0.5 · moderate 0.3-0.5 · weak < 0.3",
  },
  budget_pressure: {
    label: "Budget Pressure",
    emoji: "💰",
    color: "#f59e0b",
    description: "יחס spend בפועל / יעד החיזוי. גבוה = מוציאים מעבר ליעד.",
    ranges:      "comfortable < 0.7 · tight 0.7-1.0 · over ≥ 1.0",
  },
  source_quality: {
    label: "Source Quality",
    emoji: "⭐",
    color: "#10b981",
    description: "ממוצע יחס נרשמים/לידים על פני פלטפורמות (Meta + Google). מאז 06/05 נלקח מ-monthly_school_kpi של אנליזה — לא נחשב מחדש מדגימה.",
    ranges:      "high ≥ 0.60 · medium 0.30-0.60 · low < 0.30",
  },
  denial: {
    label: "Denial",
    emoji: "❌",
    color: "#dc2626",
    description: "אחוז לידים עם sub_status 'שגוי'/'מכחיש' — מי שטעה בטלפון או הכחיש פנייה.",
    ranges:      "low < 0.05 · moderate 0.05-0.15 · high > 0.15",
  },
  demand: {
    label: "Demand",
    emoji: "🔍",
    color: "#ec4899",
    description: "מדד ביקוש חיצוני מ-Perplexity / GA4 / Google Trends. נמוך מבטא ירידה בעניין בשוק.",
    ranges:      "rising > +0.05 · flat ±0.05 · falling < -0.05",
  },
};

export default function SignalChip({ signal }) {
  const [open, setOpen] = useState(false);
  if (!signal) return null;
  const meta = SIGNAL_META[signal.type] || {
    label: signal.type, emoji: "•", color: "#64748b",
    description: "(אין הסבר זמין)", ranges: "",
  };
  const valueText = signal.value != null
    ? typeof signal.value === "number" ? signal.value.toFixed(2) : String(signal.value)
    : null;

  return (
    <span
      style={{ position: "relative", display: "inline-block", margin: "0 4px 4px 0" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: meta.color + "20",
          border: `1px solid ${meta.color}50`,
          borderRadius: 999,
          padding: "5px 12px",
          fontSize: 12,
          color: "#0f172a",
          cursor: "help",
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
      </span>

      {open && (
        <div
          dir="rtl"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 50,
            width: 320,
            background: "#0f172a",
            color: "#f8fafc",
            border: `1px solid ${meta.color}`,
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 12,
            lineHeight: 1.5,
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, color: meta.color }}>
            {meta.emoji} {meta.label}
          </div>
          <div style={{ marginBottom: 6 }}>{meta.description}</div>
          {meta.ranges && (
            <div style={{ color: "#cbd5e1", fontSize: 11 }}>
              <span style={{ fontWeight: 600 }}>תחומים:</span> {meta.ranges}
            </div>
          )}
          {valueText && signal.label && (
            <div style={{ marginTop: 6, color: "#fbbf24", fontSize: 11 }}>
              ערך נוכחי: <b>{valueText}</b> → <b>{signal.label}</b>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

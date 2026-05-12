/**
 * ApprovalGuard.jsx — מציג למשתמשת באופן עקבי שהמערכת לא מבצעת שום שינוי
 * בלי האישור שלה.
 *
 * שלוש וריאציות:
 *   <ApprovalGuardBadge />        — תגית קומפקטית לכותרת (תמיד נראית).
 *   <ApprovalGuardBanner />       — באנר רחב לראש פאנלים (Recommendations, Artifacts).
 *   <ApprovalGuardLine />         — שורת טקסט עדינה לליד כפתורי "אישור" / "קבלי".
 *
 * עיקרון מנחה ב-Spec 01: "HITL מוחלט. אין override, אין batch approvals.
 * כל פעולה חיה ב-QA חסומה." הקומפוננטה הזו עוטפת את ההבטחה הזו ב-UI.
 */
import React from "react";
import { color, radius, space, type, fontFamily } from "./_tokens.js";

/** Compact pill — fits in a header next to a bell icon. */
export function ApprovalGuardBadge({ compact = false }) {
  return (
    <span
      title="המערכת לעולם לא מבצעת שינוי חי בלי האישור שלך. כל המלצה, תוצר, או החלטה — דורשים לחיצה מפורשת."
      style={{
        display: "inline-flex", alignItems: "center", gap: space(1),
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #86efac",
        borderRadius: radius.pill,
        padding: compact ? `${space(0.5)} ${space(2)}` : `${space(1)} ${space(2.5)}`,
        fontSize: compact ? 11 : 12,
        fontWeight: 700,
        fontFamily,
        whiteSpace: "nowrap",
        cursor: "help",
      }}
    >
      <span style={{ fontSize: compact ? 12 : 14 }}>🛡</span>
      <span>{compact ? "אישורך נדרש" : "לא מבוצע ללא אישורך"}</span>
    </span>
  );
}

/** Wide banner for panel headers — first thing the manager sees. */
export function ApprovalGuardBanner({ context = "general" }) {
  const messages = {
    general:        "המערכת אף פעם לא מבצעת שום שינוי, פעולה, או החלטה בלי הלחיצה המפורשת שלך.",
    recommendations: "אלו המלצות, לא פעולות. שום קמפיין, תקציב, או הגדרה לא יזוז אלא אם תאשרי אותה — בלחיצה.",
    artifacts:      "אלו תוצרים שמחלקות הסוכנים הכינו. הם לא יפורסמו ולא יבוצעו עד שתאשרי כל אחד בנפרד.",
    feasibility:    "המלצת התקציב המוצעת לא משנה תקציב קיים. קבלת ההמלצה תיצור גרסה חדשה של הבריף שאת תוכלי לערוך לפני שמירה.",
  };
  const text = messages[context] || messages.general;

  return (
    <div style={{
      background: "#f0fdf4",
      border: "1px solid #bbf7d0",
      borderRadius: radius.md,
      padding: `${space(2)} ${space(3)}`,
      marginBottom: space(3),
      display: "flex", alignItems: "center", gap: space(2),
      direction: "rtl", fontFamily,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>🛡</span>
      <span style={{ ...type.bodySmall, color: "#166534", lineHeight: 1.5 }}>
        <strong>HITL — Human In The Loop:</strong> {text}
      </span>
    </div>
  );
}

/** Inline line — quietly near action buttons. */
export function ApprovalGuardLine({ children }) {
  return (
    <div style={{
      ...type.small,
      color: color.fgMuted,
      display: "flex", alignItems: "center", gap: space(1),
      marginTop: space(1.5),
      direction: "rtl", fontFamily,
    }}>
      <span>🛡</span>
      <span>{children || "פעולה זו לא תבוצע בפועל עד שתאשרי בלחיצה."}</span>
    </div>
  );
}

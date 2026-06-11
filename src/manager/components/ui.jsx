/**
 * ui.jsx — קומפוננטות-הבסיס של ממשק המנהלת (מהמוקאפ המחייב).
 * StatCard · PriorityCard · StatusChip · EmptyState · ErrorBanner · Skeleton
 */
import React from "react";

/* מספר גדול + תווית + אייקון בריבוע רך. לחיץ ⇒ ניווט לרשימה המסוננת. */
export function StatCard({ value, label, icon, tone = "accent", onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className="mi-card" onClick={onClick}
         style={{ display: "flex", alignItems: "center", gap: 14,
                  textAlign: "start", border: "1px solid var(--mi-border)",
                  inlineSize: "100%" }}>
      <span aria-hidden="true" style={{
        background: `var(--mi-${tone}-bg, var(--mi-accent-bg))`,
        color: `var(--mi-${tone}, var(--mi-accent))`,
        borderRadius: 12, inlineSize: 44, blockSize: 44, fontSize: 20,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>{icon}</span>
      <span>
        <span style={{ display: "block", fontSize: 26, fontWeight: 700,
                       color: "var(--mi-ink)" }} className="mi-ltr">{value}</span>
        <span className="mi-meta">{label}</span>
      </span>
    </Tag>
  );
}

const TAG_TONE = {
  "דורש אישור": ["mi-priority-approval", "mi-chip-primary"],
  "דורש החלטה": ["mi-priority-decision", "mi-chip-warning"],
  "חסר מידע":   ["mi-priority-info",     "mi-chip-info"],
};

/* כרטיס "מה מחכה לך עכשיו" — פס-צבע בקצה הפותח + תגית + כותרת + מטא. */
export function PriorityCard({ tag, title, meta, onClick }) {
  const [edge, chip] = TAG_TONE[tag] || ["", "mi-chip-info"];
  return (
    <button className={`mi-card mi-priority ${edge}`} onClick={onClick}
            style={{ display: "block", inlineSize: "100%", textAlign: "start",
                     padding: "14px 16px" }}>
      <span className={`mi-chip ${chip}`}>{tag}</span>
      <span style={{ display: "block", fontWeight: 600, color: "var(--mi-ink)",
                     fontSize: 14, marginBlockStart: 6 }}>{title}</span>
      {meta && <span className="mi-meta" style={{ display: "block", marginBlockStart: 4 }}>{meta}</span>}
    </button>
  );
}

const STATUS_CHIP = {
  waiting_for_marketing_approval: ["ממתין לאישור שלך", "mi-chip-warning", "⏳"],
  qa_passed:                      ["מוכן לבדיקה", "mi-chip-success", "✓"],
  internal_review:                ["בבדיקה פנימית", "mi-chip-info", "🔍"],
  approved:                       ["מאושר", "mi-chip-success", "✓"],
  revision_required:              ["הוחזר לתיקון", "mi-chip-danger", "✎"],
  recommended:                    ["המלצה חדשה", "mi-chip-warning", "💡"],
  pending:                        ["ממתין להחלטה", "mi-chip-warning", "⏳"],
};

/* צ'יפ סטטוס — תמיד צבע + טקסט + אייקון, לא צבע בלבד (WCAG 1.4.1). */
export function StatusChip({ status }) {
  const [label, cls, icon] = STATUS_CHIP[status] || [status, "mi-chip-info", "•"];
  return <span className={`mi-chip ${cls}`}><span aria-hidden="true">{icon}</span>{label}</span>;
}

export function EmptyState({ icon = "🎉", title, hint }) {
  return (
    <div className="mi-card" style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 40 }} aria-hidden="true">{icon}</div>
      <div className="mi-h2" style={{ marginBlockStart: 8 }}>{title}</div>
      {hint && <div className="mi-meta" style={{ marginBlockStart: 4 }}>{hint}</div>}
    </div>
  );
}

/* כשל-שליפה גלוי — לא נכשלים בשקט (עיקרון evidence). */
export function ErrorBanner({ errors = [], onRetry }) {
  if (!errors.length) return null;
  return (
    <div className="mi-card" role="alert"
         style={{ background: "var(--mi-danger-bg)", borderColor: "var(--mi-danger)",
                  color: "var(--mi-danger)", marginBlockEnd: 16 }}>
      <strong>חלק מהנתונים לא נטענו:</strong>{" "}
      {errors.map((e) => e.source || e).join(", ")}
      {onRetry && (
        <button className="mi-btn mi-btn-secondary" onClick={onRetry}
                style={{ marginInlineStart: 12, minBlockSize: 32, padding: "4px 12px" }}>
          נסי שוב
        </button>
      )}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="mi-card" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="mi-skeleton"
             style={{ inlineSize: `${85 - i * 20}%`, marginBlockEnd: 10 }} />
      ))}
    </div>
  );
}

/* זמן יחסי בעברית — דטרמיניסטי ופשוט. */
export function timeAgoHe(iso) {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "לפני שעה" : `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  return days === 1 ? "אתמול" : `לפני ${days} ימים`;
}

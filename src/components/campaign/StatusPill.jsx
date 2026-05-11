/**
 * StatusPill.jsx — sticker צבעוני לסטטוס workflow/artifact/folder.
 */
import React from "react";

const STYLES = {
  // Folder statuses
  draft:            { bg: "#f1f5f9", fg: "#64748b", label: "טיוטה" },
  in_progress:      { bg: "#e0f2fe", fg: "#0369a1", label: "בעבודה" },
  ready_to_launch:  { bg: "#dcfce7", fg: "#15803d", label: "מוכן לעלייה" },
  live:             { bg: "#bbf7d0", fg: "#166534", label: "באוויר" },
  closing:          { bg: "#fef3c7", fg: "#a16207", label: "בסגירה" },
  closed:           { bg: "#fee2e2", fg: "#b91c1c", label: "סגור" },
  // Workflow statuses
  created:              { bg: "#f1f5f9", fg: "#475569", label: "נוצר" },
  running:              { bg: "#dbeafe", fg: "#1d4ed8", label: "רץ" },
  waiting_for_agent:    { bg: "#fef3c7", fg: "#a16207", label: "ממתין לסוכן" },
  waiting_for_human:    { bg: "#ffedd5", fg: "#c2410c", label: "ממתין לאישור" },
  completed:            { bg: "#dcfce7", fg: "#15803d", label: "הושלם" },
  failed:               { bg: "#fee2e2", fg: "#b91c1c", label: "נכשל" },
  cancelled:            { bg: "#f1f5f9", fg: "#475569", label: "בוטל" },
  // Artifact statuses
  internal_review:                 { bg: "#e0e7ff", fg: "#4338ca", label: "בבדיקה פנימית" },
  revision_required:               { bg: "#fef3c7", fg: "#a16207", label: "דרוש תיקון" },
  qa_passed:                       { bg: "#dcfce7", fg: "#15803d", label: "QA עבר" },
  waiting_for_marketing_approval:  { bg: "#ffedd5", fg: "#c2410c", label: "ממתין לאישור" },
  approved:                        { bg: "#bbf7d0", fg: "#166534", label: "אושר" },
  rejected:                        { bg: "#fee2e2", fg: "#b91c1c", label: "נדחה" },
  archived:                        { bg: "#f1f5f9", fg: "#64748b", label: "נארכב" },
  superseded:                      { bg: "#f1f5f9", fg: "#64748b", label: "הוחלפה גרסה" },
  // Severity
  low:      { bg: "#f1f5f9", fg: "#64748b", label: "נמוך" },
  normal:   { bg: "#e0e7ff", fg: "#4338ca", label: "רגיל" },
  high:     { bg: "#fef3c7", fg: "#a16207", label: "גבוה" },
  critical: { bg: "#fee2e2", fg: "#b91c1c", label: "קריטי" },
};

export default function StatusPill({ value, customLabel = null }) {
  const cfg = STYLES[value] || { bg: "#e2e8f0", fg: "#334155", label: value || "—" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        background: cfg.bg,
        color: cfg.fg,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {customLabel || cfg.label}
    </span>
  );
}

/**
 * ActivityIndicator — maps workflow_items.current_stage + current_owner_agent
 * to a human Hebrew badge. Click opens a Timeline drawer.
 */
import React, { useState } from "react";
import { color, radius, shadow, space, fontFamily, transition } from "./_tokens.js";

const STAGE_MAP = {
  brief_intake:                  { icon: "📋", label: "בריף בתרגום",          bg: "#e0e7ff", fg: "#3730a3" },
  media_planning:                { icon: "📊", label: "מחלקת מדיה עובדת",    bg: "#fef3c7", fg: "#92400e" },
  copy_drafting:                 { icon: "✍",  label: "קופי בכתיבה",          bg: "#fef3c7", fg: "#92400e" },
  creative_rendering:            { icon: "🎨", label: "קריאייטיב בייצור",    bg: "#fef3c7", fg: "#92400e" },
  waiting_for_marketing_approval:{ icon: "⏳", label: "ממתין לאישורך",         bg: "#fdab3d22", fg: "#a16207" },
  ready_to_launch:               { icon: "✅", label: "מוכן לעלייה",          bg: "#dcfce7", fg: "#15803d" },
  live:                          { icon: "🟢", label: "באוויר",               bg: "#dcfce7", fg: "#15803d" },
  closing:                       { icon: "🔻", label: "בסגירה",               bg: "#fee2e2", fg: "#991b1b" },
  completed:                     { icon: "✓",  label: "הסתיים",               bg: "#f1f5f9", fg: "#475569" },
};

function stageLabel(stage, ownerAgent) {
  if (!stage) return null;
  return STAGE_MAP[stage] || { icon: "⚙", label: stage.replace(/_/g, " "), bg: "#f1f5f9", fg: "#475569" };
}

// ─── Timeline drawer (slide-in from right) ───────────────────────────────────
function TimelineDrawer({ transitions, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", zIndex: 9998,
      }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 380,
        background: color.surface, boxShadow: shadow.xl,
        zIndex: 9999, display: "flex", flexDirection: "column",
        direction: "rtl",
      }}>
        <div style={{
          padding: `${space(4)} ${space(5)}`,
          borderBottom: `1px solid ${color.borderDefault}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: color.fgDefault, fontFamily }}>⏱ ציר זמן</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 20, color: color.fgMuted }}>×</button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: space(4) }}>
          {(!transitions || transitions.length === 0) ? (
            <div style={{ color: color.fgSubtle, fontSize: 14, fontFamily, textAlign: "center", paddingTop: space(8) }}>
              אין מידע על מעברים עדיין
            </div>
          ) : transitions.map((t, i) => {
            const info = STAGE_MAP[t.new_stage || t.stage] || { icon: "⚙", label: (t.new_stage || t.stage || ""), bg: "#f1f5f9", fg: "#475569" };
            const dt = t.decided_at || t.created_at || t.transitioned_at;
            return (
              <div key={i} style={{ display: "flex", gap: space(3), marginBottom: space(4) }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: info.bg, color: info.fg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, flexShrink: 0,
                  }}>{info.icon}</div>
                  {i < transitions.length - 1 && (
                    <div style={{ width: 2, flex: 1, background: color.borderSubtle, margin: "4px 0" }} />
                  )}
                </div>
                <div style={{ paddingTop: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: color.fgDefault, fontFamily }}>{info.label}</div>
                  {t.decided_by && <div style={{ fontSize: 12, color: color.fgSubtle, fontFamily }}>{t.decided_by}</div>}
                  {dt && <div style={{ fontSize: 11, color: color.fgSubtle, fontFamily }}>{new Date(dt).toLocaleString("he-IL")}</div>}
                  {t.reason && <div style={{ fontSize: 12, color: color.fgMuted, marginTop: 2, fontFamily }}>{t.reason}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── ActivityIndicator component ─────────────────────────────────────────────
export default function ActivityIndicator({ workflowItems = [], folder }) {
  const [showTimeline, setShowTimeline] = useState(false);

  // Find the most relevant workflow item for this folder
  const latest = workflowItems
    .filter(w => w.folder_id === folder?.id || w.related_folder_id === folder?.id)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];

  const stage = latest?.current_stage || folder?.status;

  if (!stage) {
    return <span style={{ color: color.fgSubtle, fontSize: 13, fontFamily }}>—</span>;
  }

  const info = stageLabel(stage);
  if (!info) return <span style={{ color: color.fgSubtle, fontSize: 13, fontFamily }}>—</span>;

  const transitions = workflowItems
    .filter(w => w.folder_id === folder?.id || w.related_folder_id === folder?.id)
    .filter(w => w.decision_type === "workflow_transition" || w.new_stage);

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setShowTimeline(true); }}
        title={`שלב נוכחי: ${info.label}`}
        style={{
          background: info.bg, color: info.fg,
          border: "none", borderRadius: radius.badge,
          padding: "4px 10px", fontSize: 11, fontWeight: 700,
          cursor: "pointer", fontFamily, whiteSpace: "nowrap",
          transition: transition.fast,
        }}
      >
        {info.icon} {info.label}
      </button>

      {showTimeline && (
        <TimelineDrawer
          transitions={transitions}
          onClose={() => setShowTimeline(false)}
        />
      )}
    </>
  );
}

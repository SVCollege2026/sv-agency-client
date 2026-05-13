/**
 * RecommendationCard — single recommendation from the engine.
 * Shows signal / context / policy / action with 4 manager actions.
 */
import React, { useState } from "react";
import { color, radius, space, fontFamily, transition } from "./_tokens.js";
import { decideRecommendation } from "../../api.js";
import { useToast } from "./Toast.jsx";

const DEPT_ICONS = {
  media_dept:    "📊",
  copy_dept:     "✍",
  creative_dept: "🎨",
  budget_dept:   "💰",
  closure_dept:  "🔻",
};

function deptIcon(dept) {
  return DEPT_ICONS[dept] || "⚙";
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (d > 0) return `לפני ${d} ימים`;
  if (h > 0) return `לפני ${h} שעות`;
  return "לפני מעט";
}

export default function RecommendationCard({ rec, onDecided }) {
  const toast = useToast();
  const [busy, setBusy]       = useState(false);
  const [showReject, setShowReject]   = useState(false);
  const [showModify, setShowModify]   = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [modifiedAction, setModifiedAction] = useState("");

  async function decide(decision, reason) {
    if (busy) return;
    setBusy(true);
    try {
      await decideRecommendation(rec.id, {
        decided_by: "marketing_manager",
        decision,
        reason: reason || undefined,
        qa_feedback_dimensions: [],
      });
      toast.success(decision === "approved"
        ? "✓ ההמלצה אושרה — המחלקה תחל בייצור"
        : decision === "rejected"
          ? "✗ ההמלצה נדחתה"
          : "✏ ההמלצה אושרה עם שינוי");
      onDecided?.();
    } catch (e) {
      toast.error(`שגיאה: ${e.message}`);
    } finally { setBusy(false); }
  }

  const dept    = rec.producing_department || rec.platform_department || "—";
  const icon    = deptIcon(dept);
  const created = rec.created_at || rec.generated_at;
  const conf    = rec.confidence ? `${Math.round(rec.confidence * 100)}%` : null;
  const eta     = rec.estimated_duration_hours ? `${rec.estimated_duration_hours}ש' לייצור` : null;

  return (
    <div style={{
      border: `1px solid ${color.borderDefault}`, borderRadius: radius.md,
      background: color.surface, marginBottom: space(3), overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        background: color.surfaceMuted, padding: `${space(2.5)} ${space(3)}`,
        display: "flex", alignItems: "center", gap: space(2),
        borderBottom: `1px solid ${color.borderSubtle}`,
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: color.fgMuted, fontFamily }}>{dept.replace(/_/g, " ")}</span>
        {conf && <span style={{ fontSize: 11, color: color.fgSubtle, fontFamily, marginRight: "auto" }}>confidence: {conf}</span>}
        <span style={{ fontSize: 11, color: color.fgSubtle, fontFamily }}>{timeAgo(created)}</span>
      </div>

      {/* Body */}
      <div style={{ padding: `${space(3)} ${space(3)}`, direction: "rtl" }}>
        {rec.signal && (
          <Row label="Signal" value={rec.signal} />
        )}
        {rec.context_text && (
          <Row label="Context" value={rec.context_text} />
        )}
        {rec.policy && (
          <Row label="Policy" value={rec.policy} muted />
        )}
        {rec.action && (
          <div style={{ marginTop: space(2), padding: `${space(2)} ${space(3)}`, background: "#eff6ff", borderRadius: radius.sm, borderRight: `3px solid #579bfc` }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#1e40af", fontFamily }}>Action: </span>
            <span style={{ fontSize: 13, color: "#1e40af", fontFamily }}>{rec.action}</span>
          </div>
        )}
        {(eta || conf) && (
          <div style={{ display: "flex", gap: space(4), marginTop: space(2) }}>
            {eta && <span style={{ fontSize: 11, color: color.fgSubtle, fontFamily }}>ETA: {eta}</span>}
          </div>
        )}
      </div>

      {/* Actions (only if pending) */}
      {rec.decision_status === "pending" && !showReject && !showModify && (
        <div style={{
          padding: `${space(2.5)} ${space(3)}`,
          borderTop: `1px solid ${color.borderSubtle}`,
          display: "flex", gap: space(2), flexWrap: "wrap",
        }}>
          <ActionBtn color="#00c875" disabled={busy} onClick={() => decide("approved", "")}>✓ אשרי</ActionBtn>
          <ActionBtn color="#df2f4a" disabled={busy} onClick={() => setShowReject(true)}>✗ דחי</ActionBtn>
          <ActionBtn color="#a25ddc" disabled={busy} onClick={() => { setModifiedAction(rec.action || ""); setShowModify(true); }}>💬 שיני הוראה</ActionBtn>
          <ActionBtn color={color.fgMuted} light disabled={busy} onClick={() => {/* open payload info */}}>↗ פרטים</ActionBtn>
        </div>
      )}

      {/* Reject form */}
      {showReject && (
        <div style={{ padding: space(3), borderTop: `1px solid ${color.borderSubtle}` }}>
          <textarea
            autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            placeholder="סיבת הדחייה (אופציונלי)"
            rows={3}
            style={{
              width: "100%", padding: space(2), fontSize: 13, fontFamily, direction: "rtl",
              border: `1px solid ${color.borderDefault}`, borderRadius: radius.sm, outline: "none", resize: "none",
            }}
          />
          <div style={{ display: "flex", gap: space(2), marginTop: space(2) }}>
            <button onClick={() => setShowReject(false)} style={cancelBtnStyle}>ביטול</button>
            <button onClick={() => decide("rejected", rejectReason)} disabled={busy} style={submitBtnStyle("#df2f4a")}>דחי</button>
          </div>
        </div>
      )}

      {/* Modify form */}
      {showModify && (
        <div style={{ padding: space(3), borderTop: `1px solid ${color.borderSubtle}` }}>
          <div style={{ fontSize: 12, color: color.fgSubtle, marginBottom: space(2), fontFamily }}>
            Action מקורי: <em>{rec.action}</em>
          </div>
          <textarea
            autoFocus value={modifiedAction} onChange={e => setModifiedAction(e.target.value)}
            placeholder="כתבי action מתוקן..."
            rows={3}
            style={{
              width: "100%", padding: space(2), fontSize: 13, fontFamily, direction: "rtl",
              border: `1px solid ${color.borderDefault}`, borderRadius: radius.sm, outline: "none", resize: "none",
            }}
          />
          <div style={{ display: "flex", gap: space(2), marginTop: space(2) }}>
            <button onClick={() => setShowModify(false)} style={cancelBtnStyle}>ביטול</button>
            <button onClick={() => decide("approved_modified", modifiedAction)} disabled={busy || !modifiedAction.trim()} style={submitBtnStyle("#a25ddc")}>שלחי שינוי</button>
          </div>
        </div>
      )}

      {/* Completed / in-production status */}
      {rec.decision_status === "approved" && (
        <div style={{ padding: `${space(2)} ${space(3)}`, borderTop: `1px solid ${color.borderSubtle}`, fontSize: 12, color: "#15803d", fontFamily, background: "#f0fdf4" }}>
          ✓ אושרה — מחלקה בייצור
        </div>
      )}
      {rec.decision_status === "rejected" && (
        <div style={{ padding: `${space(2)} ${space(3)}`, borderTop: `1px solid ${color.borderSubtle}`, fontSize: 12, color: "#b91c1c", fontFamily, background: "#fff1f2" }}>
          ✗ נדחתה {rec.reject_reason ? `— ${rec.reject_reason}` : ""}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div style={{ marginBottom: space(1.5), fontSize: 13, fontFamily }}>
      <span style={{ fontWeight: 700, color: muted ? color.fgSubtle : color.fgMuted, marginLeft: 4 }}>{label}:</span>
      <span style={{ color: muted ? color.fgSubtle : color.fgDefault }}> {value}</span>
    </div>
  );
}

function ActionBtn({ children, color: bg, light, disabled, onClick }) {
  const textColor = light ? "#6b7280" : "#fff";
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        padding: `${space(1.5)} ${space(3)}`,
        background: light ? "transparent" : bg,
        color: textColor,
        border: light ? `1px solid #e5e7eb` : "none",
        borderRadius: radius.sm, fontSize: 12, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer", fontFamily,
        opacity: disabled ? 0.6 : 1,
        transition: "opacity 120ms",
      }}
    >{children}</button>
  );
}

const cancelBtnStyle = {
  flex: 1, padding: `${space(2)} 0`,
  background: "transparent", border: `1px solid #e5e7eb`,
  borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6b7280",
};

function submitBtnStyle(bg) {
  return {
    flex: 2, padding: `${space(2)} 0`,
    background: bg, border: "none",
    borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff",
  };
}

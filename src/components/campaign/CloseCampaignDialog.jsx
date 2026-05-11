/**
 * CloseCampaignDialog.jsx — Spec 03 §6.2 — dialog יחיד עם:
 *   • שם הקמפיין (verify, readonly)
 *   • הסבר מה יקרה
 *   • שדה טקסט חופשי לנימוק (חובה)
 *   • כפתור "אישור סופי — סגור" (active רק אחרי נימוק)
 *   • כפתור ביטול
 *
 * אין שלבי אישור נוספים מעבר ל-dialog הזה (Plan §"Flows").
 */
import React, { useState } from "react";
import { closeCampaign } from "../../api.js";

export default function CloseCampaignDialog({ folder, onClose, onClosed }) {
  const [confirmName, setConfirmName] = useState("");
  const [reason, setReason]           = useState("");
  const [busy, setBusy]               = useState(false);
  const [error, setError]             = useState(null);

  const nameMatches = confirmName.trim() === (folder.course_name || "").trim();
  const canSubmit   = nameMatches && reason.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true); setError(null);
    try {
      await closeCampaign(folder.id, {
        requested_by: "marketing_manager",
        reason:       reason.trim(),
        campaign_name_confirmation: confirmName.trim(),
      });
      onClosed();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, direction: "rtl", padding: 20,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: 24,
        maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <h2 style={{ margin: "0 0 8px", color: "#b91c1c", fontSize: 22 }}>🛑 סגירת קמפיין</h2>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          פעולה זו תסגור את הקמפיין ב-SV Agency.
        </div>

        {/* Campaign name for verification */}
        <div style={{ marginBottom: 16, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>שם הקמפיין שתסגר:</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{folder.course_name}</div>
        </div>

        {/* What will happen */}
        <div style={{ marginBottom: 16, padding: 12, background: "#fefce8", borderRadius: 8, borderInlineStart: "4px solid #ca8a04" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#854d0e", marginBottom: 6 }}>מה יקרה בסגירה:</div>
          <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 13, color: "#713f12", lineHeight: 1.6 }}>
            <li>תקציב הקמפיין יוקפא</li>
            <li>המודעות יורדו מהפלטפורמות (במצב live)</li>
            <li>סטטוס התיקייה ישתנה ל-"סגור"</li>
            <li>ההחלטה תתועד עם הנימוק ב-decision_log</li>
          </ul>
          <div style={{ fontSize: 11, color: "#a16207", marginTop: 8, fontStyle: "italic" }}>
            במצב Dry Run — תיעוד מלא בלי קריאה ל-APIs חיצוניים.
          </div>
        </div>

        {/* Confirmation: name */}
        <label style={{ display: "block", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
            לאימות — הקלידי את שם הקורס במלואו:
          </div>
          <input
            value={confirmName}
            onChange={e => setConfirmName(e.target.value)}
            placeholder={folder.course_name}
            style={{
              width: "100%", padding: "10px 12px", fontSize: 14,
              border: `2px solid ${nameMatches ? "#16a34a" : "#cbd5e1"}`,
              borderRadius: 6, direction: "rtl",
            }}
          />
        </label>

        {/* Reason (mandatory) */}
        <label style={{ display: "block", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
            נימוק לסגירה (חובה): *
          </div>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="לדוגמה: קורס התמלא, תקציב הסתיים, החלטה אסטרטגית..."
            rows={4}
            style={{
              width: "100%", padding: "10px 12px", fontSize: 14,
              border: "1px solid #cbd5e1", borderRadius: 6, direction: "rtl",
              resize: "vertical", fontFamily: "inherit",
            }}
          />
        </label>

        {error && (
          <div style={{ marginBottom: 12, padding: 10, background: "#fee2e2", color: "#b91c1c", borderRadius: 6, fontSize: 13 }}>
            שגיאה: {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={busy} style={{
            padding: "10px 18px", background: "transparent", color: "#475569",
            border: "1px solid #cbd5e1", borderRadius: 6, cursor: busy ? "not-allowed" : "pointer",
            fontSize: 14,
          }}>ביטול</button>
          <button
            onClick={submit}
            disabled={!canSubmit || busy}
            style={{
              padding: "10px 18px", background: canSubmit ? "#dc2626" : "#fecaca",
              color: "#fff", border: "none", borderRadius: 6,
              cursor: (!canSubmit || busy) ? "not-allowed" : "pointer",
              fontWeight: 700, fontSize: 14,
            }}
          >
            {busy ? "סוגר..." : "🛑 אישור סופי — סגור"}
          </button>
        </div>
      </div>
    </div>
  );
}

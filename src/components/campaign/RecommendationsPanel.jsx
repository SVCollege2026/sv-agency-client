/**
 * RecommendationsPanel.jsx — Media Recommendations UI (Spec 02 §3, §11, §12).
 * Shows each recommendation with all 17 fields + 9 QA feedback dimension buttons.
 * Approve/Reject/Snooze/Follow-up.
 */
import React, { useState } from "react";
import { decideRecommendation } from "../../api.js";
import StatusPill from "./StatusPill.jsx";

const QA_DIMENSIONS = [
  { id: "correct",          label: "✅ המלצה נכונה" },
  { id: "understandable",   label: "📖 מובנת" },
  { id: "not_relevant_now", label: "⏸ לא רלוונטית כרגע" },
  { id: "too_strict",       label: "⚖ מחמירה מדי" },
  { id: "too_lenient",      label: "🪶 חלשה מדי" },
  { id: "wrong_context",    label: "❌ הקשר שגוי" },
  { id: "change_setting",   label: "⚙ צריך לשנות הגדרה" },
  { id: "change_policy",    label: "📋 צריך לשנות policy" },
  { id: "fix_code_logic",   label: "🔧 לתקן לוגיקה בקוד" },
];

const section = {
  background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0",
  padding: 18, marginBottom: 16,
};

export default function RecommendationsPanel({ folderId, recommendations = [], onChanged = () => {} }) {
  if (recommendations.length === 0) {
    return (
      <div style={section}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15, color: "#0f172a", fontWeight: 700 }}>🎯 המלצות מדיה</h3>
        <div style={{ color: "#64748b", fontSize: 13 }}>אין המלצות פעילות לתיקייה זו.</div>
      </div>
    );
  }

  return (
    <div style={section}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f172a", fontWeight: 700 }}>
        🎯 המלצות מדיה ({recommendations.length})
      </h3>
      {recommendations.map(r => (
        <RecommendationCard key={r.id} rec={r} onChanged={onChanged} />
      ))}
    </div>
  );
}

function RecommendationCard({ rec, onChanged }) {
  const [open, setOpen] = useState(false);
  const [selectedDims, setSelectedDims] = useState([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isPending = rec.decision_status === "pending";

  function toggleDim(id) {
    setSelectedDims(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function decide(decision) {
    if (decision === "reject" && !reason.trim()) {
      alert("דחייה דורשת סיבה."); return;
    }
    setBusy(true); setError(null);
    try {
      await decideRecommendation(rec.id, {
        decided_by: "marketing_manager",
        decision,
        reason: reason.trim() || null,
        qa_feedback_dimensions: selectedDims,
      });
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, marginBottom: 12,
      background: isPending ? "#fffbeb" : "#f8fafc",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>{rec.platform}</span>
            <StatusPill value={rec.decision_status} />
            <StatusPill value={rec.signal?.severity || "normal"} />
            {rec.requires_approval && (
              <span style={{
                background: "#fef3c7", color: "#a16207", padding: "2px 8px",
                fontSize: 11, fontWeight: 700, borderRadius: 12,
              }}>דורש אישור</span>
            )}
            {rec.times_seen > 1 && (
              <span style={{
                background: "#e0e7ff", color: "#4338ca", padding: "2px 8px",
                fontSize: 11, fontWeight: 700, borderRadius: 12,
              }}>נצפה {rec.times_seen} פעמים</span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 8 }}>
            {rec.recommendation_text}
          </div>
          {rec.human_explanation && (
            <div style={{
              marginTop: 10, padding: 10, background: "#fff", borderRadius: 6,
              fontSize: 13, color: "#334155", whiteSpace: "pre-wrap", border: "1px solid #f1f5f9",
            }}>
              {rec.human_explanation}
            </div>
          )}
        </div>
      </div>

      <button onClick={() => setOpen(o => !o)} style={{
        marginTop: 10, background: "transparent", border: "none",
        color: "#1e3a5f", cursor: "pointer", fontSize: 12, fontWeight: 700,
      }}>
        {open ? "הסתר פרטים ▼" : "הצג פרטים ‹"}
      </button>

      {open && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#475569" }}>
          <div><strong>action:</strong> {rec.chosen_action}</div>
          <div><strong>blocked_actions:</strong> {(rec.blocked_actions || []).join(", ") || "—"}</div>
          <div><strong>setting_level:</strong> {rec.setting_level}</div>
          <div><strong>policy_id:</strong> {rec.policy_applied || "—"}</div>
          <div><strong>signal:</strong> {JSON.stringify(rec.signal)}</div>
          <div><strong>data_window:</strong> {JSON.stringify(rec.data_window)}</div>
          <div><strong>run_date:</strong> {rec.run_date}</div>
        </div>
      )}

      {isPending && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #cbd5e1" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
            ✍ סמני dimensions של QA Feedback (לפי Spec 02 §12):
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {QA_DIMENSIONS.map(d => (
              <button key={d.id} onClick={() => toggleDim(d.id)} style={{
                padding: "4px 10px", borderRadius: 12, cursor: "pointer", fontSize: 12,
                background: selectedDims.includes(d.id) ? "#1e3a5f" : "#fff",
                color:      selectedDims.includes(d.id) ? "#fff" : "#475569",
                border: `1px solid ${selectedDims.includes(d.id) ? "#1e3a5f" : "#cbd5e1"}`,
                fontWeight: 600,
              }}>{d.label}</button>
            ))}
          </div>
          <input
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="סיבה (חובה לדחייה)"
            style={{
              width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1",
              borderRadius: 6, fontSize: 13, marginBottom: 8,
            }}
          />
          {error && (
            <div style={{ padding: 8, background: "#fee2e2", color: "#b91c1c", borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn onClick={() => decide("approve")} disabled={busy} bg="#16a34a">✓ אישור</Btn>
            <Btn onClick={() => decide("reject")}  disabled={busy} bg="#dc2626">✗ דחייה</Btn>
            <Btn onClick={() => decide("snooze")}  disabled={busy} bg="#64748b">⏸ השהה</Btn>
            <Btn onClick={() => decide("follow_up")} disabled={busy} bg="#0369a1">📌 מעקב</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

const Btn = ({ children, bg, ...p }) => (
  <button {...p} style={{
    padding: "6px 14px", background: bg, color: "#fff", border: "none",
    borderRadius: 6, cursor: p.disabled ? "not-allowed" : "pointer",
    fontWeight: 700, fontSize: 13, opacity: p.disabled ? 0.6 : 1,
  }}>{children}</button>
);

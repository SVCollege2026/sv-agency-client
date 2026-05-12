/**
 * RecommendationsPanel.jsx — המלצות מדיה בלשון אנושית.
 * אין UUIDs, אין JSON של signal, אין policy_id נחשף. רק מה שמשתמש מבין.
 */
import React, { useState } from "react";
import { decideRecommendation } from "../../api.js";
import { ApprovalGuardBanner } from "./ApprovalGuard.jsx";

const QA_DIMENSIONS = [
  { id: "correct",          label: "✅ נכונה" },
  { id: "understandable",   label: "📖 ברורה" },
  { id: "not_relevant_now", label: "⏸ לא רלוונטית כרגע" },
  { id: "too_strict",       label: "⚖ מחמירה מדי" },
  { id: "too_lenient",      label: "🪶 חלשה מדי" },
  { id: "wrong_context",    label: "❌ הקשר שגוי" },
  { id: "change_setting",   label: "⚙ צריך לשנות הגדרה" },
  { id: "change_policy",    label: "📋 צריך לשנות מדיניות" },
  { id: "fix_code_logic",   label: "🔧 לוגיקה דורשת תיקון" },
];

const ACTION_LABELS = {
  observe:               "להמשיך לעקוב",
  recommend:             "להוציא המלצה",
  increase_budget:       "להגדיל תקציב",
  decrease_budget:       "להקטין תקציב",
  reallocate_budget:     "להעביר תקציב בין פלטפורמות",
  refresh_creative:      "לרענן קריאייטיב",
  pause_campaign:        "להשהות קמפיין",
  close_campaign:        "לסגור קמפיין",
  change_budget_live:    "לשנות תקציב חי",
  change_creative_live:  "לעדכן קריאייטיב חי",
};

const SEVERITY_LABEL = {
  low: "נמוך", normal: "רגיל", high: "גבוה", critical: "קריטי",
};

const SEVERITY_COLOR = {
  low:      { bg: "#f1f5f9", color: "#475569" },
  normal:   { bg: "#e0e7ff", color: "#4338ca" },
  high:     { bg: "#fef3c7", color: "#a16207" },
  critical: { bg: "#fee2e2", color: "#b91c1c" },
};

const card = {
  background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
  padding: 22, marginBottom: 16, boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
};

function relTime(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)     return "ממש עכשיו";
  if (diff < 3600)   return `לפני ${Math.floor(diff / 60)} דק'`;
  if (diff < 86400)  return `לפני ${Math.floor(diff / 3600)} שעות`;
  if (diff < 604800) return `לפני ${Math.floor(diff / 86400)} ימים`;
  return new Date(iso).toLocaleDateString("he-IL");
}

export default function RecommendationsPanel({ folderId, recommendations = [], onChanged = () => {} }) {
  if (recommendations.length === 0) {
    return (
      <div style={card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "#111827", fontWeight: 700 }}>💡 התראות פעולה מהמערכת</h3>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>
          המערכת מנטרת את הקמפיין באופן רציף. כשהיא מזהה משהו שדורש את תשומת לבך — היא מציעה לך פעולה כאן.
        </div>
        <div style={{
          textAlign: "center", padding: "30px 12px", color: "#6b7280",
          background: "#f9fafb", borderRadius: 10, fontSize: 14, fontWeight: 600,
        }}>
          🌱 אין התראות פעולה כרגע — הקמפיין פועל באופן תקין.<br />
          <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 400 }}>
            ברגע שהמערכת תזהה משהו שדורש את תשומת לבך — היא תוצאה כאן.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "#111827", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
        💡 התראות פעולה מהמערכת
        <span style={{ fontSize: 13, fontWeight: 400, color: "#9ca3af" }}>({recommendations.length})</span>
      </h3>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>
        המערכת זיהתה דברים שדורשים את תשומת לבך. את יכולה לאשר את ההמלצה, לדחות, או לדחות לעת עתה.
      </div>
      <ApprovalGuardBanner context="recommendations" />
      {recommendations.map(r => (
        <RecommendationCard key={r.id} rec={r} onChanged={onChanged} />
      ))}
    </div>
  );
}

function RecommendationCard({ rec, onChanged }) {
  const [selectedDims, setSelectedDims] = useState([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState(null);
  const isPending = rec.decision_status === "pending";

  function toggleDim(id) {
    setSelectedDims(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function decide(decision) {
    if (decision === "reject" && !reason.trim()) {
      alert("דחייה דורשת סיבה.");
      return;
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
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const sev = SEVERITY_COLOR[rec.signal?.severity] || SEVERITY_COLOR.normal;
  const actionLabel = ACTION_LABELS[rec.chosen_action] || rec.chosen_action;

  return (
    <div style={{
      border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 12,
      background: isPending ? "#fffbeb" : "#f9fafb",
    }}>
      {/* Header with badges */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
          {rec.platform === "meta" ? "📘 Meta" :
           rec.platform === "google" ? "🔍 Google" :
           rec.platform === "tiktok" ? "🎵 TikTok" :
           rec.platform}
        </span>
        <span style={{ background: sev.bg, color: sev.color, padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
          חומרה: {SEVERITY_LABEL[rec.signal?.severity] || "רגיל"}
        </span>
        {rec.requires_approval && (
          <span style={{ background: "#fef3c7", color: "#a16207", padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
            ⚠ דורש אישור
          </span>
        )}
        {rec.times_seen > 1 && (
          <span style={{ background: "#e0e7ff", color: "#4338ca", padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
            🔁 חוזרת ({rec.times_seen} פעמים)
          </span>
        )}
        <span style={{ marginInlineStart: "auto", fontSize: 11, color: "#9ca3af" }}>
          {relTime(rec.created_at)}
        </span>
      </div>

      {/* Action card */}
      <div style={{
        background: "#fff", padding: "12px 14px", borderRadius: 10,
        border: "1px solid #e5e7eb", marginBottom: 10,
      }}>
        <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>
          המלצת המערכת:
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
          🎯 {actionLabel}
        </div>
      </div>

      {/* Hebrew explanation */}
      {rec.human_explanation && (
        <div style={{
          padding: 14, background: "#fff", borderRadius: 10,
          fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.6,
          border: "1px solid #f3f4f6",
        }}>
          {rec.human_explanation}
        </div>
      )}

      {/* Decision panel — only when pending */}
      {isPending && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
            ✍ איך את חווה את ההמלצה? (אפשר לסמן יותר מאחת)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {QA_DIMENSIONS.map(d => (
              <button key={d.id} onClick={() => toggleDim(d.id)} style={{
                padding: "5px 12px", borderRadius: 14, cursor: "pointer", fontSize: 12,
                background: selectedDims.includes(d.id) ? "#1e3a5f" : "#fff",
                color:      selectedDims.includes(d.id) ? "#fff" : "#374151",
                border: `1px solid ${selectedDims.includes(d.id) ? "#1e3a5f" : "#e5e7eb"}`,
                fontWeight: 600,
              }}>{d.label}</button>
            ))}
          </div>
          <input
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="סיבה (חובה לדחייה)"
            style={{
              width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb",
              borderRadius: 8, fontSize: 13, marginBottom: 10, background: "#fff",
            }}
          />
          {error && (
            <div style={{ padding: 10, background: "#fee2e2", color: "#b91c1c", borderRadius: 8, marginBottom: 10, fontSize: 12 }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn onClick={() => decide("approve")} disabled={busy} bg="#16a34a">✓ אשרי</Btn>
            <Btn onClick={() => decide("reject")}  disabled={busy} bg="#dc2626">✗ דחי</Btn>
            <Btn onClick={() => decide("snooze")}  disabled={busy} bg="#64748b">⏸ דחי לעת עתה</Btn>
            <Btn onClick={() => decide("follow_up")} disabled={busy} bg="#0369a1">📌 צריכה לחזור לזה</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

const Btn = ({ children, bg, ...p }) => (
  <button {...p} style={{
    padding: "8px 16px", background: bg, color: "#fff", border: "none",
    borderRadius: 8, cursor: p.disabled ? "not-allowed" : "pointer",
    fontWeight: 700, fontSize: 13, opacity: p.disabled ? 0.6 : 1,
  }}>{children}</button>
);

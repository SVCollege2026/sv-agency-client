/**
 * Stage0Trigger.jsx — כפתור הפעלת Stage 0 + סטטוס ריצה אחרונה
 * ============================================================
 */
import React, { useEffect, useState } from "react";
import { triggerStage0, getStage0Status } from "../../api.js";

const STATUS_HE = {
  running:    { label: "רץ עכשיו", color: "#3b82f6", emoji: "⏳" },
  completed:  { label: "הושלם",    color: "#16a34a", emoji: "✓" },
  partial:    { label: "חלקי",     color: "#ca8a04", emoji: "⚠" },
  failed:     { label: "נכשל",     color: "#dc2626", emoji: "✗" },
  never_run:  { label: "לא הופעל", color: "#94a3b8", emoji: "•" },
};

export default function Stage0Trigger() {
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  async function load() {
    try {
      const s = await getStage0Status();
      setStatus(s);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);  // poll כל 10 שניות
    return () => clearInterval(interval);
  }, []);

  async function trigger() {
    setLoading(true);
    setError(null);
    try {
      await triggerStage0("ui");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const isRunning = status?.status === "running";
  const meta = STATUS_HE[status?.status] || STATUS_HE.never_run;

  return (
    <div dir="rtl" style={{
      background: "#0d1626", border: "1px solid #1e3a5f", borderRadius: 14,
      padding: 20, marginTop: 20,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, color: "#e2e8f0", fontSize: 17 }}>🧠 Stage 0 — ריצת למידה ראשונית</h2>
        <span style={{ color: meta.color, fontSize: 13, fontWeight: 600 }}>
          {meta.emoji} {meta.label}
        </span>
      </div>

      <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7, margin: "0 0 14px" }}>
        סורק את כל הלידים ב-leads_fix עם 4 סקנרים גנריים (trend / lag / seasonality / anomaly).
        ייצור Candidate Patterns; דפוסים שצוברים ≥2 ראיות יעלו לספריית הדפוסים הפעילים.
        זמן ריצה משוער: <strong>6-10 דקות</strong>.
      </p>

      {status && status.status !== "never_run" && (
        <div style={{ background: "#0a1322", borderRadius: 8, padding: 12, fontSize: 12,
                      color: "#cbd5e1", marginBottom: 14, lineHeight: 1.7 }}>
          <div><strong>ריצה אחרונה:</strong> {status.started_at?.replace("T", " ").slice(0, 19)}</div>
          {status.completed_at && (
            <div><strong>הסתיים:</strong> {status.completed_at?.replace("T", " ").slice(0, 19)}</div>
          )}
          {status.patterns_extracted_count != null && (
            <div>
              <strong>דפוסים שעלו ל-Patterns:</strong> {status.patterns_extracted_count} ·{" "}
              <strong>Candidates שנצברו:</strong> {status.candidates_count} ·{" "}
              <strong>קומבינציות שנסרקו:</strong> {status.combinations_scanned}
            </div>
          )}
          {status.scanners_ok?.length > 0 && (
            <div><strong>סקנרים שעבדו:</strong> {status.scanners_ok.join(", ")}</div>
          )}
          {status.error_message && (
            <div style={{ color: "#fca5a5" }}><strong>שגיאה:</strong> {status.error_message}</div>
          )}
        </div>
      )}

      {error && (
        <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>שגיאה: {error}</div>
      )}

      <button
        type="button"
        onClick={trigger}
        disabled={loading || isRunning}
        style={{
          background: isRunning ? "#475569" : loading ? "#64748b" : "#3b82f6",
          color: "#fff", border: "none", borderRadius: 8,
          padding: "10px 24px", fontSize: 14, fontWeight: 600,
          cursor: (loading || isRunning) ? "default" : "pointer",
        }}
      >
        {isRunning ? "Stage 0 רץ ברקע…" : loading ? "מפעיל…" : "🚀 הרץ Stage 0 עכשיו"}
      </button>
    </div>
  );
}

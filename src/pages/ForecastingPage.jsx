/**
 * ForecastingPage.jsx — מחלקת חיזוי
 * ====================================
 * 4 סקציות:
 *   1. הגשת שאלה (department + question_kind + question)
 *   2. תוצאה (תשובה + signals + Evidence Pack)
 *   3. ספריית דפוסים פעילים
 *   4. Stage 0 trigger
 *
 * נתיב: /forecasting
 * Backend: /api/forecasting/*
 */
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  submitForecast, getForecastStatus, getForecastResult,
  getForecastingCronStatus,
} from "../api.js";
import EvidencePackView from "../components/forecasting/EvidencePackView.jsx";
import SignalChip       from "../components/forecasting/SignalChip.jsx";
import PatternLibrary   from "../components/forecasting/PatternLibrary.jsx";
import Stage0Trigger    from "../components/forecasting/Stage0Trigger.jsx";

const DEPARTMENTS = [
  { value: "strategy",  label: "אסטרטגיה" },
  { value: "media",     label: "מדיה" },
  { value: "analytics", label: "אנליזה" },
  { value: "sales",     label: "מכירות" },
  { value: "manual",    label: "ידני / לקוח" },
];

const QUESTION_KINDS = [
  { value: "forecast",       label: "תחזית" },
  { value: "scenario",       label: "תרחיש (Phase 3)" },
  { value: "feasibility",    label: "היתכנות (Phase 3)" },
  { value: "pattern_lookup", label: "חיפוש בדפוסים" },
];

const STATUS_HE = {
  queued:               { label: "בתור",          color: "#475569" },
  validating:           { label: "אימות",          color: "#475569" },
  running:              { label: "רץ",             color: "#3b82f6" },
  completed:            { label: "הושלם",          color: "#16a34a" },
  failed:               { label: "נכשל",           color: "#dc2626" },
  not_enough_info:      { label: "אין מספיק מידע", color: "#ca8a04" },
  needs_clarification:  { label: "דרושה הבהרה",    color: "#ca8a04" },
};

export default function ForecastingPage() {
  const navigate = useNavigate();
  const [department, setDepartment]     = useState("strategy");
  const [questionKind, setKind]         = useState("forecast");
  const [question, setQuestion]         = useState("");
  const [submitting, setSubmitting]     = useState(false);

  const [requestId, setRequestId]       = useState(null);
  const [statusInfo, setStatusInfo]     = useState(null);
  const [resultData, setResultData]     = useState(null);
  const [error, setError]               = useState(null);
  const [cron, setCron]                 = useState(null);
  const pollTimer = useRef(null);

  useEffect(() => {
    getForecastingCronStatus().then(setCron).catch(() => {});
  }, []);

  // poll על ריצה פעילה
  useEffect(() => {
    if (!requestId || resultData) return;
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      try {
        const st = await getForecastStatus(requestId);
        setStatusInfo(st);
        if (st.status === "completed" || st.status === "not_enough_info" || st.status === "failed") {
          // טען תוצאה
          if (st.status !== "failed") {
            try {
              const r = await getForecastResult(requestId);
              setResultData(r);
            } catch (err) {
              setError(err.message);
            }
          }
          clearInterval(pollTimer.current);
          pollTimer.current = null;
        }
      } catch (err) {
        // 404 על result זה תקין כל עוד עוד רץ
      }
    }, 5000);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [requestId, resultData]);

  async function submit(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setSubmitting(true);
    setError(null);
    setResultData(null);
    setStatusInfo(null);
    try {
      const res = await submitForecast({ department, question, questionKind });
      setRequestId(res.request_id);
      setStatusInfo({ status: "queued", iteration_count: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setRequestId(null);
    setStatusInfo(null);
    setResultData(null);
    setError(null);
    setQuestion("");
    if (pollTimer.current) clearInterval(pollTimer.current);
  }

  return (
    <div lang="he" dir="rtl" style={{
      background: "#ffffff", color: "#0f172a",
      fontFamily: "'Segoe UI', sans-serif",
      minHeight: "calc(100vh - 56px)",
      padding: "32px 24px",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <button onClick={() => navigate("/")}
                  style={{ background: "transparent", border: "1px solid #cbd5e1",
                           color: "#475569", padding: "5px 12px", borderRadius: 6,
                           cursor: "pointer", fontSize: 12 }}>
            ← חזרה לפורטל
          </button>
          {cron && (
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {cron.running ? `Cron: הריצה הבאה ${(cron.next_run_time || "").slice(0, 16)}` : "Cron כבוי"}
            </div>
          )}
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 6px" }}>🔮 מחלקת חיזוי</h1>
        <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 28px" }}>
          תחזיות עתידיות מבוססות-ראיות · ReAct + Self-Reflection · Pattern Memory ארגוני
        </p>

        {/* ── סקציה 1: שאלה ── */}
        <div style={cardStyle}>
          <h2 style={h2Style}>📝 שאלת חיזוי</h2>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={labelStyle}>מחלקה</label>
                <select value={department} onChange={(e) => setDepartment(e.target.value)}
                        style={selectStyle}>
                  {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={labelStyle}>סוג שאלה</label>
                <select value={questionKind} onChange={(e) => setKind(e.target.value)}
                        style={selectStyle}>
                  {QUESTION_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>השאלה</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                placeholder="לדוגמה: כמה לידים נצפה לקבל ביוני 2026? האם יש עלייה בביקוש לקורסי AI?"
                style={{
                  width: "100%", background: "#ffffff", color: "#0f172a",
                  border: "1px solid #cbd5e1", borderRadius: 8,
                  padding: "10px 12px", fontSize: 14, resize: "vertical",
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
                disabled={submitting || (requestId && !resultData)}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={submitting || !question.trim() || (requestId && !resultData)}
                style={{
                  background: (submitting || !question.trim() || (requestId && !resultData)) ? "#475569" : "#3b82f6",
                  color: "#fff", border: "none", borderRadius: 8,
                  padding: "10px 22px", fontSize: 14, fontWeight: 600,
                  cursor: (submitting || !question.trim() || (requestId && !resultData)) ? "default" : "pointer",
                }}>
                {submitting ? "שולח…" : "🚀 שלח לחיזוי"}
              </button>
              {requestId && (
                <button
                  type="button" onClick={reset}
                  style={{
                    background: "transparent", border: "1px solid #cbd5e1",
                    color: "#475569", borderRadius: 8, padding: "10px 22px",
                    fontSize: 14, cursor: "pointer",
                  }}>
                  שאלה חדשה
                </button>
              )}
            </div>
            {error && (
              <div style={{ color: "#dc2626", fontSize: 13 }}>שגיאה: {error}</div>
            )}
          </form>
        </div>

        {/* ── סקציה 2: תוצאה ── */}
        {(statusInfo || resultData) && (
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={h2Style}>📊 תוצאה</h2>
              {statusInfo && (
                <span style={{ color: STATUS_HE[statusInfo.status]?.color || "#94a3b8", fontSize: 13, fontWeight: 600 }}>
                  ● {STATUS_HE[statusInfo.status]?.label || statusInfo.status}
                  {statusInfo.iteration_count > 0 && ` · iteration ${statusInfo.iteration_count}/4`}
                  {statusInfo.current_step && ` · ${statusInfo.current_step}`}
                </span>
              )}
            </div>

            {!resultData && statusInfo?.status !== "failed" && (
              <div style={{ color: "#475569", fontSize: 13, padding: 16, textAlign: "center" }}>
                ⏳ ה-ReAct loop של מנהל החיזוי רץ ברקע…
                <br />
                <small style={{ color: "#64748b" }}>polling כל 5 שניות. זמן ממוצע: 30-90 שניות.</small>
              </div>
            )}

            {statusInfo?.status === "failed" && (
              <div style={{ color: "#dc2626", fontSize: 13, padding: 12 }}>
                ❌ הריצה נכשלה. {statusInfo.error_message ? `סיבה: ${statusInfo.error_message}` : ""}
              </div>
            )}

            {resultData && (
              <ResultDisplay result={resultData} />
            )}
          </div>
        )}

        {/* ── סקציה 3: ספריית דפוסים ── */}
        <PatternLibrary />

        {/* ── סקציה 4: Stage 0 ── */}
        <Stage0Trigger />

        {/* ── Disclaimer ── */}
        <div style={{
          marginTop: 28, padding: 14,
          background: "rgba(245, 158, 11, 0.08)",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          borderRadius: 8, fontSize: 12, color: "#fbbf24", lineHeight: 1.7,
        }}>
          ⚠ <strong>חוק אמת:</strong> Meta/Google אינם אמת עסקית ללידים — אמת = Supabase + Fireberry בלבד.
          Meta/Google משמשים ל-traffic ו-spend בלבד.
        </div>
      </div>
    </div>
  );
}

function ResultDisplay({ result }) {
  const sigs = result.signals || [];
  const pred = result.prediction || {};
  const pack = result.evidence_pack || {};

  return (
    <div>
      {result.not_enough_info ? (
        <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)",
                      borderRadius: 8, padding: 16, color: "#fbbf24", whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7 }}>
          {result.answer_text}
        </div>
      ) : (
        <>
          {/* תשובה טקסטואלית */}
          <div style={{ background: "#ffffff", borderRadius: 8, padding: 16, color: "#0f172a",
                        whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>
            {result.answer_text}
          </div>

          {/* Prediction box */}
          {pred?.point != null && (
            <div style={{ background: "#ffffff", borderRadius: 8, padding: 14, marginBottom: 14,
                          border: "1px solid #16a34a40" }}>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>תחזית מספרית</div>
              <div style={{ fontSize: 24, color: "#16a34a", fontWeight: 700 }}>
                {Math.round(pred.point).toLocaleString()}
                {pred.range_low != null && pred.range_high != null && (
                  <span style={{ fontSize: 14, color: "#475569", marginRight: 12 }}>
                    {" "}(טווח {Math.round(pred.range_low).toLocaleString()}–{Math.round(pred.range_high).toLocaleString()})
                  </span>
                )}
              </div>
              {pred.horizon && (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>אופק: {pred.horizon}</div>
              )}
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                ביטחון: {(pred.confidence ?? 0).toFixed(2)}
              </div>
            </div>
          )}

          {/* Signals */}
          {sigs.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>Signals</div>
              <div>
                {sigs.map((s, i) => <SignalChip key={i} signal={s} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Evidence Pack — תמיד מציג */}
      <EvidencePackView pack={pack} defaultOpen={false} />
    </div>
  );
}

const cardStyle = {
  background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14,
  padding: 20, marginBottom: 20, boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const h2Style = { margin: "0 0 14px", color: "#0f172a", fontSize: 17 };

const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 600,
  color: "#475569", marginBottom: 6,
};

const selectStyle = {
  width: "100%",
  background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a",
  borderRadius: 8, padding: "9px 12px", fontSize: 14,
  boxSizing: "border-box",
};

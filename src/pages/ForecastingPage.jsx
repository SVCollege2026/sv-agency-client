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
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
// PatternLibrary + Stage0Trigger הוסרו מהתצוגה — debug-only.

// "מי מבקש" dropdown הוסר — היה metadata שבילבל. ברירת המחדל "manual"
// נשלחת אוטומטית מ-state.

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
  const [department, setDepartment]     = useState("manual");
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

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>🔮 חיזוי</h1>
        <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 28px" }}>
          תחזיות עתידיות מבוססות-ראיות · ReAct + Self-Reflection · Pattern Memory ארגוני.
          <br/>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            עורכים יעדים בטאב <b>יעדים</b>. תרחישים פסימי/ריאלי/אופטימי = פלט של חיזוי מול היעדים.
          </span>
        </p>

        {/* ── סקציה 1: שאלה ── */}
        <div style={cardStyle}>
          <h2 style={h2Style}>📝 שאלת חיזוי</h2>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* dropdown של סוג שאלה הוסר — default 'forecast' */}
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

        {/* PatternLibrary + Stage0Trigger הוסרו לחלוטין מהתצוגה — debug
            views, לא רלוונטי לתצוגת לקוחה. */}

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

// ─── Chart data helpers ────────────────────────────────────────────────────

function _pivotPlatformMonth(rows) {
  // [{platform, month, leads}, ...] → [{month, Meta: 12, Google: 19, ...}, ...]
  if (!rows || !rows.length) return [];
  const byMonth = {};
  for (const r of rows) {
    const m = r.month;
    if (!byMonth[m]) byMonth[m] = { month: m };
    byMonth[m][r.platform || "—"] = r.leads || 0;
  }
  return Object.values(byMonth).sort((a, b) => (a.month || "").localeCompare(b.month || ""));
}

function _uniquePlatforms(rows) {
  if (!rows || !rows.length) return [];
  const out = new Set();
  for (const r of rows) if (r.platform) out.add(r.platform);
  return Array.from(out);
}

// ─── Color palettes ────────────────────────────────────────────────────────
const STATUS_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];
const PLATFORM_COLORS = { Meta: "#1877f2", Google: "#fbbc04", פייסבוק: "#1877f2", אינסטגרם: "#e4405f", גוגל: "#fbbc04", "טיק טוק": "#000000", אורגני: "#10b981" };

function fmtN(v) {
  if (v == null) return "—";
  return Number(v).toLocaleString("he-IL");
}
function fmtPctV(v) {
  if (v == null) return "—";
  return `${(Number(v) * 100).toFixed(1)}%`;
}

// ─── Stat card ─────────────────────────────────────────────────────────────
function ForecastStatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
      padding: "14px 16px",
    }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "#0f172a" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Section card ──────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, color, footer }) {
  return (
    <div dir="rtl" style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
      padding: "14px 16px", minHeight: 260,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: color || "#0f172a", marginBottom: 2 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10, lineHeight: 1.5 }}>
          {subtitle}
        </div>
      )}
      <div style={{ marginTop: subtitle ? 0 : 6 }}>
        {children}
      </div>
      {footer && (
        <div style={{
          fontSize: 11, color: "#475569", marginTop: 10, paddingTop: 8,
          borderTop: "1px solid #f1f5f9", lineHeight: 1.6,
        }}>
          {footer}
        </div>
      )}
    </div>
  );
}

function ResultDisplay({ result }) {
  const sigs = result.signals || [];
  const pred = result.prediction || {};
  const pack = result.evidence_pack || {};
  const smart = result.smart_report || {};
  const scenarios = smart.scenarios || {};
  const charts = smart.chart_data || {};

  // Compute stat cards values
  const realPt = (scenarios.realistic || {}).point;
  const totals = charts.internal_totals || {};
  const convRate = totals.records ? (totals.enrolled / totals.records) : null;
  const irrelevantPct = totals.records ? (totals.irrelevant / totals.records) : null;
  const dowData = charts.day_of_week || [];
  const bestDow = dowData.length ? [...dowData].sort((a, b) => (b.conv_rate || 0) - (a.conv_rate || 0))[0] : null;

  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Stat cards row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <ForecastStatCard
          label="תחזית ריאלית"
          value={realPt != null ? fmtN(Math.round(realPt)) : (pred?.point != null ? fmtN(Math.round(pred.point)) : "—")}
          sub={pred?.horizon || "אופק חיזוי"}
          color="#1e40af"
        />
        <ForecastStatCard
          label="המרה (לידים → נרשמים)"
          value={convRate != null ? fmtPctV(convRate) : "—"}
          sub={totals.records ? `${fmtN(totals.enrolled)}/${fmtN(totals.records)} בדגימה` : "אין נתונים"}
          color="#16a34a"
        />
        <ForecastStatCard
          label="לא רלוונטיים"
          value={irrelevantPct != null ? fmtPctV(irrelevantPct) : "—"}
          sub={totals.irrelevant != null ? `${fmtN(totals.irrelevant)} לידים` : "—"}
          color="#dc2626"
        />
        <ForecastStatCard
          label="יום חזק בשבוע"
          value={bestDow ? bestDow.day_name : "—"}
          sub={bestDow ? `${fmtPctV(bestDow.conv_rate)} המרה` : "—"}
          color="#7c3aed"
        />
      </div>

      {/* ── Smart Report summary (compact narrative) ── */}
      {smart.summary && (
        <div style={{
          background: "#eff6ff", border: "1px solid #bfdbfe",
          borderRadius: 10, padding: "14px 16px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", marginBottom: 6 }}>
            🧠 סיכום AI {smart.produced_by === "smart_interpreter:fallback" && (
              <span style={{ color: "#92400e", fontWeight: 400 }}>(fallback)</span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: "#0f172a" }}>
            {smart.summary}
          </p>
        </div>
      )}

      {/* ── Scenarios bar chart — פסימי / ריאלי / אופטימי ── */}
      {(charts.scenarios_chart || []).some(s => s.point != null) && (
        <ChartCard
          title="🎯 תרחישים — פסימי / ריאלי / אופטימי"
          subtitle="3 תרחישים מבוססי-AI מול ה-prediction. כל אחד עם הנמקה משלו."
          color="#1e40af"
          footer={
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {["pessimistic", "realistic", "optimistic"].map((k, i) => {
                const sc = scenarios[k] || {};
                const labels = ["פסימי", "ריאלי", "אופטימי"];
                const colors = ["#dc2626", "#ca8a04", "#16a34a"];
                return (
                  <div key={k} style={{ borderTop: `3px solid ${colors[i]}`, paddingTop: 6 }}>
                    <div style={{ fontWeight: 700, color: colors[i], marginBottom: 2 }}>
                      {labels[i]}{sc.point != null && ` · ${fmtN(Math.round(sc.point))}`}
                    </div>
                    <div>{sc.reasoning || "—"}</div>
                  </div>
                );
              })}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts.scenarios_chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#475569" }} reversed />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} orientation="right" />
              <Tooltip
                formatter={(v) => fmtN(Math.round(v))}
                contentStyle={{ fontSize: 12, direction: "rtl", textAlign: "right" }}
              />
              <Bar dataKey="point" radius={[8, 8, 0, 0]}>
                {(charts.scenarios_chart || []).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── Two col: Day of week + Status pie ── */}
      {(charts.day_of_week || charts.status_breakdown) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 10 }}>
          {charts.day_of_week && charts.day_of_week.length > 0 && (
            <ChartCard
              title="📅 דפוסי ימי שבוע"
              subtitle="לידים, נרשמים, ושיעור המרה לפי יום בשבוע (ראשון-שבת). מזהה ימים חזקים/חלשים לתזמון קמפיינים."
              color="#7c3aed"
              footer={(() => {
                const sorted = [...charts.day_of_week].sort((a, b) => (b.conv_rate || 0) - (a.conv_rate || 0));
                const best = sorted[0]; const worst = sorted[sorted.length - 1];
                if (!best || !worst) return null;
                return <span>היום החזק: <b>{best.day_name}</b> ({fmtPctV(best.conv_rate)}). החלש: <b>{worst.day_name}</b> ({fmtPctV(worst.conv_rate)}).</span>;
              })()}
            >
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={charts.day_of_week} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day_name" tick={{ fontSize: 11, fill: "#475569" }} reversed />
                  <YAxis yAxisId="left"  orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis yAxisId="right" orientation="left"  tick={{ fontSize: 10, fill: "#94a3b8" }}
                         tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip
                    formatter={(v, name) => name === "conv_rate" ? `${(v * 100).toFixed(1)}%` : fmtN(v)}
                    contentStyle={{ fontSize: 12, direction: "rtl", textAlign: "right" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, direction: "rtl" }} />
                  <Bar yAxisId="left"  dataKey="leads"     name="לידים"   fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar yAxisId="left"  dataKey="enrolled"  name="נרשמים"  fill="#10b981" radius={[4,4,0,0]} />
                  <Line yAxisId="right" type="monotone" dataKey="conv_rate" name="conv_rate" stroke="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {charts.status_breakdown && charts.status_breakdown.length > 0 && (
            <ChartCard
              title="🥧 התפלגות status — איכות לידים"
              subtitle="פילוח כל הלידים לפי סטטוס. מזהה כמה הם 'נרשם', 'פתוח', 'לא רלוונטי' וכד'."
              color="#0c4a6e"
              footer={(() => {
                const total = (charts.status_breakdown || []).reduce((s, x) => s + (x.value || 0), 0);
                const top = (charts.status_breakdown || [])[0];
                if (!top || !total) return null;
                return <span>הסטטוס הדומיננטי: <b>{top.name}</b> — {fmtN(top.value)} מתוך {fmtN(total)} ({((top.value / total) * 100).toFixed(0)}%).</span>;
              })()}
            >
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={charts.status_breakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={2}
                    label={(e) => e.name}
                    labelLine={false}
                  >
                    {(charts.status_breakdown || []).map((_, i) => (
                      <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={fmtN} contentStyle={{ fontSize: 12, direction: "rtl", textAlign: "right" }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

      {/* ── Two col: Platform×month + Irrelevant breakdown ── */}
      {(charts.platform_month || charts.irrelevant_breakdown) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 10 }}>
          {charts.platform_month && charts.platform_month.length > 0 && (
            <ChartCard
              title="📈 לידים לפי פלטפורמה × חודש"
              subtitle="מגמת לידים חודשית פר פלטפורמה (Meta, Google, אורגני, ספקי לידים)."
              color="#1877f2"
              footer="כל קו = פלטפורמה. ההיפוך בין Meta ל-Google משוקף לאורך הזמן."
            >
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={_pivotPlatformMonth(charts.platform_month)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#475569" }} reversed />
                  <YAxis orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <Tooltip formatter={fmtN} contentStyle={{ fontSize: 12, direction: "rtl", textAlign: "right" }} />
                  <Legend wrapperStyle={{ fontSize: 11, direction: "rtl" }} />
                  {_uniquePlatforms(charts.platform_month).map((plat) => (
                    <Line
                      key={plat}
                      type="monotone"
                      dataKey={plat}
                      stroke={PLATFORM_COLORS[plat] || "#64748b"}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {charts.irrelevant_breakdown && charts.irrelevant_breakdown.length > 0 && (
            <ChartCard
              title="❌ לידים לא רלוונטיים — פילוח"
              subtitle="כל ה-sub_status שמסומנים כ'לא רלוונטי / פסול / מכחיש'. מזהה איפה הצמצום אפשרי."
              color="#991b1b"
              footer={(() => {
                const top = (charts.irrelevant_breakdown || [])[0];
                if (!top) return null;
                return <span>סוג הפסילה הדומיננטי: <b>{top.name}</b> ({fmtN(top.value)} לידים).</span>;
              })()}
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={charts.irrelevant_breakdown} layout="vertical" margin={{ top: 10, right: 10, left: 80, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} orientation="top" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#475569" }} width={120} orientation="right" />
                  <Tooltip formatter={fmtN} contentStyle={{ fontSize: 12, direction: "rtl", textAlign: "right" }} />
                  <Bar dataKey="value" fill="#ef4444" radius={[4, 0, 0, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

      {/* ── Internal analysis (איכות לידים, ימי שבוע, לא רלוונטיים, פוטנציאל שלא נסגר) ── */}
      {smart.internal_analysis && Object.keys(smart.internal_analysis).length > 0 && (
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0c4a6e", marginBottom: 10 }}>🔬 ניתוח דאטה פנימי</div>
          {smart.internal_analysis.lead_quality && (
            <div style={{ fontSize: 13, color: "#0f172a", marginBottom: 8, lineHeight: 1.7 }}>
              <b>איכות לידים:</b> {smart.internal_analysis.lead_quality}
            </div>
          )}
          {smart.internal_analysis.day_of_week_pattern && (
            <div style={{ fontSize: 13, color: "#0f172a", marginBottom: 8, lineHeight: 1.7 }}>
              <b>דפוסי ימי שבוע:</b> {smart.internal_analysis.day_of_week_pattern}
            </div>
          )}
          {smart.internal_analysis.irrelevant_leads && (
            <div style={{ fontSize: 13, color: "#0f172a", marginBottom: 8, lineHeight: 1.7 }}>
              <b>לידים לא רלוונטיים:</b> {smart.internal_analysis.irrelevant_leads}
            </div>
          )}
          {smart.internal_analysis.missed_opportunities && (
            <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.7 }}>
              <b>פוטנציאל שלא נסגר:</b> {smart.internal_analysis.missed_opportunities}
            </div>
          )}
        </div>
      )}

      {/* ── Media analysis (CPL, budget efficiency) ── */}
      {smart.media_analysis && Object.keys(smart.media_analysis).length > 0 && (
        <div style={{ background: "#fdf4ff", border: "1px solid #f5d0fe", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#86198f", marginBottom: 10 }}>📣 ניתוח מדיה</div>
          {smart.media_analysis.cost_per_lead_trend && (
            <div style={{ fontSize: 13, color: "#0f172a", marginBottom: 8, lineHeight: 1.7 }}>
              <b>מגמת CPL:</b> {smart.media_analysis.cost_per_lead_trend}
            </div>
          )}
          {smart.media_analysis.budget_efficiency && (
            <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.7 }}>
              <b>יעילות תקציב:</b> {smart.media_analysis.budget_efficiency}
            </div>
          )}
        </div>
      )}

      {/* ── Key findings ── */}
      {(smart.key_findings || []).length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>📋 ממצאים מרכזיים</div>
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, lineHeight: 1.8 }}>
            {smart.key_findings.map((f, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>{f.claim}</span>
                <span style={{
                  fontSize: 10, padding: "1px 7px", borderRadius: 10, marginInlineStart: 6,
                  background: f.confidence === "high" ? "#dcfce7" : f.confidence === "low" ? "#fef3c7" : "#e0e7ff",
                  color:      f.confidence === "high" ? "#166534" : f.confidence === "low" ? "#92400e" : "#3730a3",
                }}>{f.confidence === "high" ? "ביטחון גבוה" : f.confidence === "low" ? "נמוך" : "בינוני"}</span>
                {(f.evidence || []).length > 0 && (
                  <ul style={{ margin: "3px 0 0", paddingInlineStart: 16, fontSize: 12, color: "#475569" }}>
                    {f.evidence.map((e, j) => <li key={j}>{e}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── What to think about ── */}
      {(smart.what_to_think_about || []).length > 0 && (
        <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>💭 נקודות לחשיבה</div>
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, lineHeight: 1.8, color: "#7c2d12" }}>
            {smart.what_to_think_about.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* ── AI priors used ── */}
      {(smart.ai_priors_used || []).length > 0 && (
        <details style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "#475569", fontWeight: 600 }}>
            🧩 ידע AI ששולב בתשובה ({smart.ai_priors_used.length})
          </summary>
          <ul style={{ margin: "8px 0 0", paddingInlineStart: 18, fontSize: 12, lineHeight: 1.7, color: "#0f172a" }}>
            {smart.ai_priors_used.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </details>
      )}

      {/* ── תשובה טקסטואלית גולמית — קיים גם כדי לראות raw ── */}
      {result.answer_text && !smart.summary && (
        <div style={{
          background: result.not_enough_info ? "rgba(245, 158, 11, 0.08)" : "#ffffff",
          border: result.not_enough_info ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid #e2e8f0",
          borderRadius: 8, padding: 16,
          color: result.not_enough_info ? "#fbbf24" : "#0f172a",
          whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, marginBottom: 14,
        }}>
          {result.answer_text}
        </div>
      )}

      {/* ── Prediction box (calc_agent — רגרסיה לינארית) ── */}
      {pred?.point != null && (
        <div style={{ background: "#ffffff", borderRadius: 8, padding: 14, marginBottom: 14,
                      border: "1px solid #16a34a40" }}>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
            תחזית רגרסיה לינארית (calc_agent)
          </div>
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

      {/* ── Signals ── */}
      {sigs.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>Signals (מנועי הניתוח)</div>
          <div>
            {sigs.map((s, i) => <SignalChip key={i} signal={s} />)}
          </div>
        </div>
      )}

      {/* ── Data gaps (technical) ── */}
      {(smart.data_gaps || []).length > 0 && (
        <details style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
            ⚠ פערי דאטה טכניים ({smart.data_gaps.length}) — backlog להנדסה
          </summary>
          <ul style={{ margin: "8px 0 0", paddingInlineStart: 18, fontSize: 12, lineHeight: 1.7, color: "#92400e" }}>
            {smart.data_gaps.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </details>
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

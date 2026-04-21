/**
 * MediaReportsPage.jsx — ממשק דוחות מדיה (שלב א')
 * ====================================================
 * תצוגה יומית / שבועית / טווח + סינון פלטפורמה + בחירת עמודות + CSV export.
 * הפעלה ידנית של דוח + שליחת מייל חוזרת.
 *
 * נתיב: /media-reports
 * Backend: /api/media-reports/*
 */
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMediaDaily,
  getMediaWeekly,
  getMediaRange,
  getMediaPlatforms,
  getMediaRuns,
  getMediaWeeklyRuns,
  runMediaDaily,
  runMediaWeekly,
  sendMediaDailyEmail,
  sendMediaWeeklyEmail,
} from "../api.js";

// ─── Utils ───────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function lastSunSat() {
  const d = new Date();
  const daysSinceSunday = (d.getDay() + 7) % 7; // Sun=0
  const lastSunday = new Date(d);
  lastSunday.setDate(d.getDate() - daysSinceSunday - 7);
  const lastSaturday = new Date(lastSunday);
  lastSaturday.setDate(lastSunday.getDate() + 6);
  return [lastSunday.toISOString().slice(0, 10), lastSaturday.toISOString().slice(0, 10)];
}

function fmtNum(v, digits = 0) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("he-IL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtMoney(v) {
  if (v === null || v === undefined) return "—";
  return `₪${fmtNum(v, 0)}`;
}

function fmtPct(v) {
  if (v === null || v === undefined) return "—";
  return `${fmtNum(v, 2)}%`;
}

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  let s;
  if (typeof v === "object") {
    // leads_by_channel וכו' — JSONB map → "פייסבוק: 3; אינסטגרם: 4"
    s = Object.entries(v)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k}: ${n}`)
      .join("; ");
  } else {
    s = String(v);
  }
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// פורמט JSONB map של פירוט ערוצים לתצוגה: "פייסבוק 3 · אינסטגרם 4"
function fmtChannelSplit(v) {
  if (!v || typeof v !== "object") return "—";
  const entries = Object.entries(v).filter(([, n]) => n > 0);
  if (!entries.length) return "—";
  return entries.map(([k, n]) => `${k} ${n}`).join(" · ");
}

// ─── Column definitions ─────────────────────────────────────────────────────

const ALL_COLUMNS = [
  { key: "platform",        label: "פלטפורמה",   default: true  },
  { key: "campaign_name",   label: "קמפיין",     default: true  },
  { key: "budget",          label: "תקציב",      default: true,  fmt: fmtMoney },
  { key: "spend",           label: "הוצאה",      default: true,  fmt: fmtMoney },
  { key: "budget_util_pct", label: "% ניצול",    default: true,  fmt: fmtPct   },
  { key: "impressions",     label: "חשיפות",     default: true,  fmt: (v) => fmtNum(v) },
  { key: "clicks",          label: "קליקים",     default: true,  fmt: (v) => fmtNum(v) },
  { key: "ctr_pct",         label: "CTR",         default: true,  fmt: fmtPct },
  // לידים — שלושה מספרים: סה"כ הגשות / חדשים / חוזרים (re-engagement).
  // leads_count ≈ new_leads_count + returning_leads_count.
  { key: "leads_count",           label: "לידים (סה״כ)",  default: true,  fmt: (v) => fmtNum(v) },
  { key: "new_leads_count",       label: "חדשים",          default: true,  fmt: (v) => fmtNum(v) },
  { key: "returning_leads_count", label: "חוזרים",         default: true,  fmt: (v) => fmtNum(v) },
  // פירוט ערוצים — default hidden, ניתן להדליק בבחירת עמודות.
  { key: "leads_by_channel",      label: "פירוט ערוצים (סה״כ)",  default: false, fmt: fmtChannelSplit },
  { key: "new_leads_by_channel",  label: "פירוט ערוצים (חדשים)", default: false, fmt: fmtChannelSplit },
  { key: "cpl",             label: "עלות לליד",  default: true,  fmt: fmtMoney },
];

// ─── Filter bar ──────────────────────────────────────────────────────────────

const MODES = [
  { id: "daily",  label: "יומי"   },
  { id: "weekly", label: "שבועי" },
  { id: "range",  label: "טווח"   },
];

// ─── Main component ─────────────────────────────────────────────────────────

export default function MediaReportsPage() {
  const navigate = useNavigate();

  const [mode, setMode]           = useState("daily");
  const [day, setDay]             = useState(yesterday());
  const [weekStart, setWeekStart] = useState(lastSunSat()[0]);
  const [weekEnd, setWeekEnd]     = useState(lastSunSat()[1]);
  const [rangeStart, setRangeStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [rangeEnd, setRangeEnd]   = useState(yesterday());

  const [platforms, setPlatforms]         = useState([]);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [data, setData]                   = useState(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [action, setAction]               = useState(null); // 'running' | 'emailing' | null
  const [actionMsg, setActionMsg]         = useState(null);
  const [runs, setRuns]                   = useState([]);
  const [showRuns, setShowRuns]           = useState(false);

  const [visibleCols, setVisibleCols] = useState(
    () => Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.default]))
  );

  // Load platforms once
  useEffect(() => {
    getMediaPlatforms()
      .then((d) => setPlatforms(d.platforms || []))
      .catch(() => setPlatforms([]));
  }, []);

  // Fetch data on mode/date changes
  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      let d;
      if (mode === "daily")       d = await getMediaDaily(day);
      else if (mode === "weekly") d = await getMediaWeekly(weekStart, weekEnd);
      else                        d = await getMediaRange(rangeStart, rangeEnd);
      setData(d);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [mode]);

  async function loadRuns() {
    try {
      const [d, w] = await Promise.all([getMediaRuns(30), getMediaWeeklyRuns(20)]);
      setRuns([
        ...(d.runs || []).map((r) => ({ ...r, kind: "daily" })),
        ...(w.runs || []).map((r) => ({ ...r, kind: "weekly" })),
      ].sort((a, b) => (b.started_at || "").localeCompare(a.started_at || "")));
    } catch {
      setRuns([]);
    }
  }

  useEffect(() => { if (showRuns) loadRuns(); }, [showRuns]);

  // ── Manual trigger ─────────────────────────────────────────────────────────
  async function handleRun(sendEmail = false) {
    setAction("running");
    setActionMsg(null);
    try {
      if (mode === "daily") {
        const res = await runMediaDaily({ day, send_email: sendEmail });
        setActionMsg(`✓ הדוח היומי ל-${day} הופעל (PID ${res.pid}). בעוד כמה דקות — רענן.`);
      } else if (mode === "weekly") {
        const res = await runMediaWeekly({ week_start: weekStart, week_end: weekEnd, send_email: sendEmail });
        setActionMsg(`✓ הדוח השבועי ${weekStart}—${weekEnd} הופעל (PID ${res.pid}).`);
      } else {
        setActionMsg("⚠ במצב טווח — אין הפעלה ידנית. עבור למצב יומי.");
      }
    } catch (err) {
      setActionMsg(`✗ שגיאה: ${err.message}`);
    } finally {
      setAction(null);
    }
  }

  async function handleSendEmail() {
    setAction("emailing");
    setActionMsg(null);
    try {
      if (mode === "daily") {
        await sendMediaDailyEmail(day);
        setActionMsg(`✓ מייל יומי נשלח עבור ${day}`);
      } else if (mode === "weekly") {
        await sendMediaWeeklyEmail(weekStart, weekEnd);
        setActionMsg(`✓ מייל שבועי נשלח עבור ${weekStart}—${weekEnd}`);
      } else {
        setActionMsg("⚠ שליחת מייל זמינה רק ביומי/שבועי.");
      }
    } catch (err) {
      setActionMsg(`✗ שגיאה: ${err.message}`);
    } finally {
      setAction(null);
    }
  }

  // ── Derive table rows ─────────────────────────────────────────────────────
  const tableRows = useMemo(() => {
    if (!data) return [];
    if (mode === "daily") {
      const rows = data.rows || [];
      const summaries = (data.platform_summaries || []);
      const filtered = platformFilter === "all"
        ? [...rows, ...summaries]
        : [...rows.filter(r => r.platform === platformFilter),
           ...summaries.filter(s => s.platform === platformFilter)];
      // sort: non-summary by platform+name, then summaries at end of each platform
      return filtered.sort((a, b) => {
        if (a.platform === b.platform) {
          if (a.is_summary && !b.is_summary) return 1;
          if (!a.is_summary && b.is_summary) return -1;
          return (a.campaign_name || "").localeCompare(b.campaign_name || "");
        }
        return (a.platform || "").localeCompare(b.platform || "");
      });
    }
    if (mode === "weekly") {
      const rows = data.weekly_summary || [];
      const filtered = platformFilter === "all"
        ? rows
        : rows.filter(r => r.platform === platformFilter);
      return filtered.map((r) => ({
        ...r,
        ctr_pct: r.impressions ? (r.clicks / r.impressions * 100) : 0,
        cpl:     r.leads_count ? (r.spend / r.leads_count) : null,
      }));
    }
    // range
    const rows = data.rows || [];
    return platformFilter === "all"
      ? rows
      : rows.filter(r => r.platform === platformFilter);
  }, [data, mode, platformFilter]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  function exportCsv() {
    if (!tableRows.length) return;
    const cols = ALL_COLUMNS.filter((c) => visibleCols[c.key]);
    const header = cols.map((c) => csvEscape(c.label)).join(",");
    const lines = tableRows.map((r) =>
      cols.map((c) => csvEscape(r[c.key] ?? "")).join(",")
    );
    const csv = "\ufeff" + [header, ...lines].join("\r\n"); // BOM for Excel Hebrew
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `media-report-${mode}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const totals = data?.totals || data?.lead_totals;
  const run    = data?.run;
  const visibleColList = ALL_COLUMNS.filter((c) => visibleCols[c.key]);

  return (
    <div
      lang="he"
      dir="rtl"
      style={{
        minHeight:  "calc(100vh - 56px)",
        background: "#060d1a",
        color:      "#e2e8f0",
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      {/* ── Sub-nav (minimal, back-to-portal) ── */}
      <div
        style={{
          background:   "#0a1628",
          borderBottom: "1px solid #1e293b",
          padding:      "0 16px",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span>📣</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#93c5fd" }}>מחלקת מדיה · דוחות</span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 12px", marginRight: 8, fontSize: 12,
            color: "#475569", background: "none",
            border: "1px solid #1e293b", borderRadius: 7, cursor: "pointer",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#93c5fd"; e.currentTarget.style.borderColor = "#3b82f6"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#475569"; e.currentTarget.style.borderColor = "#1e293b"; }}
        >
          ⌂ פורטל
        </button>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 20px" }}>
        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#e2e8f0" }}>דוחות מדיה</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
              נתונים גולמיים ל-Meta / Google + לידים מ-Fireberry · שלב א' — ללא המלצות
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRuns((v) => !v)}
            style={{
              background: "#0d1626", border: "1px solid #1e3a5f", color: "#93c5fd",
              borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer",
            }}
          >
            {showRuns ? "הסתר ריצות" : "📋 ריצות אחרונות"}
          </button>
        </div>

        {/* ── Mode tabs ── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              style={{
                padding: "8px 18px", fontSize: 13, fontWeight: 600,
                borderRadius: 8, cursor: "pointer",
                background: mode === m.id ? "#1e3a5f" : "#0d1626",
                color:      mode === m.id ? "#e2e8f0" : "#64748b",
                border: `1px solid ${mode === m.id ? "#3b82f6" : "#1e293b"}`,
                transition: "all 0.15s",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* ── Filters ── */}
        <div style={{
          background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10,
          padding: "14px 16px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          {mode === "daily" && (
            <label style={{ fontSize: 13, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
              תאריך:
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
                style={dateInputStyle} />
            </label>
          )}
          {mode === "weekly" && (
            <>
              <label style={{ fontSize: 13, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
                מ:
                <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} style={dateInputStyle} />
              </label>
              <label style={{ fontSize: 13, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
                עד:
                <input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} style={dateInputStyle} />
              </label>
              <button type="button"
                onClick={() => { const [s, e] = lastSunSat(); setWeekStart(s); setWeekEnd(e); }}
                style={chipBtnStyle}>שבוע קודם</button>
            </>
          )}
          {mode === "range" && (
            <>
              <label style={{ fontSize: 13, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
                מ:
                <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} style={dateInputStyle} />
              </label>
              <label style={{ fontSize: 13, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
                עד:
                <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} style={dateInputStyle} />
              </label>
            </>
          )}

          <label style={{ fontSize: 13, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
            פלטפורמה:
            <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} style={selectStyle}>
              <option value="all">כל הפלטפורמות</option>
              {platforms.map((p) => (
                <option key={p.name} value={p.name} disabled={!p.enabled}>
                  {p.label_he}{!p.enabled ? " (לא מחובר)" : ""}
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={fetchData} disabled={loading}
            style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }}>
            {loading ? "טוען…" : "🔄 רענן"}
          </button>

          <div style={{ flex: 1 }} />

          {mode !== "range" && (
            <>
              <button type="button" onClick={() => handleRun(false)} disabled={action === "running"}
                style={{ ...secondaryBtn, opacity: action === "running" ? 0.6 : 1 }}>
                {action === "running" ? "משגר…" : "▶ הפעל דוח"}
              </button>
              <button type="button" onClick={handleSendEmail} disabled={action === "emailing"}
                style={{ ...secondaryBtn, opacity: action === "emailing" ? 0.6 : 1 }}>
                {action === "emailing" ? "שולח…" : "✉ שלח מייל"}
              </button>
            </>
          )}

          <button type="button" onClick={exportCsv} disabled={!tableRows.length}
            style={{ ...secondaryBtn, opacity: tableRows.length ? 1 : 0.5 }}>
            ⬇ CSV
          </button>
        </div>

        {/* ── Action message ── */}
        {actionMsg && (
          <div style={{
            background: actionMsg.startsWith("✗") ? "#1a0c0c" : "#0c1a0e",
            border:     `1px solid ${actionMsg.startsWith("✗") ? "#7f1d1d" : "#166534"}`,
            color:      actionMsg.startsWith("✗") ? "#fca5a5" : "#86efac",
            borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14,
          }}>
            {actionMsg}
          </div>
        )}

        {/* ── Run status ── */}
        {mode === "daily" && run && (
          <div style={runStatusStyle(run.status)}>
            <strong>סטטוס הדוח:</strong> {hebStatus(run.status)}
            {run.email_sent_at && <span> · מייל נשלח {fmtDateTime(run.email_sent_at)}</span>}
            {run.platforms_err && Object.keys(run.platforms_err).length > 0 && (
              <span style={{ color: "#fca5a5", marginInlineStart: 8 }}>
                (שגיאות: {Object.keys(run.platforms_err).join(", ")})
              </span>
            )}
          </div>
        )}

        {/* ── Totals ── */}
        {totals && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
            {mode === "daily" ? (
              <>
                <StatCard label="סה״כ לידים"   value={fmtNum(totals.total_leads ?? 0)} />
                <StatCard label="רשומות 1006" value={fmtNum(totals.raw_records_count ?? 0)} />
              </>
            ) : mode === "weekly" ? (
              <>
                <StatCard label="סה״כ קמפיינים"  value={fmtNum(totals.campaigns)} />
                <StatCard label="סה״כ לידים"     value={fmtNum(totals.leads_count)} />
                <StatCard label="סה״כ הוצאה"     value={fmtMoney(totals.spend)} />
                <StatCard label="סה״כ חשיפות"    value={fmtNum(totals.impressions)} />
                <StatCard label="סה״כ קליקים"    value={fmtNum(totals.clicks)} />
                <StatCard label="CTR כולל"       value={fmtPct(totals.ctr_pct)} />
                <StatCard label="עלות לליד"      value={fmtMoney(totals.cpl)} />
              </>
            ) : null}
          </div>
        )}

        {/* ── Column picker ── */}
        <details style={{
          background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10,
          padding: "10px 14px", marginBottom: 14, fontSize: 13,
        }}>
          <summary style={{ cursor: "pointer", color: "#94a3b8", fontWeight: 600 }}>⚙ בחר עמודות</summary>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 14 }}>
            {ALL_COLUMNS.map((c) => (
              <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 6, color: "#cbd5e1", cursor: "pointer" }}>
                <input type="checkbox" checked={visibleCols[c.key]}
                  onChange={(e) => setVisibleCols({ ...visibleCols, [c.key]: e.target.checked })} />
                {c.label}
              </label>
            ))}
          </div>
        </details>

        {/* ── Error ── */}
        {error && (
          <div style={{ background: "#1a0c0c", border: "1px solid #7f1d1d", color: "#fca5a5", padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Table ── */}
        <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#0d1626" }}>
                <tr>
                  {visibleColList.map((c) => (
                    <th key={c.key} style={thStyle}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={visibleColList.length} style={{ textAlign: "center", color: "#64748b", padding: "36px 0" }}>טוען…</td></tr>
                )}
                {!loading && tableRows.length === 0 && (
                  <tr><td colSpan={visibleColList.length} style={{ textAlign: "center", color: "#64748b", padding: "36px 0" }}>אין שורות להצגה</td></tr>
                )}
                {!loading && tableRows.map((r, i) => (
                  <tr key={i} style={{
                    background: r.is_summary ? "#111d33" : "transparent",
                    borderTop: "1px solid #101a2c",
                    fontWeight: r.is_summary ? 600 : 400,
                    color:      r.is_summary ? "#93c5fd" : "#cbd5e1",
                  }}>
                    {visibleColList.map((c) => (
                      <td key={c.key} style={tdStyle}>
                        {c.fmt ? c.fmt(r[c.key]) : (r[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Runs history panel ── */}
        {showRuns && (
          <div style={{ marginTop: 20, background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", margin: "0 0 12px" }}>ריצות אחרונות</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead style={{ background: "#0d1626" }}>
                  <tr>
                    <th style={thStyle}>סוג</th>
                    <th style={thStyle}>תאריך/שבוע</th>
                    <th style={thStyle}>סטטוס</th>
                    <th style={thStyle}>החל</th>
                    <th style={thStyle}>הסתיים</th>
                    <th style={thStyle}>מייל</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 40).map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #101a2c", color: "#cbd5e1" }}>
                      <td style={tdStyle}>{r.kind === "weekly" ? "שבועי" : "יומי"}</td>
                      <td style={tdStyle}>{r.report_date || `${r.week_start} — ${r.week_end}`}</td>
                      <td style={tdStyle}><span style={{ color: statusColor(r.status) }}>{hebStatus(r.status)}</span></td>
                      <td style={tdStyle}>{fmtDateTime(r.started_at)}</td>
                      <td style={tdStyle}>{fmtDateTime(r.completed_at)}</td>
                      <td style={tdStyle}>
                        {r.email_sent_at ? "✓ " + fmtDateTime(r.email_sent_at) :
                         r.email_error ? <span style={{ color: "#fca5a5" }} title={r.email_error}>✗</span> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Footer note ── */}
        <p style={{ marginTop: 20, fontSize: 11, color: "#334155", textAlign: "center" }}>
          שלב א' — נתונים יבשים בלבד. ניתוח והמלצות יגיעו בשלבים הבאים.
        </p>
      </div>
    </div>
  );
}

// ─── Small components & styles ──────────────────────────────────────────────

function StatCard({ label, value }) {
  return (
    <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>{value}</div>
    </div>
  );
}

function hebStatus(s) {
  return {
    running:             "רץ",
    completed:           "הושלם",
    partial:             "חלקי",
    failed:              "נכשל",
    skipped_concurrent:  "דולג",
    timeout:             "timeout",
  }[s] || s || "—";
}

function statusColor(s) {
  return {
    completed: "#86efac",
    partial:   "#fcd34d",
    running:   "#93c5fd",
    failed:    "#fca5a5",
    timeout:   "#fca5a5",
  }[s] || "#94a3b8";
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

function runStatusStyle(status) {
  const color = statusColor(status);
  return {
    background: "#0a1628", border: `1px solid ${color}40`,
    color: "#cbd5e1", borderRadius: 8,
    padding: "10px 14px", fontSize: 13, marginBottom: 14,
  };
}

const dateInputStyle = {
  background: "#060d1a", color: "#e2e8f0", border: "1px solid #1e293b",
  borderRadius: 6, padding: "5px 8px", fontSize: 13,
};

const selectStyle = {
  background: "#060d1a", color: "#e2e8f0", border: "1px solid #1e293b",
  borderRadius: 6, padding: "5px 8px", fontSize: 13,
};

const chipBtnStyle = {
  background: "#0d1626", border: "1px solid #1e3a5f", color: "#93c5fd",
  borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer",
};

const primaryBtn = {
  background: "#1e3a5f", border: "1px solid #3b82f6", color: "#e2e8f0",
  borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

const secondaryBtn = {
  background: "#0d1626", border: "1px solid #1e293b", color: "#cbd5e1",
  borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer",
};

const thStyle = {
  textAlign: "right", fontSize: 12, fontWeight: 600, color: "#94a3b8",
  padding: "10px 12px", borderBottom: "1px solid #1e293b", whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "9px 12px", whiteSpace: "nowrap",
};

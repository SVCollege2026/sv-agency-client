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
  getMonthlySchoolKpi,
  getMonthlyCoursesKpi,
  runMonthlyKpi,
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

// עמודות לתצוגת "פירוט לפי מדיה" — per-campaign (ad sets / קמפיינים), רק ממומנים.
const DETAIL_COLUMNS = [
  { key: "platform",        label: "פלטפורמה",   default: true  },
  { key: "campaign_name",   label: "קמפיין",     default: true  },
  { key: "budget",          label: "תקציב",      default: true,  fmt: fmtMoney },
  { key: "spend",           label: "הוצאה",      default: true,  fmt: fmtMoney },
  { key: "budget_util_pct", label: "% ניצול",    default: true,  fmt: fmtPct   },
  { key: "impressions",     label: "חשיפות",     default: true,  fmt: (v) => fmtNum(v) },
  { key: "clicks",          label: "קליקים",     default: true,  fmt: (v) => fmtNum(v) },
  { key: "ctr_pct",         label: "CTR",         default: true,  fmt: fmtPct },
  { key: "leads_count",           label: "לידים (סה״כ)",  default: true,  fmt: (v) => fmtNum(v) },
  { key: "new_leads_count",       label: "חדשים",          default: true,  fmt: (v) => fmtNum(v) },
  { key: "returning_leads_count", label: "חוזרים",         default: true,  fmt: (v) => fmtNum(v) },
  { key: "leads_by_channel",      label: "פירוט ערוצים (סה״כ)",  default: false, fmt: fmtChannelSplit },
  { key: "new_leads_by_channel",  label: "פירוט ערוצים (חדשים)", default: false, fmt: fmtChannelSplit },
  { key: "cpl",             label: "עלות לליד",  default: true,  fmt: fmtMoney },
];

// עמודות לטבלה ראשית — שורה אחת לכל מדיה.
// לא-ממומנים (ספקי לידים / אתר הבית / וכו׳) מציגים רק לידים; שאר השדות ריקים.
const MASTER_COLUMNS = [
  { key: "source_name",     label: "מדיה / מקור",   default: true },
  { key: "source_kind_he",  label: "סוג",           default: true },
  { key: "campaigns_count", label: "קמפיינים",      default: true,  fmt: (v) => fmtNum(v) },
  { key: "spend",           label: "הוצאה",         default: true,  fmt: fmtMoney },
  { key: "impressions",     label: "חשיפות",        default: true,  fmt: (v) => fmtNum(v) },
  { key: "clicks",          label: "קליקים",        default: true,  fmt: (v) => fmtNum(v) },
  { key: "ctr_pct",         label: "CTR",           default: true,  fmt: fmtPct },
  { key: "leads_count",           label: "לידים (סה״כ)", default: true, fmt: (v) => fmtNum(v) },
  { key: "new_leads_count",       label: "חדשים",        default: true, fmt: (v) => fmtNum(v) },
  { key: "returning_leads_count", label: "חוזרים",       default: true, fmt: (v) => fmtNum(v) },
  { key: "cpl",             label: "עלות לליד",     default: true,  fmt: fmtMoney },
];

// לאחור-תאימות — טווח/שבועי עדיין משתמשים ב-ALL_COLUMNS.
const ALL_COLUMNS = DETAIL_COLUMNS;

const DAILY_VIEWS = [
  { id: "master",     label: "🏁 ראשית (לפי מדיה)" },
  { id: "detail",     label: "🔎 פירוט לפי מדיה"   },
  { id: "sub_status", label: "📊 תת-סטטוס"         },
  { id: "analytics",  label: "🌐 אנליטיקס"         },
];

function hebSourceKind(k) {
  return { paid: "ממומן", non_paid: "לא-ממומן" }[k] || "—";
}

// ─── Filter bar ──────────────────────────────────────────────────────────────

const MODES = [
  { id: "daily",   label: "יומי"   },
  { id: "weekly",  label: "שבועי" },
  { id: "range",   label: "טווח"   },
  { id: "monthly", label: "📈 חודשי Y-o-Y" },
];

// ─── Monthly KPI sub-component ─────────────────────────────────────────────
// תצוגה זו מחקה את SV_Monthly_Comparison.xlsx:
//   • חודשים = עמודות רמה 1 (ינואר/פברואר/...), כל אחת מתחלקת ל-3 עמודות 25/26/Δ%
//   • מטריקות = שורות (לידים מ-Meta, תקציב, CPL, נרשמים, מבטלים, ...)

const HEB_MONTHS_FULL = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

// Format helpers — תואמים ל-build_monthly_comparison.py
function fmtMetric(v, kind) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  if (kind === "n")        return fmtNum(Math.round(n), 0);
  if (kind === "money")    return `₪${fmtNum(Math.round(n), 0)}`;
  if (kind === "money_d")  return `₪${fmtNum(n, 2)}`;
  if (kind === "pct")      return `${fmtNum(n * 100, 2)}%`;
  return String(v);
}

function pctChange(v25, v26) {
  if (v25 == null || v26 == null) return null;
  const a = Number(v25), b = Number(v26);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  if (a === 0)  return b === 0 ? 0 : null;
  return (b - a) / a * 100;
}

function fmtDelta(d) {
  if (d == null) return "—";
  const sign = d > 0 ? "+" : "";
  return `${sign}${fmtNum(d, 1)}%`;
}
function deltaColor(d) {
  if (d == null || d === 0) return "#94a3b8";
  return d > 0 ? "#86efac" : "#fca5a5";
}

// Metrics list — תואם בדיוק ל-METRICS שב-build_monthly_comparison.py:325-374
const SCHOOL_METRICS = [
  { label: "▼ בלוק 1 — פעילות החודש (Action) ▼",        group: true },
  { label: "— לידים שהגיעו (לפי פלטפורמה) —",            group: true },
  { label: "לידים מ-Meta (פייסבוק+אינסטגרם)",           key: "leads_meta",        kind: "n"       },
  { label: "לידים מ-Google",                            key: "leads_google",      kind: "n"       },
  { label: "לידים מטיקטוק/לינקדאין",                    key: "leads_other_paid",  kind: "n"       },
  { label: "לידים מספקי לידים",                         key: "leads_vendor",      kind: "n"       },
  { label: "לידים אורגניים",                            key: "leads_organic",     kind: "n"       },
  { label: "לידים אחר/לא ידוע",                         key: "leads_other",       kind: "n"       },
  { label: "סה\"כ לידים",                              key: "leads_total",       kind: "n",      total: true },
  { label: "— תקציב מדיה (Meta + Google בנפרד) —",       group: true },
  { label: "תקציב Meta ₪",                              key: "spend_meta",        kind: "money"   },
  { label: "תקציב Google ₪",                            key: "spend_google",      kind: "money"   },
  { label: "סה\"כ תקציב ₪",                            key: "spend_total",       kind: "money",  total: true },
  { label: "— CPL לפי פלטפורמה —",                     group: true },
  { label: "CPL Meta ₪ (תקציב/לידים Meta)",             key: "cpl_meta",          kind: "money_d" },
  { label: "CPL Google ₪ (תקציב/לידים Google)",         key: "cpl_google",        kind: "money_d" },
  { label: "— נרשמים שעשו רישום החודש (Action) —",     group: true },
  { label: "נרשמים החודש סה\"כ",                       key: "reg_action_total",  kind: "n",      total: true },
  { label: "   ↳ ממקור Meta",                          key: "reg_action_meta",   kind: "n"       },
  { label: "   ↳ ממקור Google",                        key: "reg_action_google", kind: "n"       },
  { label: "עלות לנרשם Action — Meta ₪ ⚠",             key: "cpr_action_meta",   kind: "money_d" },
  { label: "עלות לנרשם Action — Google ₪ ⚠",           key: "cpr_action_google", kind: "money_d" },
  { label: "% המרה Action ⚠",                          key: "conv_action",       kind: "pct"     },
  { label: "מבטלים החודש",                             key: "canc_action",       kind: "n"       },
  { label: "% ביטול",                                  key: "canc_rate",         kind: "pct"     },
  { label: "▼ בלוק 2 — מקור הליד (Attribution / Cohort) ▼", group: true },
  { label: "— מהלידים שהגיעו בחודש: כמה נרשמו —",      group: true },
  { label: "סה\"כ נרשמו עד היום",                      key: "reg_cohort_total",  kind: "n",      total: true },
  { label: "   ↳ נרשמו באותו חודש",                    key: "reg_same_month",    kind: "n"       },
  { label: "   ↳ נרשמו +1 חודש",                       key: "reg_plus1",         kind: "n"       },
  { label: "   ↳ נרשמו +2 חודשים ויותר",               key: "reg_plus2plus",     kind: "n"       },
  { label: "— נרשמים מהקוהורט לפי פלטפורמה —",        group: true },
  { label: "נרשמים מקוהורט — Meta",                    key: "reg_cohort_meta",   kind: "n"       },
  { label: "נרשמים מקוהורט — Google",                  key: "reg_cohort_google", kind: "n"       },
  { label: "— ROI אמיתי (Cohort) —",                  group: true },
  { label: "% המרה Cohort",                            key: "conv_cohort",       kind: "pct"     },
  { label: "עלות לנרשם Cohort — Meta ₪ ✓",             key: "cpr_cohort_meta",   kind: "money_d" },
  { label: "עלות לנרשם Cohort — Google ₪ ✓",           key: "cpr_cohort_google", kind: "money_d" },
];

// קורסים פעילים — תואם ל-monthly_kpi_aggregator._ACTIVE_COURSES
const COURSE_METRICS = [
  { id: "reg_total_ytd", label: "סה\"כ נרשמו (YTD)" },
  { id: "active_ytd",    label: "רשומים פעילים (YTD)" },
  { id: "canc_ytd",      label: "מבטלים (YTD)" },
  { id: "frozen_ytd",    label: "מקפיאים (YTD)" },
];

function MonthlyKpiView() {
  const [tab, setTab] = useState("school"); // 'school' | 'courses'
  const [school, setSchool] = useState([]);
  const [courses, setCourses] = useState([]);
  const [currYear, setCurrYear] = useState(2026); // השנה ה"נוכחית" — תושווה ל-(currYear-1)
  const [courseMetric, setCourseMetric] = useState("reg_total_ytd");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [running, setRunning] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      if (tab === "school") {
        const d = await getMonthlySchoolKpi();
        setSchool(d.rows || []);
      } else {
        // לקורסים — מביאים גם year וגם year-1 כדי שיהיה לנו Y-o-Y
        const [a, b] = await Promise.all([
          getMonthlyCoursesKpi({ year: currYear - 1 }),
          getMonthlyCoursesKpi({ year: currYear }),
        ]);
        setCourses([...(a.rows || []), ...(b.rows || [])]);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, currYear]);

  async function handleRecompute() {
    // טריגר ידני לחודש שעבר (כמו ה-cron)
    const today = new Date();
    let y = today.getFullYear(), m = today.getMonth(); // החודש הקודם (0-indexed → 1..12 אחרי +1)
    if (m === 0) { y -= 1; m = 12; }
    setRunning(true); setActionMsg(null);
    try {
      const res = await runMonthlyKpi(y, m);
      setActionMsg(`✓ חישוב מחדש ל-${res.month}: ${res.rows?.school || 0} בית-ספר, ${res.rows?.courses || 0} קורסים. (מקור: ${res.source})`);
      await load();
    } catch (e) {
      setActionMsg(`✗ שגיאה: ${e.message}`);
    } finally {
      setRunning(false);
    }
  }

  const tabBtn = (id, label) => (
    <button key={id} type="button" onClick={() => setTab(id)}
      style={{
        padding: "8px 16px", fontSize: 13, fontWeight: 600,
        borderRadius: 8, cursor: "pointer",
        background: tab === id ? "#1e3a5f" : "#0d1626",
        color:      tab === id ? "#e2e8f0" : "#64748b",
        border: `1px solid ${tab === id ? "#3b82f6" : "#1e293b"}`,
      }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        {tabBtn("school",  "🏫 סה\"כ בית הספר")}
        {tabBtn("courses", "🎓 לפי קורס YTD")}

        <span style={{ marginInlineStart: 12, fontSize: 12, color: "#64748b" }}>השוואה:</span>
        <select value={currYear} onChange={(e) => setCurrYear(Number(e.target.value))}
          style={{
            background: "#0d1626", border: "1px solid #1e3a5f",
            color: "#cbd5e1", borderRadius: 6, padding: "6px 10px", fontSize: 13,
          }}>
          {[2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y - 1} מול {y}</option>
          ))}
        </select>

        {tab === "courses" && (
          <select value={courseMetric} onChange={(e) => setCourseMetric(e.target.value)}
            style={{
              background: "#0d1626", border: "1px solid #1e3a5f",
              color: "#cbd5e1", borderRadius: 6, padding: "6px 10px", fontSize: 13,
            }}>
            {COURSE_METRICS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        )}

        <div style={{ flex: 1 }} />

        <button type="button" onClick={handleRecompute} disabled={running}
          style={{ ...secondaryBtn, opacity: running ? 0.6 : 1 }}>
          {running ? "מחשב…" : "▶ חשב מחדש (חודש שעבר)"}
        </button>
        <button type="button" onClick={load} disabled={loading}
          style={{ ...secondaryBtn, opacity: loading ? 0.6 : 1 }}>
          🔄 רענן
        </button>
      </div>

      {actionMsg && (
        <div style={{
          background: actionMsg.startsWith("✗") ? "#1a0c0c" : "#0c1a0e",
          border:     `1px solid ${actionMsg.startsWith("✗") ? "#7f1d1d" : "#166534"}`,
          color:      actionMsg.startsWith("✗") ? "#fca5a5" : "#86efac",
          borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12,
        }}>{actionMsg}</div>
      )}

      {error && (
        <div style={{ background: "#1a0c0c", border: "1px solid #7f1d1d", color: "#fca5a5",
                      padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          ⚠ {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>טוען…</div>
      )}

      {!loading && tab === "school"  && <SchoolKpiTable  rows={school} currYear={currYear} />}
      {!loading && tab === "courses" && <CoursesKpiTable rows={courses} currYear={currYear} metricId={courseMetric} />}
    </div>
  );
}

// SchoolKpiTable — Y-o-Y pivot בסגנון Excel.
//   header: row 1 = months (colSpan=3), row 2 = "25 | 26 | Δ%"
//   body:   each metric row + group separators
function SchoolKpiTable({ rows, currYear }) {
  const prevYear = currYear - 1;

  // Build map: year → { month_num → row }
  const byYearMonth = useMemo(() => {
    const map = {};
    for (const r of rows || []) {
      if (!r.month_ym) continue;
      const y = parseInt(r.month_ym.slice(0, 4), 10);
      const m = parseInt(r.month_ym.slice(5, 7), 10);
      if (!map[y]) map[y] = {};
      map[y][m] = r;
    }
    return map;
  }, [rows]);

  // קביעת חודשים להצגה — כל החודשים שיש להם נתונים בשנה הנוכחית או הקודמת
  const monthsToShow = useMemo(() => {
    const set = new Set();
    [prevYear, currYear].forEach((y) => {
      if (byYearMonth[y]) Object.keys(byYearMonth[y]).forEach((m) => set.add(parseInt(m, 10)));
    });
    return [...set].sort((a, b) => a - b);
  }, [byYearMonth, prevYear, currYear]);

  if (monthsToShow.length === 0) {
    return <div style={{ color: "#64748b", padding: 40, textAlign: "center" }}>
      אין נתונים להשוואה בין {prevYear} ל-{currYear}
    </div>;
  }

  const subYearShort = (y) => String(y).slice(-2);

  return (
    <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "#0d1626", position: "sticky", top: 0 }}>
            {/* Row 1: months (each colSpan=3) */}
            <tr>
              <th rowSpan={2} style={{ ...thStyle, minWidth: 280, textAlign: "right",
                  borderInlineEnd: "1px solid #1e293b", background: "#0d1626" }}>מטריקה</th>
              {monthsToShow.map((m) => (
                <th key={m} colSpan={3} style={{ ...thStyle, textAlign: "center",
                    borderInlineEnd: "1px solid #1e293b", color: "#93c5fd",
                    background: "#101a2c", fontSize: 13 }}>
                  {HEB_MONTHS_FULL[m - 1]}
                </th>
              ))}
            </tr>
            {/* Row 2: 25 | 26 | Δ% */}
            <tr>
              {monthsToShow.flatMap((m) => [
                <th key={`${m}-prev`} style={{ ...thStyle, textAlign: "center",
                    color: "#94a3b8", borderInlineStart: "1px solid #1e293b" }}>
                  '{subYearShort(prevYear)}
                </th>,
                <th key={`${m}-curr`} style={{ ...thStyle, textAlign: "center", color: "#94a3b8" }}>
                  '{subYearShort(currYear)}
                </th>,
                <th key={`${m}-delta`} style={{ ...thStyle, textAlign: "center",
                    color: "#94a3b8", borderInlineEnd: "1px solid #1e293b" }}>Δ%</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {SCHOOL_METRICS.map((row, idx) => {
              if (row.group) {
                return (
                  <tr key={`g-${idx}`} style={{ background: "#0d1f3a", borderTop: "1px solid #1e3a5f" }}>
                    <td colSpan={1 + monthsToShow.length * 3}
                        style={{ padding: "8px 12px", fontWeight: 700, color: "#93c5fd", fontSize: 12 }}>
                      {row.label}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={row.key} style={{
                  borderTop: "1px solid #101a2c",
                  background: row.total ? "#101a2c" : "transparent",
                  fontWeight: row.total ? 700 : 400,
                  color: row.total ? "#e2e8f0" : "#cbd5e1",
                }}>
                  <td style={{ ...tdStyle, textAlign: "right",
                       borderInlineEnd: "1px solid #1e293b", whiteSpace: "nowrap" }}>{row.label}</td>
                  {monthsToShow.map((m) => {
                    const prevRow = byYearMonth[prevYear]?.[m];
                    const currRow = byYearMonth[currYear]?.[m];
                    const v25 = prevRow ? prevRow[row.key] : null;
                    const v26 = currRow ? currRow[row.key] : null;
                    const d   = pctChange(v25, v26);
                    return [
                      <td key={`${m}-p`} style={{ ...tdStyle, textAlign: "center",
                          borderInlineStart: "1px solid #1e293b" }}>{fmtMetric(v25, row.kind)}</td>,
                      <td key={`${m}-c`} style={{ ...tdStyle, textAlign: "center" }}>{fmtMetric(v26, row.kind)}</td>,
                      <td key={`${m}-d`} style={{ ...tdStyle, textAlign: "center",
                          color: deltaColor(d), fontWeight: 600,
                          borderInlineEnd: "1px solid #1e293b" }}>{fmtDelta(d)}</td>,
                    ];
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// CoursesKpiTable — Y-o-Y pivot בסגנון Excel:
//   header: row 1 = months, row 2 = 25/26/Δ%
//   body:   each course = one row (אוחד למטריקה אחת לפי הבחירה)
function CoursesKpiTable({ rows, currYear, metricId }) {
  const prevYear = currYear - 1;

  // Build map: course → year → month → row
  const byCourse = useMemo(() => {
    const map = {};
    for (const r of rows || []) {
      if (!r.course_clean) continue;
      const y = r.year, m = r.month_num;
      if (!map[r.course_clean]) map[r.course_clean] = {};
      if (!map[r.course_clean][y]) map[r.course_clean][y] = {};
      map[r.course_clean][y][m] = r;
    }
    return map;
  }, [rows]);

  const courseList = useMemo(() => Object.keys(byCourse).sort((a, b) => a.localeCompare(b, "he")), [byCourse]);

  const monthsToShow = useMemo(() => {
    const set = new Set();
    for (const c of courseList) {
      [prevYear, currYear].forEach((y) => {
        if (byCourse[c][y]) Object.keys(byCourse[c][y]).forEach((m) => set.add(parseInt(m, 10)));
      });
    }
    return [...set].sort((a, b) => a - b);
  }, [byCourse, courseList, prevYear, currYear]);

  if (courseList.length === 0 || monthsToShow.length === 0) {
    return <div style={{ color: "#64748b", padding: 40, textAlign: "center" }}>
      אין נתונים להשוואה בין {prevYear} ל-{currYear}
    </div>;
  }

  const subYearShort = (y) => String(y).slice(-2);
  const metricLabel = COURSE_METRICS.find((m) => m.id === metricId)?.label || metricId;

  // חישוב סה"כ בית הספר (פר חודש פר שנה)
  const totals = {};
  for (const y of [prevYear, currYear]) {
    totals[y] = {};
    for (const m of monthsToShow) {
      let s = 0, hasData = false;
      for (const c of courseList) {
        const r = byCourse[c]?.[y]?.[m];
        if (r && r[metricId] != null) { s += Number(r[metricId]); hasData = true; }
      }
      totals[y][m] = hasData ? s : null;
    }
  }

  return (
    <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", color: "#64748b", fontSize: 12, borderBottom: "1px solid #1e293b" }}>
        מציג: <span style={{ color: "#93c5fd", fontWeight: 600 }}>{metricLabel}</span> · השוואה {prevYear} מול {currYear}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "#0d1626" }}>
            <tr>
              <th rowSpan={2} style={{ ...thStyle, minWidth: 180, textAlign: "right",
                  borderInlineEnd: "1px solid #1e293b", background: "#0d1626" }}>קורס</th>
              {monthsToShow.map((m) => (
                <th key={m} colSpan={3} style={{ ...thStyle, textAlign: "center",
                    borderInlineEnd: "1px solid #1e293b", color: "#93c5fd",
                    background: "#101a2c", fontSize: 13 }}>
                  {HEB_MONTHS_FULL[m - 1]}
                </th>
              ))}
            </tr>
            <tr>
              {monthsToShow.flatMap((m) => [
                <th key={`${m}-p`} style={{ ...thStyle, textAlign: "center",
                    color: "#94a3b8", borderInlineStart: "1px solid #1e293b" }}>'{subYearShort(prevYear)}</th>,
                <th key={`${m}-c`} style={{ ...thStyle, textAlign: "center", color: "#94a3b8" }}>'{subYearShort(currYear)}</th>,
                <th key={`${m}-d`} style={{ ...thStyle, textAlign: "center",
                    color: "#94a3b8", borderInlineEnd: "1px solid #1e293b" }}>Δ%</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {courseList.map((course) => (
              <tr key={course} style={{ borderTop: "1px solid #101a2c", color: "#cbd5e1" }}>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#93c5fd",
                     borderInlineEnd: "1px solid #1e293b" }}>{course}</td>
                {monthsToShow.map((m) => {
                  const v25 = byCourse[course]?.[prevYear]?.[m]?.[metricId] ?? null;
                  const v26 = byCourse[course]?.[currYear]?.[m]?.[metricId] ?? null;
                  const d   = pctChange(v25, v26);
                  return [
                    <td key={`${m}-p`} style={{ ...tdStyle, textAlign: "center",
                         borderInlineStart: "1px solid #1e293b" }}>{fmtMetric(v25, "n")}</td>,
                    <td key={`${m}-c`} style={{ ...tdStyle, textAlign: "center" }}>{fmtMetric(v26, "n")}</td>,
                    <td key={`${m}-d`} style={{ ...tdStyle, textAlign: "center", color: deltaColor(d),
                         fontWeight: 600, borderInlineEnd: "1px solid #1e293b" }}>{fmtDelta(d)}</td>,
                  ];
                })}
              </tr>
            ))}
            {/* סה"כ בית הספר */}
            <tr style={{ borderTop: "2px solid #1e3a5f", background: "#101a2c", fontWeight: 700, color: "#e2e8f0" }}>
              <td style={{ ...tdStyle, textAlign: "right", borderInlineEnd: "1px solid #1e293b" }}>סה"כ בית הספר</td>
              {monthsToShow.map((m) => {
                const v25 = totals[prevYear][m];
                const v26 = totals[currYear][m];
                const d   = pctChange(v25, v26);
                return [
                  <td key={`${m}-p`} style={{ ...tdStyle, textAlign: "center",
                       borderInlineStart: "1px solid #1e293b" }}>{fmtMetric(v25, "n")}</td>,
                  <td key={`${m}-c`} style={{ ...tdStyle, textAlign: "center" }}>{fmtMetric(v26, "n")}</td>,
                  <td key={`${m}-d`} style={{ ...tdStyle, textAlign: "center", color: deltaColor(d),
                       fontWeight: 700, borderInlineEnd: "1px solid #1e293b" }}>{fmtDelta(d)}</td>,
                ];
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function MediaReportsPage() {
  const navigate = useNavigate();

  const [mode, setMode]           = useState("daily");
  const [dailyView, setDailyView] = useState("master");  // master | detail | sub_status | analytics
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

  // עמודות פעילות לפי תת-תצוגת daily.
  const activeColumns = useMemo(() => {
    if (mode === "daily" && dailyView === "master") return MASTER_COLUMNS;
    return DETAIL_COLUMNS;
  }, [mode, dailyView]);

  // סנכרון visibleCols כש-activeColumns משתנה — להדליק דיפולטים של הסט החדש.
  useEffect(() => {
    setVisibleCols((prev) => {
      const next = { ...prev };
      for (const c of activeColumns) {
        if (next[c.key] === undefined) next[c.key] = c.default;
      }
      return next;
    });
  }, [activeColumns]);

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
      // master = שורה לכל מדיה (ממומנות + לא-ממומנות)
      if (dailyView === "master") {
        const master = (data.master_rows || []).map((r) => ({
          ...r,
          source_kind_he: hebSourceKind(r.source_kind),
        }));
        return master;
      }
      // detail = per-campaign, ממומנים בלבד. platform filter קובע באיזו מדיה לדרול
      if (dailyView === "detail") {
        const rows = data.detail_rows || data.rows || [];
        const filtered = platformFilter === "all"
          ? rows
          : rows.filter(r => r.platform === platformFilter);
        return filtered.sort((a, b) => {
          if (a.platform === b.platform) {
            return (a.campaign_name || "").localeCompare(b.campaign_name || "");
          }
          return (a.platform || "").localeCompare(b.platform || "");
        });
      }
      // sub_status / analytics — מטופלים ברינדור ישירות (לא דרך tableRows)
      return [];
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
  }, [data, mode, dailyView, platformFilter]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  function exportCsv() {
    if (!tableRows.length) return;
    const cols = activeColumns.filter((c) => visibleCols[c.key]);
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
  const visibleColList = activeColumns.filter((c) => visibleCols[c.key]);

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

        {/* ── Daily sub-tabs ── */}
        {mode === "daily" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {DAILY_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setDailyView(v.id)}
                style={{
                  padding: "7px 14px", fontSize: 12, fontWeight: 600,
                  borderRadius: 8, cursor: "pointer",
                  background: dailyView === v.id ? "#1e3a5f" : "#0d1626",
                  color:      dailyView === v.id ? "#e2e8f0" : "#64748b",
                  border: `1px solid ${dailyView === v.id ? "#3b82f6" : "#1e293b"}`,
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Column picker (רק בטבלאות עם עמודות) ── */}
        {!(mode === "daily" && (dailyView === "sub_status" || dailyView === "analytics")) && (
          <details style={{
            background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10,
            padding: "10px 14px", marginBottom: 14, fontSize: 13,
          }}>
            <summary style={{ cursor: "pointer", color: "#94a3b8", fontWeight: 600 }}>⚙ בחר עמודות</summary>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 14 }}>
              {activeColumns.map((c) => (
                <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 6, color: "#cbd5e1", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!visibleCols[c.key]}
                    onChange={(e) => setVisibleCols({ ...visibleCols, [c.key]: e.target.checked })} />
                  {c.label}
                </label>
              ))}
            </div>
          </details>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{ background: "#1a0c0c", border: "1px solid #7f1d1d", color: "#fca5a5", padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Main content: table / sub_status / analytics / monthly ── */}
        {mode === "monthly" ? (
          <MonthlyKpiView />
        ) : mode === "daily" && dailyView === "sub_status" ? (
          <SubStatusTable rows={data?.sub_status || []} loading={loading} />
        ) : mode === "daily" && dailyView === "analytics" ? (
          <AnalyticsPanel analytics={data?.analytics} loading={loading} />
        ) : (
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
                      color:      r.source_kind === "non_paid" ? "#a7f3d0" : (r.is_summary ? "#93c5fd" : "#cbd5e1"),
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
        )}

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

// ─── Sub-status table ───────────────────────────────────────────────────────

function SubStatusTable({ rows, loading }) {
  const total = rows.reduce((s, r) => s + (r.leads_count || 0), 0);
  return (
    <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", color: "#64748b", fontSize: 12, borderBottom: "1px solid #1e293b" }}>
        פירוט תת-סטטוס — רק על לידים שנוצרו היום ({fmtNum(total)} לידים)
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#0d1626" }}>
            <tr>
              <th style={thStyle}>תת-סטטוס</th>
              <th style={thStyle}>כמות לידים</th>
              <th style={thStyle}>% מסה״כ</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={3} style={{ textAlign: "center", color: "#64748b", padding: "36px 0" }}>טוען…</td></tr>}
            {!loading && !rows.length && <tr><td colSpan={3} style={{ textAlign: "center", color: "#64748b", padding: "36px 0" }}>אין נתונים</td></tr>}
            {!loading && rows.map((r, i) => {
              const pct = total ? (r.leads_count / total * 100) : 0;
              return (
                <tr key={i} style={{ borderTop: "1px solid #101a2c", color: "#cbd5e1" }}>
                  <td style={tdStyle}>{r.sub_status_name}</td>
                  <td style={tdStyle}>{fmtNum(r.leads_count)}</td>
                  <td style={tdStyle}>{fmtPct(pct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Analytics panel ────────────────────────────────────────────────────────

function AnalyticsPanel({ analytics, loading }) {
  if (loading) {
    return <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, padding: 36, textAlign: "center", color: "#64748b" }}>טוען…</div>;
  }
  if (!analytics) {
    return (
      <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, padding: 36, textAlign: "center", color: "#64748b", fontSize: 13 }}>
        עדיין אין נתוני אנליטיקס ליום זה. הרץ את הדוח היומי מחדש — סוכני GA4/GSC ייאספו אוטומטית.
      </div>
    );
  }

  const ga4 = analytics.ga4_data;
  const gsc = analytics.gsc_data;
  const ok  = analytics.retrievers_ok || [];
  const err = analytics.retrievers_err || {};

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* סטטוס שולפים */}
      <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#64748b" }}>
        <strong style={{ color: "#93c5fd" }}>סוכני שולפים:</strong>
        {ok.length > 0 && <span style={{ color: "#86efac", marginInlineStart: 8 }}>✓ {ok.join(", ")}</span>}
        {Object.keys(err).length > 0 && <span style={{ color: "#fca5a5", marginInlineStart: 8 }}>✗ {Object.keys(err).join(", ")}</span>}
      </div>

      {/* GA4 */}
      {ga4 && (
        <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#93c5fd", margin: "0 0 12px" }}>🌐 Google Analytics 4</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 14 }}>
            <MiniStat label="Sessions" value={fmtNum(ga4.sessions)} />
            <MiniStat label="Users" value={fmtNum(ga4.total_users)} />
            <MiniStat label="New users" value={fmtNum(ga4.new_users)} />
            <MiniStat label="Engaged sessions" value={fmtNum(ga4.engaged_sessions)} />
            <MiniStat label="Engagement rate" value={ga4.engagement_rate !== undefined ? fmtPct(ga4.engagement_rate * 100) : "—"} />
            <MiniStat label="Page views" value={fmtNum(ga4.page_views)} />
            <MiniStat label="Avg session (s)" value={fmtNum(ga4.avg_session_duration_sec, 1)} />
          </div>

          <SimpleTable
            title="תעבורה לפי Channel Group"
            cols={[{ k: "channel", l: "ערוץ" }, { k: "sessions", l: "Sessions", num: true }, { k: "users", l: "Users", num: true }]}
            rows={ga4.traffic_by_channel || []}
          />
          <SimpleTable
            title="Top 10 Landing Pages"
            cols={[{ k: "page", l: "דף" }, { k: "sessions", l: "Sessions", num: true }, { k: "engaged_sessions", l: "Engaged", num: true }, { k: "users", l: "Users", num: true }]}
            rows={ga4.top_landing_pages || []}
          />
          <SimpleTable
            title="Top Events (scroll / form / clicks...)"
            cols={[{ k: "event_name", l: "אירוע" }, { k: "count", l: "כמות", num: true }, { k: "users", l: "Users", num: true }]}
            rows={ga4.events || []}
          />
          <SimpleTable
            title="מכשיר"
            cols={[{ k: "device", l: "מכשיר" }, { k: "sessions", l: "Sessions", num: true }, { k: "users", l: "Users", num: true }]}
            rows={ga4.device_split || []}
          />
          <SimpleTable
            title="Top ערים"
            cols={[{ k: "city", l: "עיר" }, { k: "sessions", l: "Sessions", num: true }]}
            rows={ga4.top_cities || []}
          />
        </div>
      )}

      {/* GSC */}
      {gsc && (
        <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#93c5fd", margin: "0 0 12px" }}>🔍 Google Search Console</h3>
          {!gsc.properties?.length && (
            <div style={{ color: "#64748b", fontSize: 12 }}>
              אין נתוני GSC להיום. ייתכן ש-GSC עדיין לא עיבד את היום (עיכוב ~2-3 ימים) או שה-service account לא הוזמן כ-User ב-Search Console.
            </div>
          )}
          {(gsc.properties || []).map((p, i) => (
            <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < gsc.properties.length - 1 ? "1px solid #1e293b" : "none" }}>
              <div style={{ color: "#cbd5e1", fontWeight: 600, marginBottom: 8 }}>{p.site_url}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 10 }}>
                <MiniStat label="Clicks" value={fmtNum(p.clicks)} />
                <MiniStat label="Impressions" value={fmtNum(p.impressions)} />
                <MiniStat label="CTR" value={fmtPct((p.ctr || 0) * 100)} />
                <MiniStat label="Avg position" value={fmtNum(p.avg_position, 2)} />
              </div>
              <SimpleTable
                title="Top Queries"
                cols={[{ k: "query", l: "מילת חיפוש" }, { k: "clicks", l: "Clicks", num: true }, { k: "impressions", l: "Impr", num: true }, { k: "position", l: "מיקום", num: true }]}
                rows={p.top_queries || []}
              />
              <SimpleTable
                title="Top Pages"
                cols={[{ k: "page", l: "דף" }, { k: "clicks", l: "Clicks", num: true }, { k: "impressions", l: "Impr", num: true }, { k: "position", l: "מיקום", num: true }]}
                rows={p.top_pages || []}
              />
            </div>
          ))}
        </div>
      )}

      {/* Placeholder: סושיאל אורגני */}
      {(analytics.meta_page_data || analytics.ig_organic_data || analytics.tiktok_data) && (
        <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, padding: 16, fontSize: 12, color: "#64748b" }}>
          <strong>📱 סושיאל אורגני:</strong> placeholders לעתיד — יחובר כשהפעילות האורגנית תתחיל.
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ background: "#060d1a", borderRadius: 8, padding: "8px 10px", border: "1px solid #1e293b" }}>
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{value}</div>
    </div>
  );
}

function SimpleTable({ title, cols, rows }) {
  if (!rows || !rows.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "#0d1626" }}>
            <tr>{cols.map((c) => <th key={c.k} style={thStyle}>{c.l}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid #101a2c", color: "#cbd5e1" }}>
                {cols.map((c) => (
                  <td key={c.k} style={{ ...tdStyle, maxWidth: c.k === "page" || c.k === "query" ? 280 : "auto", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.num ? fmtNum(r[c.k], c.k === "position" || c.k === "avg_position" ? 2 : 0) : (r[c.k] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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

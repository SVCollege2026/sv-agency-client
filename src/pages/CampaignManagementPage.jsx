/**
 * CampaignManagementPage.jsx — דשבורד מנהלים (קריאה בלבד)
 * ================================================================
 * דשבורד הדיווח שמנהלת השיווק משתמשת בו. מוגש ב-/media-reports (כרטיס
 * "דשבורד מנהלים" בפורטל) וגם בנתיב הישן /campaign-management.
 *
 * 2 טאבים ראשיים:
 *   📊 סטטוס מדיה        — יומי / שבועי / טווח / חודשי Y-o-Y
 *   📋 רישום לקורסים     — דשבורד פאי + טבלאות קורסים+מחזורים
 *
 * מכונת ניהול-הקמפיינים הישנה (לשונית "🎯 פעילות שיווקית" / CampaignTab —
 * תיקיות, אישורים, בריפים, blockers) הוסרה לחלוטין. נשארו רק תצוגות
 * הדיווח הקריאות-בלבד + כפתור עצירת-החירום (EmergencyStopButton).
 *
 * נתיב קנוני: /campaign-management?tab=<status|registration|daily|...>
 */
import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  getEmergencyStopActive,
} from "../api.js";
import CoursesCyclesPanel from "../components/CoursesCyclesPanel.jsx";
import EmergencyStopButton from "../components/EmergencyStopButton.jsx";

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

/**
 * הטווח שאמור להיות מוצג בטאב "יומי" — תואם בדיוק ל-cron schedule
 * (ראה analytics/media_reports/scheduler.py):
 *
 *   ראשון       → ה' + ו' + ש' (3 ימים — היומי על ראשון מצטבר)
 *   שני–חמישי   → אתמול (יום אחד)
 *   שישי/שבת    → חמישי האחרון (cron לא רץ ביומיים האלה)
 *
 * Returns: { start, end, multi } — כשmulti=true ה-UI ישלוף getMediaRange.
 */
function smartDailyRange() {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const iso = (offset) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  if (dow === 0) {
    // ראשון — Thu (3 days back), Fri (2), Sat (1)
    return { start: iso(3), end: iso(1), multi: true };
  }
  if (dow >= 1 && dow <= 4) {
    // שני (1) – חמישי (4) — אתמול בלבד
    return { start: iso(1), end: iso(1), multi: false };
  }
  // שישי (5) או שבת (6) — חמישי האחרון
  // שישי: dow=5, אתמול=Thu (1 day back). שבת: dow=6, יומיים אחורה=Thu.
  return { start: iso(dow - 4), end: iso(dow - 4), multi: false };
}

// פורמט עברי DD/MM/YYYY
function fmtDateHe(iso) {
  if (!iso) return "";
  const s = String(iso).slice(0, 10).split("-");
  if (s.length !== 3) return iso;
  return `${s[2]}/${s[1]}/${s[0]}`;
}

// בודק אם תאריך ISO הוא 'אתמול' מה-clock client-side
function isYesterday(iso) {
  if (!iso) return false;
  return iso === yesterday();
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
// 6 עמודות default — חיוניות בלבד. השאר זמינות דרך "בחר עמודות".
const DETAIL_COLUMNS = [
  { key: "platform",        label: "פלטפורמה",   default: true  },
  { key: "campaign_name",   label: "קמפיין",     default: true  },
  // עצירת-חירום (EMERGENCY-STOP-HAND-3): כפתור אדום ליד כל קמפיין מטא. הלחיצה = האישור.
  { key: "emergency_stop",  label: "עצירת חירום", default: true  },
  { key: "spend",           label: "הוצאה",      default: true,  fmt: fmtMoney },
  { key: "leads_count",     label: "לידים",       default: true,  fmt: (v) => fmtNum(v) },
  { key: "new_leads_count", label: "חדשים",      default: true,  fmt: (v) => fmtNum(v) },
  { key: "cpl",             label: "עלות לליד",  default: true,  fmt: fmtMoney },
  // — אופציונליים (toggleable) —
  { key: "budget",          label: "תקציב",      default: false, fmt: fmtMoney },
  { key: "budget_util_pct", label: "% ניצול",    default: false, fmt: fmtPct },
  { key: "impressions",     label: "חשיפות",     default: false, fmt: (v) => fmtNum(v) },
  { key: "clicks",          label: "קליקים",     default: false, fmt: (v) => fmtNum(v) },
  { key: "ctr_pct",         label: "CTR",         default: false, fmt: fmtPct },
  { key: "returning_leads_count", label: "חוזרים", default: false, fmt: (v) => fmtNum(v) },
  { key: "leads_by_channel",      label: "פירוט ערוצים (סה״כ)",  default: false, fmt: fmtChannelSplit },
  { key: "new_leads_by_channel",  label: "פירוט ערוצים (חדשים)", default: false, fmt: fmtChannelSplit },
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

// מדיה = מציגה מה יש + חוקרת מה עבד/לא עבד + ממוצעים. **בלי חיפוש מגמות**
// (זה תפקיד מחלקת חיזוי). המלצות מדיה = forward-looking, גם תפקיד חיזוי/recommender.
// טאבים ראשיים — 2 בלבד. כל אחד עם URL נפרד דרך ?tab=
//   📊 סטטוס מדיה   — מאחד יומי/שבועי/טווח/חודשי Y-o-Y כ-sub-tabs
//   📋 רישום לקורסים — דשבורד פאי + טבלאות קורסים+מחזורים, מסונן לפי שנה
const MODES = [
  { id: "media_status", label: "📊 סטטוס מדיה",      url: "status" },
  { id: "registration", label: "📋 רישום לקורסים",   url: "registration" },
];

// מיפוי URL ↔ mode
const URL_TO_MODE = {
  "status":       "media_status",
  "registration": "registration",
  // sub-modes של media_status — נכנסים כמופע סטטוס עם submode
  "daily":   "daily",
  "weekly":  "weekly",
  "range":   "range",
  "monthly": "monthly",
};

// Sub-tabs בתוך "סטטוס מדיה" — אלה ה-mode-ים הקיימים שתמכנו בהם.
const MEDIA_STATUS_SUBMODES = [
  { id: "daily",   label: "יומי"   },
  { id: "weekly",  label: "שבועי" },
  { id: "range",   label: "טווח"   },
  { id: "monthly", label: "📈 חודשי Y-o-Y" },
];
const _MEDIA_STATUS_IDS = MEDIA_STATUS_SUBMODES.map((m) => m.id);
const _isMediaStatusMode = (m) => _MEDIA_STATUS_IDS.includes(m);

// "שאלות פתוחות" הוסר — אגרגציית data_gaps הייתה פערים טכניים, לא שאלות
// פוליסי למנכ"ל. שאלות פוליסי ("מתי להחליף קריאייטיב? מתי להסיט תקציב?")
// יבואו דרך config של recommender — ראה המלצות מדיה.

// המצבים החדשים אינם משתמשים ב-fetchMediaDaily/Weekly/Range/Monthly. כל אחד
// מנהל את הfetching שלו פנימית.
const _NEW_MODES = ["registration", "media_status"];
const _isLegacyMode = (m) => !_NEW_MODES.includes(m);

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
  return d > 0 ? "#16a34a" : "#dc2626";
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
  { label: "▼ נרשמו מתחילת השנה (מצטבר · לפי תאריך הרשמה · Fireberry) ▼", group: true },
  { label: "סה\"כ נרשמו YTD",                          key: "reg_ytd_total",     kind: "n",      total: true },
  { label: "   ↳ מתוכם ביטלו (YTD)",                   key: "canc_ytd_total",    kind: "n"       },
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

// ─── MediaSummaryCharts ───────────────────────────────────────────────────────
// גרפי סיכום כלליים: KPI tiles + לידים לפי פלטפורמה + CPL + טופ קמפיינים.
// משמש יומי / שבועי / טווח — מקבל rows ישירות + תווית של התקופה לכותרת ה-KPI.
//
// dateLabel — מחרוזת בעברית שמתארת את התקופה המוצגת ("אתמול 9/5/2026"
//   או "9/5–11/5/2026" וכו'). מוצג ב-tile הראשון במקום "לידים היום".
function MediaSummaryCharts({ rows: detailRows = [], dateLabel = "" }) {
  // ── Platform aggregation ──
  const platformData = useMemo(() => {
    const map = {};
    for (const r of detailRows) {
      const raw = r.platform || "לא ידוע";
      const key = /meta|facebook|instagram/i.test(raw) ? "Meta"
                : /google/i.test(raw)                   ? "Google"
                : /tik.?tok/i.test(raw)                 ? "TikTok"
                : raw.split(" ")[0];
      if (!map[key]) map[key] = { platform: key, leads: 0, spend: 0 };
      map[key].leads += r.leads_count || 0;
      map[key].spend += r.spend       || 0;
    }
    return Object.values(map)
      .map(p => ({ ...p, cpl: p.leads > 0 ? Math.round(p.spend / p.leads) : 0 }))
      .filter(p => p.leads > 0 || p.spend > 0)
      .sort((a, b) => b.leads - a.leads);
  }, [detailRows]);

  // ── KPI totals ──
  const totals = useMemo(() => {
    const byP = Object.fromEntries(platformData.map(p => [p.platform, p]));
    const leads = platformData.reduce((s, p) => s + p.leads, 0);
    const spend = platformData.reduce((s, p) => s + p.spend, 0);
    return { leads, spend, cpl: leads > 0 ? Math.round(spend / leads) : null,
             meta: byP["Meta"] || null, google: byP["Google"] || null };
  }, [platformData]);

  if (platformData.length === 0) return null;

  const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];
  const axisTick = { fontSize: 11, fill: "#64748b" };
  const tipStyle = {
    background: "#fff", border: "1px solid #e2e8f0",
    borderRadius: 8, fontSize: 12, direction: "rtl",
  };

  const KpiTile = ({ label, value, sub, color, icon }) => (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0",
      borderTop: `3px solid ${color}`, borderRadius: 10,
      padding: "14px 18px", display: "flex", flexDirection: "column", gap: 3,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>
        {icon && <span style={{ marginLeft: 4 }}>{icon}</span>}{label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</div>}
    </div>
  );

  const ChartCard = ({ title, color, children, height = 210 }) => (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0",
      borderTop: `3px solid ${color}`, borderRadius: 10, padding: "14px 16px",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>{title}</div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );

  // Title: "לידים — {dateLabel}" אם יש תווית, אחרת ברירת מחדל "לידים".
  const leadsLabel = dateLabel ? `לידים — ${dateLabel}` : "לידים";
  const spendLabel = dateLabel ? `הוצאה — ${dateLabel}` : "הוצאה";

  const kpis = [
    { label: leadsLabel,     value: fmtNum(totals.leads), color: "#3b82f6", icon: "📥" },
    { label: spendLabel,     value: fmtMoney(totals.spend), color: "#8b5cf6", icon: "💰" },
    totals.cpl != null
      ? { label: "CPL ממוצע", value: fmtMoney(totals.cpl), color: "#f59e0b", icon: "🎯",
          sub: "הוצאה ÷ לידים" }
      : null,
    totals.meta
      ? { label: "Meta — לידים", value: fmtNum(totals.meta.leads), color: "#3b82f6", icon: "📘",
          sub: `${fmtMoney(totals.meta.spend)} · CPL ${fmtMoney(totals.meta.cpl)}` }
      : null,
    totals.google
      ? { label: "Google — לידים", value: fmtNum(totals.google.leads), color: "#10b981", icon: "🔍",
          sub: `${fmtMoney(totals.google.spend)} · CPL ${fmtMoney(totals.google.cpl)}` }
      : null,
  ].filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>

      {/* ── שורה 1: KPI tiles ── */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 10 }}>
        {kpis.map((k, i) => <KpiTile key={i} {...k} />)}
      </div>

      {/* ── שורה 2: לידים לפי פלטפורמה + CPL לפי פלטפורמה ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard title="לידים לפי פלטפורמה" color="#3b82f6">
          <BarChart data={platformData} margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="platform" tick={axisTick} />
            <YAxis tick={axisTick} allowDecimals={false} />
            <Tooltip contentStyle={tipStyle} />
            <Bar dataKey="leads" name="לידים" radius={[5, 5, 0, 0]}>
              {platformData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="CPL לפי פלטפורמה (₪)" color="#f59e0b">
          <BarChart data={platformData.filter(p => p.cpl > 0)}
                    margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="platform" tick={axisTick} />
            <YAxis tick={axisTick} tickFormatter={v => `₪${v}`} />
            <Tooltip contentStyle={tipStyle}
                     formatter={(v) => [`₪${fmtNum(v)}`, "CPL"]} />
            <Bar dataKey="cpl" name="CPL ₪" radius={[5, 5, 0, 0]}>
              {platformData.filter(p => p.cpl > 0).map((_, i) =>
                <Cell key={i} fill={["#f59e0b", "#f97316", "#ef4444"][i % 3]} />)}
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

    </div>
  );
}

/**
 * מאחד תוצאות מ-N קריאות getMediaDaily (יום-בודד) לאובייקט אחד מאוחד
 * שכולל master_rows + detail_rows + totals אגרגטיבים. משמש כשהיומי
 * מציג כמה ימים (ראשון = ה'+ו'+ש').
 *
 * אגרגציה ברמת מקור: למקור לא-ממומן (אורגני / ספקי לידים / אתר) אין
 * spend/impressions/clicks ולכן הם נסכמים רק כ-leads_count.
 */
function _mergeDailyResults(dailies) {
  if (!dailies.length) return null;
  if (dailies.length === 1) return dailies[0];

  // master_rows aggregation by source_name
  const masterMap = new Map();
  for (const d of dailies) {
    for (const r of (d.master_rows || [])) {
      const key = (r.source_name || r.platform || "—").trim();
      if (!masterMap.has(key)) {
        masterMap.set(key, {
          source_name:           r.source_name,
          source_kind:           r.source_kind,
          campaigns_count:       0,
          spend:                 0,
          impressions:           0,
          clicks:                0,
          leads_count:           0,
          new_leads_count:       0,
          returning_leads_count: 0,
        });
      }
      const a = masterMap.get(key);
      a.campaigns_count       += Number(r.campaigns_count       || 0);
      a.spend                 += Number(r.spend                 || 0);
      a.impressions           += Number(r.impressions           || 0);
      a.clicks                += Number(r.clicks                || 0);
      a.leads_count           += Number(r.leads_count           || 0);
      a.new_leads_count       += Number(r.new_leads_count       || 0);
      a.returning_leads_count += Number(r.returning_leads_count || 0);
    }
  }
  const master_rows = Array.from(masterMap.values()).map((a) => ({
    ...a,
    ctr_pct: a.impressions ? (a.clicks / a.impressions * 100) : 0,
    cpl:     a.leads_count ? (a.spend  / a.leads_count)        : null,
  })).sort((a, b) => (b.leads_count || 0) - (a.leads_count || 0));

  // detail_rows = concat (כל קמפיין יום נפרד = שורה נפרדת)
  const detail_rows = [];
  for (const d of dailies) {
    for (const r of (d.detail_rows || d.rows || [])) {
      if (!r.is_summary) detail_rows.push(r);
    }
  }

  // sub_status = concat לכל הימים
  const sub_status = [];
  for (const d of dailies) {
    for (const r of (d.sub_status || [])) sub_status.push(r);
  }

  // totals — סכום פלטפורמות paid בלבד (לתאימות עם השדה הקיים)
  const _sumNum = (k) => master_rows.reduce((s, r) => s + Number(r[k] || 0), 0);
  const totalSpend = _sumNum("spend"), totalLeads = _sumNum("leads_count");
  return {
    master_rows,
    detail_rows,
    rows: detail_rows,    // alias לתאימות עם RangeChartsView
    sub_status,
    totals: {
      leads: totalLeads,
      spend: totalSpend,
      cpl:   totalLeads ? totalSpend / totalLeads : null,
    },
    // איחוד רץ — לציון בלבד, לא תפעולי
    _merged_from: dailies.map((d) => d.run?.report_date).filter(Boolean),
  };
}

// Thin wrappers — pull the right rows out of the raw API response
function DailyChartsView({ data, day, rangeStart, rangeEnd }) {
  const rows = useMemo(
    () => (data?.detail_rows || data?.rows || []).filter(r => !r.is_summary),
    [data]
  );
  // אם הוצב טווח (יום ראשון = ה'+ו'+ש'), הצג טווח. אחרת יום אחד.
  let dateLabel;
  if (rangeStart && rangeEnd && rangeStart !== rangeEnd) {
    dateLabel = `${fmtDateHe(rangeStart)} – ${fmtDateHe(rangeEnd)}`;
  } else if (day) {
    dateLabel = isYesterday(day) ? `אתמול ${fmtDateHe(day)}` : fmtDateHe(day);
  } else {
    dateLabel = "";
  }
  return <MediaSummaryCharts rows={rows} dateLabel={dateLabel} />;
}
function WeeklyChartsView({ data, weekStart, weekEnd }) {
  const dateLabel = (weekStart && weekEnd)
    ? `שבוע ${fmtDateHe(weekStart)} – ${fmtDateHe(weekEnd)}`
    : "";
  return <MediaSummaryCharts rows={data?.weekly_summary || []} dateLabel={dateLabel} />;
}
function RangeChartsView({ data, rangeStart, rangeEnd }) {
  const dateLabel = (rangeStart && rangeEnd)
    ? (rangeStart === rangeEnd ? fmtDateHe(rangeStart) : `${fmtDateHe(rangeStart)} – ${fmtDateHe(rangeEnd)}`)
    : "";
  return <MediaSummaryCharts rows={data?.rows || []} dateLabel={dateLabel} />;
}

// ─── SchoolKpiCharts ──────────────────────────────────────────────────────────
// 3 bar charts above the table: leads YoY · registrations YoY · spend YoY
function SchoolKpiCharts({ rows, currYear }) {
  const prevYear = currYear - 1;

  const byYM = useMemo(() => {
    const m = {};
    for (const r of rows || []) {
      if (!r.month_ym) continue;
      const y = parseInt(r.month_ym.slice(0, 4), 10);
      const mo = parseInt(r.month_ym.slice(5, 7), 10);
      if (!m[y]) m[y] = {};
      m[y][mo] = r;
    }
    return m;
  }, [rows]);

  const months = useMemo(() => {
    const s = new Set();
    [prevYear, currYear].forEach(y => {
      if (byYM[y]) Object.keys(byYM[y]).forEach(mo => s.add(+mo));
    });
    return [...s].sort((a, b) => a - b);
  }, [byYM, prevYear, currYear]);

  if (!months.length) return null;

  const HEB_S = ["ינו'", "פבר'", "מרץ", "אפר'", "מאי", "יוני",
                 "יולי", "אוג'", "ספט'", "אוק'", "נוב'", "דצמ'"];
  const axisTick = { fontSize: 11, fill: "#64748b" };

  const leadsData = months.map(m => ({
    month: HEB_S[m - 1],
    [String(prevYear)]: byYM[prevYear]?.[m]?.leads_total ?? null,
    [String(currYear)]: byYM[currYear]?.[m]?.leads_total ?? null,
  }));
  const regData = months.map(m => ({
    month: HEB_S[m - 1],
    [String(prevYear)]: byYM[prevYear]?.[m]?.reg_action_total ?? null,
    [String(currYear)]: byYM[currYear]?.[m]?.reg_action_total ?? null,
  }));
  const spendData = months.map(m => ({
    month: HEB_S[m - 1],
    [`Meta ${prevYear}`]:   byYM[prevYear]?.[m]?.spend_meta   ?? null,
    [`Google ${prevYear}`]: byYM[prevYear]?.[m]?.spend_google ?? null,
    [`Meta ${currYear}`]:   byYM[currYear]?.[m]?.spend_meta   ?? null,
    [`Google ${currYear}`]: byYM[currYear]?.[m]?.spend_google ?? null,
  }));

  const tipStyle = {
    background: "#fff", border: "1px solid #e2e8f0",
    borderRadius: 8, fontSize: 12, direction: "rtl",
  };
  const ChartCard = ({ title, color, children, full }) => (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0",
      borderTop: `3px solid ${color}`, borderRadius: 10, padding: "14px 16px",
      gridColumn: full ? "1 / -1" : undefined,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>{title}</div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
      <ChartCard title={`לידים חודשי — ${prevYear} מול ${currYear}`} color="#3b82f6">
        <BarChart data={leadsData} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="month" tick={axisTick} />
          <YAxis tick={axisTick} />
          <Tooltip contentStyle={tipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey={String(prevYear)} fill="#94a3b8" radius={[3, 3, 0, 0]} />
          <Bar dataKey={String(currYear)} fill="#3b82f6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title={`נרשמים חודשי — ${prevYear} מול ${currYear}`} color="#10b981">
        <BarChart data={regData} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="month" tick={axisTick} />
          <YAxis tick={axisTick} />
          <Tooltip contentStyle={tipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey={String(prevYear)} fill="#94a3b8" radius={[3, 3, 0, 0]} />
          <Bar dataKey={String(currYear)} fill="#10b981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title={`ספנד Meta + Google — ${prevYear} מול ${currYear}`} color="#8b5cf6" full>
        <BarChart data={spendData} margin={{ top: 4, right: 16, bottom: 4, left: 40 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="month" tick={axisTick} />
          <YAxis tick={axisTick} tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
          <Tooltip
            contentStyle={tipStyle}
            formatter={v => `₪${Math.round(v).toLocaleString("he-IL")}`}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey={`Meta ${prevYear}`}   fill="#c4b5fd" radius={[3, 3, 0, 0]} />
          <Bar dataKey={`Google ${prevYear}`} fill="#fde68a" radius={[3, 3, 0, 0]} />
          <Bar dataKey={`Meta ${currYear}`}   fill="#8b5cf6" radius={[3, 3, 0, 0]} />
          <Bar dataKey={`Google ${currYear}`} fill="#f59e0b" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>
    </div>
  );
}

// ─── CoursesKpiCharts ─────────────────────────────────────────────────────────
// Horizontal grouped bar: each course, prevYear vs currYear for selected metric
function CoursesKpiCharts({ rows, currYear, metricId }) {
  const prevYear = currYear - 1;

  const chartData = useMemo(() => {
    const byCourse = {};
    for (const r of rows || []) {
      const c = r.course_clean;
      if (!c) continue;
      if (!byCourse[c]) byCourse[c] = {};
      const y = r.year;
      // YTD is cumulative — keep row with highest month_num per course×year
      if (!byCourse[c][y] || (r.month_num || 0) > (byCourse[c][y].month_num || 0))
        byCourse[c][y] = r;
    }
    return Object.entries(byCourse)
      .map(([course, byYear]) => ({
        course,
        [String(prevYear)]: byYear[prevYear]?.[metricId] ?? 0,
        [String(currYear)]: byYear[currYear]?.[metricId] ?? 0,
      }))
      .sort((a, b) => (b[String(currYear)] || 0) - (a[String(currYear)] || 0));
  }, [rows, currYear, metricId, prevYear]);

  const metricLabel = COURSE_METRICS.find(m => m.id === metricId)?.label || metricId;
  if (!chartData.length) return null;

  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0",
      borderTop: "3px solid #10b981", borderRadius: 10,
      padding: "14px 16px", marginBottom: 20,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
        {metricLabel} לפי קורס — {prevYear} מול {currYear}
      </div>
      <div style={{ width: "100%", height: Math.max(200, chartData.length * 44) }}>
        <ResponsiveContainer>
          <BarChart data={chartData} layout="vertical"
                    margin={{ top: 4, right: 40, bottom: 4, left: 110 }}>
            <CartesianGrid stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis type="category" dataKey="course" tick={{ fontSize: 11, fill: "#64748b" }} width={100} />
            <Tooltip
              contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey={String(prevYear)} fill="#94a3b8" radius={[0, 3, 3, 0]} />
            <Bar dataKey={String(currYear)} fill="#10b981" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

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
        background: tab === id ? "#1e3a5f" : "#ffffff",
        color:      tab === id ? "#ffffff" : "#64748b",
        border: `1px solid ${tab === id ? "#1e3a5f" : "#cbd5e1"}`,
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
            background: "#f1f5f9", border: "1px solid #1e3a5f",
            color: "#0f172a", borderRadius: 6, padding: "6px 10px", fontSize: 13,
          }}>
          {[2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y - 1} מול {y}</option>
          ))}
        </select>

        {tab === "courses" && (
          <select value={courseMetric} onChange={(e) => setCourseMetric(e.target.value)}
            style={{
              background: "#f1f5f9", border: "1px solid #1e3a5f",
              color: "#0f172a", borderRadius: 6, padding: "6px 10px", fontSize: 13,
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
          background: actionMsg.startsWith("✗") ? "#fef2f2" : "#f0fdf4",
          border:     `1px solid ${actionMsg.startsWith("✗") ? "#fecaca" : "#bbf7d0"}`,
          color:      actionMsg.startsWith("✗") ? "#991b1b" : "#15803d",
          borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12,
        }}>{actionMsg}</div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626",
                      padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          ⚠ {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>טוען…</div>
      )}

      {!loading && tab === "school" && (
        <>
          <SchoolKpiCharts rows={school} currYear={currYear} />
          <SchoolKpiTable  rows={school} currYear={currYear} />
        </>
      )}
      {!loading && tab === "courses" && (
        <>
          <CoursesKpiCharts rows={courses} currYear={currYear} metricId={courseMetric} />
          <CoursesKpiTable  rows={courses} currYear={currYear} metricId={courseMetric} />
        </>
      )}
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
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "#f1f5f9", position: "sticky", top: 0 }}>
            {/* Row 1: months (each colSpan=3) */}
            <tr>
              <th rowSpan={2} style={{ ...thStyle, minWidth: 280, textAlign: "right",
                  borderInlineEnd: "1px solid #cbd5e1", background: "#f1f5f9" }}>מטריקה</th>
              {monthsToShow.map((m) => (
                <th key={m} colSpan={3} style={{ ...thStyle, textAlign: "center",
                    borderInlineEnd: "1px solid #cbd5e1", color: "#1e40af",
                    background: "#f8fafc", fontSize: 13 }}>
                  {HEB_MONTHS_FULL[m - 1]}
                </th>
              ))}
            </tr>
            {/* Row 2: 25 | 26 | Δ% */}
            <tr>
              {monthsToShow.flatMap((m) => [
                <th key={`${m}-prev`} style={{ ...thStyle, textAlign: "center",
                    color: "#64748b", borderInlineStart: "1px solid #e2e8f0" }}>
                  '{subYearShort(prevYear)}
                </th>,
                <th key={`${m}-curr`} style={{ ...thStyle, textAlign: "center", color: "#64748b" }}>
                  '{subYearShort(currYear)}
                </th>,
                <th key={`${m}-delta`} style={{ ...thStyle, textAlign: "center",
                    color: "#64748b", borderInlineEnd: "1px solid #cbd5e1" }}>Δ%</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {SCHOOL_METRICS.map((row, idx) => {
              if (row.group) {
                return (
                  <tr key={`g-${idx}`} style={{ background: "#dbeafe", borderTop: "1px solid #1e3a5f" }}>
                    <td colSpan={1 + monthsToShow.length * 3}
                        style={{ padding: "8px 12px", fontWeight: 700, color: "#1e40af", fontSize: 12 }}>
                      {row.label}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={row.key} style={{
                  borderTop: "1px solid #f1f5f9",
                  background: row.total ? "#f1f5f9" : "transparent",
                  fontWeight: row.total ? 700 : 400,
                  color: row.total ? "#0f172a" : "#1e293b",
                }}>
                  <td style={{ ...tdStyle, textAlign: "right",
                       borderInlineEnd: "1px solid #cbd5e1", whiteSpace: "nowrap" }}>{row.label}</td>
                  {monthsToShow.map((m) => {
                    const prevRow = byYearMonth[prevYear]?.[m];
                    const currRow = byYearMonth[currYear]?.[m];
                    const v25 = prevRow ? prevRow[row.key] : null;
                    const v26 = currRow ? currRow[row.key] : null;
                    const d   = pctChange(v25, v26);
                    return [
                      <td key={`${m}-p`} style={{ ...tdStyle, textAlign: "center",
                          borderInlineStart: "1px solid #e2e8f0" }}>{fmtMetric(v25, row.kind)}</td>,
                      <td key={`${m}-c`} style={{ ...tdStyle, textAlign: "center" }}>{fmtMetric(v26, row.kind)}</td>,
                      <td key={`${m}-d`} style={{ ...tdStyle, textAlign: "center",
                          color: deltaColor(d), fontWeight: 600,
                          borderInlineEnd: "1px solid #cbd5e1" }}>{fmtDelta(d)}</td>,
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
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", color: "#64748b", fontSize: 12, borderBottom: "1px solid #e2e8f0" }}>
        מציג: <span style={{ color: "#1e40af", fontWeight: 600 }}>{metricLabel}</span> · השוואה {prevYear} מול {currYear}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "#f1f5f9" }}>
            <tr>
              <th rowSpan={2} style={{ ...thStyle, minWidth: 180, textAlign: "right",
                  borderInlineEnd: "1px solid #cbd5e1", background: "#f1f5f9" }}>קורס</th>
              {monthsToShow.map((m) => (
                <th key={m} colSpan={3} style={{ ...thStyle, textAlign: "center",
                    borderInlineEnd: "1px solid #cbd5e1", color: "#1e40af",
                    background: "#f8fafc", fontSize: 13 }}>
                  {HEB_MONTHS_FULL[m - 1]}
                </th>
              ))}
            </tr>
            <tr>
              {monthsToShow.flatMap((m) => [
                <th key={`${m}-p`} style={{ ...thStyle, textAlign: "center",
                    color: "#64748b", borderInlineStart: "1px solid #e2e8f0" }}>'{subYearShort(prevYear)}</th>,
                <th key={`${m}-c`} style={{ ...thStyle, textAlign: "center", color: "#64748b" }}>'{subYearShort(currYear)}</th>,
                <th key={`${m}-d`} style={{ ...thStyle, textAlign: "center",
                    color: "#64748b", borderInlineEnd: "1px solid #cbd5e1" }}>Δ%</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {courseList.map((course) => (
              <tr key={course} style={{ borderTop: "1px solid #f1f5f9", color: "#0f172a" }}>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#1e40af",
                     borderInlineEnd: "1px solid #cbd5e1" }}>{course}</td>
                {monthsToShow.map((m) => {
                  const v25 = byCourse[course]?.[prevYear]?.[m]?.[metricId] ?? null;
                  const v26 = byCourse[course]?.[currYear]?.[m]?.[metricId] ?? null;
                  const d   = pctChange(v25, v26);
                  return [
                    <td key={`${m}-p`} style={{ ...tdStyle, textAlign: "center",
                         borderInlineStart: "1px solid #e2e8f0" }}>{fmtMetric(v25, "n")}</td>,
                    <td key={`${m}-c`} style={{ ...tdStyle, textAlign: "center" }}>{fmtMetric(v26, "n")}</td>,
                    <td key={`${m}-d`} style={{ ...tdStyle, textAlign: "center", color: deltaColor(d),
                         fontWeight: 600, borderInlineEnd: "1px solid #cbd5e1" }}>{fmtDelta(d)}</td>,
                  ];
                })}
              </tr>
            ))}
            {/* סה"כ בית הספר */}
            <tr style={{ borderTop: "2px solid #1e3a5f", background: "#f8fafc", fontWeight: 700, color: "#0f172a" }}>
              <td style={{ ...tdStyle, textAlign: "right", borderInlineEnd: "1px solid #cbd5e1" }}>סה"כ בית הספר</td>
              {monthsToShow.map((m) => {
                const v25 = totals[prevYear][m];
                const v26 = totals[currYear][m];
                const d   = pctChange(v25, v26);
                return [
                  <td key={`${m}-p`} style={{ ...tdStyle, textAlign: "center",
                       borderInlineStart: "1px solid #e2e8f0" }}>{fmtMetric(v25, "n")}</td>,
                  <td key={`${m}-c`} style={{ ...tdStyle, textAlign: "center" }}>{fmtMetric(v26, "n")}</td>,
                  <td key={`${m}-d`} style={{ ...tdStyle, textAlign: "center", color: deltaColor(d),
                       fontWeight: 700, borderInlineEnd: "1px solid #cbd5e1" }}>{fmtDelta(d)}</td>,
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

export default function CampaignManagementPage() {
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  // URL tab = status | registration | daily | weekly | range | monthly
  // URL view (רק לטאב יומי) = master | detail | sub_status | analytics
  const tabFromUrl  = searchParams.get("tab")  || "";
  const viewFromUrl = searchParams.get("view") || "";
  const initialMode = URL_TO_MODE[tabFromUrl] || "registration";
  const [mode, _setMode] = useState(initialMode);
  const setMode = (m) => {
    _setMode(m);
    const url = (m === "media_status") ? "status"
              : (m === "registration") ? "registration"
              : m;
    const next = new URLSearchParams(searchParams);
    next.set("tab", url);
    // כשעוברים בין טאבים — מסירים את ?view= (רלוונטי רק ליומי)
    if (m !== "daily") next.delete("view");
    setSearchParams(next, { replace: true });
  };
  // sync initial URL → אם המשתמש נחת בלי ?tab=, נכתוב את ברירת המחדל
  useEffect(() => {
    if (!tabFromUrl) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "registration");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // dailyView מסונכרן עם ?view= ב-URL כדי שכל sub-tab יהיה shareable
  const _validViews = ["master", "detail", "sub_status", "analytics"];
  const _initialView = _validViews.includes(viewFromUrl) ? viewFromUrl : "master";
  const [dailyView, _setDailyView] = useState(_initialView);
  const setDailyView = (v) => {
    _setDailyView(v);
    const next = new URLSearchParams(searchParams);
    next.set("view", v);
    setSearchParams(next, { replace: true });
  };

  // ברירת מחדל ל-daily — הטווח שה-cron באמת כיסה אתמול-בלילה.
  // ראשון = ה'+ו'+ש' (3 ימים). שני-חמישי = אתמול. שישי/שבת = חמישי האחרון.
  const _smartDaily = useMemo(() => smartDailyRange(), []);
  const [day, setDay]             = useState(_smartDaily.end);   // התאריך הראשי לתצוגה — האחרון בטווח
  const [dailyStart, setDailyStart] = useState(_smartDaily.start); // ההתחלה — שווה ל-day כשלא ראשון, אחרת Thu
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

  // עצירות-חירום פעילות (EMERGENCY-STOP-HAND-3): map של "target_type:target_id" → רשומת stop.
  // נטען פעם אחת ומתרענן אחרי כל לחיצת עצירה/החזרה — קובע "נעצר ע"י מנהלת השיווק" בטבלה.
  const [emergencyStops, setEmergencyStops] = useState({});
  const loadEmergencyStops = React.useCallback(() => {
    getEmergencyStopActive()
      .then((r) => setEmergencyStops(Object.fromEntries(
        (r.stops || []).map((s) => [`${s.target_type}:${s.target_id}`, s]))))
      .catch(() => setEmergencyStops({})); // אין דאטה ≠ "נעצר" — ברירת-מחדל: לא מציגים עצור
  }, []);
  useEffect(loadEmergencyStops, [loadEmergencyStops]);

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

  // Fetch data on mode/date changes — only for legacy modes (daily/weekly/range).
  // monthly/investigations/timeline/questions manage their own fetching internally.
  async function fetchData() {
    if (!_isLegacyMode(mode) || mode === "monthly") return;
    setLoading(true);
    setError(null);
    try {
      let d;
      if (mode === "daily") {
        if (dailyStart && dailyStart !== day) {
          // ראשון = ה'+ו'+ש' — שולפים את 3 הימים בנפרד ב-getMediaDaily
          // (במקום getMediaRange) כדי לקבל גם master_rows הכולל מקורות
          // non-paid (אורגני / ספקי לידים / אתר). אז אגרגציה client-side.
          const dates = [];
          for (let dt = new Date(dailyStart); dt <= new Date(day); dt.setDate(dt.getDate() + 1)) {
            dates.push(dt.toISOString().slice(0, 10));
          }
          const results = await Promise.all(
            dates.map((dd) => getMediaDaily(dd).catch(() => null))
          );
          d = _mergeDailyResults(results.filter(Boolean));
        } else {
          d = await getMediaDaily(day);
        }
      }
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
        // עדיפות 1: master_rows מהשרת (יום בודד)
        if ((data.master_rows || []).length > 0) {
          return data.master_rows.map((r) => ({
            ...r,
            source_kind_he: hebSourceKind(r.source_kind),
          }));
        }
        // fallback: בריצת range (ראשון = ה'+ו'+ש') השרת מחזיר רק data.rows
        // (per-campaign). אגרגציה client-side לפי platform/source_name.
        const rows = data.detail_rows || data.rows || [];
        const m = new Map();
        for (const r of rows) {
          if (r.is_summary) continue;
          const key = (r.source_name || r.platform || "—").trim();
          if (!m.has(key)) {
            m.set(key, {
              source_name:     key,
              source_kind:     r.source_kind || "paid",
              source_kind_he:  hebSourceKind(r.source_kind || "paid"),
              campaigns_count: 0,
              spend:           0,
              impressions:     0,
              clicks:          0,
              leads_count:     0,
              new_leads_count: 0,
              returning_leads_count: 0,
            });
          }
          const a = m.get(key);
          a.campaigns_count       += 1;
          a.spend                 += Number(r.spend                 || 0);
          a.impressions           += Number(r.impressions           || 0);
          a.clicks                += Number(r.clicks                || 0);
          a.leads_count           += Number(r.leads_count           || 0);
          a.new_leads_count       += Number(r.new_leads_count       || 0);
          a.returning_leads_count += Number(r.returning_leads_count || 0);
        }
        return Array.from(m.values()).map((a) => ({
          ...a,
          ctr_pct: a.impressions ? (a.clicks      / a.impressions * 100) : 0,
          cpl:     a.leads_count ? (a.spend       / a.leads_count)        : null,
        })).sort((a, b) => (b.leads_count || 0) - (a.leads_count || 0));
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
        background: "#ffffff",
        color:      "#0f172a",
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      {/* ── Sub-nav (minimal, back-to-portal) ── */}
      <div
        style={{
          background:   "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          padding:      "0 16px",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span>📣</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1e40af" }}>ניהול קמפיינים</span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 12px", marginRight: 8, fontSize: 12,
            color: "#64748b", background: "none",
            border: "1px solid #e2e8f0", borderRadius: 7, cursor: "pointer",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#1e40af"; e.currentTarget.style.borderColor = "#3b82f6"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#475569"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
        >
          ⌂ פורטל
        </button>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 20px" }}>
        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#0f172a" }}>ניהול קמפיינים</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowRuns((v) => !v)}
            style={{
              background: "#f1f5f9", border: "1px solid #1e3a5f", color: "#1e40af",
              borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer",
            }}
          >
            {showRuns ? "הסתר ריצות" : "📋 ריצות אחרונות"}
          </button>
        </div>

        {/* ── Top-level mode tabs (2) ── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {MODES.map((m) => {
            // "סטטוס מדיה" = active אם המשתמש בכל אחד מ-4 ה-sub-modes
            const isActive = m.id === "media_status"
              ? _isMediaStatusMode(mode)
              : mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  // לחיצה על "סטטוס מדיה" → אם כבר באחד הסאב — נשאר; אחרת ברירת מחדל יומי
                  if (m.id === "media_status") {
                    if (!_isMediaStatusMode(mode)) setMode("daily");
                  } else {
                    setMode(m.id);
                  }
                }}
                style={{
                  padding: "8px 18px", fontSize: 13, fontWeight: 600,
                  borderRadius: 8, cursor: "pointer",
                  background: isActive ? "#1e3a5f" : "#ffffff",
                  color:      isActive ? "#ffffff" : "#64748b",
                  border: `1px solid ${isActive ? "#1e3a5f" : "#cbd5e1"}`,
                  transition: "all 0.15s",
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* ── Sub-tabs of "סטטוס מדיה" (only shown when in one of the sub-modes) ── */}
        {_isMediaStatusMode(mode) && (
          <div style={{ display: "flex", gap: 6, marginBottom: 16, paddingRight: 6 }}>
            {MEDIA_STATUS_SUBMODES.map((sm) => (
              <button
                key={sm.id}
                type="button"
                onClick={() => setMode(sm.id)}
                style={{
                  padding: "5px 12px", fontSize: 12, fontWeight: 500,
                  borderRadius: 6, cursor: "pointer",
                  background: mode === sm.id ? "#dbeafe" : "transparent",
                  color:      mode === sm.id ? "#1e3a5f" : "#64748b",
                  border: `1px solid ${mode === sm.id ? "#1e3a5f" : "#cbd5e1"}`,
                  transition: "all 0.15s",
                }}
              >
                {sm.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Filters (legacy modes only) ── */}
        {_isLegacyMode(mode) && mode !== "monthly" && (
        <div style={{
          background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10,
          padding: "14px 16px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          {mode === "daily" && (
            <>
              <label style={{ fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
                תאריך:
                <input type="date" value={day}
                  onChange={(e) => {
                    // משתמש בוחר תאריך ספציפי → קופצים למצב יום-בודד (start = end)
                    const v = e.target.value;
                    setDay(v);
                    setDailyStart(v);
                  }}
                  style={dateInputStyle} />
              </label>
              {/* כשהטווח של היום הראשי כולל יותר מיום אחד — מציגים אינדיקציה */}
              {dailyStart && dailyStart !== day && (
                <span style={{ fontSize: 12, color: "#1e40af", background: "#dbeafe", padding: "3px 9px", borderRadius: 6, fontWeight: 600 }}>
                  טווח: {fmtDateHe(dailyStart)} – {fmtDateHe(day)} (3 ימים)
                </span>
              )}
            </>
          )}
          {mode === "weekly" && (
            <>
              <label style={{ fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
                מ:
                <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} style={dateInputStyle} />
              </label>
              <label style={{ fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
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
              <label style={{ fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
                מ:
                <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} style={dateInputStyle} />
              </label>
              <label style={{ fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
                עד:
                <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} style={dateInputStyle} />
              </label>
            </>
          )}

          <label style={{ fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
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
        )}

        {/* ── Action message ── */}
        {actionMsg && (
          <div style={{
            background: actionMsg.startsWith("✗") ? "#fef2f2" : "#f0fdf4",
            border:     `1px solid ${actionMsg.startsWith("✗") ? "#fecaca" : "#bbf7d0"}`,
            color:      actionMsg.startsWith("✗") ? "#991b1b" : "#15803d",
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
              <span style={{ color: "#dc2626", marginInlineStart: 8 }}>
                (שגיאות: {Object.keys(run.platforms_err).join(", ")})
              </span>
            )}
          </div>
        )}

        {/* ── Totals / KPI strip — range-only (יומי ושבועי מקבלים tiles מ-MediaSummaryCharts) ── */}
        {mode === "range" && totals && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
            <StatCard color="#10b981" label="סה״כ לידים"  value={fmtNum(totals?.leads_count)} />
            <StatCard color="#8b5cf6" label="סה״כ הוצאה"  value={fmtMoney(totals?.spend)}     />
            <StatCard color="#f59e0b" label="CTR"          value={fmtPct(totals?.ctr_pct)}     />
            <StatCard color="#ef4444" label="עלות לליד"   value={fmtMoney(totals?.cpl)}       />
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
                  background: dailyView === v.id ? "#1e3a5f" : "#ffffff",
                  color:      dailyView === v.id ? "#ffffff" : "#64748b",
                  border: `1px solid ${dailyView === v.id ? "#1e3a5f" : "#cbd5e1"}`,
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Column picker (רק בטבלאות עם עמודות) ── */}
        {_isLegacyMode(mode) && mode !== "monthly" && !(mode === "daily" && (dailyView === "sub_status" || dailyView === "analytics")) && (
          <details style={{
            background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10,
            padding: "10px 14px", marginBottom: 14, fontSize: 13,
          }}>
            <summary style={{ cursor: "pointer", color: "#64748b", fontWeight: 600 }}>⚙ בחר עמודות</summary>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 14 }}>
              {activeColumns.map((c) => (
                <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0f172a", cursor: "pointer" }}>
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
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Main content ── */}
        {mode === "registration" ? (
          <CoursesCyclesPanel />
        ) : mode === "monthly" ? (
          <MonthlyKpiView />
        ) : mode === "daily" && dailyView === "sub_status" ? (
          <SubStatusTable rows={data?.sub_status || []} loading={loading} />
        ) : mode === "daily" && dailyView === "analytics" ? (
          <AnalyticsPanel analytics={data?.analytics} loading={loading} />
        ) : (
          <>
          {/* גרפי סיכום יומיים — רק בתצוגת ראשית */}
          {/* ── גרפי סיכום: יומי / שבועי / טווח ── */}
          {mode === "daily"  && dailyView === "master" && !loading && data && (
            <DailyChartsView data={data} day={day} rangeStart={dailyStart} rangeEnd={day} />
          )}
          {mode === "weekly" && !loading && data && (
            <WeeklyChartsView data={data} weekStart={weekStart} weekEnd={weekEnd} />
          )}
          {mode === "range"  && !loading && data && (
            <RangeChartsView data={data} rangeStart={rangeStart} rangeEnd={rangeEnd} />
          )}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "#f1f5f9" }}>
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
                      background: r.is_summary ? "#fef3c7" : (i % 2 === 1 ? "#fafbfc" : "#ffffff"),
                      borderTop: "1px solid #e2e8f0",
                      fontWeight: r.is_summary ? 700 : 400,
                      color:      r.source_kind === "non_paid" ? "#15803d" : (r.is_summary ? "#1e40af" : "#0f172a"),
                    }}>
                      {visibleColList.map((c) => (
                        <td key={c.key} style={tdStyle}>
                          {c.key === "emergency_stop" ? (
                            // עצירת-חירום: רק שורות-קמפיין אמיתיות (לא סיכום); הכפתור עצמו
                            // מציג את עצמו רק למטא — היד-הכותבת תומכת רק בה.
                            r.is_summary ? "" : (
                              <EmergencyStopButton
                                platform={r.platform}
                                campaignId={r.campaign_id}
                                campaignName={r.campaign_name}
                                stopInfo={emergencyStops[`campaign:${r.campaign_id}`] || null}
                                onChanged={loadEmergencyStops}
                              />
                            )
                          ) : (c.fmt ? c.fmt(r[c.key]) : (r[c.key] ?? "—"))}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* ── שורת סיכום: מחושבת מצד הלקוח אם אין כבר is_summary מהשרת ── */}
                  {!loading && tableRows.length > 0 && !tableRows.some((r) => r.is_summary) && (() => {
                    // צבירה: מספרים מסוכמים, אחוזים/יחסים נגזרים מסכומים גולמיים.
                    const sums = {};
                    let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalLeads = 0, totalBudget = 0;
                    for (const r of tableRows) {
                      totalSpend       += Number(r.spend       || 0);
                      totalImpressions += Number(r.impressions || 0);
                      totalClicks      += Number(r.clicks      || 0);
                      totalLeads       += Number(r.leads_count || 0);
                      totalBudget      += Number(r.budget      || 0);
                      for (const c of visibleColList) {
                        const v = r[c.key];
                        if (typeof v === "number") {
                          sums[c.key] = (sums[c.key] || 0) + v;
                        }
                      }
                    }
                    // עמודות מחושבות (ratios/avgs) — תמיד מחושבות מחדש מסכומים גולמיים אם
                    // העמודה מוצגת, גם אם אף שורה לא הכילה ערך מספרי.
                    const _set = (k, v) => { if (visibleColList.some((c) => c.key === k)) sums[k] = v; };
                    _set("ctr_pct",         totalImpressions ? (totalClicks / totalImpressions * 100) : 0);
                    _set("budget_util_pct", totalBudget      ? (totalSpend  / totalBudget       * 100) : 0);
                    _set("cpl",             totalLeads       ? (totalSpend  / totalLeads)               : null);
                    return (
                      <tr style={{ background: "#f1f5f9", borderTop: "2px solid #1e3a5f", fontWeight: 700, color: "#0f172a" }}>
                        {visibleColList.map((c, i) => (
                          <td key={c.key} style={tdStyle}>
                            {i === 0 ? `סה״כ (${tableRows.length})` :
                             c.key in sums && sums[c.key] != null
                               ? (c.fmt ? c.fmt(sums[c.key]) : sums[c.key])
                               : ""}
                          </td>
                        ))}
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}

        {/* ── Runs history panel ── */}
        {showRuns && (
          <div style={{ marginTop: 20, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", margin: "0 0 12px" }}>ריצות אחרונות</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead style={{ background: "#f1f5f9" }}>
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
                    <tr key={i} style={{ borderTop: "1px solid #f1f5f9", color: "#0f172a" }}>
                      <td style={tdStyle}>{r.kind === "weekly" ? "שבועי" : "יומי"}</td>
                      <td style={tdStyle}>{r.report_date || `${r.week_start} — ${r.week_end}`}</td>
                      <td style={tdStyle}><span style={{ color: statusColor(r.status) }}>{hebStatus(r.status)}</span></td>
                      <td style={tdStyle}>{fmtDateTime(r.started_at)}</td>
                      <td style={tdStyle}>{fmtDateTime(r.completed_at)}</td>
                      <td style={tdStyle}>
                        {r.email_sent_at ? "✓ " + fmtDateTime(r.email_sent_at) :
                         r.email_error ? <span style={{ color: "#dc2626" }} title={r.email_error}>✗</span> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Sub-status table ───────────────────────────────────────────────────────

function SubStatusTable({ rows, loading }) {
  const total = rows.reduce((s, r) => s + (r.leads_count || 0), 0);
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", color: "#64748b", fontSize: 12, borderBottom: "1px solid #e2e8f0" }}>
        פירוט תת-סטטוס — רק על לידים שנוצרו היום ({fmtNum(total)} לידים)
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#f1f5f9" }}>
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
                <tr key={i} style={{ borderTop: "1px solid #f1f5f9", color: "#0f172a" }}>
                  <td style={tdStyle}>{r.sub_status_name}</td>
                  <td style={tdStyle}>{fmtNum(r.leads_count)}</td>
                  <td style={tdStyle}>{fmtPct(pct)}</td>
                </tr>
              );
            })}
            {!loading && rows.length > 0 && (
              <tr style={{ background: "#f1f5f9", borderTop: "2px solid #1e3a5f", fontWeight: 700, color: "#0f172a" }}>
                <td style={tdStyle}>סה״כ ({rows.length})</td>
                <td style={tdStyle}>{fmtNum(total)}</td>
                <td style={tdStyle}>100.00%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Analytics panel ────────────────────────────────────────────────────────

function AnalyticsPanel({ analytics, loading }) {
  if (loading) {
    return <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 36, textAlign: "center", color: "#64748b" }}>טוען…</div>;
  }
  if (!analytics) {
    return (
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 36, textAlign: "center", color: "#64748b", fontSize: 13 }}>
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
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#64748b" }}>
        <strong style={{ color: "#1e40af" }}>סוכני שולפים:</strong>
        {ok.length > 0 && <span style={{ color: "#16a34a", marginInlineStart: 8 }}>✓ {ok.join(", ")}</span>}
        {Object.keys(err).length > 0 && <span style={{ color: "#dc2626", marginInlineStart: 8 }}>✗ {Object.keys(err).join(", ")}</span>}
      </div>

      {/* GA4 */}
      {ga4 && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e40af", margin: "0 0 12px" }}>🌐 Google Analytics 4</h3>
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
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e40af", margin: "0 0 12px" }}>🔍 Google Search Console</h3>
          {!gsc.properties?.length && (
            <div style={{ color: "#64748b", fontSize: 12 }}>
              אין נתוני GSC להיום. ייתכן ש-GSC עדיין לא עיבד את היום (עיכוב ~2-3 ימים) או שה-service account לא הוזמן כ-User ב-Search Console.
            </div>
          )}
          {(gsc.properties || []).map((p, i) => (
            <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < gsc.properties.length - 1 ? "1px solid #e2e8f0" : "none" }}>
              <div style={{ color: "#0f172a", fontWeight: 600, marginBottom: 8 }}>{p.site_url}</div>
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
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, fontSize: 12, color: "#64748b" }}>
          <strong>📱 סושיאל אורגני:</strong> placeholders לעתיד — יחובר כשהפעילות האורגנית תתחיל.
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ background: "#ffffff", borderRadius: 8, padding: "8px 10px", border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

function SimpleTable({ title, cols, rows }) {
  if (!rows || !rows.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "#f1f5f9" }}>
            <tr>{cols.map((c) => <th key={c.k} style={thStyle}>{c.l}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid #f1f5f9", color: "#0f172a" }}>
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

function StatCard({ label, value, color = "#3b82f6", sub }) {
  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e8edf3",
      borderTop: `3px solid ${color}`,
      borderRadius: 12,
      padding: "14px 16px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{sub}</div>}
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
    completed: "#16a34a",
    partial:   "#ca8a04",
    running:   "#2563eb",
    failed:    "#dc2626",
    timeout:   "#dc2626",
  }[s] || "#64748b";
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
    background: "#ffffff", border: `1px solid ${color}50`,
    color: "#0f172a", borderRadius: 8,
    padding: "10px 14px", fontSize: 13, marginBottom: 14,
  };
}

const dateInputStyle = {
  background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1",
  borderRadius: 6, padding: "5px 8px", fontSize: 13,
};

const selectStyle = {
  background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1",
  borderRadius: 6, padding: "5px 8px", fontSize: 13,
};

const chipBtnStyle = {
  background: "#eff6ff", border: "1px solid #93c5fd", color: "#1e40af",
  borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer",
};

const primaryBtn = {
  background: "#1e3a5f", border: "1px solid #1e40af", color: "#ffffff",
  borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

const secondaryBtn = {
  background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a",
  borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer",
};

const thStyle = {
  textAlign: "right", fontSize: 12, fontWeight: 700, color: "#0f172a",
  padding: "10px 12px", borderBottom: "1px solid #cbd5e1", whiteSpace: "nowrap",
  background: "#f1f5f9",
};

const tdStyle = {
  padding: "9px 12px", whiteSpace: "nowrap",
  borderBottom: "1px solid #f1f5f9",
};

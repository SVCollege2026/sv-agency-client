/**
 * Dashboard.jsx — Power BI style analytics dashboard
 * ====================================================
 * Layout: KPIs → Charts → Tables → Executive Summary (text only)
 * Sections stacked vertically, charts always visible (no accordions).
 */

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line, ComposedChart, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
} from "recharts";
import { getAnalytics, getDashboardStage0 } from "../api.js";

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = "#ffffff";
const PANEL   = "#ffffff";
const CARD    = "#ffffff";
const BORDER  = "#e2e8f0";
const TEXT    = "#0f172a";
const MUTED   = "#64748b";
const DIM     = "#64748b";

const ACCENT = {
  media:    "#06b6d4",
  funnel:   "#3b82f6",
  courses:  "#10b981",
  segments: "#8b5cf6",
  cross:    "#f59e0b",
  exec:     "#f97316",
};

const C = {
  leads:    "#3b82f6",
  enrolled: "#10b981",
  conv:     "#f59e0b",
  meta:     "#1877f2",
  google:   "#ea4335",
  spend:    "#06b6d4",
  cpl:      "#f97316",
};

const PIE_PAL = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316","#84cc16"];
const YR_PAL  = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt   = (n) => n == null ? "—" : typeof n === "number" ? (Number.isInteger(n) ? n.toLocaleString("he-IL") : n.toFixed(1)) : String(n);
const ils   = (n) => n == null ? "—" : `₪${Number(n).toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
const pct   = (n) => n == null ? "—" : `${Number(n).toFixed(1)}%`;
const fmtDate = (s) => s ? new Date(s).toLocaleDateString("he-IL", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";

const objToRows = (obj) =>
  !obj ? [] :
  Object.entries(obj)
    .map(([name, v]) => typeof v === "object" ? { name, ...v } : { name, value: v })
    .sort((a, b) => (b.leads ?? b.value ?? 0) - (a.leads ?? a.value ?? 0));

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const RtlTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#0f1f35", border:"1px solid #94a3b8", borderRadius:8, padding:"10px 14px", direction:"rtl", textAlign:"right", fontSize:12, minWidth:160 }}>
      {label && <p style={{ color:DIM, marginBottom:6, fontWeight:600 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color:p.color, margin:"3px 0", display:"flex", justifyContent:"space-between", gap:16 }}>
          <span>{p.name}</span>
          <strong>{
            typeof p.value === "number" && (p.dataKey?.includes("pct") || p.dataKey?.includes("conv"))
              ? pct(p.value)
              : p.dataKey?.includes("spend") || p.dataKey?.includes("cpl")
                ? ils(p.value)
                : fmt(p.value)
          }</strong>
        </p>
      ))}
    </div>
  );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section = ({ title, accent, children, subtitle }) => (
  <div style={{ marginBottom: 40 }}>
    <div style={{
      display:"flex", alignItems:"center", gap:12,
      borderBottom:`2px solid ${BORDER}`, paddingBottom:14, marginBottom:24,
    }}>
      <div style={{ width:4, height:28, background:accent, borderRadius:2, flexShrink:0 }} />
      <div>
        <h2 style={{ color:TEXT, fontSize:16, fontWeight:700, margin:0 }}>{title}</h2>
        {subtitle && <p style={{ color:MUTED, fontSize:12, margin:"3px 0 0" }}>{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

// ─── Chart panel ──────────────────────────────────────────────────────────────
const ChartPanel = ({ title, children, flex = 1, minWidth = 320 }) => (
  <div style={{
    background:CARD, border:`1px solid ${BORDER}`, borderRadius:12,
    padding:"16px 20px", flex, minWidth,
  }}>
    {title && <p style={{ color:DIM, fontSize:12, fontWeight:600, margin:"0 0 14px", textTransform:"uppercase", letterSpacing:"0.05em" }}>{title}</p>}
    {children}
  </div>
);

// ─── Data table ───────────────────────────────────────────────────────────────
const DataTable = ({ columns, rows, maxRows = 20, accent = ACCENT.funnel }) => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, maxRows);
  return (
    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, overflow:"hidden" }}>
      <div style={{ overflowX:"auto" }}>
        <table style={{ borderCollapse:"collapse", width:"100%", fontSize:13 }}>
          <thead>
            <tr style={{ background:PANEL }}>
              {columns.map(col => (
                <th key={col.key} style={{
                  padding:"10px 14px", color:DIM, fontWeight:600, fontSize:11,
                  textAlign: col.align ?? "right",
                  borderBottom:`1px solid ${BORDER}`, whiteSpace:"nowrap",
                  textTransform:"uppercase", letterSpacing:"0.05em",
                }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={i} style={{ borderBottom:`1px solid #0f172a` }}>
                {columns.map(col => (
                  <td key={col.key} style={{
                    padding:"9px 14px",
                    color: col.color ? col.color(row[col.key], row) : TEXT,
                    textAlign: col.align ?? "right",
                    fontWeight: col.bold ? 600 : 400,
                    background: col.heat ? heatColor(row[col.key], col.heatMax, accent) : "transparent",
                    whiteSpace:"nowrap",
                  }}>
                    {col.render ? col.render(row[col.key], row) : fmt(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={columns.length} style={{ padding:"20px 14px", color:MUTED, textAlign:"center" }}>אין נתונים</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > maxRows && (
        <button
          onClick={() => setShowAll(s => !s)}
          style={{ width:"100%", padding:"10px", background:"transparent", border:"none", borderTop:`1px solid ${BORDER}`, color:DIM, fontSize:12, cursor:"pointer" }}
        >
          {showAll ? `הצג פחות ▲` : `הצג עוד ${rows.length - maxRows} שורות ▼`}
        </button>
      )}
    </div>
  );
};

function heatColor(val, max, accent) {
  if (val == null || !max) return "transparent";
  const ratio = Math.min(val / max, 1);
  const alpha = Math.round(ratio * 180 + 20).toString(16).padStart(2, "0");
  return accent + alpha;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, color = TEXT, icon }) => (
  <div style={{
    background:CARD, border:`1px solid ${BORDER}`, borderRadius:14,
    padding:"20px 22px", flex:1, minWidth:160, direction:"rtl",
    position:"relative", overflow:"hidden",
  }}>
    <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:color, opacity:0.7 }} />
    {icon && <div style={{ fontSize:24, marginBottom:8 }}>{icon}</div>}
    <p style={{ color:MUTED, fontSize:11, margin:"0 0 6px", textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</p>
    <p style={{ color, fontSize:30, fontWeight:700, margin:0, lineHeight:1.1 }}>{value}</p>
    {sub && <p style={{ color:MUTED, fontSize:11, margin:"6px 0 0" }}>{sub}</p>}
  </div>
);

// ─── ConvBadge ────────────────────────────────────────────────────────────────
const ConvBadge = ({ v }) => {
  const n = parseFloat(v) || 0;
  const col = n >= 30 ? "#10b981" : n >= 15 ? "#f59e0b" : "#ef4444";
  return <span style={{ fontSize:12, color:col, fontWeight:700, background:col+"22", borderRadius:6, padding:"2px 8px" }}>{pct(n)}</span>;
};

// ─── CrossBuilder (same as before) ───────────────────────────────────────────
const DIMS = [
  { id:"course", label:"קורס" }, { id:"cycle", label:"מחזור" },
  { id:"platform", label:"פלטפורמה" }, { id:"year", label:"שנה" },
];
const CROSS_MAP = {
  "course-year":"by_course_year","cycle-year":"by_cycle_year",
  "platform-year":"by_platform_year","platform-course":"by_platform_course",
  "platform-cycle":"by_platform_cycle","course-cycle":"by_course_cycle",
};
function crossKey(a,b){ const p=[a,b].sort().join("-"); if(p==="course-platform")return"platform-course"; if(p==="cycle-platform")return"platform-cycle"; return CROSS_MAP[p]??null; }

function CrossBuilder({ analytics }) {
  const [dimA, setDimA] = useState("platform");
  const [dimB, setDimB] = useState("course");
  const [metric, setMetric] = useState("leads");

  const key  = dimA !== dimB ? crossKey(dimA, dimB) : null;
  const data = key ? analytics?.[key] : null;

  const { outerKeys, innerKeys, cells } = useMemo(() => {
    if (!data) return { outerKeys:[], innerKeys:[], cells:{} };
    const storedKey  = crossKey(dimA, dimB);
    const storedOuter = storedKey?.split("_")[1] ?? "";
    const flip = storedOuter && !storedOuter.startsWith(dimA[0]);
    let oriented = data;
    if (flip) {
      const t = {};
      for (const [ok, im] of Object.entries(data))
        for (const [ik, v] of Object.entries(im)) { if (!t[ik]) t[ik]={}; t[ik][ok]=v; }
      oriented = t;
    }
    const outerKeys = Object.keys(oriented).sort();
    const s = new Set();
    for (const im of Object.values(oriented)) for (const k of Object.keys(im)) s.add(k);
    return { outerKeys, innerKeys:[...s].sort(), cells:oriented };
  }, [data, dimA, dimB]);

  const getVal = (ok, ik) => {
    const cell = cells[ok]?.[ik];
    if (!cell) return null;
    if (metric === "conversion_pct") return cell.conversion_pct ?? null;
    if (metric === "enrolled") return cell.enrolled ?? null;
    return cell.leads ?? null;
  };
  const allVals = outerKeys.flatMap(ok => innerKeys.map(ik => getVal(ok,ik) ?? 0));
  const maxVal  = Math.max(...allVals, 1);

  const sel = { background:PANEL, border:`1px solid ${BORDER}`, borderRadius:8, color:TEXT, padding:"6px 12px", fontSize:13 };
  const accent = ACCENT.cross;

  return (
    <div style={{ direction:"rtl" }}>
      <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", marginBottom:20 }}>
        <span style={{ color:DIM, fontSize:13 }}>הצלב:</span>
        <select value={dimA} onChange={e=>setDimA(e.target.value)} style={sel}>
          {DIMS.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <span style={{ color:MUTED }}>×</span>
        <select value={dimB} onChange={e=>setDimB(e.target.value)} style={sel}>
          {DIMS.filter(d=>d.id!==dimA).map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <span style={{ color:DIM, fontSize:13, marginRight:16 }}>הצג:</span>
        {[{id:"leads",label:"לידים"},{id:"enrolled",label:"נרשמים"},{id:"conversion_pct",label:"המרה %"}].map(m=>(
          <button key={m.id} onClick={()=>setMetric(m.id)} style={{
            background: metric===m.id ? "#1e3a5f" : "transparent",
            color: metric===m.id ? "#1e40af" : MUTED,
            border:`1px solid ${metric===m.id ? "#3b82f6" : BORDER}`,
            borderRadius:8, padding:"5px 14px", cursor:"pointer", fontSize:12,
          }}>{m.label}</button>
        ))}
      </div>

      {dimA === dimB && <p style={{ color:MUTED, padding:"12px", textAlign:"center" }}>בחר שני ממדים שונים</p>}
      {dimA !== dimB && !key && <p style={{ color:MUTED, padding:"12px", textAlign:"center" }}>הצלבה זו אינה נתמכת</p>}
      {dimA !== dimB && key && !data && <p style={{ color:MUTED, padding:"12px", textAlign:"center" }}>נתונים לא זמינים — הפעל ניתוח כדי לחשב הצלבה זו</p>}

      {data && outerKeys.length > 0 && (
        <div style={{ overflowX:"auto" }}>
          <table style={{ borderCollapse:"collapse", width:"100%", fontSize:12 }}>
            <thead>
              <tr>
                <th style={{ padding:"8px 12px", color:MUTED, textAlign:"right", borderBottom:`1px solid ${BORDER}`, whiteSpace:"nowrap", background:PANEL }}>
                  {DIMS.find(d=>d.id===dimA)?.label} \ {DIMS.find(d=>d.id===dimB)?.label}
                </th>
                {innerKeys.map(ik=>(
                  <th key={ik} style={{ padding:"8px 10px", color:DIM, textAlign:"center", borderBottom:`1px solid ${BORDER}`, whiteSpace:"nowrap", minWidth:64, background:PANEL }}>{ik}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {outerKeys.map(ok=>(
                <tr key={ok}>
                  <td style={{ padding:"7px 12px", color:TEXT, fontWeight:600, borderBottom:`1px solid #0a0f1e`, whiteSpace:"nowrap" }}>{ok}</td>
                  {innerKeys.map(ik=>{
                    const val = getVal(ok,ik);
                    return (
                      <td key={ik} style={{
                        padding:"7px 10px", textAlign:"center",
                        borderBottom:`1px solid #0a0f1e`,
                        background: val != null ? heatColor(val, maxVal, accent) : "transparent",
                        color: val != null ? TEXT : "#94a3b8",
                      }}>
                        {val != null ? (metric==="conversion_pct" ? `${Number(val).toFixed(1)}%` : fmt(val)) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [stage0,    setStage0]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [a, s] = await Promise.all([getAnalytics(), getDashboardStage0()]);
        setAnalytics(a?.available ? a : null);
        setStage0(s?.available ? s : null);
      } catch (e) { setError(e.message); }
      finally     { setLoading(false); }
    })();
  }, []);

  // ── Loading / Error / Empty ───────────────────────────────────────────────
  if (loading) return <div style={{ minHeight:"100vh", background:BG, display:"flex", alignItems:"center", justifyContent:"center" }}><p style={{ color:MUTED, fontSize:16 }}>טוען נתונים…</p></div>;
  if (error)   return <div style={{ minHeight:"100vh", background:BG, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}><p style={{ color:"#ef4444" }}>{error}</p><button onClick={()=>navigate("/analytics/analysis")} style={{ background:"#3b82f6", color:"#fff", border:"none", borderRadius:8, padding:"8px 20px", cursor:"pointer" }}>← ניתוח</button></div>;
  if (!analytics) return (
    <div style={{ minHeight:"100vh", background:BG, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, direction:"rtl" }}>
      <p style={{ color:DIM, fontSize:16 }}>טרם הושלם ניתוח. הפעל ניתוח תחילה.</p>
      <button onClick={()=>navigate("/analytics/analysis")} style={{ background:"#3b82f6", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", cursor:"pointer", fontSize:14 }}>← עבור לניתוח</button>
    </div>
  );

  // ── Derived data ─────────────────────────────────────────────────────────
  const a     = analytics;
  const conv  = a.conversion_rate?.overall_pct ?? a.conversion_rate;
  const media = a.media_metrics?.combined ?? {};

  const trendRows  = (a.monthly_trend ?? []).slice(-18).map(r => ({ ...r, name:r.month }));
  const courseRows = objToRows(a.by_course).slice(0, 15);
  const platRows   = objToRows(a.by_platform);
  const cycleRows  = objToRows(a.by_cycle).slice(0, 12);

  // Media CRM monthly (new metric)
  const mediaCRM = (a.media_crm_monthly ?? []).slice(-18).map(r => ({ ...r, name: r.month }));
  const mediaByMonth = (media.by_month ?? []).slice(-18).map(r => ({ ...r, name: r.month }));

  // Gender / Age
  const ageRows = objToRows(a.age_distribution).map(r => ({ name:r.name, value:r.value ?? r.count ?? 0 }));
  const genRows = objToRows(a.by_gender).map(r => ({ name:r.name, value:r.value ?? 0 }));

  // Synthesis — תומך גם במבנה החדש (executive_summary + detailed_analysis) וגם במבנה הישן
  const summary       = stage0?.results_summary ?? {};
  const exec          = summary.executive_summary ?? {};
  const headline      = exec.headline ?? "";
  const keyPoints     = Array.isArray(exec.key_points) ? exec.key_points : [];
  const biggestAlert  = exec.biggest_alert ?? null;
  const legacyFindings = Array.isArray(summary.key_findings) ? summary.key_findings : [];
  const legacySynthesis = summary.synthesis ?? "";
  const findings   = keyPoints.length > 0 ? keyPoints : legacyFindings;  // עדיפות למבנה חדש
  const synthesis  = legacySynthesis;  // רק במבנה הישן
  const anomalies  = summary.moderator_warnings ?? summary.moderator_anomalies ?? [];

  const hasMedia = mediaCRM.some(r => r.total_spend > 0) || mediaByMonth.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div lang="he" style={{ minHeight:"100vh", background:BG, color:TEXT, fontFamily:"'Segoe UI', sans-serif", direction:"rtl" }}>

      {/* ── Top bar ── */}
      <div style={{ background:PANEL, borderBottom:`1px solid ${BORDER}`, padding:"16px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:50 }}>
        <div>
          <h1 style={{ margin:0, fontSize:18, fontWeight:700, color:TEXT }}>לוח בקרה — SV Agency</h1>
          {a.completed_at && <p style={{ margin:"3px 0 0", fontSize:11, color:MUTED }}>עודכן לאחרונה: {fmtDate(a.completed_at)}</p>}
        </div>
        <button
          onClick={()=>navigate("/analytics/analysis")}
          style={{ background:"#e2e8f0", color:DIM, border:"none", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:12 }}
        >
          ← הפעל ניתוח חדש
        </button>
      </div>

      <div style={{ maxWidth:1300, margin:"0 auto", padding:"28px 24px" }}>

        {/* ══ KPI Row ════════════════════════════════════════════════════════ */}
        <div style={{ display:"flex", gap:14, marginBottom:40, flexWrap:"wrap" }}>
          <KpiCard label="סה״כ לידים"   value={fmt(a.total_leads)}     color={C.leads}    icon="📥" />
          <KpiCard label="סה״כ נרשמים"  value={fmt(a.total_enrolled)}  color={C.enrolled} icon="✅" />
          <KpiCard label="המרה כוללת"   value={pct(conv)}               color={C.conv}     icon="📈"
            sub={conv >= 30 ? "מעל ממוצע" : conv >= 15 ? "ממוצע" : "מתחת לממוצע"} />
          {media.total_spend > 0 && (
            <KpiCard label="הוצאות מדיה (תקופה)" value={ils(media.total_spend)} color={C.spend} icon="💸" />
          )}
          {media.total_spend > 0 && a.total_leads > 0 && (
            <KpiCard
              label="CPL ממוצע (תקופה)"
              value={ils(media.total_spend / a.total_leads)}
              color={C.cpl} icon="🎯"
              sub="עלות ליד מחושבת"
            />
          )}
        </div>

        {/* ══ 1. ביצועי מדיה ════════════════════════════════════════════════ */}
        {hasMedia && (
          <Section title="ביצועי מדיה" accent={ACCENT.media} subtitle="הוצאות × CPL × קורלציה עם לידים לאורך זמן">

            {/* Row 1: charts side by side */}
            <div style={{ display:"flex", gap:16, marginBottom:16, flexWrap:"wrap" }}>

              {/* Monthly spend area chart */}
              <ChartPanel title="הוצאות חודשיות לפי פלטפורמה" flex={2} minWidth={340}>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={mediaByMonth.length ? mediaByMonth : mediaCRM} margin={{ top:4, right:16, left:0, bottom:40 }}>
                    <defs>
                      <linearGradient id="gmeta" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.meta} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={C.meta} stopOpacity={0.05}/>
                      </linearGradient>
                      <linearGradient id="ggoogle" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.google} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={C.google} stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2942" />
                    <XAxis dataKey="name" tick={{ fill:MUTED, fontSize:10 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fill:MUTED, fontSize:10 }} tickFormatter={v => `₪${(v/1000).toFixed(0)}K`} />
                    <Tooltip content={<RtlTooltip />} />
                    <Legend wrapperStyle={{ color:DIM, fontSize:11, direction:"rtl" }} />
                    <Area type="monotone" dataKey="meta_spend"   name="Meta"   stroke={C.meta}   fill="url(#gmeta)"   strokeWidth={2} />
                    <Area type="monotone" dataKey="google_spend" name="Google" stroke={C.google} fill="url(#ggoogle)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartPanel>

              {/* CPL actual line */}
              {mediaCRM.some(r => r.cpl_actual != null) && (
                <ChartPanel title="CPL בפועל לאורך זמן (₪)" flex={1} minWidth={280}>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={mediaCRM} margin={{ top:4, right:16, left:0, bottom:40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2942" />
                      <XAxis dataKey="name" tick={{ fill:MUTED, fontSize:10 }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis yAxisId="cpl" tick={{ fill:MUTED, fontSize:10 }} tickFormatter={v => `₪${v}`} />
                      <YAxis yAxisId="leads" orientation="right" tick={{ fill:C.leads, fontSize:10 }} />
                      <Tooltip content={<RtlTooltip />} />
                      <Legend wrapperStyle={{ color:DIM, fontSize:11, direction:"rtl" }} />
                      <Bar yAxisId="leads" dataKey="leads" name="לידים" fill={C.leads} opacity={0.4} radius={[3,3,0,0]} />
                      <Line yAxisId="cpl" type="monotone" dataKey="cpl_actual" name="CPL ₪" stroke={C.cpl} strokeWidth={2.5} dot={{ r:3 }} connectNulls={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartPanel>
              )}
            </div>

            {/* Table: media CRM monthly */}
            {mediaCRM.length > 0 && (
              <DataTable
                accent={ACCENT.media}
                columns={[
                  { key:"month",           label:"חודש",         bold:true },
                  { key:"meta_spend",      label:"Meta ₪",       align:"center", render: v => ils(v) },
                  { key:"google_spend",    label:"Google ₪",     align:"center", render: v => ils(v) },
                  { key:"total_spend",     label:"הוצאה סה״כ",   align:"center", render: v => ils(v), heat:true, heatMax: Math.max(...mediaCRM.map(r=>r.total_spend||0), 1) },
                  { key:"leads",           label:"לידים",        align:"center", heat:true, heatMax: Math.max(...mediaCRM.map(r=>r.leads||0), 1) },
                  { key:"enrolled",        label:"נרשמים",       align:"center" },
                  { key:"conversion_pct",  label:"המרה %",       align:"center", render: v => <ConvBadge v={v} /> },
                  { key:"cpl_actual",      label:"CPL ₪",        align:"center", render: v => v != null ? ils(v) : <span style={{color:MUTED}}>—</span>,
                    color: (v) => v == null ? MUTED : v < 100 ? "#10b981" : v < 200 ? C.conv : "#ef4444" },
                ]}
                rows={mediaCRM}
              />
            )}
          </Section>
        )}

        {/* ══ 2. משפך לידים ═════════════════════════════════════════════════ */}
        <Section title="משפך לידים" accent={ACCENT.funnel} subtitle="מגמה חודשית · לידים · נרשמים · שיעור המרה">

          <div style={{ display:"flex", gap:16, marginBottom:16, flexWrap:"wrap" }}>
            {/* Monthly trend */}
            <ChartPanel title="מגמה חודשית — לידים / נרשמים / המרה %" flex={2} minWidth={360}>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={trendRows} margin={{ top:4, right:20, left:0, bottom:40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2942" />
                  <XAxis dataKey="name" tick={{ fill:MUTED, fontSize:10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis yAxisId="l" tick={{ fill:MUTED, fontSize:10 }} />
                  <YAxis yAxisId="r" orientation="right" unit="%" tick={{ fill:C.conv, fontSize:10 }} />
                  <Tooltip content={<RtlTooltip />} />
                  <Legend wrapperStyle={{ color:DIM, fontSize:11, direction:"rtl" }} />
                  <Bar yAxisId="l" dataKey="leads"    name="לידים"  fill={C.leads}    opacity={0.85} radius={[3,3,0,0]} />
                  <Bar yAxisId="l" dataKey="enrolled" name="נרשמים" fill={C.enrolled} opacity={0.85} radius={[3,3,0,0]} />
                  <Line yAxisId="r" type="monotone" dataKey="conversion_pct" name="המרה %" stroke={C.conv} strokeWidth={2.5} dot={{ r:3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPanel>

            {/* By platform bar */}
            {platRows.length > 0 && (
              <ChartPanel title="לידים לפי מקור הגעה" flex={1} minWidth={260}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={platRows.slice(0,10)} layout="vertical" margin={{ top:4, right:16, left:60, bottom:4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2942" />
                    <XAxis type="number" tick={{ fill:MUTED, fontSize:10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill:DIM, fontSize:10 }} width={60} />
                    <Tooltip content={<RtlTooltip />} />
                    <Bar dataKey="leads" name="לידים" fill={C.leads} radius={[0,4,4,0]}>
                      {platRows.slice(0,10).map((_,i) => <Cell key={i} fill={PIE_PAL[i % PIE_PAL.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            )}
          </div>

          {/* Platform table */}
          {platRows.length > 0 && (
            <DataTable
              accent={ACCENT.funnel}
              columns={[
                { key:"name",            label:"מקור הגעה",     bold:true },
                { key:"leads",           label:"לידים",         align:"center", heat:true, heatMax: Math.max(...platRows.map(r=>r.leads||r.value||0), 1) },
                { key:"enrolled",        label:"נרשמים",        align:"center" },
                { key:"conversion_pct",  label:"המרה %",        align:"center", render: v => v != null ? <ConvBadge v={v} /> : <span style={{color:MUTED}}>—</span> },
              ]}
              rows={platRows.map(r => ({ ...r, leads: r.leads ?? r.value ?? 0 }))}
            />
          )}
        </Section>

        {/* ══ 3. ביצועי קורסים ══════════════════════════════════════════════ */}
        {courseRows.length > 0 && (
          <Section title="ביצועי קורסים" accent={ACCENT.courses} subtitle="לידים · נרשמים · שיעור המרה לפי קורס">

            <div style={{ marginBottom:16 }}>
              <ChartPanel title="לידים ונרשמים לפי קורס">
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={courseRows} margin={{ top:4, right:20, left:0, bottom:60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2942" />
                    <XAxis dataKey="name" tick={{ fill:MUTED, fontSize:10 }} angle={-40} textAnchor="end" interval={0} />
                    <YAxis yAxisId="l" tick={{ fill:MUTED, fontSize:10 }} />
                    <YAxis yAxisId="r" orientation="right" unit="%" tick={{ fill:C.conv, fontSize:10 }} />
                    <Tooltip content={<RtlTooltip />} />
                    <Legend wrapperStyle={{ color:DIM, fontSize:11, direction:"rtl" }} />
                    <Bar yAxisId="l" dataKey="leads"    name="לידים"  fill={C.leads}    radius={[4,4,0,0]} />
                    <Bar yAxisId="l" dataKey="enrolled" name="נרשמים" fill={C.enrolled} radius={[4,4,0,0]} />
                    <Line yAxisId="r" type="monotone" dataKey="conversion_pct" name="המרה %" stroke={C.conv} strokeWidth={2} dot={{ r:4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>

            <DataTable
              accent={ACCENT.courses}
              columns={[
                { key:"name",           label:"קורס",         bold:true },
                { key:"leads",          label:"לידים",        align:"center", heat:true, heatMax: Math.max(...courseRows.map(r=>r.leads||0), 1) },
                { key:"enrolled",       label:"נרשמים",       align:"center" },
                { key:"conversion_pct", label:"המרה %",       align:"center", render: v => v != null ? <ConvBadge v={v} /> : <span style={{color:MUTED}}>—</span> },
              ]}
              rows={courseRows}
            />
          </Section>
        )}

        {/* ══ 4. מחזורי קורס ════════════════════════════════════════════════ */}
        {cycleRows.length > 0 && (
          <Section title="מחזורי קורס" accent={ACCENT.cross} subtitle="ביצועים לפי מחזור">
            <div style={{ marginBottom:16 }}>
              <ChartPanel title="לידים ונרשמים לפי מחזור">
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={cycleRows} margin={{ top:4, right:20, left:0, bottom:60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2942" />
                    <XAxis dataKey="name" tick={{ fill:MUTED, fontSize:10 }} angle={-40} textAnchor="end" interval={0} />
                    <YAxis yAxisId="l" tick={{ fill:MUTED, fontSize:10 }} />
                    <YAxis yAxisId="r" orientation="right" unit="%" tick={{ fill:C.conv, fontSize:10 }} />
                    <Tooltip content={<RtlTooltip />} />
                    <Legend wrapperStyle={{ color:DIM, fontSize:11, direction:"rtl" }} />
                    <Bar yAxisId="l" dataKey="leads"    name="לידים"  fill={C.leads}    radius={[3,3,0,0]} />
                    <Bar yAxisId="l" dataKey="enrolled" name="נרשמים" fill={C.enrolled} radius={[3,3,0,0]} />
                    <Line yAxisId="r" type="monotone" dataKey="conversion_pct" name="המרה %" stroke={C.conv} strokeWidth={2} dot={{ r:3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>
            <DataTable
              accent={ACCENT.cross}
              columns={[
                { key:"name",           label:"מחזור",        bold:true },
                { key:"leads",          label:"לידים",        align:"center", heat:true, heatMax: Math.max(...cycleRows.map(r=>r.leads||0),1) },
                { key:"enrolled",       label:"נרשמים",       align:"center" },
                { key:"conversion_pct", label:"המרה %",       align:"center", render: v => v != null ? <ConvBadge v={v} /> : <span style={{color:MUTED}}>—</span> },
              ]}
              rows={cycleRows}
            />
          </Section>
        )}

        {/* ══ 5. מגזרים ופרופיל ═════════════════════════════════════════════ */}
        {(ageRows.length > 0 || genRows.length > 0) && (
          <Section title="פרופיל לקוח" accent={ACCENT.segments} subtitle="דמוגרפיה של נרשמים">
            <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
              {ageRows.length > 0 && (
                <ChartPanel title="התפלגות גיל" flex={2} minWidth={300}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={ageRows} margin={{ top:4, right:8, left:0, bottom:8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2942" />
                      <XAxis dataKey="name" tick={{ fill:MUTED, fontSize:11 }} />
                      <YAxis tick={{ fill:MUTED, fontSize:11 }} />
                      <Tooltip content={<RtlTooltip />} />
                      <Bar dataKey="value" name="נרשמים" radius={[4,4,0,0]}>
                        {ageRows.map((_,i) => <Cell key={i} fill={YR_PAL[i % YR_PAL.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartPanel>
              )}
              {genRows.length > 0 && (
                <ChartPanel title="חלוקת מגדר" flex={1} minWidth={220}>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={genRows} dataKey="value" nameKey="name" outerRadius={80} innerRadius={40}
                        label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                        labelLine={{ stroke:DIM, strokeWidth:1 }}>
                        {genRows.map((_,i) => <Cell key={i} fill={PIE_PAL[i % PIE_PAL.length]} />)}
                      </Pie>
                      <Tooltip content={<RtlTooltip />} />
                      <Legend wrapperStyle={{ color:DIM, fontSize:11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartPanel>
              )}
            </div>
            {/* Age table */}
            {ageRows.length > 0 && (
              <div style={{ marginTop:16 }}>
                <DataTable
                  accent={ACCENT.segments}
                  columns={[
                    { key:"name",  label:"קבוצת גיל", bold:true },
                    { key:"value", label:"נרשמים",     align:"center", heat:true, heatMax: Math.max(...ageRows.map(r=>r.value||0),1) },
                  ]}
                  rows={ageRows}
                />
              </div>
            )}
          </Section>
        )}

        {/* ══ 6. הצלבות ═════════════════════════════════════════════════════ */}
        <Section title="הצלבות" accent={ACCENT.cross} subtitle="ניתוח ממדים — בחר שני ממדים לצפייה בהצלבה">
          <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:"20px 24px" }}>
            <CrossBuilder analytics={a} />
          </div>
        </Section>

        {/* ══ 7. ניתוח מנהלים (TEXT ONLY) ═══════════════════════════════════ */}
        {(headline || synthesis || findings.length > 0 || biggestAlert) && (
          <Section title="ניתוח מנהלים" accent={ACCENT.exec} subtitle="סינתזה — ממצאים מרכזיים לקבלת החלטות">

            {/* Headline (new structure) */}
            {headline && (
              <div style={{ background:CARD, border:`1px solid ${ACCENT.exec}44`, borderRadius:12, padding:"20px 24px", marginBottom:16 }}>
                <p style={{ color:ACCENT.exec, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 12px" }}>כותרת מרכזית</p>
                <p style={{ color:TEXT, fontSize:16, fontWeight:600, lineHeight:1.6, margin:0 }}>{headline}</p>
              </div>
            )}

            {/* Biggest alert (new structure) */}
            {biggestAlert && (
              <div style={{ background:"#2a0e0a", border:"1px solid #dc2626", borderRadius:12, padding:"18px 22px", marginBottom:16 }}>
                <p style={{ color:"#dc2626", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 8px" }}>⚠ דורש תשומת לב מיידית</p>
                <p style={{ color:"#fecaca", fontSize:14, lineHeight:1.6, margin:0 }}>{biggestAlert}</p>
              </div>
            )}

            {/* Key findings */}
            {findings.length > 0 && (
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:"20px 24px", marginBottom:16 }}>
                <p style={{ color:DIM, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 16px" }}>ממצאים מרכזיים</p>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {findings.map((f, i) => (
                    <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                      <div style={{ width:24, height:24, background:ACCENT.exec+"33", border:`1px solid ${ACCENT.exec}44`, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 }}>
                        <span style={{ color:ACCENT.exec, fontSize:11, fontWeight:700 }}>{i+1}</span>
                      </div>
                      <p style={{ color:TEXT, fontSize:14, lineHeight:1.7, margin:0 }}>{f}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Moderator anomalies */}
            {anomalies.length > 0 && (
              <div style={{ background:"#1a0f0a", border:`1px solid ${ACCENT.exec}44`, borderRadius:12, padding:"18px 22px", marginBottom:16 }}>
                <p style={{ color:ACCENT.exec, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 12px" }}>⚡ חריגות שזוהו בנתונים</p>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {anomalies.map((a, i) => (
                    <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      <span style={{ color:ACCENT.exec, fontSize:14, flexShrink:0 }}>▸</span>
                      <p style={{ color:"#ca8a04", fontSize:13, lineHeight:1.6, margin:0 }}>{a}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full synthesis */}
            {synthesis && (
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:"22px 28px" }}>
                <p style={{ color:DIM, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 18px" }}>ניתוח מלא</p>
                <div style={{ color:TEXT, fontSize:14, lineHeight:1.9, whiteSpace:"pre-wrap" }}>
                  {synthesis.split("\n").map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={i} style={{ height:8 }} />;
                    if (trimmed.startsWith("**") && trimmed.endsWith("**"))
                      return <p key={i} style={{ color:"#1e40af", fontWeight:700, fontSize:15, margin:"16px 0 6px" }}>{trimmed.replace(/\*\*/g,"")}</p>;
                    if (trimmed.startsWith("# "))
                      return <h3 key={i} style={{ color:TEXT, fontSize:16, fontWeight:700, margin:"18px 0 8px" }}>{trimmed.slice(2)}</h3>;
                    if (trimmed.startsWith("- ") || trimmed.startsWith("• "))
                      return <p key={i} style={{ color:DIM, margin:"4px 0", paddingRight:16 }}>▸ {trimmed.slice(2)}</p>;
                    return <p key={i} style={{ color:TEXT, margin:"6px 0" }}>{trimmed}</p>;
                  })}
                </div>
              </div>
            )}
          </Section>
        )}

      </div>
    </div>
  );
}

/**
 * Dashboard.jsx — לוח בקרה מונחה-שאלות עסקיות
 * ================================================
 * 7 קטגוריות × שאלות עסקיות מהמסמך
 * כל שאלה: מאקרו · מיקרו · ממד זמן + ויזואליזציה
 */

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { getAnalytics, getQuestions } from "../api.js";

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = { leads: "#3b82f6", enrolled: "#10b981", conv: "#f59e0b" };
const PIE_PAL = ["#3b82f6","#10b981","#f59e0b","#6366f1","#ec4899","#14b8a6","#f97316","#8b5cf6","#06b6d4","#84cc16"];
const YR_PAL  = ["#3b82f6","#10b981","#f59e0b","#6366f1","#ec4899","#14b8a6"];

// ─── Category map (matches first-row text in the docx tables) ────────────────
const CATEGORIES = [
  { id: "cross",    icon: "🔀", label: "הצלבות", fixed: true },
  { id: "funnel",   icon: "🔵", label: "משפך המרה" },
  { id: "cac",      icon: "📣", label: "עלויות גיוס" },
  { id: "creative", icon: "🎨", label: "קריאייטיב" },
  { id: "segments", icon: "🗂️",  label: "סגמנטים" },
  { id: "cancel",   icon: "⚠️", label: "ביטולים" },
  { id: "profile",  icon: "👥", label: "פרופיל לקוח" },
  { id: "cycles",   icon: "🔄", label: "מחזורי קורס" },
];

// Normalise the raw category string coming from the DB
function resolveCategory(raw = "") {
  if (!raw) return null;
  if (raw.includes("משפך") || raw.includes("Sales Cycle")) return "funnel";
  if (raw.includes("עלויות") || raw.includes("CAC"))       return "cac";
  if (raw.includes("קריאייטיב") || raw.includes("שחיקת"))  return "creative";
  if (raw.includes("סגמנט") || raw.includes("לא נסגר"))    return "segments";
  if (raw.includes("ביטול"))                               return "cancel";
  if (raw.includes("פרופיל") || raw.includes("עונתי"))     return "profile";
  if (raw.includes("מחזור") || raw.includes("תפעול"))      return "cycles";
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (n) => n == null ? "—" : typeof n === "number" ? (Number.isInteger(n) ? n.toLocaleString("he-IL") : n.toFixed(1)) : String(n);
const pct  = (n) => n == null ? "—" : `${Number(n).toFixed(1)}%`;
const qNum = (q) => parseInt(String(q.metadata?.question_number ?? "0"));

const objToRows = (obj) =>
  !obj ? [] :
  Object.entries(obj)
    .map(([name, v]) => typeof v === "object" ? { name, ...v } : { name, value: v })
    .sort((a, b) => (b.leads ?? b.value ?? 0) - (a.leads ?? a.value ?? 0));

const allYears = (cross) => {
  if (!cross) return [];
  const s = new Set();
  for (const ym of Object.values(cross)) for (const y of Object.keys(ym)) s.add(y);
  return [...s].filter(y => y !== "לא ידוע").sort();
};

// ─── Micro components ─────────────────────────────────────────────────────────
const RtlTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:8, padding:"8px 12px", direction:"rtl", textAlign:"right", fontSize:12 }}>
      {label && <p style={{ color:"#94a3b8", marginBottom:4 }}>{label}</p>}
      {payload.map(p => (
        <p key={p.dataKey} style={{ color:p.color, margin:"2px 0" }}>
          {p.name}: <strong>{typeof p.value === "number" && p.value % 1 !== 0 ? p.value.toFixed(1)+"%" : fmt(p.value)}</strong>
        </p>
      ))}
    </div>
  );
};

const ConvBadge = ({ value }) => {
  const v = parseFloat(value) || 0;
  const col = v >= 30 ? "#10b981" : v >= 15 ? "#f59e0b" : "#ef4444";
  return <span style={{ fontSize:12, color:col, fontWeight:700, background:col+"22", borderRadius:6, padding:"2px 8px" }}>{pct(v)}</span>;
};

/**
 * CannotAnalyze — מציג הסבר דינמי למה הניתוח לא זמין
 * props:
 *   missing  — מערך שמות מקורות חסרים  → "לא ניתן לבצע את הניתוח כי חסר: X, Y"
 *   reason   — מחרוזת סיבה חופשית       → "לא ניתן לבצע את הניתוח כי {reason}"
 */
const CannotAnalyze = ({ missing, reason }) => {
  const isMissing = missing?.length > 0;
  const msg = isMissing
    ? `לא ניתן לבצע את הניתוח כי חסר: ${missing.join(", ")}`
    : `לא ניתן לבצע את הניתוח כי ${reason ?? "הנתון אינו זמין"}`;

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      background: "#0f172a", border: "1px dashed #475569",
      borderRadius: 8, padding: "14px 18px", margin: "12px 0",
    }}>
      <span style={{ color: "#f59e0b", fontSize: 18, lineHeight: 1.3, flexShrink: 0 }}>✱</span>
      <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
        {isMissing ? (
          <>לא ניתן לבצע את הניתוח כי חסר:{" "}
            <strong style={{ color: "#fbbf24" }}>{missing.join(", ")}</strong>
          </>
        ) : (
          <>לא ניתן לבצע את הניתוח כי{" "}
            <strong style={{ color: "#fbbf24" }}>{reason ?? "הנתון אינו זמין"}</strong>
          </>
        )}
      </p>
    </div>
  );
};

// backward-compat alias
const NeedsData = ({ sources }) => <CannotAnalyze missing={sources} />;

// Small bar chart (leads + enrolled + conversion line)
const MiniCombo = ({ data, xKey = "name", ariaLabel = "גרף לידים, נרשמים ושיעור המרה" }) => {
  if (!data?.length) return <NeedsData sources={["אין נתונים"]} />;
  return (
    <div role="img" aria-label={ariaLabel}>
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top:4, right:16, left:0, bottom:40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey={xKey} tick={{ fill:"#94a3b8", fontSize:11 }} angle={-35} textAnchor="end" interval={0} />
        <YAxis yAxisId="l" tick={{ fill:"#94a3b8", fontSize:11 }} />
        <YAxis yAxisId="r" orientation="right" unit="%" tick={{ fill:"#f59e0b", fontSize:11 }} />
        <Tooltip content={<RtlTooltip />} />
        <Legend wrapperStyle={{ color:"#94a3b8", fontSize:12, direction:"rtl" }} />
        <Bar yAxisId="l" dataKey="leads"    name="לידים"    fill={C.leads}    radius={[4,4,0,0]} />
        <Bar yAxisId="l" dataKey="enrolled" name="נרשמים"   fill={C.enrolled} radius={[4,4,0,0]} />
        <Line yAxisId="r" type="monotone" dataKey="conversion_pct" name="המרה %" stroke={C.conv} strokeWidth={2} dot={{ r:3 }} />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  );
};

// ─── Data renderers keyed by question number ──────────────────────────────────
function makeRenderers(a) {
  if (!a) return {};

  /* ---- helpers ---- */
  const trendRows = (a.monthly_trend || []).map(r => ({ ...r, name: r.month }));

  const courseRows = objToRows(a.by_course).slice(0, 12);
  const cycleRows  = objToRows(a.by_cycle).slice(0, 12);
  const platRows   = objToRows(a.by_platform);

  /* ---- Q1: שיעור המרה מליד להרשמה ---- */
  const r1 = () => (
    <div>
      <div style={{ display:"flex", gap:24, marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ background:"#0f172a", border:"1px solid #1e3a5f", borderRadius:10, padding:"12px 20px" }}>
          <p style={{ color:"#64748b", fontSize:11, margin:0 }}>סה"כ המרה (מאקרו)</p>
          <ConvBadge value={a.conversion_rate?.overall_pct ?? a.conversion_rate} />
        </div>
        <div style={{ background:"#0f172a", border:"1px solid #1e3a5f", borderRadius:10, padding:"12px 20px" }}>
          <p style={{ color:"#64748b", fontSize:11, margin:0 }}>סה"כ לידים</p>
          <p style={{ color:"#e2e8f0", fontSize:20, fontWeight:700, margin:0 }}>{fmt(a.total_leads)}</p>
        </div>
        <div style={{ background:"#0f172a", border:"1px solid #1e3a5f", borderRadius:10, padding:"12px 20px" }}>
          <p style={{ color:"#64748b", fontSize:11, margin:0 }}>סה"כ נרשמים</p>
          <p style={{ color:"#10b981", fontSize:20, fontWeight:700, margin:0 }}>{fmt(a.total_enrolled)}</p>
        </div>
      </div>
      <p style={{ color:"#94a3b8", fontSize:12, marginBottom:8 }}>מיקרו — שיעור המרה לפי קורס:</p>
      <MiniCombo data={courseRows} />
    </div>
  );

  /* ---- Q4: מגמת שיעור המרה לאורך זמן ---- */
  const r4 = () => (
    <div>
      <p style={{ color:"#94a3b8", fontSize:12, marginBottom:8 }}>מגמה חודשית — לידים, נרשמים, המרה %</p>
      <MiniCombo data={trendRows} xKey="name" />
    </div>
  );

  /* ---- Q12/13: לפי פלטפורמה ---- */
  const rPlatform = () => (
    <div>
      <p style={{ color:"#94a3b8", fontSize:12, marginBottom:8 }}>לפי פלטפורמה — לידים · נרשמים · המרה %</p>
      <MiniCombo data={platRows} />
      {!platRows.length && <CannotAnalyze missing={["CRM", "נתוני מדיה ממומנת"]} />}
    </div>
  );

  /* ---- Q22: מגמת לפי פלטפורמה × שנה ---- */
  const r22 = () => {
    const cross = a.by_platform_year;
    if (!cross) return <NeedsData sources={["נתוני מדיה ממומנת"]} />;
    const years = allYears(cross);
    const rows  = Object.entries(cross).map(([plat, yrMap]) => {
      const row = { name: plat };
      years.forEach(y => { row[y] = yrMap[y]?.leads ?? 0; });
      return row;
    });
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} margin={{ top:4, right:16, left:0, bottom:40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="name" tick={{ fill:"#94a3b8", fontSize:11 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fill:"#94a3b8", fontSize:11 }} />
          <Tooltip content={<RtlTooltip />} />
          <Legend wrapperStyle={{ color:"#94a3b8", fontSize:12 }} />
          {years.map((y, i) => <Bar key={y} dataKey={y} name={y} fill={YR_PAL[i % YR_PAL.length]} radius={[4,4,0,0]} />)}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  /* ---- Q43: פרופיל דמוגרפי — גיל ---- */
  const r43 = () => {
    const ageRows = objToRows(a.age_distribution).map(r => ({ name: r.name, value: r.value ?? r.count ?? 0 }));
    const genRows = objToRows(a.by_gender).map(r => ({ name: r.name, value: r.value ?? 0 }));
    return (
      <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
        <div style={{ flex:2, minWidth:280 }}>
          <p style={{ color:"#94a3b8", fontSize:12, marginBottom:8 }}>התפלגות גיל בעת הרשמה:</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ageRows} margin={{ top:4, right:8, left:0, bottom:8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fill:"#94a3b8", fontSize:11 }} />
              <YAxis tick={{ fill:"#94a3b8", fontSize:11 }} />
              <Tooltip content={<RtlTooltip />} />
              <Bar dataKey="value" name="נרשמים" fill={C.enrolled} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {genRows.length > 0 && (
          <div style={{ flex:1, minWidth:180 }}>
            <p style={{ color:"#94a3b8", fontSize:12, marginBottom:8 }}>מגדר:</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={genRows} dataKey="value" nameKey="name" outerRadius={70} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {genRows.map((_, i) => <Cell key={i} fill={PIE_PAL[i % PIE_PAL.length]} />)}
                </Pie>
                <Tooltip content={<RtlTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  /* ---- Q47: דפוס עונתי ---- */
  const r47 = () => (
    <div>
      <p style={{ color:"#94a3b8", fontSize:12, marginBottom:8 }}>נפח לידים ונרשמים לפי חודש:</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={trendRows} margin={{ top:4, right:16, left:0, bottom:40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="name" tick={{ fill:"#94a3b8", fontSize:11 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fill:"#94a3b8", fontSize:11 }} />
          <Tooltip content={<RtlTooltip />} />
          <Legend wrapperStyle={{ color:"#94a3b8", fontSize:12 }} />
          <Bar dataKey="leads"    name="לידים"  fill={C.leads}    radius={[4,4,0,0]} />
          <Bar dataKey="enrolled" name="נרשמים" fill={C.enrolled} radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  /* ---- Q52/56: מחזורים ---- */
  const rCycles = () => (
    <div>
      <p style={{ color:"#94a3b8", fontSize:12, marginBottom:8 }}>לפי מחזור:</p>
      <MiniCombo data={cycleRows} />
    </div>
  );

  return {
    1: r1, 4: r4,
    12: rPlatform, 13: rPlatform,
    22: r22,
    43: r43,
    47: r47,
    48: r47,
    50: r47,
    52: rCycles, 56: rCycles,
  };
}

// ─── CrossBuilder — גנרי, לא תלוי בשאלה ────────────────────────────────────
const DIMS = [
  { id: "course",   label: "קורס" },
  { id: "cycle",    label: "מחזור" },
  { id: "platform", label: "פלטפורמה" },
  { id: "year",     label: "שנה" },
];

// Map (a,b) → metric key — סימטרי
const CROSS_MAP = {
  "course-year":    "by_course_year",
  "cycle-year":     "by_cycle_year",
  "platform-year":  "by_platform_year",
  "platform-course":"by_platform_course",
  "platform-cycle": "by_platform_cycle",
  "course-cycle":   "by_course_cycle",
};

function crossKey(a, b) {
  const pair = [a, b].sort().join("-");
  // undo sort for direction-sensitive keys
  if (pair === "course-platform") return "platform-course";
  if (pair === "cycle-platform")  return "platform-cycle";
  return CROSS_MAP[pair] ?? null;
}

function CrossBuilder({ analytics }) {
  const [dimA, setDimA] = useState("platform");
  const [dimB, setDimB] = useState("course");
  const [metric, setMetric] = useState("leads"); // leads | enrolled | conversion_pct

  const key  = dimA !== dimB ? crossKey(dimA, dimB) : null;
  const data = key ? analytics?.[key] : null;

  // Build table rows: outer = dimA, inner = dimB
  const { outerKeys, innerKeys, cells } = useMemo(() => {
    if (!data) return { outerKeys: [], innerKeys: [], cells: {} };

    // Figure out orientation: data is always stored as { outer: { inner: {...} } }
    // We need to check if dimA matches the outer dimension of the stored metric.
    // stored metrics: by_platform_course (platform→course), by_platform_cycle (platform→cycle),
    //                 by_course_year (course→year), by_cycle_year (cycle→year),
    //                 by_platform_year (platform→year), by_course_cycle (course→cycle)
    // So outer dim of stored key:
    const storedKey = crossKey(dimA, dimB);
    const storedOuter = storedKey?.split("_")[1] ?? ""; // crude but works for our keys

    // If dimA matches the outer of the stored key, data is already oriented correctly.
    // Otherwise flip.
    const flip = storedOuter && !storedOuter.startsWith(dimA[0]);

    let oriented = data;
    if (flip) {
      // Transpose: { a: { b: v } } → { b: { a: v } }
      const transposed = {};
      for (const [outerK, innerMap] of Object.entries(data)) {
        for (const [innerK, v] of Object.entries(innerMap)) {
          if (!transposed[innerK]) transposed[innerK] = {};
          transposed[innerK][outerK] = v;
        }
      }
      oriented = transposed;
    }

    const outerKeys = Object.keys(oriented).sort();
    const innerSet  = new Set();
    for (const innerMap of Object.values(oriented))
      for (const k of Object.keys(innerMap)) innerSet.add(k);
    const innerKeys = [...innerSet].sort();

    return { outerKeys, innerKeys, cells: oriented };
  }, [data, dimA, dimB]);

  const selectStyle = {
    background:"#0d1626", border:"1px solid #334155", borderRadius:8,
    color:"#e2e8f0", padding:"6px 12px", fontSize:13, cursor:"pointer",
  };

  const getVal = (outerK, innerK) => {
    const cell = cells[outerK]?.[innerK];
    if (!cell) return null;
    if (metric === "conversion_pct") return cell.conversion_pct != null ? cell.conversion_pct : null;
    if (metric === "enrolled")       return cell.enrolled ?? null;
    return cell.leads ?? null;
  };

  const colorFor = (val, max) => {
    if (val == null || max === 0) return "transparent";
    const ratio = val / max;
    if (metric === "conversion_pct") {
      const r = val >= 30 ? "#10b981" : val >= 15 ? "#f59e0b" : "#ef4444";
      return r + Math.round(ratio * 220 + 35).toString(16);
    }
    return C.leads + Math.round(ratio * 180 + 40).toString(16);
  };

  // Find max for color scaling
  const allVals = outerKeys.flatMap(ok => innerKeys.map(ik => getVal(ok, ik) ?? 0));
  const maxVal  = Math.max(...allVals, 1);

  return (
    <div style={{ direction:"rtl" }}>
      {/* Controls */}
      <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", marginBottom:20 }}>
        <span style={{ color:"#94a3b8", fontSize:13 }}>הצלב:</span>
        <select value={dimA} onChange={e => setDimA(e.target.value)} style={selectStyle}>
          {DIMS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <span style={{ color:"#475569" }}>×</span>
        <select value={dimB} onChange={e => setDimB(e.target.value)} style={selectStyle}>
          {DIMS.filter(d => d.id !== dimA).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <span style={{ color:"#94a3b8", fontSize:13, marginRight:16 }}>הצג:</span>
        {[
          { id:"leads",          label:"לידים" },
          { id:"enrolled",       label:"נרשמים" },
          { id:"conversion_pct", label:"המרה %" },
        ].map(m => (
          <button
            key={m.id}
            type="button"
            aria-pressed={metric === m.id}
            onClick={() => setMetric(m.id)}
            style={{
              background: metric === m.id ? "#1e3a5f" : "transparent",
              color:      metric === m.id ? "#93c5fd" : "#64748b",
              border:     "1px solid " + (metric === m.id ? "#3b82f6" : "#334155"),
              borderRadius:8, padding:"5px 14px", cursor:"pointer", fontSize:12,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* No data state */}
      {dimA === dimB && (
        <CannotAnalyze reason="יש לבחור שני ממדים שונים" />
      )}
      {dimA !== dimB && !key && (
        <CannotAnalyze
          reason={`הצלבה ${DIMS.find(d=>d.id===dimA)?.label} × ${DIMS.find(d=>d.id===dimB)?.label} אינה נתמכת`}
        />
      )}
      {dimA !== dimB && key && !data && (
        <CannotAnalyze
          reason={`הצלבה ${DIMS.find(d=>d.id===dimA)?.label} × ${DIMS.find(d=>d.id===dimB)?.label} טרם חושבה — הפעל ניתוח מחדש להוספתה`}
        />
      )}

      {/* Heatmap table */}
      {data && outerKeys.length > 0 && (
        <div style={{ overflowX:"auto" }}>
          <table style={{ borderCollapse:"collapse", width:"100%", fontSize:12 }}>
            <thead>
              <tr>
                <th style={{ padding:"8px 12px", color:"#64748b", textAlign:"right", borderBottom:"1px solid #1e293b", whiteSpace:"nowrap" }}>
                  {DIMS.find(d=>d.id===dimA)?.label} \ {DIMS.find(d=>d.id===dimB)?.label}
                </th>
                {innerKeys.map(ik => (
                  <th key={ik} style={{ padding:"8px 10px", color:"#94a3b8", textAlign:"center", borderBottom:"1px solid #1e293b", whiteSpace:"nowrap", minWidth:64 }}>
                    {ik}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {outerKeys.map(ok => (
                <tr key={ok}>
                  <td style={{ padding:"7px 12px", color:"#e2e8f0", fontWeight:600, borderBottom:"1px solid #0f172a", whiteSpace:"nowrap" }}>
                    {ok}
                  </td>
                  {innerKeys.map(ik => {
                    const val = getVal(ok, ik);
                    return (
                      <td
                        key={ik}
                        style={{
                          padding:"7px 10px",
                          textAlign:"center",
                          borderBottom:"1px solid #0f172a",
                          background: colorFor(val, maxVal),
                          color: val != null ? "#e2e8f0" : "#334155",
                          borderRadius:4,
                        }}
                      >
                        {val != null
                          ? metric === "conversion_pct" ? `${Number(val).toFixed(1)}%` : fmt(val)
                          : "—"
                        }
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

// ─── QuestionCard ─────────────────────────────────────────────────────────────
function QuestionCard({ question, renderers }) {
  const [open, setOpen] = useState(false);
  const num     = qNum(question);
  const meta    = question.metadata || {};
  const render  = renderers[num];

  return (
    <div style={{
      background: "#0d1626",
      border: "1px solid #1e293b",
      borderRadius: 12,
      marginBottom: 12,
      overflow: "hidden",
    }}>
      {/* Header row */}
      <button
        type="button"
        aria-expanded={open}
        aria-label={`שאלה ${meta.question_number ?? ""}: ${question.question_text?.slice(0, 60)}`}
        onClick={() => setOpen(o => !o)}
        style={{
          width:"100%", display:"flex", alignItems:"flex-start", gap:12,
          padding:"14px 18px", background:"transparent", border:"none",
          cursor:"pointer", textAlign:"right", direction:"rtl",
        }}
      >
        <span style={{ color: render ? "#10b981" : "#475569", fontSize:18, marginTop:2, flexShrink:0 }}>
          {render ? "✦" : "○"}
        </span>
        <div style={{ flex:1 }}>
          <p style={{ color:"#e2e8f0", fontSize:14, fontWeight:600, margin:0, lineHeight:1.5 }}>
            {meta.question_number && <span style={{ color:"#64748b", fontSize:12, marginLeft:8 }}>#{meta.question_number}</span>}
            {question.question_text}
          </p>
          {/* Dimension badges */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
            {meta.analysis_macro && (
              <span style={{ fontSize:11, color:"#93c5fd", background:"#1e3a5f", borderRadius:6, padding:"2px 8px" }}>
                מאקרו: {meta.analysis_macro.length > 60 ? meta.analysis_macro.slice(0,60)+"…" : meta.analysis_macro}
              </span>
            )}
            {meta.analysis_micro && (
              <span style={{ fontSize:11, color:"#6ee7b7", background:"#064e3b", borderRadius:6, padding:"2px 8px" }}>
                מיקרו: {meta.analysis_micro.length > 60 ? meta.analysis_micro.slice(0,60)+"…" : meta.analysis_micro}
              </span>
            )}
            {meta.time_dimension && (
              <span style={{ fontSize:11, color:"#fcd34d", background:"#431a03", borderRadius:6, padding:"2px 8px" }}>
                ⏱ {meta.time_dimension}
              </span>
            )}
            {meta.data_sources && (
              <span style={{ fontSize:11, color:"#c4b5fd", background:"#2e1065", borderRadius:6, padding:"2px 8px" }}>
                🔗 {meta.data_sources}
              </span>
            )}
          </div>
        </div>
        <span style={{ color:"#475569", fontSize:14, marginTop:2, flexShrink:0 }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Expanded data panel */}
      {open && (
        <div style={{ borderTop:"1px solid #1e293b", padding:"16px 18px", direction:"rtl" }}>
          {render
            ? render()
            : meta.data_sources
              ? <CannotAnalyze missing={meta.data_sources.split(/[,+]/).map(s => s.trim()).filter(Boolean)} />
              : <CannotAnalyze reason="הנתונים הנדרשים לשאלה זו טרם נאספו" />
          }
        </div>
      )}
    </div>
  );
}

// ─── CategoryTab ──────────────────────────────────────────────────────────────
function CategoryTab({ catId, questions, renderers }) {
  const catQuestions = useMemo(
    () => questions
      .filter(q => resolveCategory(q.metadata?.category) === catId)
      .sort((a, b) => qNum(a) - qNum(b)),
    [questions, catId]
  );

  if (!catQuestions.length) {
    return (
      <div style={{ textAlign:"center", padding:"40px 20px", color:"#475569" }}>
        <p style={{ fontSize:14 }}>לא נמצאו שאלות בקטגוריה זו.</p>
        <p style={{ fontSize:12 }}>העלה את קובץ השאלות בעמוד הניתוח.</p>
      </div>
    );
  }

  const answerable = catQuestions.filter(q => renderers[qNum(q)]).length;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, direction:"rtl" }}>
        <span style={{ color:"#64748b", fontSize:13 }}>
          {catQuestions.length} שאלות ·{" "}
          <span style={{ color:"#10b981" }}>{answerable} עם נתונים</span> ·{" "}
          <span style={{ color:"#475569" }}>{catQuestions.length - answerable} ממתינות לנתונים</span>
        </span>
      </div>
      {catQuestions.map(q => (
        <QuestionCard key={q.id || q.question_text} question={q} renderers={renderers} />
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, color = "#e2e8f0" }) => (
  <div style={{
    background:"#0d1626", border:"1px solid #1e293b", borderRadius:12,
    padding:"16px 20px", flex:1, minWidth:160, direction:"rtl",
  }}>
    <p style={{ color:"#64748b", fontSize:12, margin:"0 0 6px" }}>{label}</p>
    <p style={{ color, fontSize:28, fontWeight:700, margin:0 }}>{value}</p>
    {sub && <p style={{ color:"#475569", fontSize:11, margin:"4px 0 0" }}>{sub}</p>}
  </div>
);

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate   = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [activeTab, setActiveTab] = useState("cross");

  useEffect(() => {
    (async () => {
      try {
        const [a, q] = await Promise.all([getAnalytics(), getQuestions()]);
        setAnalytics(a?.available ? a : null);
        setQuestions(q?.questions ?? []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const renderers = useMemo(() => makeRenderers(analytics), [analytics]);

  // ── Loading ──
  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#060d1a", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <p style={{ color:"#64748b", fontSize:16 }}>טוען נתונים…</p>
    </div>
  );

  // ── Error ──
  if (error) return (
    <div style={{ minHeight:"100vh", background:"#060d1a", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
      <p style={{ color:"#ef4444", fontSize:16 }}>{error}</p>
      <button onClick={() => navigate("/analytics/analysis")} style={{ background:"#3b82f6", color:"#fff", border:"none", borderRadius:8, padding:"8px 20px", cursor:"pointer" }}>
        עבור לניתוח
      </button>
    </div>
  );

  // ── No analytics ──
  if (!analytics) return (
    <div style={{ minHeight:"100vh", background:"#060d1a", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, direction:"rtl" }}>
      <p style={{ color:"#94a3b8", fontSize:16 }}>טרם הושלם ניתוח. הפעל ניתוח תחילה.</p>
      <button onClick={() => navigate("/analytics/analysis")} style={{ background:"#3b82f6", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", cursor:"pointer", fontSize:14 }}>
        ← עבור לניתוח
      </button>
    </div>
  );

  const conv = analytics.conversion_rate?.overall_pct ?? analytics.conversion_rate;

  return (
    <div lang="he" style={{ minHeight:"100vh", background:"#060d1a", color:"#e2e8f0", fontFamily:"'Segoe UI', sans-serif", direction:"rtl" }}>

      {/* ── Top bar ── */}
      <div style={{ background:"#0a1628", borderBottom:"1px solid #1e293b", padding:"16px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h1 style={{ margin:0, fontSize:20, fontWeight:700 }}>לוח בקרה — ניתוח שאלות עסקיות</h1>
        <button
          type="button" onClick={() => navigate("/analytics/analysis")}
          style={{ background:"#1e293b", color:"#94a3b8", border:"none", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:13 }}
        >
          ← ניתוח
        </button>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px 20px" }}>

        {/* ── KPIs ── */}
        <div style={{ display:"flex", gap:16, marginBottom:28, flexWrap:"wrap" }}>
          <KpiCard label="סה״כ לידים"    value={fmt(analytics.total_leads)}    color="#3b82f6" />
          <KpiCard label="סה״כ נרשמים"   value={fmt(analytics.total_enrolled)} color="#10b981" />
          <KpiCard label="המרה כוללת"    value={pct(conv)}                     color="#f59e0b" />
          <KpiCard
            label="שאלות עסקיות"
            value={questions.length || "—"}
            sub={questions.length ? `${questions.filter(q => renderers[qNum(q)]).length} מענות זמינות` : "טרם הועלו שאלות"}
            color="#a78bfa"
          />
        </div>

        {/* ── No questions message ── */}
        {!questions.length && (
          <div style={{
            background:"#0f172a", border:"1px dashed #334155", borderRadius:12,
            padding:"24px", textAlign:"center", marginBottom:24,
          }}>
            <p style={{ color:"#94a3b8", fontSize:14, margin:"0 0 12px" }}>
              לא נמצאו שאלות עסקיות. העלה את קובץ השאלות כדי לראות את הדשבורד הדינמי.
            </p>
            <button
              onClick={() => navigate("/analytics/analysis")}
              style={{ background:"#3b82f6", color:"#fff", border:"none", borderRadius:8, padding:"8px 20px", cursor:"pointer", fontSize:13 }}
            >
              העלה שאלות
            </button>
          </div>
        )}

        {/* ── Category tabs ── */}
        <div style={{ display:"flex", gap:4, marginBottom:20, flexWrap:"wrap", borderBottom:"1px solid #1e293b", paddingBottom:0 }}>
          {CATEGORIES.map(cat => {
            const count = cat.fixed ? null : questions.filter(q => resolveCategory(q.metadata?.category) === cat.id).length;
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(cat.id)}
                style={{
                  background:   isActive ? "#1e3a5f" : "transparent",
                  color:        isActive ? "#93c5fd" : cat.fixed ? "#a78bfa" : "#64748b",
                  border:       "none",
                  borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
                  borderRadius: "8px 8px 0 0",
                  padding:      "10px 16px",
                  cursor:       "pointer",
                  fontSize:     13,
                  fontWeight:   isActive ? 600 : cat.fixed ? 500 : 400,
                  whiteSpace:   "nowrap",
                }}
              >
                {cat.icon} {cat.label}
                {count > 0 && (
                  <span style={{ marginRight:6, fontSize:11, color: isActive ? "#93c5fd" : "#475569" }}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Active tab content ── */}
        {activeTab === "cross"
          ? (
            <div style={{ background:"#0d1626", border:"1px solid #1e293b", borderRadius:12, padding:"20px 24px" }}>
              <p style={{ color:"#64748b", fontSize:13, marginTop:0, marginBottom:20 }}>
                בחר שני ממדים לצפייה בהצלבה — הטבלה מתעדכנת מיד מהנתונים הקיימים.
              </p>
              <CrossBuilder analytics={analytics} />
            </div>
          )
          : (
            <CategoryTab
              key={activeTab}
              catId={activeTab}
              questions={questions}
              renderers={renderers}
            />
          )
        }

      </div>
    </div>
  );
}

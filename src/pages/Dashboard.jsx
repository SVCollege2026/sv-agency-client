/**
 * Dashboard.jsx — לוח בקרה
 * ================================================
 * מציג את ה-facts המחושבים-מראש, מקובצים ל-6 נושאים.
 * עיצוב: KPI strip + 2-column grid + כרטיסים עם shadow.
 *
 * מקור: GET /api/dashboard/baseline-facts (public.stage0_baseline_facts)
 */
import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";
import { getBaselineFacts } from "../api.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_ORDER = ["leads", "media", "enrollments", "cancellations", "context", "analytics"];

const GROUP_COLORS = {
  leads:         "#3b82f6",
  media:         "#8b5cf6",
  enrollments:   "#10b981",
  cancellations: "#ef4444",
  context:       "#f59e0b",
  analytics:     "#06b6d4",
};

const PAL = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#0ea5e9",
];

// Facts that should always span full width in the 2-col grid
const FULL_WIDTH_TYPES = new Set(["table", "sankey"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVal(v, key = "") {
  if (v == null || v === "") return "—";
  if (typeof v !== "number") return String(v);
  if (key.includes("pct") || key.includes("rate")) return `${v.toFixed(2)}%`;
  if (key.includes("spend") || key.includes("cpl") || key.includes("cpa") || key.includes("cpr"))
    return `₪${v.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
  if (Number.isInteger(v)) return v.toLocaleString("he-IL");
  return v.toLocaleString("he-IL", { maximumFractionDigits: 1 });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

// Pivot helper: long → wide format for grouped/stacked charts
function pivotByGroup(rows, xKey, groupKey, valueKey) {
  const out = {};
  const groups = new Set();
  for (const r of rows || []) {
    const x = r[xKey];
    if (x == null) continue;
    if (!out[x]) out[x] = { [xKey]: x };
    const g = r[groupKey];
    if (g != null) { out[x][g] = r[valueKey]; groups.add(g); }
  }
  return { data: Object.values(out), seriesKeys: [...groups] };
}

// Auto-detect chart shape (legacy fallback when no explicit chart_type)
function pickChartShape(fact) {
  const cols = fact.columns || [];
  const rows = fact.rows || [];
  if (rows.length < 2 || cols.length < 2) return null;
  const labelKey = cols[0];
  const sampleLabel = rows[0]?.[labelKey];
  const numericCols = cols.slice(1).filter((c) => {
    const v = rows[0]?.[c];
    return typeof v === "number" || (typeof v === "string" && !isNaN(parseFloat(v)));
  });
  if (numericCols.length === 0) return null;
  if (typeof sampleLabel === "string" && /^\d{4}-\d{2}$/.test(sampleLabel))
    return { type: "line", labelKey, valueKeys: numericCols };
  return { type: "bar", labelKey, valueKeys: numericCols };
}

// Extract KPI values from well-known fact IDs for the header strip
function extractKpis(groups) {
  const allFacts = Object.values(groups || {}).flatMap(g => g?.facts || []);
  const byId = Object.fromEntries(allFacts.map(f => [f.fact_id, f]));
  const kpis = [];

  // Leads 2026 (or last available year)
  const leadsFact = byId["leads_by_year"];
  if (leadsFact?.rows?.length) {
    const r = leadsFact.rows.find(r => String(r.year) === "2026") || leadsFact.rows.at(-1);
    if (r?.total != null)
      kpis.push({ label: "לידים YTD", value: r.total, format: "num",   color: "#3b82f6", sub: String(r.year) });
  }

  // Enrollments 2026
  const enrollFact = byId["enrollments_by_year"];
  if (enrollFact?.rows?.length) {
    const r = enrollFact.rows.find(r => String(r.year) === "2026") || enrollFact.rows.at(-1);
    if (r?.enrolled_total != null)
      kpis.push({ label: "נרשמים YTD", value: r.enrolled_total, format: "num", color: "#10b981", sub: String(r.year) });
  }

  // Meta spend 2026
  const spendFact = byId["media_spend_by_year"];
  if (spendFact?.rows?.length) {
    const metaRows = spendFact.rows.filter(r =>
      String(r.year) === "2026" && String(r.platform || "").toLowerCase().includes("meta"));
    const total = metaRows.reduce((s, r) => s + (r.spend || 0), 0);
    if (total > 0)
      kpis.push({ label: "ספנד Meta", value: total, format: "money", color: "#8b5cf6", sub: "2026" });
  }

  // Google CPL 2026
  const cplFact = byId["cpl_by_year_platform"];
  if (cplFact?.rows?.length) {
    const r = cplFact.rows.find(r =>
      String(r.year) === "2026" && String(r.platform || "").toLowerCase().includes("google"));
    if (r?.cpl != null)
      kpis.push({ label: "CPL Google", value: r.cpl, format: "money", color: "#f59e0b", sub: "2026" });
  }

  // Active learners (from status_distribution)
  const statusFact = byId["status_distribution"];
  if (statusFact?.rows?.length) {
    const active = statusFact.rows.find(r =>
      String(r.status) === "נרשם" || String(r.status).includes("פעיל"));
    if (active?.n != null)
      kpis.push({ label: "לומדים פעילים", value: active.n, format: "num", color: "#06b6d4", sub: "כרגע" });
  }

  return kpis;
}

function fmtKpi(value, format) {
  if (value == null) return "—";
  if (format === "money") return `₪${Math.round(value).toLocaleString("he-IL")}`;
  if (format === "pct")   return `${Number(value).toFixed(1)}%`;
  return Math.round(value).toLocaleString("he-IL");
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function MdLine({ text }) {
  const parts = String(text || "").split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

function MdBlock({ text }) {
  if (!text) return null;
  return (
    <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.75 }}>
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 6 }} />;
        return (
          <div key={i} style={{ marginBottom: 4 }}>
            <MdLine text={t} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #e2e8f0",
      borderRadius: 8, padding: "8px 12px",
      direction: "rtl", textAlign: "right", fontSize: 12,
      boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
    }}>
      {label && <div style={{ color: "#475569", marginBottom: 4, fontWeight: 600 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between",
                              gap: 12, color: p.color, padding: "2px 0" }}>
          <span>{p.name}</span>
          <strong>{fmtVal(p.value, p.dataKey)}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── Chart renderers ──────────────────────────────────────────────────────────

function PieChartView({ fact }) {
  const cfg = fact.chart_config || {};
  const labelKey = cfg.label || (fact.columns || [])[0];
  const valueKey = cfg.value || (fact.columns || []).find((c) => c !== labelKey);
  const data = (fact.rows || []).filter((r) => r[valueKey] != null);
  return (
    <div style={{ width: "100%", height: 300, marginTop: 8 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey={valueKey} nameKey={labelKey}
               cx="50%" cy="50%" outerRadius={110} innerRadius={50}
               label={(e) => e[labelKey]}>
            {data.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function HBarChartView({ fact }) {
  const cfg = fact.chart_config || {};
  const xKey = cfg.x || (fact.columns || [])[0];
  const yKey = cfg.y || (fact.columns || []).find((c) => c !== xKey);
  const data = [...(fact.rows || [])].sort((a, b) => (b[yKey] || 0) - (a[yKey] || 0));
  const height = Math.max(200, data.length * 28);
  return (
    <div style={{ width: "100%", height, marginTop: 8 }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical"
                  margin={{ top: 4, right: 32, bottom: 4, left: 110 }}>
          <CartesianGrid stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }}
                 width={100} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey={yKey} fill={PAL[0]} radius={[0, 5, 5, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarChartView({ fact }) {
  const cfg = fact.chart_config || {};
  const xKey = cfg.x || (fact.columns || [])[0];
  const yKey = cfg.y || (fact.columns || []).find((c) => c !== xKey);
  const isPct = (yKey || "").includes("pct") || (yKey || "").includes("rate");
  return (
    <div style={{ width: "100%", height: 280, marginTop: 8 }}>
      <ResponsiveContainer>
        <BarChart data={fact.rows} margin={{ top: 6, right: 18, bottom: 6, left: 18 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }}
                 tickFormatter={isPct ? ((v) => `${v}%`) : undefined} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey={yKey} fill={PAL[0]} radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LineChartView({ fact }) {
  const cfg = fact.chart_config || {};
  const xKey = cfg.x || (fact.columns || [])[0];
  let data = fact.rows;
  let seriesKeys = [];
  if (Array.isArray(cfg.series) && cfg.series.length) {
    seriesKeys = cfg.series;
  } else if (cfg.group_by && cfg.value) {
    const piv = pivotByGroup(fact.rows, xKey, cfg.group_by, cfg.value);
    data = piv.data; seriesKeys = piv.seriesKeys;
  } else if (cfg.y) {
    seriesKeys = [cfg.y];
  } else {
    seriesKeys = (fact.columns || []).filter((c) => c !== xKey).slice(0, 5);
  }
  return (
    <div style={{ width: "100%", height: 300, marginTop: 8 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 18, bottom: 6, left: 18 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {seriesKeys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={PAL[i % PAL.length]}
                  strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function StackedBarView({ fact }) {
  const cfg = fact.chart_config || {};
  const xKey = cfg.x || (fact.columns || [])[0];
  let data = fact.rows;
  let seriesKeys = [];
  if (cfg.group_by && cfg.value) {
    const piv = pivotByGroup(fact.rows, xKey, cfg.group_by, cfg.value);
    data = piv.data; seriesKeys = piv.seriesKeys;
  } else if (Array.isArray(cfg.series) && cfg.series.length) {
    seriesKeys = cfg.series;
  } else {
    const exclude = new Set([xKey, ...(cfg.exclude || [])]);
    seriesKeys = (fact.columns || []).filter((c) => !exclude.has(c));
  }
  return (
    <div style={{ width: "100%", height: 300, marginTop: 8 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 18, bottom: 6, left: 18 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={PAL[i % PAL.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GroupedBarView({ fact }) {
  const cfg = fact.chart_config || {};
  const xKey = cfg.x || (fact.columns || [])[0];
  let data = fact.rows;
  let seriesKeys = [];
  if (cfg.group_by && cfg.value) {
    const piv = pivotByGroup(fact.rows, xKey, cfg.group_by, cfg.value);
    data = piv.data; seriesKeys = piv.seriesKeys;
  } else if (Array.isArray(cfg.series) && cfg.series.length) {
    seriesKeys = cfg.series;
  } else {
    const exclude = new Set([xKey, ...(cfg.exclude || [])]);
    seriesKeys = (fact.columns || []).filter((c) => !exclude.has(c));
  }
  const avgLen = data.length
    ? data.reduce((s, r) => s + String(r[xKey] || "").length, 0) / data.length : 0;
  const angled = avgLen > 6;
  return (
    <div style={{ width: "100%", height: angled ? 340 : 300, marginTop: 8 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 18, bottom: angled ? 60 : 6, left: 18 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey={xKey} interval={0}
                 tick={{ fontSize: 10, fill: "#64748b", ...(angled ? { angle: -35, dy: 8 } : {}) }}
                 height={angled ? 70 : 30} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={PAL[i % PAL.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Sankey (pure-SVG) ────────────────────────────────────────────────────────

function SankeyChartView({ fact }) {
  const cfg = fact.chart_config || {};
  const srcKey = cfg.source || "interested_in";
  const dstKey = cfg.target || "enrolled_in";
  const valKey = cfg.value  || "n";

  const flows = (fact.rows || []).filter((r) => r.is_cross === true || r.is_cross === "true");
  if (!flows.length) return null;

  const srcTotals = {}, dstTotals = {};
  let totalFlow = 0;
  flows.forEach((f) => {
    srcTotals[f[srcKey]] = (srcTotals[f[srcKey]] || 0) + Number(f[valKey]);
    dstTotals[f[dstKey]] = (dstTotals[f[dstKey]] || 0) + Number(f[valKey]);
    totalFlow += Number(f[valKey]);
  });
  if (!totalFlow) return null;

  const PAD = 8, MIN_H = 6;
  function layoutNodes(totalsMap) {
    const sorted = Object.entries(totalsMap).sort((a, b) => b[1] - a[1]);
    const usableH = 360 - PAD * (sorted.length - 1);
    let y = 14;
    return sorted.map(([name, total]) => {
      const h = Math.max(MIN_H, (total / totalFlow) * usableH);
      const node = { name, total, y, h };
      y += h + PAD;
      return node;
    });
  }

  const srcNodes = layoutNodes(srcTotals);
  const dstNodes = layoutNodes(dstTotals);

  const svgH = Math.max(
    (srcNodes.at(-1)?.y ?? 0) + (srcNodes.at(-1)?.h ?? 0),
    (dstNodes.at(-1)?.y ?? 0) + (dstNodes.at(-1)?.h ?? 0),
  ) + 20;

  const W = 520, nodeW = 14;
  const leftX = 140, rightX = W - 140 - nodeW;
  const cx = (leftX + nodeW + rightX) / 2;

  const srcMap = Object.fromEntries(srcNodes.map((n) => [n.name, n]));
  const dstMap = Object.fromEntries(dstNodes.map((n) => [n.name, n]));
  const srcOff = Object.fromEntries(srcNodes.map((n) => [n.name, 0]));
  const dstOff = Object.fromEntries(dstNodes.map((n) => [n.name, 0]));
  const srcColors = Object.fromEntries(srcNodes.map((n, i) => [n.name, PAL[i % PAL.length]]));

  const usableH = 360 - PAD * (srcNodes.length - 1);
  const scaleH = (v) => Math.max(1.5, (v / totalFlow) * usableH);

  const sortedFlows = [...flows].sort((a, b) => {
    const sd = srcTotals[b[srcKey]] - srcTotals[a[srcKey]];
    return sd !== 0 ? sd : b[valKey] - a[valKey];
  });

  const links = sortedFlows.map((f) => {
    const src = srcMap[f[srcKey]], dst = dstMap[f[dstKey]];
    if (!src || !dst) return null;
    const fH = scaleH(Number(f[valKey]));
    const sy0 = src.y + srcOff[f[srcKey]];
    const dy0 = dst.y + dstOff[f[dstKey]];
    srcOff[f[srcKey]] += fH;
    dstOff[f[dstKey]] += fH;
    return { ...f, sy0, dy0, fH, color: srcColors[f[srcKey]] };
  }).filter(Boolean);

  return (
    <div style={{ width: "100%", marginTop: 10, overflowX: "auto" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${svgH}`} style={{ display: "block" }}>
        {links.map((l, i) => {
          const d = [
            `M ${leftX + nodeW} ${l.sy0}`,
            `C ${cx} ${l.sy0}, ${cx} ${l.dy0}, ${rightX} ${l.dy0}`,
            `L ${rightX} ${l.dy0 + l.fH}`,
            `C ${cx} ${l.dy0 + l.fH}, ${cx} ${l.sy0 + l.fH}, ${leftX + nodeW} ${l.sy0 + l.fH}`,
            "Z",
          ].join(" ");
          return (
            <path key={i} d={d} fill={l.color} opacity={0.42}>
              <title>{l[srcKey]} ← {l[dstKey]}: {l[valKey]}</title>
            </path>
          );
        })}
        {srcNodes.map((n) => (
          <g key={n.name}>
            <rect x={leftX} y={n.y} width={nodeW} height={n.h} fill={srcColors[n.name]} rx={2} />
            <text x={leftX - 6} y={n.y + n.h / 2} textAnchor="end" dominantBaseline="middle"
                  fontSize={11} fill="#1e293b">{n.name}</text>
          </g>
        ))}
        {dstNodes.map((n) => (
          <g key={n.name}>
            <rect x={rightX} y={n.y} width={nodeW} height={n.h} fill="#64748b" rx={2} />
            <text x={rightX + nodeW + 6} y={n.y + n.h / 2} textAnchor="start" dominantBaseline="middle"
                  fontSize={11} fill="#1e293b">
              {n.name}{" "}
              <tspan fontSize={10} fill="#64748b">({n.total})</tspan>
            </text>
          </g>
        ))}
      </svg>
      <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0", textAlign: "center" }}>
        מציג מעברים בין קורסים בלבד (ללא רישום לאותו קורס שהתעניינו בו)
      </p>
    </div>
  );
}

// ─── Chart dispatcher ─────────────────────────────────────────────────────────

function FactChart({ fact }) {
  const t = fact.chart_type || "auto";
  if (t === "pie")          return <PieChartView fact={fact} />;
  if (t === "hbar")         return <HBarChartView fact={fact} />;
  if (t === "bar")          return <BarChartView fact={fact} />;
  if (t === "line")         return <LineChartView fact={fact} />;
  if (t === "stacked_bar")  return <StackedBarView fact={fact} />;
  if (t === "grouped_bar")  return <GroupedBarView fact={fact} />;
  if (t === "sankey")       return <SankeyChartView fact={fact} />;
  if (t === "table" || t === "metric") return null;

  // Auto fallback
  const shape = pickChartShape(fact);
  if (!shape) return null;
  const { type, labelKey, valueKeys } = shape;
  const keys = valueKeys.slice(0, 8);
  const chartData = fact.rows;
  if (type === "line") {
    return (
      <div style={{ width: "100%", height: 300, marginTop: 8 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 6, right: 18, bottom: 6, left: 18 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={labelKey} tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {keys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={PAL[i % PAL.length]}
                    strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: 280, marginTop: 8 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 6, right: 18, bottom: 6, left: 18 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey={labelKey} tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={PAL[i % PAL.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Data table ───────────────────────────────────────────────────────────────

function FactTable({ fact }) {
  const cols = fact.columns || [];
  const rows = fact.rows || [];
  const totals = fact.totals;
  if (!cols.length || !rows.length) return null;
  return (
    <div style={{ marginTop: 14, overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ background: "#f8fafc" }}>
          <tr>{cols.map((c) => (
            <th key={c} style={{
              padding: "9px 12px", textAlign: "right",
              fontWeight: 700, color: "#0f172a",
              borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap",
            }}>{c}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{
              background: i % 2 === 1 ? "#f8fafc" : "#ffffff",
              borderTop: "1px solid #f1f5f9",
              transition: "background 0.1s",
            }}>
              {cols.map((c) => (
                <td key={c} style={{ padding: "8px 12px", textAlign: "right",
                                     color: "#1e293b", whiteSpace: "nowrap" }}>
                  {fmtVal(r[c], c)}
                </td>
              ))}
            </tr>
          ))}
          {totals && (
            <tr style={{ background: "#fef9ec", borderTop: "2px solid #f59e0b",
                         fontWeight: 700, color: "#0f172a" }}>
              {cols.map((c) => (
                <td key={c} style={{ padding: "9px 12px", textAlign: "right",
                                     whiteSpace: "nowrap" }}>{fmtVal(totals[c], c)}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Fact card ────────────────────────────────────────────────────────────────

function FactCard({ fact, accentColor }) {
  const isTable  = fact.chart_type === "table";
  const hasChart = !isTable && fact.chart_type !== "metric" && (
    fact.chart_type && fact.chart_type !== "auto"
      ? true
      : !!pickChartShape(fact)
  );
  const [tableOpen,   setTableOpen]   = useState(isTable);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const accent = accentColor || "#3b82f6";

  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e8edf3",
      borderTop: `3px solid ${accent}`,
      borderRadius: 12,
      padding: "18px 20px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>
      {/* Title */}
      <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
        {fact.title}
      </h3>

      {/* Chart caption — מעל הגרף (שורה קצרה מה רואים) */}
      {fact.chart_caption && (
        <p style={{
          margin: "0 0 10px", fontSize: 13, color: "#475569",
          lineHeight: 1.55, textAlign: "right", direction: "rtl",
        }}>
          {fact.chart_caption}
        </p>
      )}

      {/* Chart */}
      {hasChart && <FactChart fact={fact} />}

      {/* Management summary — collapsible */}
      {fact.human_description && (
        <div style={{ marginTop: 14, borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
          <button
            type="button"
            onClick={() => setSummaryOpen(o => !o)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: summaryOpen ? "#f0f9ff" : "#f8fafc",
              border: "1px solid " + (summaryOpen ? "#bae6fd" : "#e2e8f0"),
              borderRadius: 7, padding: "5px 12px",
              fontSize: 12, fontWeight: 600,
              color: summaryOpen ? "#0369a1" : "#475569",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            <span>📊</span>
            <span>סיכום מנהלים</span>
            <span style={{ marginRight: "auto", opacity: 0.6 }}>{summaryOpen ? "▲" : "▼"}</span>
          </button>
          {summaryOpen && (
            <div style={{
              marginTop: 10, padding: "12px 14px",
              background: "#f8fafc", borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}>
              <MdBlock text={fact.human_description} />
            </div>
          )}
        </div>
      )}

      {/* Table toggle */}
      <div style={{ marginTop: fact.human_description ? 8 : 14 }}>
        <button
          type="button"
          onClick={() => setTableOpen(o => !o)}
          style={{
            padding: "5px 12px", fontSize: 12, fontWeight: 600,
            background: tableOpen ? "#1e3a5f" : "transparent",
            color: tableOpen ? "#ffffff" : "#1e40af",
            border: "1px solid " + (tableOpen ? "#1e3a5f" : "#dbeafe"),
            borderRadius: 7, cursor: "pointer", transition: "all 0.15s",
          }}
        >
          {tableOpen ? "▲ הסתר טבלה" : `▼ הצג טבלה (${fact.rows?.length || 0} שורות)`}
        </button>
        {tableOpen && <FactTable fact={fact} />}
      </div>
    </div>
  );
}

// ─── KPI strip ────────────────────────────────────────────────────────────────

function KpiStrip({ kpis }) {
  if (!kpis?.length) return null;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${kpis.length}, 1fr)`,
      gap: 12,
      marginBottom: 28,
    }}>
      {kpis.map((k, i) => (
        <div key={i} style={{
          background: "#ffffff",
          border: "1px solid #e8edf3",
          borderTop: `3px solid ${k.color}`,
          borderRadius: 12,
          padding: "16px 18px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
            {k.label}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
            {fmtKpi(k.value, k.format)}
          </div>
          {k.sub && (
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{k.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [activeTab, setTab]   = useState("leads");

  useEffect(() => {
    getBaselineFacts()
      .then(setData)
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageShell><Center>טוען לוח בקרה…</Center></PageShell>;
  if (error)   return <PageShell><ErrorBox message={error} /></PageShell>;
  if (!data?.available) return <PageShell><EmptyState /></PageShell>;

  const tabs = GROUP_ORDER
    .filter((g) => data.groups[g])
    .map((g) => ({ key: g, ...data.groups[g] }));
  Object.keys(data.groups).forEach((g) => {
    if (!GROUP_ORDER.includes(g)) tabs.push({ key: g, ...data.groups[g] });
  });

  const active    = data.groups[activeTab] || tabs[0];
  const kpis      = extractKpis(data.groups);
  const accent    = GROUP_COLORS[activeTab] || "#3b82f6";
  const totalFacts = Object.values(data.groups).reduce((s, g) => s + g.facts.length, 0);

  return (
    <PageShell>
      {/* Header meta row */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 20, flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          baseline נכון ל-{data.cutoff_date} · עודכן: {fmtDateTime(data.computed_at)} · {totalFacts} ניתוחים
        </div>
      </div>

      {/* KPI strip */}
      <KpiStrip kpis={kpis} />

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24,
        borderBottom: "2px solid #e2e8f0", paddingBottom: 0,
      }}>
        {tabs.map((t) => {
          const isActive = activeTab === t.key;
          const tabColor = GROUP_COLORS[t.key] || "#3b82f6";
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 600,
                background: isActive ? tabColor : "transparent",
                color: isActive ? "#ffffff" : "#64748b",
                border: isActive ? `1px solid ${tabColor}` : "1px solid transparent",
                borderBottom: isActive ? `1px solid ${tabColor}` : "1px solid transparent",
                borderRadius: "8px 8px 0 0",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: -2,
                transition: "all 0.15s",
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              <span style={{
                fontSize: 11, padding: "1px 6px",
                background: isActive ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                color: isActive ? "#ffffff" : "#64748b",
                borderRadius: 99, fontWeight: 700,
              }}>{t.facts.length}</span>
            </button>
          );
        })}
      </div>

      {/* Active group heading */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{
          fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "0 0 4px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{
            display: "inline-block", width: 5, height: 20,
            background: accent, borderRadius: 3,
          }} />
          {active?.icon} {active?.label}
        </h2>
        {active?.description && (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{active.description}</p>
        )}
      </div>

      {/* 2-column chart grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 20,
        alignItems: "start",
      }}>
        {active?.facts.map((f) => (
          <div
            key={f.fact_id}
            style={{
              gridColumn: FULL_WIDTH_TYPES.has(f.chart_type) ? "1 / -1" : undefined,
            }}
          >
            <FactCard fact={f} accentColor={accent} />
          </div>
        ))}
      </div>
    </PageShell>
  );
}

// ─── Layout shells ────────────────────────────────────────────────────────────

function PageShell({ children }) {
  return (
    <div lang="he" dir="rtl" style={{
      background: "#f1f5f9",
      color: "#0f172a",
      minHeight: "calc(100vh - 56px - 42px)",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Page header */}
      <div style={{
        background: "#0f172a",
        padding: "24px 32px 20px",
        marginBottom: 0,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 2px", color: "#ffffff" }}>
          📊 לוח בקרה
        </h1>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
          כל הניתוחים על baseline שלב 0 — מקובצים לפי נושאים. לחץ על כרטיס לסיכום מנהלים.
        </p>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 28px 64px" }}>
        {children}
      </div>
    </div>
  );
}

function Center({ children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "80px 20px", color: "#64748b", fontSize: 14,
    }}>{children}</div>
  );
}

function ErrorBox({ message }) {
  return (
    <div style={{
      background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b",
      borderRadius: 10, padding: "14px 18px", fontSize: 14,
    }}>⚠ {message}</div>
  );
}

function EmptyState() {
  return (
    <div style={{
      textAlign: "center", padding: "60px 20px",
      background: "#ffffff", border: "1px dashed #cbd5e1", borderRadius: 12,
    }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
      <h3 style={{ fontSize: 17, color: "#0f172a", margin: "0 0 6px" }}>
        עדיין אין נתונים בלוח הבקרה
      </h3>
      <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
        ה-facts יוצרים ע"י <code>scripts/populate_stage0_baseline_facts.py</code>
      </p>
    </div>
  );
}

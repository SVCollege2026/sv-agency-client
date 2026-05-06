/**
 * Dashboard.jsx — לוח בקרה
 * ================================================
 * מציג את 28 ה-facts המחושבים-מראש, מקובצים ל-6 נושאים.
 * לכל fact: משפט הסבר → גרף → מקליקים לפתוח טבלה עם המספרים.
 *
 * מקור: GET /api/dashboard/baseline-facts (public.stage0_baseline_facts)
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";
import { getBaselineFacts } from "../api.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_ORDER = ["leads", "media", "enrollments", "cancellations", "context", "analytics"];

const PAL = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
             "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#0ea5e9"];

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

// Pivot helper: converts rows like [{x:..., group_by:..., value:...}, ...]
// into [{x: x_val, series_a: v, series_b: v}, ...] suitable for grouped/stacked charts
function pivotByGroup(rows, xKey, groupKey, valueKey) {
  const out = {};
  const groups = new Set();
  for (const r of rows || []) {
    const x = r[xKey];
    if (x == null) continue;
    if (!out[x]) out[x] = { [xKey]: x };
    const g = r[groupKey];
    if (g != null) {
      out[x][g] = r[valueKey];
      groups.add(g);
    }
  }
  return { data: Object.values(out), seriesKeys: [...groups] };
}

// Detect chart shape: line for monthly, bar for category, none if unsuitable.
// Used as FALLBACK when fact has no explicit chart_type.
function pickChartShape(fact) {
  const cols = fact.columns || [];
  const rows = fact.rows || [];
  if (rows.length < 2 || cols.length < 2) return null;

  // First column = label
  const labelKey = cols[0];
  const sampleLabel = rows[0]?.[labelKey];

  // Numeric columns
  const numericCols = cols.slice(1).filter((c) => {
    const v = rows[0]?.[c];
    return typeof v === "number" || (typeof v === "string" && !isNaN(parseFloat(v)));
  });

  if (numericCols.length === 0) return null;

  // Monthly format YYYY-MM → line
  if (typeof sampleLabel === "string" && /^\d{4}-\d{2}$/.test(sampleLabel)) {
    return { type: "line", labelKey, valueKeys: numericCols };
  }
  // Yearly or category → bar
  return { type: "bar", labelKey, valueKeys: numericCols };
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #cbd5e1",
      borderRadius: 8, padding: "8px 12px",
      direction: "rtl", textAlign: "right", fontSize: 12,
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
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

// ─── Components ───────────────────────────────────────────────────────────────

// ─── Chart renderers ──────────────────────────────────────────────────────────

function PieChartView({ fact }) {
  const cfg = fact.chart_config || {};
  const labelKey = cfg.label || (fact.columns || [])[0];
  const valueKey = cfg.value || (fact.columns || []).find((c) => c !== labelKey);
  const data = (fact.rows || []).filter((r) => r[valueKey] != null);
  return (
    <div style={{ width: "100%", height: 300, marginTop: 6 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey={valueKey} nameKey={labelKey}
               cx="50%" cy="50%" outerRadius={100} label={(e) => e[labelKey]}>
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
  const height = Math.max(220, data.length * 28);
  return (
    <div style={{ width: "100%", height, marginTop: 6 }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical"
                  margin={{ top: 6, right: 30, bottom: 6, left: 110 }}>
          <CartesianGrid stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#475569" }} />
          <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11, fill: "#475569" }}
                 width={100} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey={yKey} fill={PAL[0]} radius={[0, 4, 4, 0]} />
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
    <div style={{ width: "100%", height: 260, marginTop: 6 }}>
      <ResponsiveContainer>
        <BarChart data={fact.rows} margin={{ top: 6, right: 18, bottom: 6, left: 18 }}>
          <CartesianGrid stroke="#f1f5f9" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#475569" }} />
          <YAxis tick={{ fontSize: 11, fill: "#475569" }}
                 tickFormatter={isPct ? ((v) => `${v}%`) : undefined} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey={yKey} fill={PAL[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LineChartView({ fact }) {
  const cfg = fact.chart_config || {};
  const xKey = cfg.x || (fact.columns || [])[0];
  // Multiple series — either explicit list, or pivot by group_by, or numeric cols
  let data = fact.rows;
  let seriesKeys = [];
  if (Array.isArray(cfg.series) && cfg.series.length) {
    seriesKeys = cfg.series;
  } else if (cfg.group_by && cfg.value) {
    const piv = pivotByGroup(fact.rows, xKey, cfg.group_by, cfg.value);
    data = piv.data;
    seriesKeys = piv.seriesKeys;
  } else if (cfg.y) {
    seriesKeys = [cfg.y];
  } else {
    seriesKeys = (fact.columns || []).filter((c) => c !== xKey).slice(0, 5);
  }
  return (
    <div style={{ width: "100%", height: 280, marginTop: 6 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 18, bottom: 6, left: 18 }}>
          <CartesianGrid stroke="#f1f5f9" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: "#475569" }} />
          <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {seriesKeys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={PAL[i % PAL.length]}
                  strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
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
    data = piv.data;
    seriesKeys = piv.seriesKeys;
  } else {
    const exclude = new Set([xKey, ...(cfg.exclude || [])]);
    seriesKeys = (fact.columns || []).filter((c) => !exclude.has(c));
  }
  return (
    <div style={{ width: "100%", height: 300, marginTop: 6 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 18, bottom: 6, left: 18 }}>
          <CartesianGrid stroke="#f1f5f9" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#475569" }} />
          <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
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
  // Same shape as stacked but without stackId
  const cfg = fact.chart_config || {};
  const xKey = cfg.x || (fact.columns || [])[0];
  let data = fact.rows;
  let seriesKeys = [];
  if (cfg.group_by && cfg.value) {
    const piv = pivotByGroup(fact.rows, xKey, cfg.group_by, cfg.value);
    data = piv.data;
    seriesKeys = piv.seriesKeys;
  } else {
    const exclude = new Set([xKey, ...(cfg.exclude || [])]);
    seriesKeys = (fact.columns || []).filter((c) => !exclude.has(c));
  }
  // Auto-angle x-axis labels when average label length > 6 chars
  const avgLen = data.length
    ? data.reduce((s, r) => s + String(r[xKey] || "").length, 0) / data.length
    : 0;
  const angled = avgLen > 6;
  return (
    <div style={{ width: "100%", height: angled ? 340 : 300, marginTop: 6 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 18, bottom: angled ? 60 : 6, left: 18 }}>
          <CartesianGrid stroke="#f1f5f9" />
          <XAxis dataKey={xKey} interval={0}
                 tick={{ fontSize: 10, fill: "#475569", ...(angled ? { angle: -35, dy: 8 } : {}) }}
                 height={angled ? 70 : 30} />
          <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
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

// ─── Sankey (pure-SVG, no external lib) ──────────────────────────────────────
function SankeyChartView({ fact }) {
  const cfg = fact.chart_config || {};
  const srcKey = cfg.source || "interested_in";
  const dstKey = cfg.target || "enrolled_in";
  const valKey = cfg.value  || "n";

  // Only cross-course flows (filter out same→same)
  const flows = (fact.rows || []).filter((r) => r.is_cross === true || r.is_cross === "true");
  if (!flows.length) return null;

  // Aggregate totals
  const srcTotals = {}, dstTotals = {};
  let totalFlow = 0;
  flows.forEach((f) => {
    srcTotals[f[srcKey]] = (srcTotals[f[srcKey]] || 0) + Number(f[valKey]);
    dstTotals[f[dstKey]] = (dstTotals[f[dstKey]] || 0) + Number(f[valKey]);
    totalFlow += Number(f[valKey]);
  });
  if (!totalFlow) return null;

  // Layout helpers
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

  // Scale factor shared with layoutNodes
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
        {/* Flows */}
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
        {/* Source nodes + labels */}
        {srcNodes.map((n) => (
          <g key={n.name}>
            <rect x={leftX} y={n.y} width={nodeW} height={n.h}
                  fill={srcColors[n.name]} rx={2} />
            <text x={leftX - 6} y={n.y + n.h / 2}
                  textAnchor="end" dominantBaseline="middle"
                  fontSize={11} fill="#1e293b">
              {n.name}
            </text>
          </g>
        ))}
        {/* Target nodes + labels */}
        {dstNodes.map((n) => (
          <g key={n.name}>
            <rect x={rightX} y={n.y} width={nodeW} height={n.h}
                  fill="#64748b" rx={2} />
            <text x={rightX + nodeW + 6} y={n.y + n.h / 2}
                  textAnchor="start" dominantBaseline="middle"
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

function FactChart({ fact }) {
  const t = fact.chart_type || "auto";

  if (t === "pie")          return <PieChartView fact={fact} />;
  if (t === "hbar")         return <HBarChartView fact={fact} />;
  if (t === "bar")          return <BarChartView fact={fact} />;
  if (t === "line")         return <LineChartView fact={fact} />;
  if (t === "stacked_bar")  return <StackedBarView fact={fact} />;
  if (t === "grouped_bar")  return <GroupedBarView fact={fact} />;
  if (t === "sankey")       return <SankeyChartView fact={fact} />;
  if (t === "table" || t === "metric") return null; // nothing — table is rendered below

  // auto fallback (legacy)
  const shape = pickChartShape(fact);
  if (!shape) return null;
  const { type, labelKey, valueKeys } = shape;
  const keys = valueKeys.slice(0, 8);
  if (type === "line") {
    return (
      <div style={{ width: "100%", height: 280, marginTop: 6 }}>
        <ResponsiveContainer>
          <LineChart data={fact.rows} margin={{ top: 6, right: 18, bottom: 6, left: 18 }}>
            <CartesianGrid stroke="#f1f5f9" />
            <XAxis dataKey={labelKey} tick={{ fontSize: 11, fill: "#475569" }} />
            <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {keys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={PAL[i % PAL.length]}
                    strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: 280, marginTop: 6 }}>
      <ResponsiveContainer>
        <BarChart data={fact.rows} margin={{ top: 6, right: 18, bottom: 6, left: 18 }}>
          <CartesianGrid stroke="#f1f5f9" />
          <XAxis dataKey={labelKey} tick={{ fontSize: 11, fill: "#475569" }} />
          <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
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

function FactTable({ fact }) {
  const cols = fact.columns || [];
  const rows = fact.rows || [];
  const totals = fact.totals;
  if (!cols.length || !rows.length) return null;
  return (
    <div style={{ marginTop: 12, overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ background: "#f1f5f9" }}>
          <tr>{cols.map((c) => (
            <th key={c} style={{ padding: "8px 10px", textAlign: "right",
                                 fontWeight: 700, color: "#1e293b",
                                 borderBottom: "1px solid #cbd5e1", whiteSpace: "nowrap" }}>{c}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{
              background: i % 2 === 1 ? "#fafbfc" : "#ffffff",
              borderTop: "1px solid #f1f5f9",
            }}>
              {cols.map((c) => (
                <td key={c} style={{ padding: "7px 10px", textAlign: "right",
                                     color: "#1e293b", whiteSpace: "nowrap" }}>
                  {fmtVal(r[c], c)}
                </td>
              ))}
            </tr>
          ))}
          {totals && (
            <tr style={{ background: "#fef3c7", borderTop: "2px solid #f59e0b",
                         fontWeight: 700, color: "#0f172a" }}>
              {cols.map((c) => (
                <td key={c} style={{ padding: "8px 10px", textAlign: "right",
                                     whiteSpace: "nowrap" }}>{fmtVal(totals[c], c)}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FactCard({ fact }) {
  const isTable = (fact.chart_type === "table");
  const hasChart = !isTable && (fact.chart_type !== "metric") && (
    fact.chart_type && fact.chart_type !== "auto"
      ? true
      : !!pickChartShape(fact)
  );
  const [tableOpen, setTableOpen] = useState(isTable); // tables expanded by default

  return (
    <div style={{
      background: "#ffffff", border: "1px solid #e2e8f0",
      borderRadius: 12, padding: "16px 18px", marginBottom: 16,
    }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
        {fact.title}
      </h3>

      {/* Chart caption — מסביר מה הגרף מציג (שונה מה-description שהוא קונטקסט) */}
      {hasChart && fact.chart_caption && (
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#1e293b", lineHeight: 1.6 }}>
          {fact.chart_caption}
        </p>
      )}

      {/* Description — קונטקסט נוסף, רק אם שונה משמעותית מה-caption */}
      {fact.description && (!fact.chart_caption || fact.description !== fact.chart_caption) && (
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
          {fact.description}
        </p>
      )}

      {hasChart && <FactChart fact={fact} />}

      <button
        type="button"
        onClick={() => setTableOpen((o) => !o)}
        style={{
          marginTop: 10, padding: "5px 12px", fontSize: 12,
          background: tableOpen ? "#1e3a5f" : "#ffffff",
          color: tableOpen ? "#ffffff" : "#1e40af",
          border: "1px solid #1e3a5f", borderRadius: 7, cursor: "pointer",
        }}
      >
        {tableOpen ? "▲ הסתר טבלה" : `▼ הצג טבלה (${fact.rows?.length || 0} שורות)`}
      </button>

      {tableOpen && <FactTable fact={fact} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [activeTab, setTab]   = useState("leads");

  useEffect(() => {
    getBaselineFacts()
      .then(setData)
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Page><Center>טוען לוח בקרה…</Center></Page>;
  if (error)   return <Page><ErrorBox message={error} /></Page>;
  if (!data?.available) {
    return (
      <Page>
        <EmptyState />
      </Page>
    );
  }

  // Build tabs in the canonical order
  const tabs = GROUP_ORDER
    .filter((g) => data.groups[g])
    .map((g) => ({ key: g, ...data.groups[g] }));

  // Add any extra groups not in canonical order
  Object.keys(data.groups).forEach((g) => {
    if (!GROUP_ORDER.includes(g)) tabs.push({ key: g, ...data.groups[g] });
  });

  const active = data.groups[activeTab] || tabs[0];

  return (
    <Page>
      {/* Meta line */}
      <div style={{ marginBottom: 24, fontSize: 12, color: "#64748b" }}>
        baseline נכון ל-{data.cutoff_date} · עודכן: {fmtDateTime(data.computed_at)}
        {" · "}{Object.values(data.groups).reduce((s, g) => s + g.facts.length, 0)} ניתוחים
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, flexWrap: "wrap",
        borderBottom: "2px solid #e2e8f0", marginBottom: 24,
      }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 16px", fontSize: 14, fontWeight: 600,
              background: "none",
              color: activeTab === t.key ? "#1e3a5f" : "#64748b",
              border: "none",
              borderBottom: activeTab === t.key ? "3px solid #1e3a5f" : "3px solid transparent",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              marginBottom: -2,
              transition: "color 0.15s",
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            <span style={{
              fontSize: 11, padding: "2px 7px", background: "#f1f5f9",
              color: "#475569", borderRadius: 99, fontWeight: 600,
            }}>{t.facts.length}</span>
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 16px" }}>
          {active?.icon} {active?.label}
        </h2>
        {active?.facts.map((f) => <FactCard key={f.fact_id} fact={f} />)}
      </div>
    </Page>
  );
}

// ─── Layout ────────────────────────────────────────────────────────────────────

function Page({ children }) {
  return (
    <div lang="he" dir="rtl" style={{
      background: "#ffffff", color: "#0f172a",
      minHeight: "calc(100vh - 56px - 42px)",
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 22px 64px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>
          📊 לוח בקרה
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px" }}>
          כל הניתוחים על baseline שלב 0 — מקובצים לפי נושאים. כל גרף עם הסבר מעליו;
          לחיצה על "הצג טבלה" — לראות את המספרים המדויקים.
        </p>
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
      background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 12,
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

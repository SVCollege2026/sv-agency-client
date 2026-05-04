/**
 * ReportsPage.jsx — דוחות שמורים (גרסאות)
 * ===========================================
 * רשימת כל הריצות של Stage 0. כל ריצה היא צילום מלא של הדוח מנהלים +
 * הגרפים באותו רגע. לחיצה על גרסה פותחת snapshot view שמראה את שני
 * החלקים כפי שהיו בעת השמירה.
 *
 * נתונים: GET /api/dashboard/stage0-history (רשימה)
 *         GET /api/dashboard/stage0-report/:id (snapshot מלא)
 */
import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";
import { getStage0History, getStage0Report } from "../api.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_ORDER = ["leads", "media", "enrollments", "cancellations", "context", "analytics"];
const PAL = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444",
             "#06b6d4","#f97316","#84cc16","#ec4899","#0ea5e9"];

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

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

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

// Auto-detect chart shape (used when fact.chart_type === "auto" — saved before
// chart_type was set per fact). Returns null if data shape doesn't fit a chart.
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
  if (typeof sampleLabel === "string" && /^\d{4}-\d{2}$/.test(sampleLabel)) {
    return { type: "line", labelKey, valueKeys: numericCols };
  }
  return { type: "bar", labelKey, valueKeys: numericCols };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [list, setList]                 = useState([]);
  const [loadingList, setLoadingList]   = useState(true);
  const [error, setError]               = useState(null);

  const [selectedId, setSelectedId]     = useState(null);
  const [snapshot, setSnapshot]         = useState(null);
  const [loadingSnap, setLoadingSnap]   = useState(false);

  // Load list once
  useEffect(() => {
    getStage0History()
      .then((d) => {
        const rows = d?.reports || [];
        setList(rows);
        if (rows.length) setSelectedId(rows[0].id);  // open the latest by default
      })
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoadingList(false));
  }, []);

  // Load snapshot when selection changes
  useEffect(() => {
    if (!selectedId) return;
    setLoadingSnap(true);
    setSnapshot(null);
    getStage0Report(selectedId)
      .then(setSnapshot)
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoadingSnap(false));
  }, [selectedId]);

  return (
    <div lang="he" dir="rtl" style={{
      background: "#ffffff", color: "#0f172a",
      minHeight: "calc(100vh - 56px - 42px)",
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 22px 64px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px", color: "#0f172a" }}>
          📄 דוחות
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 24px" }}>
          רשימת כל הגרסאות של ניתוח שלב 0. כל גרסה היא צילום מלא של הדוח מנהלים +
          הגרפים באותו רגע.
        </p>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca",
                        color: "#991b1b", padding: 12, borderRadius: 8, marginBottom: 14 }}>
            ⚠ {error}
          </div>
        )}

        {loadingList ? (
          <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>טוען רשימה…</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", background: "#f8fafc",
                        border: "1px dashed #cbd5e1", borderRadius: 12 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
            <p style={{ color: "#64748b" }}>עדיין אין גרסאות שמורות. הפעל את שלב 0 לפעם הראשונה.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 18 }}>
            {/* ── Sidebar: list of versions ── */}
            <aside style={{
              background: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: 12, padding: 12, alignSelf: "start",
              position: "sticky", top: 100, maxHeight: "calc(100vh - 130px)",
              overflowY: "auto",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569",
                            padding: "0 4px 8px", borderBottom: "1px solid #e2e8f0",
                            marginBottom: 8 }}>
                {list.length} גרסאות
              </div>
              {list.map((r) => {
                const active = r.id === selectedId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    style={{
                      width: "100%", textAlign: "right", padding: "8px 10px",
                      marginBottom: 4, fontSize: 12, fontFamily: "inherit",
                      background: active ? "#1e3a5f" : "transparent",
                      color:      active ? "#ffffff" : "#1e293b",
                      border: "1px solid " + (active ? "#1e3a5f" : "transparent"),
                      borderRadius: 6, cursor: "pointer",
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 11,
                                  color: active ? "#bfdbfe" : "#475569" }}>
                      {fmtDate(r.generated_at)}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12 }}>
                      {(r.headline || "(ללא כותרת)").slice(0, 80)}
                      {(r.headline || "").length > 80 ? "…" : ""}
                    </div>
                  </button>
                );
              })}
            </aside>

            {/* ── Snapshot view ── */}
            <main>
              {loadingSnap ? (
                <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
                  טוען גרסה…
                </div>
              ) : snapshot ? (
                <SnapshotView snapshot={snapshot} />
              ) : (
                <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
                  בחר גרסה מהרשימה
                </div>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Snapshot View — Executive analysis + Charts ─────────────────────────────

function SnapshotView({ snapshot }) {
  const a = snapshot.analysis || {};
  const c = snapshot.charts || { groups: {} };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, padding: "12px 16px",
                    background: "#eff6ff", border: "1px solid #bfdbfe",
                    borderRadius: 10 }}>
        <div style={{ fontSize: 11, color: "#1e40af", marginBottom: 2 }}>
          גרסה
        </div>
        <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>
          {fmtDate(a.generated_at)} · {a.n_facts} ניתוחים · {(a.agents_used || []).join(" + ")}
        </div>
      </div>

      {/* ── Part 1: Executive analysis ── */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a",
                     margin: "0 0 16px", borderBottom: "2px solid #e2e8f0",
                     paddingBottom: 8 }}>
          📋 דוח מנהלים
        </h2>
        <ExecutiveAnalysisView data={a} />
      </section>

      {/* ── Part 2: Charts ── */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a",
                     margin: "0 0 16px", borderBottom: "2px solid #e2e8f0",
                     paddingBottom: 8 }}>
          📊 גרפים מאותה תקופה
        </h2>
        <ChartsView charts={c} />
      </section>
    </div>
  );
}

// ─── Executive Analysis (extracted from EcosystemPage) ───────────────────────

function ExecutiveAnalysisView({ data }) {
  const briefsByDept = data.briefs_by_dept || {};
  const allBriefs = Object.values(briefsByDept).flat();

  return (
    <div>
      {data.data_period && (
        <Section title="תקופת הניתוח" emoji="📅" tone="neutral">
          <p style={{ fontSize: 14, color: "#1e293b", margin: 0, lineHeight: 1.7 }}>
            {data.data_period}
          </p>
        </Section>
      )}

      {data.data_limitations?.length > 0 && (
        <Section title="מגבלות נתונים" emoji="📋" tone="neutral">
          <ul style={{ margin: 0, paddingInlineStart: 22, fontSize: 13.5, lineHeight: 1.8 }}>
            {data.data_limitations.map((p, i) => (
              <li key={i} style={{ color: "#475569", marginBottom: 6 }}>{p}</li>
            ))}
          </ul>
        </Section>
      )}

      {data.macro_picture && (
        <Section title="התמונה הכוללת" emoji="📌" tone="primary">
          <p style={{ fontSize: 16, lineHeight: 1.8, color: "#0f172a", margin: 0 }}>
            {data.macro_picture}
          </p>
        </Section>
      )}

      {data.headline && data.headline !== data.macro_picture && (
        <Section title="כותרת מרכזית" emoji="🎯" tone="primary">
          <p style={{ fontSize: 18, lineHeight: 1.7, color: "#0f172a",
                      fontWeight: 500, margin: 0 }}>{data.headline}</p>
        </Section>
      )}

      {data.customer_journey_findings?.length > 0 && (
        <Section title="תהליך מתעניין → תלמיד" emoji="🛤️" tone="neutral">
          <ul style={{ margin: 0, paddingInlineStart: 22, fontSize: 14, lineHeight: 1.85 }}>
            {data.customer_journey_findings.map((p, i) => (
              <li key={i} style={{ color: "#1e293b", marginBottom: 8 }}>{p}</li>
            ))}
          </ul>
        </Section>
      )}

      {data.demographic_findings?.length > 0 && (
        <Section title="פרופיל הקהל" emoji="👥" tone="neutral">
          <ul style={{ margin: 0, paddingInlineStart: 22, fontSize: 14, lineHeight: 1.85 }}>
            {data.demographic_findings.map((p, i) => (
              <li key={i} style={{ color: "#1e293b", marginBottom: 8 }}>{p}</li>
            ))}
          </ul>
        </Section>
      )}

      {data.key_points?.length > 0 && (
        <Section title="ממצאים מספריים מרכזיים" emoji="🔑">
          <ul style={{ margin: 0, paddingInlineStart: 22, fontSize: 14, lineHeight: 1.85 }}>
            {data.key_points.map((p, i) => (
              <li key={i} style={{ color: "#1e293b", marginBottom: 8 }}>{p}</li>
            ))}
          </ul>
        </Section>
      )}

      {data.biggest_alert && (
        <Section title="הממצא הכי בולט" emoji="⚠️" tone="alert">
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#7c2d12", margin: 0 }}>
            {data.biggest_alert}
          </p>
        </Section>
      )}

      {allBriefs.length > 0 && (
        <Section title="שאלות נוספות לדיון" emoji="💭" tone="neutral">
          <ul style={{ margin: 0, paddingInlineStart: 22, fontSize: 14, lineHeight: 1.85 }}>
            {allBriefs.flatMap((b, bi) => (b.next_questions || []).map((q, qi) => (
              <li key={`${bi}-${qi}`} style={{ color: "#1e293b", marginBottom: 10 }}>
                {q}
                {b.where && (
                  <span style={{ display: "block", fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    בהקשר: {b.where}
                  </span>
                )}
              </li>
            )))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, emoji, tone = "neutral", children }) {
  const palette = {
    neutral: { bg: "#ffffff", border: "#e2e8f0", title: "#0f172a" },
    primary: { bg: "#eff6ff", border: "#bfdbfe", title: "#1e3a8a" },
    alert:   { bg: "#fff7ed", border: "#fed7aa", title: "#9a3412" },
  }[tone];
  return (
    <div style={{ background: palette.bg, border: `1px solid ${palette.border}`,
                  borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px",
                   color: palette.title, display: "flex",
                   alignItems: "center", gap: 8 }}>
        {emoji && <span>{emoji}</span>}
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Charts View ─────────────────────────────────────────────────────────────

function ChartsView({ charts }) {
  const [activeTab, setTab] = useState("leads");
  const groups = charts.groups || {};

  const tabs = [...GROUP_ORDER.filter((g) => groups[g])
    .map((g) => ({ key: g, ...groups[g] }))];
  Object.keys(groups).forEach((g) => {
    if (!GROUP_ORDER.includes(g)) tabs.push({ key: g, ...groups[g] });
  });

  if (!tabs.length) {
    return <p style={{ color: "#64748b", fontSize: 13 }}>אין נתוני גרפים בגרסה הזאת.</p>;
  }

  const active = groups[activeTab] || tabs[0];

  return (
    <div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap",
                    borderBottom: "2px solid #e2e8f0", marginBottom: 18 }}>
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{
              padding: "8px 14px", fontSize: 13, fontWeight: 600,
              background: "none",
              color: activeTab === t.key ? "#1e3a5f" : "#64748b",
              border: "none",
              borderBottom: activeTab === t.key ? "3px solid #1e3a5f" : "3px solid transparent",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              marginBottom: -2,
            }}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
            <span style={{ fontSize: 10, padding: "2px 6px", background: "#f1f5f9",
                           color: "#475569", borderRadius: 99 }}>
              {t.facts.length}
            </span>
          </button>
        ))}
      </div>

      <div>
        {(active?.facts || []).map((f) => <FactCard key={f.fact_id} fact={f} />)}
      </div>
    </div>
  );
}

// ─── Fact Card + Renderers (ported from Dashboard.jsx) ──────────────────────

function FactCard({ fact }) {
  const t = fact.chart_type || "auto";
  const isTable = (t === "table");
  const hasChart = !isTable && t !== "metric" && (
    t !== "auto" ? true : !!pickChartShape(fact)
  );
  const [open, setOpen] = useState(isTable);

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0",
                  borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
        {fact.title}
      </h3>
      {hasChart && fact.chart_caption && (
        <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "#1e293b", lineHeight: 1.6 }}>
          {fact.chart_caption}
        </p>
      )}
      {hasChart && <FactChart fact={fact} />}
      <button type="button" onClick={() => setOpen(!open)}
        style={{ marginTop: 8, padding: "4px 10px", fontSize: 11,
                 background: open ? "#1e3a5f" : "#ffffff",
                 color: open ? "#ffffff" : "#1e40af",
                 border: "1px solid #1e3a5f", borderRadius: 6, cursor: "pointer" }}>
        {open ? "▲ הסתר טבלה" : `▼ הצג טבלה (${fact.rows?.length || 0})`}
      </button>
      {open && <FactTable fact={fact} />}
    </div>
  );
}

function FactTable({ fact }) {
  const cols = fact.columns || [];
  const rows = fact.rows || [];
  const totals = fact.totals;
  if (!cols.length || !rows.length) return null;
  return (
    <div style={{ marginTop: 10, overflowX: "auto", border: "1px solid #e2e8f0",
                  borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
        <thead style={{ background: "#f1f5f9" }}>
          <tr>{cols.map((c) => (
            <th key={c} style={{ padding: "6px 8px", textAlign: "right",
                                 fontWeight: 700, color: "#1e293b",
                                 borderBottom: "1px solid #cbd5e1", whiteSpace: "nowrap" }}>{c}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#fafbfc" : "#ffffff",
                                 borderTop: "1px solid #f1f5f9" }}>
              {cols.map((c) => (
                <td key={c} style={{ padding: "5px 8px", textAlign: "right",
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
                <td key={c} style={{ padding: "6px 8px", textAlign: "right",
                                     whiteSpace: "nowrap" }}>{fmtVal(totals[c], c)}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#ffffff", border: "1px solid #cbd5e1",
                  borderRadius: 8, padding: "8px 12px",
                  direction: "rtl", textAlign: "right", fontSize: 11.5,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      {label && <div style={{ color: "#475569", marginBottom: 4, fontWeight: 600 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between",
                              gap: 12, color: p.color, padding: "1px 0" }}>
          <span>{p.name}</span>
          <strong>{fmtVal(p.value, p.dataKey)}</strong>
        </div>
      ))}
    </div>
  );
}

function FactChart({ fact }) {
  const t = fact.chart_type || "auto";
  const cfg = fact.chart_config || {};

  if (t === "pie") {
    const labelKey = cfg.label || (fact.columns || [])[0];
    const valueKey = cfg.value || (fact.columns || []).find((c) => c !== labelKey);
    const data = (fact.rows || []).filter((r) => r[valueKey] != null);
    return (
      <div style={{ width: "100%", height: 280, marginTop: 4 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey={valueKey} nameKey={labelKey}
                 cx="50%" cy="50%" outerRadius={90} label={(e) => e[labelKey]}>
              {data.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (t === "hbar") {
    const xKey = cfg.x || (fact.columns || [])[0];
    const yKey = cfg.y || (fact.columns || []).find((c) => c !== xKey);
    const data = [...(fact.rows || [])].sort((a, b) => (b[yKey] || 0) - (a[yKey] || 0));
    const height = Math.max(200, data.length * 26);
    return (
      <div style={{ width: "100%", height, marginTop: 4 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical"
                    margin={{ top: 4, right: 28, bottom: 4, left: 110 }}>
            <CartesianGrid stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: "#475569" }} />
            <YAxis type="category" dataKey={xKey} tick={{ fontSize: 10, fill: "#475569" }}
                   width={100} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={yKey} fill={PAL[0]} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (t === "bar") {
    const xKey = cfg.x || (fact.columns || [])[0];
    const yKey = cfg.y || (fact.columns || []).find((c) => c !== xKey);
    const isPct = (yKey || "").includes("pct") || (yKey || "").includes("rate");
    return (
      <div style={{ width: "100%", height: 240, marginTop: 4 }}>
        <ResponsiveContainer>
          <BarChart data={fact.rows} margin={{ top: 4, right: 18, bottom: 4, left: 18 }}>
            <CartesianGrid stroke="#f1f5f9" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: "#475569" }} />
            <YAxis tick={{ fontSize: 10, fill: "#475569" }}
                   tickFormatter={isPct ? ((v) => `${v}%`) : undefined} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={yKey} fill={PAL[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (t === "line") {
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
      <div style={{ width: "100%", height: 260, marginTop: 4 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 18, bottom: 4, left: 18 }}>
            <CartesianGrid stroke="#f1f5f9" />
            <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: "#475569" }} />
            <YAxis tick={{ fontSize: 10, fill: "#475569" }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {seriesKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={PAL[i % PAL.length]}
                    strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (t === "stacked_bar" || t === "grouped_bar") {
    const xKey = cfg.x || (fact.columns || [])[0];
    let data = fact.rows;
    let seriesKeys = [];
    if (cfg.group_by && cfg.value) {
      const piv = pivotByGroup(fact.rows, xKey, cfg.group_by, cfg.value);
      data = piv.data; seriesKeys = piv.seriesKeys;
    } else {
      const exclude = new Set([xKey, ...(cfg.exclude || [])]);
      seriesKeys = (fact.columns || []).filter((c) => !exclude.has(c));
    }
    const stacked = (t === "stacked_bar");
    return (
      <div style={{ width: "100%", height: 280, marginTop: 4 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 18, bottom: 4, left: 18 }}>
            <CartesianGrid stroke="#f1f5f9" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: "#475569" }} />
            <YAxis tick={{ fontSize: 10, fill: "#475569" }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {seriesKeys.map((k, i) => (
              <Bar key={k} dataKey={k} stackId={stacked ? "a" : undefined}
                   fill={PAL[i % PAL.length]} radius={stacked ? 0 : [4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // auto fallback (legacy snapshots saved before chart_type was set per fact)
  const shape = pickChartShape(fact);
  if (!shape) return null;
  const { type, labelKey, valueKeys } = shape;
  const keys = valueKeys.slice(0, 8);
  if (type === "line") {
    return (
      <div style={{ width: "100%", height: 260, marginTop: 4 }}>
        <ResponsiveContainer>
          <LineChart data={fact.rows} margin={{ top: 4, right: 18, bottom: 4, left: 18 }}>
            <CartesianGrid stroke="#f1f5f9" />
            <XAxis dataKey={labelKey} tick={{ fontSize: 9, fill: "#475569" }} />
            <YAxis tick={{ fontSize: 10, fill: "#475569" }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {keys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={PAL[i % PAL.length]}
                    strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: 260, marginTop: 4 }}>
      <ResponsiveContainer>
        <BarChart data={fact.rows} margin={{ top: 4, right: 18, bottom: 4, left: 18 }}>
          <CartesianGrid stroke="#f1f5f9" />
          <XAxis dataKey={labelKey} tick={{ fontSize: 10, fill: "#475569" }} />
          <YAxis tick={{ fontSize: 10, fill: "#475569" }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={PAL[i % PAL.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

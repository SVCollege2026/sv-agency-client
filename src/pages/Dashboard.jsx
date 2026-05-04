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

// Detect chart shape: line for monthly, bar for category, none if unsuitable
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

function FactChart({ fact }) {
  const shape = useMemo(() => pickChartShape(fact), [fact]);
  if (!shape) return null;

  const { type, labelKey, valueKeys } = shape;

  // Limit to 3 series for readability
  const keys = valueKeys.slice(0, 3);

  return (
    <div style={{ width: "100%", height: 280, marginTop: 6 }}>
      <ResponsiveContainer>
        {type === "line" ? (
          <LineChart data={fact.rows} margin={{ top: 6, right: 18, bottom: 6, left: 18 }}>
            <CartesianGrid stroke="#f1f5f9" />
            <XAxis dataKey={labelKey} tick={{ fontSize: 11, fill: "#475569" }}
                   reversed={false} />
            <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {keys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={PAL[i % PAL.length]}
                    strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        ) : (
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
        )}
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
  const [tableOpen, setTableOpen] = useState(false);
  const hasChart = !!pickChartShape(fact);

  return (
    <div style={{
      background: "#ffffff", border: "1px solid #e2e8f0",
      borderRadius: 12, padding: "16px 18px", marginBottom: 16,
    }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
        {fact.title}
      </h3>
      {fact.description && (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
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

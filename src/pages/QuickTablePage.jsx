/**
 * QuickTablePage.jsx — ניתוח נקודתי: שאלה אחת → טבלה אחת
 * ללא דיון, ללא דוח מנהלים. שולחת ל-`/api/analysis/quick-table`.
 */
import React, { useState } from "react";
import { quickTable } from "../api.js";

export default function QuickTablePage() {
  const [question, setQuestion]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (!question.trim()) {
      setError("אנא הקלידי שאלה");
      return;
    }
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await quickTable(question.trim());
      setResult(data);
    } catch (err) {
      setError(err.message || "שגיאה בקריאה לשרת");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, color: "#0f172a", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>ניתוח נקודתי</h1>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
        שאלה אחת, טבלה אחת — ללא דיון אנליסטים, ללא דוח מנהלים. תוך שניות.
      </p>

      <form onSubmit={onSubmit} style={{ marginBottom: 24 }}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="לדוגמה: לידים לפי פלטפורמה לפי שנה כולל אחוז ושיעור המרה — 2023 עד היום"
          rows={4}
          style={{
            width: "100%",
            padding: 12,
            fontSize: 14,
            background: "#0f1d33",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            color: "#0f172a",
            resize: "vertical",
            fontFamily: "inherit",
            direction: "rtl",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              background: loading ? "#e2e8f0" : "#3b82f6",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "מחשב..." : "תני לי טבלה"}
          </button>
        </div>
      </form>

      {error && (
        <div style={{
          padding: 14,
          background: "#3b1818",
          border: "1px solid #fecaca",
          borderRadius: 6,
          color: "#dc2626",
          marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 14 }}>
          מתרגם → שולף → מחשב → מסדר טבלה...
        </div>
      )}

      {result && <ResultDisplay result={result} />}
    </div>
  );
}

function ResultDisplay({ result }) {
  const layout    = result.table_layout || {};
  const meta      = result.calc_meta    || {};
  const cols      = layout.columns      || [];
  const rows      = layout.rows         || [];
  const groups    = layout.header_groups;
  const totals    = layout.totals;

  return (
    <div style={{
      background: "#0f1d33",
      border: "1px solid #e2e8f0",
      borderRadius: 8,
      padding: 20,
    }}>
      <div style={{ marginBottom: 12, fontSize: 13, color: "#64748b" }}>
        <span style={{ color: "#3b82f6" }}>n_input:</span> {meta.n_input ?? "?"} ·
        <span style={{ color: "#3b82f6", marginRight: 8 }}>n_after_filters:</span> {meta.n_after_filters ?? "?"} ·
        <span style={{ color: "#3b82f6", marginRight: 8 }}>operation:</span> {meta.operation ?? "?"}
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        {layout.title || meta.title || "תוצאה"}
      </h2>

      {layout.notes && (
        <div style={{ marginBottom: 12, padding: 10, background: "#e2e8f0",
                      borderRadius: 4, fontSize: 12, color: "#64748b" }}>
          {layout.notes}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
          direction: "rtl",
        }}>
          <thead>
            {groups && groups.length > 0 && (
              <tr style={{ background: "#172033" }}>
                {groups.map((g, i) => (
                  <th
                    key={i}
                    colSpan={g.span || 1}
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid #e2e8f0",
                      borderLeft: i < groups.length - 1 ? "1px solid #e2e8f0" : "none",
                      textAlign: "center",
                      color: "#0f172a",
                      fontWeight: 600,
                    }}
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
            )}
            <tr style={{ background: "#ffffff" }}>
              {cols.map((c, i) => (
                <th
                  key={c.key || i}
                  style={{
                    padding: "9px 12px",
                    borderBottom: "1px solid #e2e8f0",
                    textAlign: "right",
                    color: "#64748b",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.label || c.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} style={{ background: ri % 2 ? "#ffffff" : "transparent" }}>
                {cols.map((c, ci) => {
                  const v = (r.values || {})[c.key];
                  return (
                    <td
                      key={ci}
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid #172033",
                        color: ci === 0 ? "#e2e8f0" : "#64748b",
                        fontWeight: ci === 0 ? 500 : 400,
                      }}
                    >
                      {formatValue(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {totals && (
              <tr style={{ background: "#172033", fontWeight: 600 }}>
                {cols.map((c, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: "10px 12px",
                      borderTop: "2px solid #e2e8f0",
                      color: "#0f172a",
                    }}
                  >
                    {ci === 0 ? "סה\"כ" : formatValue(totals[c.key])}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatValue(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") {
    return Number.isInteger(v) ? v.toLocaleString("he-IL") : v.toFixed(2);
  }
  return String(v);
}

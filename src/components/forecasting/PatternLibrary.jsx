/**
 * PatternLibrary.jsx — ספריית דפוסים פעילים
 * ============================================
 * טבלה עם פילטרים: kind / confidence. row click → modal עם evidence_pack.
 */
import React, { useEffect, useMemo, useState } from "react";
import { listPatterns, getPattern } from "../../api.js";
import EvidencePackView from "./EvidencePackView.jsx";

const KINDS = [
  { value: "",            label: "כל הסוגים" },
  { value: "trend",       label: "Trend" },
  { value: "lag",         label: "Lag" },
  { value: "seasonality", label: "Seasonality" },
  { value: "anomaly",     label: "Anomaly" },
];

const CONFIDENCES = [
  { value: "",       label: "כל רמות הביטחון" },
  { value: "high",   label: "גבוה בלבד" },
  { value: "medium", label: "בינוני ומעלה" },
  { value: "low",    label: "כל הרמות" },
];

const conf2color = { high: "#16a34a", medium: "#ca8a04", low: "#9ca3af" };

export default function PatternLibrary() {
  const [kind, setKind]                 = useState("");
  const [minConfidence, setMinConf]     = useState("");
  const [patterns, setPatterns]         = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [selected, setSelected]         = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = { active: true, limit: 100 };
      if (kind)          params.kind = kind;
      if (minConfidence) params.minConfidence = minConfidence;
      const res = await listPatterns(params);
      setPatterns(res.patterns || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [kind, minConfidence]);

  return (
    <div dir="rtl" style={{
      background: "#f8fafc", border: "1px solid #1e3a5f", borderRadius: 14,
      padding: 20, marginTop: 20,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ margin: 0, color: "#0f172a", fontSize: 17 }}>📚 ספריית דפוסים פעילים</h2>
        <button
          type="button" onClick={load}
          style={{ background: "transparent", border: "1px solid #1e3a5f", color: "#64748b",
                   padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
          🔄 רענן
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)}
                style={selectStyle}>
          {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <select value={minConfidence} onChange={(e) => setMinConf(e.target.value)}
                style={selectStyle}>
          {CONFIDENCES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {error && <div style={{ color: "#dc2626", fontSize: 13 }}>שגיאה: {error}</div>}
      {loading && <div style={{ color: "#64748b", fontSize: 13 }}>טוען…</div>}
      {!loading && patterns.length === 0 && (
        <div style={{ color: "#64748b", fontSize: 13, padding: 16, textAlign: "center" }}>
          אין דפוסים פעילים עדיין. הרץ Stage 0 כדי לבנות את הספרייה.
        </div>
      )}
      {patterns.length > 0 && (
        <div style={{ overflow: "auto", maxHeight: 400 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", color: "#0f172a", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#ffffff", color: "#64748b", textAlign: "right" }}>
                <th style={thStyle}>סוג</th>
                <th style={thStyle}>תיוג</th>
                <th style={thStyle}>תנאים</th>
                <th style={thStyle}>ראיות</th>
                <th style={thStyle}>תוקף</th>
                <th style={thStyle}>ביטחון</th>
              </tr>
            </thead>
            <tbody>
              {patterns.map(p => (
                <tr key={p.id}
                    onClick={() => setSelected(p)}
                    style={{ cursor: "pointer", borderTop: "1px solid #1a2234" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#ffffff"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <td style={tdStyle}>
                    <span style={{
                      background: "#1e3a5f", borderRadius: 4, padding: "2px 8px",
                      fontSize: 11, color: "#1e40af",
                    }}>{p.pattern_kind}</span>
                  </td>
                  <td style={tdStyle}>{p.human_label || p.description?.slice(0, 60) || "—"}</td>
                  <td style={tdStyle}>
                    <code style={{ color: "#7dd3fc", fontSize: 11 }}>
                      {summarizeConditions(p.conditions)}
                    </code>
                  </td>
                  <td style={tdStyle}>{p.verified_count}</td>
                  <td style={tdStyle}>{p.validity_until || "ללא תוקף"}</td>
                  <td style={tdStyle}>
                    <span style={{ color: conf2color[p.confidence_level] }}>
                      ● {p.confidence_level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <PatternModal pattern={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function summarizeConditions(c) {
  if (!c || typeof c !== "object") return "—";
  const parts = [];
  if (c.metric) parts.push(`metric=${c.metric}`);
  if (c.time_grain) parts.push(`grain=${c.time_grain}`);
  if (c.dimensions && typeof c.dimensions === "object") {
    const dims = Object.entries(c.dimensions).map(([k, v]) => `${k}=${v}`);
    if (dims.length) parts.push(`dims:[${dims.join(", ")}]`);
  }
  if (c.direction) parts.push(`dir=${c.direction}`);
  if (c.period)    parts.push(`period=${c.period}`);
  if (c.lag)       parts.push(`lag=${c.lag}`);
  return parts.join(" ") || "—";
}

function PatternModal({ pattern, onClose }) {
  const [full, setFull] = useState(pattern);
  useEffect(() => {
    if (pattern?.id) {
      getPattern(pattern.id).then(setFull).catch(() => {});
    }
  }, [pattern]);

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
         style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div dir="rtl" style={{
        background: "#f8fafc", border: "1px solid #1e3a5f", borderRadius: 14,
        padding: 24, maxWidth: 700, width: "100%", maxHeight: "85vh", overflow: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, color: "#0f172a" }}>
            {full.human_label || full.description?.slice(0, 80) || `Pattern #${full.id}`}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none",
                  color: "#64748b", fontSize: 24, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: "#0f172a", lineHeight: 1.7 }}>
          <div><strong>סוג:</strong> {full.pattern_kind}</div>
          <div><strong>תיאור:</strong> {full.description}</div>
          <div><strong>תנאים:</strong>
            <pre style={{ background: "#ffffff", padding: 8, borderRadius: 6,
                          color: "#7dd3fc", fontSize: 11, overflow: "auto", marginTop: 4 }}>
              {JSON.stringify(full.conditions, null, 2)}
            </pre>
          </div>
          <div><strong>ראיות:</strong> {full.verified_count} | <strong>ביטחון:</strong> {full.confidence_level}</div>
          <div><strong>תוקף עד:</strong> {full.validity_until || "ללא תוקף"}</div>
        </div>
        <EvidencePackView pack={full.evidence_pack} defaultOpen={true} />
      </div>
    </div>
  );
}

const selectStyle = {
  background: "#ffffff", border: "1px solid #1e3a5f", color: "#0f172a",
  borderRadius: 6, padding: "6px 10px", fontSize: 13,
};

const thStyle = { padding: "8px 12px", fontWeight: 600, fontSize: 12 };
const tdStyle = { padding: "8px 12px" };

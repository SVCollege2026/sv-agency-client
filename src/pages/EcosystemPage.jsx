/**
 * EcosystemPage.jsx — מחלקת אנליזה: אקו-סיסטם
 * מציג: סינתזה + ממצאים מרכזיים + ולידציית מקורות + סיבובי דיבייט
 */
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { listRuns } from "../api.js";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function fetchSynthesis() {
  const res = await fetch(`${BASE}/api/dashboard/synthesis`);
  if (!res.ok) throw new Error(`שגיאת שרת: ${res.status}`);
  return res.json();
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const Section = ({ title, icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: "#0d1626", border: "1px solid #1e293b", borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "14px 20px", background: "transparent", border: "none",
          cursor: "pointer", direction: "rtl", textAlign: "right",
        }}
      >
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ flex: 1, color: "#e2e8f0", fontSize: 15, fontWeight: 600 }}>{title}</span>
        <span style={{ color: "#475569", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 20px 20px", borderTop: "1px solid #1e293b" }}>
          {children}
        </div>
      )}
    </div>
  );
};

const Badge = ({ text, variant = "default" }) => {
  const styles = {
    default:  { background: "#1e293b", color: "#94a3b8" },
    ok:       { background: "#064e3b", color: "#6ee7b7" },
    warn:     { background: "#431a03", color: "#fcd34d" },
    danger:   { background: "#450a0a", color: "#fca5a5" },
  };
  const s = styles[variant] || styles.default;
  return (
    <span style={{ ...s, fontSize: 11, borderRadius: 6, padding: "2px 8px", display: "inline-block" }}>
      {text}
    </span>
  );
};

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function KeyFindings({ findings }) {
  if (!findings?.length) return <p style={{ color: "#475569", fontSize: 13 }}>אין ממצאים זמינים.</p>;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
      {findings.map((f, i) => (
        <li
          key={i}
          style={{
            display: "flex", gap: 12, alignItems: "flex-start",
            padding: "10px 0", borderBottom: i < findings.length - 1 ? "1px solid #0f172a" : "none",
          }}
        >
          <span style={{ color: "#3b82f6", fontSize: 16, flexShrink: 0, marginTop: 2 }}>✦</span>
          <p style={{ margin: 0, color: "#cbd5e1", fontSize: 13, lineHeight: 1.7 }}>
            {typeof f === "string" ? f : f.finding ?? JSON.stringify(f)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function SynthesisText({ text }) {
  if (!text) return <p style={{ color: "#475569", fontSize: 13 }}>אין סיכום זמין.</p>;
  return (
    <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
      {text}
    </div>
  );
}

function SourcesValidation({ validation = [], urlReport = [] }) {
  const urlMap = useMemo(() => {
    const m = {};
    for (const r of urlReport) m[r.query] = r;
    return m;
  }, [urlReport]);

  if (!validation.length) return <p style={{ color: "#475569", fontSize: 13 }}>אין נתוני ולידציה.</p>;
  return (
    <div>
      {validation.map((v, i) => {
        const urls = urlMap[v.query] || {};
        const isApproved = v.status === "approved";
        return (
          <div
            key={i}
            style={{
              background: "#080e1a", border: `1px solid ${isApproved ? "#064e3b" : "#450a0a"}`,
              borderRadius: 8, padding: "12px 14px", marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Badge text={isApproved ? "✓ אושר" : "✗ נדחה"} variant={isApproved ? "ok" : "danger"} />
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, flex: 1 }}>{v.query}</p>
            </div>
            {v.reasoning && (
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 11 }}>נימוק: {v.reasoning}</p>
            )}
            {(urls.valid_urls?.length > 0 || urls.broken_urls?.length > 0) && (
              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {urls.valid_urls?.map(u => (
                  <a key={u} href={u} target="_blank" rel="noreferrer"
                    style={{ fontSize: 10, color: "#6ee7b7", background: "#064e3b", borderRadius: 4, padding: "1px 6px", textDecoration: "none" }}>
                    ✓ {u.slice(0, 40)}…
                  </a>
                ))}
                {urls.broken_urls?.map(u => (
                  <span key={u} style={{ fontSize: 10, color: "#fca5a5", background: "#450a0a", borderRadius: 4, padding: "1px 6px" }}>
                    ✗ {u.slice(0, 40)}…
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DebateRounds({ rounds = [] }) {
  const [openRound, setOpenRound] = useState(null);
  if (!rounds.length) return <p style={{ color: "#475569", fontSize: 13 }}>אין סיבובי דיבייט זמינים.</p>;
  return (
    <div>
      <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 12px" }}>
        {rounds.length} סיבובים · לחץ על סיבוב לפתיחה
      </p>
      {rounds.map(r => (
        <div key={r.round} style={{ marginBottom: 8 }}>
          <button
            type="button"
            aria-expanded={openRound === r.round}
            onClick={() => setOpenRound(openRound === r.round ? null : r.round)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", background: "#080e1a", border: "1px solid #1e293b",
              borderRadius: 8, cursor: "pointer", direction: "rtl", textAlign: "right",
            }}
          >
            <span style={{ color: "#3b82f6", fontSize: 12, fontWeight: 600 }}>סיבוב {r.round}</span>
            {r.analyst_trends_failed && <Badge text="שגיאה בסיבוב זה" variant="warn" />}
            <span style={{ flex: 1 }} />
            <span style={{ color: "#475569", fontSize: 11 }}>{openRound === r.round ? "▲" : "▼"}</span>
          </button>
          {openRound === r.round && (
            <div style={{ border: "1px solid #1e293b", borderTop: "none", borderRadius: "0 0 8px 8px", background: "#080e1a", padding: 16 }}>
              <p style={{ color: "#3b82f6", fontSize: 12, fontWeight: 600, margin: "0 0 8px" }}>מגמות חיצוניות:</p>
              <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap", margin: "0 0 16px" }}>{r.analyst_trends}</p>
              <p style={{ color: "#10b981", fontSize: 12, fontWeight: 600, margin: "0 0 8px" }}>תרגום עסקי:</p>
              <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0 }}>{r.analyst_business}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EcosystemPage() {
  const navigate  = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetchSynthesis()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <p style={{ color: "#64748b", fontSize: 15 }}>טוען ניתוח אקו-סיסטם…</p>
    </div>
  );

  if (error || !data?.available) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 12, direction: "rtl", textAlign: "center" }}>
      <span style={{ fontSize: 36 }}>🌐</span>
      <p style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 600, margin: 0 }}>
        אין נתוני אקו-סיסטם עדיין
      </p>
      <p style={{ color: "#64748b", fontSize: 13, margin: 0, maxWidth: 340 }}>
        נתוני האקו-סיסטם מתמלאים אוטומטית בסיום ריצת ניתוח שלב 0.
        לחץ כאן כדי לעבור לדף הניתוח ולהפעיל ריצה.
      </p>
      <button
        type="button"
        onClick={() => navigate("/analytics/analysis")}
        style={{ background: "#1e3a5f", color: "#93c5fd", border: "1px solid #2d4a6e", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 14, marginTop: 4 }}
      >
        ← עבור לדף הניתוח
      </button>
    </div>
  );

  const {
    synthesis, key_findings,
    hallucination_check, validation, url_report,
    rounds, additional_fetches,
    completed_at,
  } = data;

  const flagged = hallucination_check?.flagged_claims ?? [];

  return (
    <div lang="he" style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto", direction: "rtl", color: "#e2e8f0", fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>ניתוח אקו-סיסטם</h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
          עודכן: {completed_at ? new Date(completed_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }) : "—"}
        </p>
      </div>

      {/* Hallucination warning */}
      {flagged.length > 0 && (
        <div style={{ background: "#1c0f03", border: "1px solid #92400e", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
          <p style={{ margin: "0 0 8px", color: "#fcd34d", fontWeight: 600, fontSize: 13 }}>
            ✱ בודק הזיות דגל {flagged.length} טענות שלא אומתו במקורות:
          </p>
          <ul style={{ margin: 0, padding: "0 20px" }}>
            {flagged.map((f, i) => <li key={i} style={{ color: "#fbbf24", fontSize: 12, marginBottom: 4 }}>{f}</li>)}
          </ul>
        </div>
      )}

      {/* Sections */}
      <Section title="ממצאים מרכזיים" icon="✦" defaultOpen={true}>
        <KeyFindings findings={key_findings} />
      </Section>

      <Section title="סיכום אקו-סיסטם מאומת" icon="📋" defaultOpen={true}>
        <SynthesisText text={synthesis} />
      </Section>

      <Section title="ולידציית מקורות" icon="🔍" defaultOpen={false}>
        <SourcesValidation validation={validation ?? []} urlReport={url_report ?? []} />
      </Section>

      {additional_fetches?.length > 0 && (
        <Section title={`מידע נוסף שנבקש במהלך הדיבייט (${additional_fetches.length})`} icon="📡" defaultOpen={false}>
          {additional_fetches.map((f, i) => (
            <div key={i} style={{ background: "#080e1a", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <Badge text={`סיבוב ${f.round}`} />
                <Badge text={f.validated ? "✓ אושר" : "✗ לא אומת"} variant={f.validated ? "ok" : "warn"} />
              </div>
              <p style={{ margin: "0 0 4px", color: "#94a3b8", fontSize: 12 }}><strong>שאילתה:</strong> {f.query}</p>
              {f.rejected_urls?.length > 0 && (
                <p style={{ margin: 0, color: "#ef4444", fontSize: 11 }}>קישורים שבורים: {f.rejected_urls.join(", ")}</p>
              )}
            </div>
          ))}
        </Section>
      )}

      <Section title={`סיבובי דיבייט (${rounds?.length ?? 0})`} icon="💬" defaultOpen={false}>
        <DebateRounds rounds={rounds ?? []} />
      </Section>

    </div>
  );
}

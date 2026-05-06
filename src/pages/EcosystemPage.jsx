/**
 * EcosystemPage.jsx — ניתוח מנהלים (Audit-style)
 *
 * עיצוב: דוח ביקורת מובנה — כותרת מנהלים, ממצאים ממוינים לפי עדיפות,
 * ממצאים מאוששים (חוזרים), נתיב לקוח, פרופיל קהל, הקשר נתונים.
 *
 * נתונים: GET /api/dashboard/executive-analysis
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getExecutiveAnalysis } from "../api.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPT_META = {
  "מחלקת Google Ads":           { icon: "🔍", color: "#1e40af", bg: "#dbeafe" },
  "מחלקת Meta":                 { icon: "📘", color: "#5b21b6", bg: "#ede9fe" },
  "מחלקת מדיה":                 { icon: "📣", color: "#0e7490", bg: "#cffafe" },
  "מחלקת קריאייטיב":            { icon: "🎨", color: "#9a3412", bg: "#ffedd5" },
  "מחלקת מותג / שיווק אורגני":  { icon: "🌱", color: "#14532d", bg: "#dcfce7" },
  "מחלקת שימור / מסע לקוח":     { icon: "🔁", color: "#713f12", bg: "#fef9c3" },
  "מחלקת חיזוי":                { icon: "📈", color: "#1e3a5f", bg: "#e0f2fe" },
  "מחלקת מטרות-ויעדים":         { icon: "🎯", color: "#6b21a8", bg: "#f3e8ff" },
};

const TOPIC_COLOR = {
  enrollments:   { bg: "#dcfce7", color: "#14532d" },
  cancellations: { bg: "#fee2e2", color: "#991b1b" },
  media:         { bg: "#ede9fe", color: "#5b21b6" },
  leads:         { bg: "#dbeafe", color: "#1e40af" },
  google:        { bg: "#dbeafe", color: "#1e40af" },
  meta:          { bg: "#ede9fe", color: "#5b21b6" },
};

function topicStyle(topic) {
  const t = (topic || "").toLowerCase();
  for (const [k, v] of Object.entries(TOPIC_COLOR)) {
    if (t.includes(k)) return v;
  }
  return { bg: "#f1f5f9", color: "#475569" };
}

function deptMeta(deptName) {
  return DEPT_META[deptName] || { icon: "📌", color: "#475569", bg: "#f1f5f9" };
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function EcosystemPage() {
  const navigate   = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    getExecutiveAnalysis()
      .then(setData)
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Page><Center>טוען ניתוח אחרון…</Center></Page>;
  if (error)   return <Page><ErrorBox message={error} /></Page>;
  if (!data?.available) return <Page><EmptyState onHistory={() => navigate("/analytics/reports")} /></Page>;

  // ── Flatten all briefs ordered by dept priority ──
  const deptOrder = [
    "מחלקת Google Ads", "מחלקת Meta", "מחלקת מדיה",
    "מחלקת קריאייטיב", "מחלקת מותג / שיווק אורגני",
    "מחלקת שימור / מסע לקוח", "מחלקת חיזוי", "מחלקת מטרות-ויעדים",
  ];
  const briefs = deptOrder.flatMap(dept =>
    (data.briefs_by_dept?.[dept] || []).map(b => ({ ...b, dept }))
  );
  const validated = data.validated_findings || [];

  return (
    <Page>
      {/* ── Report header ── */}
      <div style={{
        background: "#0f172a", borderRadius: 12, padding: "18px 22px",
        marginBottom: 24, color: "#e2e8f0",
        display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>
            ניתוח מנהלים — שלב 0
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", gap: 12, flexWrap: "wrap" }}>
            {data.cutoff_date && <span>Baseline עד {data.cutoff_date}</span>}
            {data.data_period  && <span>· {data.data_period}</span>}
            <span>· הופק {fmtDate(data.generated_at)}</span>
            <span>· {data.n_facts} ניתוחים</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {data.is_baseline ? (
            <Tag bg="#92400e" color="#fef3c7">📌 נקודת אפס מקובעת</Tag>
          ) : (
            <Tag bg="#1e3a5f" color="#bfdbfe">הריצה האחרונה</Tag>
          )}
          <Tag bg="#1e293b" color="#94a3b8">{briefs.length} ממצאים</Tag>
          <Tag bg="#1e293b" color="#94a3b8">{validated.length} מאוששים</Tag>
        </div>
      </div>

      {/* ── 1. Macro picture ── */}
      {data.macro_picture && (
        <Block title="התמונה הכוללת" emoji="📌" tone="primary">
          <p style={{ fontSize: 15, lineHeight: 1.85, color: "#0f172a", margin: 0 }}>
            {data.macro_picture}
          </p>
        </Block>
      )}

      {/* ── 2. Priority findings ── */}
      {briefs.length > 0 && (
        <Block title="ממצאים ומשימות לחקירה" emoji="🔎" tone="neutral">
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>
            ממוינים לפי מחלקה — כל ממצא כולל ראיה והקשר.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {briefs.map((b, i) => (
              <BriefRow key={i} brief={b} index={i + 1} />
            ))}
          </div>
        </Block>
      )}

      {/* ── 4. Validated recurring findings ── */}
      {validated.length > 0 && (
        <Block title="ממצאים מאוששים (חוזרים)" emoji="✅" tone="action">
          <p style={{ fontSize: 12, color: "#166534", margin: "0 0 16px" }}>
            ממצאים שנצפו בריצות מרובות — רמת הביטחון גבוהה.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {validated.map((v, i) => (
              <ValidatedRow key={i} finding={v} />
            ))}
          </div>
        </Block>
      )}

      {/* ── 5. Key points ── */}
      {data.key_points?.length > 0 && (
        <Block title="נתונים מרכזיים" emoji="🔑" tone="neutral">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {data.key_points.map((p, i) => (
              <div key={i} style={{
                background: "#f8fafc", border: "1px solid #e2e8f0",
                borderInlineStart: "3px solid #3b82f6",
                borderRadius: 7, padding: "10px 14px",
                fontSize: 13, color: "#1e293b", lineHeight: 1.6,
              }}>
                {p}
              </div>
            ))}
          </div>
        </Block>
      )}

      {/* ── 6. Customer journey ── */}
      {data.customer_journey_findings?.length > 0 && (
        <Block title="מסע הלקוח: התעניינות → ליד → הרשמה → קורס" emoji="🛤️" tone="neutral">
          <ul style={{ margin: 0, paddingInlineStart: 22, fontSize: 14, lineHeight: 1.85 }}>
            {data.customer_journey_findings.map((p, i) => (
              <li key={i} style={{ color: "#1e293b", marginBottom: 8 }}>{p}</li>
            ))}
          </ul>
        </Block>
      )}

      {/* ── 7. Demographics ── */}
      {data.demographic_findings?.length > 0 && (
        <Block title="פרופיל הקהל (גילאים, קורסים, מקורות)" emoji="👥" tone="neutral">
          <ul style={{ margin: 0, paddingInlineStart: 22, fontSize: 14, lineHeight: 1.85 }}>
            {data.demographic_findings.map((p, i) => (
              <li key={i} style={{ color: "#1e293b", marginBottom: 8 }}>{p}</li>
            ))}
          </ul>
        </Block>
      )}

      {/* ── 8. Data limitations ── */}
      {data.data_limitations?.length > 0 && (
        <Block title="מגבלות נתונים" emoji="📋" tone="neutral">
          <ul style={{ margin: 0, paddingInlineStart: 22, fontSize: 13.5, lineHeight: 1.8 }}>
            {data.data_limitations.map((p, i) => (
              <li key={i} style={{ color: "#475569", marginBottom: 6 }}>{p}</li>
            ))}
          </ul>
        </Block>
      )}

      {/* ── Footer ── */}
      <div style={{
        marginTop: 32, padding: "12px 18px",
        background: "#f8fafc", border: "1px solid #e2e8f0",
        borderRadius: 10, fontSize: 12, color: "#64748b",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span>💾 דוח שמור · ניתן להשוות בין גרסאות</span>
        <button
          type="button"
          onClick={() => navigate("/analytics/reports")}
          style={{
            background: "#fff", border: "1px solid #cbd5e1",
            borderRadius: 7, padding: "5px 14px", fontSize: 12,
            color: "#1e40af", cursor: "pointer",
          }}
        >📂 כל הדוחות</button>
      </div>
    </Page>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BriefRow({ brief, index }) {
  const dm = deptMeta(brief.dept);

  return (
    <div style={{
      border: "1px solid #e2e8f0",
      borderInlineStart: `4px solid ${dm.color}`,
      borderRadius: 8, overflow: "hidden",
      background: "#ffffff",
    }}>
      <div style={{
        padding: "12px 16px",
        display: "flex", gap: 12, alignItems: "flex-start",
      }}>
        {/* Index */}
        <span style={{
          minWidth: 26, height: 26, borderRadius: "50%",
          background: dm.bg, color: dm.color,
          fontWeight: 700, fontSize: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>{index}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Dept tag */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 700, padding: "2px 8px",
            background: dm.bg, color: dm.color, borderRadius: 99,
            marginBottom: 6,
          }}>
            {dm.icon} {brief.dept}
          </span>

          {/* Issue */}
          <p style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a",
                       margin: "0 0 6px", lineHeight: 1.6 }}>
            {brief.issue}
          </p>

          {/* Where */}
          {brief.where && (
            <p style={{ fontSize: 12, color: "#475569", margin: "0 0 4px" }}>
              <strong style={{ color: "#0f172a" }}>היכן: </strong>{brief.where}
            </p>
          )}

          {/* Evidence */}
          {brief.evidence && (
            <div style={{
              marginTop: 6, padding: "7px 12px",
              background: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: 6, fontSize: 12, color: "#334155",
              lineHeight: 1.65,
            }}>
              <strong style={{ color: "#0f172a" }}>ראיה: </strong>
              {brief.evidence}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ValidatedRow({ finding }) {
  const { bg, color } = topicStyle(finding.topic);
  const confidence = Math.min(finding.run_count || 1, 5);

  return (
    <div style={{
      border: "1px solid #d1fae5",
      borderInlineStart: "4px solid #10b981",
      borderRadius: 8, padding: "12px 16px",
      background: "#f0fdf4",
    }}>
      <div style={{
        display: "flex", gap: 8, alignItems: "center",
        marginBottom: 6, flexWrap: "wrap",
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "2px 8px",
          background: bg, color, borderRadius: 99,
        }}>{finding.topic}</span>
        <span style={{ fontSize: 11, color: "#059669" }}>
          {"●".repeat(confidence)}{"○".repeat(5 - confidence)} {finding.run_count} ריצות
        </span>
      </div>
      <p style={{ fontSize: 13.5, fontWeight: 600, color: "#065f46",
                   margin: "0 0 6px", lineHeight: 1.6 }}>
        {finding.finding}
      </p>
      {finding.evidence && (
        <p style={{ fontSize: 12, color: "#047857", margin: 0, lineHeight: 1.65 }}>
          <strong>ראיה: </strong>{finding.evidence}
        </p>
      )}
    </div>
  );
}

// ─── Layout primitives ────────────────────────────────────────────────────────

function Page({ children }) {
  return (
    <div lang="he" dir="rtl" style={{
      background: "#f8fafc", color: "#0f172a",
      minHeight: "calc(100vh - 56px - 42px)",
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 22px 64px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: "#0f172a" }}>
          ניתוח מנהלים
        </h1>
        {children}
      </div>
    </div>
  );
}

function Block({ title, emoji, tone = "neutral", children }) {
  const palettes = {
    neutral: { bg: "#ffffff", border: "#e2e8f0", title: "#0f172a", topBorder: "#e2e8f0" },
    primary: { bg: "#eff6ff", border: "#bfdbfe", title: "#1e3a8a", topBorder: "#3b82f6" },
    alert:   { bg: "#fff7ed", border: "#fed7aa", title: "#9a3412", topBorder: "#ea580c" },
    action:  { bg: "#f0fdf4", border: "#bbf7d0", title: "#14532d", topBorder: "#10b981" },
  };
  const p = palettes[tone] || palettes.neutral;
  return (
    <div style={{
      background:  p.bg,
      border:      `1px solid ${p.border}`,
      borderTop:   `3px solid ${p.topBorder}`,
      borderRadius: 10,
      padding:     "18px 20px",
      marginBottom: 18,
      boxShadow:   "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <h2 style={{
        fontSize: 15, fontWeight: 700, margin: "0 0 14px",
        color: p.title, display: "flex", alignItems: "center", gap: 7,
      }}>
        {emoji && <span>{emoji}</span>}
        {title}
      </h2>
      {children}
    </div>
  );
}

function Tag({ bg = "#1e293b", color = "#e2e8f0", children }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 10px",
      background: bg, color, borderRadius: 99,
    }}>{children}</span>
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
      background: "#fef2f2", border: "1px solid #fecaca",
      color: "#991b1b", borderRadius: 10, padding: "16px 20px", fontSize: 14,
    }}>⚠ שגיאה: {message}</div>
  );
}

function EmptyState({ onHistory }) {
  return (
    <div style={{
      textAlign: "center", padding: "60px 20px",
      background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 12,
    }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>📭</div>
      <h3 style={{ fontSize: 18, color: "#0f172a", margin: "0 0 6px" }}>
        עדיין אין ניתוח מנהלים זמין
      </h3>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 18px" }}>
        כדי להפיק ניתוח, יש להריץ את <code>scripts/run_stage0_now.py</code> בטרמינל.
      </p>
      <button onClick={onHistory} style={{
        background: "#fff", color: "#1e293b", border: "1px solid #cbd5e1",
        borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer",
      }}>היסטוריית דוחות</button>
    </div>
  );
}

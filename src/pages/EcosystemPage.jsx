/**
 * EcosystemPage.jsx — ניתוח מנהלים (לשעבר אקו-סיסטם)
 *
 * דוח קריא לבני אדם: מאקרו, ממצאים מרכזיים, התראה, ובסוף
 * שאלות לחקירה למחלקות אחרות (Google/Meta/Creative/Brand/Retention/...).
 *
 * נתונים: GET /api/dashboard/executive-analysis (מ-public.stage0_reports).
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getExecutiveAnalysis } from "../api.js";

const DEPT_ORDER = [
  "מחלקת Google Ads",
  "מחלקת Meta",
  "מחלקת מדיה",
  "מחלקת קריאייטיב",
  "מחלקת מותג / שיווק אורגני",
  "מחלקת שימור / מסע לקוח",
  "מחלקת חיזוי",
  "מחלקת מטרות-ויעדים",
];

const DEPT_ICON = {
  "מחלקת Google Ads":           "🔍",
  "מחלקת Meta":                 "📱",
  "מחלקת מדיה":                 "📣",
  "מחלקת קריאייטיב":             "🎨",
  "מחלקת מותג / שיווק אורגני":   "🌱",
  "מחלקת שימור / מסע לקוח":      "🔁",
  "מחלקת חיזוי":                 "📈",
  "מחלקת מטרות-ויעדים":          "🎯",
  "אחר":                         "📌",
};

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

export default function EcosystemPage() {
  const navigate = useNavigate();
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
  if (!data?.available) {
    return (
      <Page>
        <EmptyState
          onRun={() => navigate("/analytics/analysis")}
          onHistory={() => navigate("/analytics/reports")}
        />
      </Page>
    );
  }

  // השאלות מוצגות כ"שאלות לדיון" — נושאים להנהלה לשקול ולחקור.
  // הראוטינג למחלקות הוא תהליך נפרד. ה-validated_findings נשארים פנימיים בלבד.
  const allBriefs = Object.values(data.briefs_by_dept || {}).flat();

  return (
    <Page>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 4px",
                    display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>ניתוח מנהלים — שלב 0</span>
          {data.is_baseline ? (
            <span title="הגרסה הזאת מקובעת בעמוד 'דוחות'. ריצות חדשות לא ידרסו אותה." style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px",
              background: "#fef3c7", color: "#92400e",
              border: "1px solid #fcd34d", borderRadius: 4,
            }}>📌 נקודת אפס מקובעת</span>
          ) : (
            <span title="אין גרסה מקובעת — מוצגת הריצה האחרונה. כדי לקבע, פתחי 'דוחות' ולחצי 'קבע כנקודת אפס'." style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px",
              background: "#dbeafe", color: "#1e40af",
              border: "1px solid #93c5fd", borderRadius: 4,
            }}>הריצה האחרונה</span>
          )}
          {data.cutoff_date && <span>· baseline עד {data.cutoff_date}</span>}
          <span>· הופק {fmtDate(data.generated_at)}</span>
          <span>· {data.n_facts} ניתוחים בבסיס</span>
          <span>· סוכנים: {(data.agents_used || []).join(" + ")}</span>
        </p>
      </div>

      {/* ── 1. תקופה ── */}
      {data.data_period && (
        <Section title="תקופת הניתוח" emoji="📅" tone="neutral">
          <p style={{ fontSize: 14, color: "#1e293b", margin: 0, lineHeight: 1.7 }}>
            {data.data_period}
          </p>
        </Section>
      )}

      {/* ── 2. מגבלות נתונים — קודם הכל ── */}
      {data.data_limitations?.length > 0 && (
        <Section title="מגבלות נתונים שיש לקחת בחשבון" emoji="📋" tone="neutral">
          <ul style={{ margin: 0, paddingInlineStart: 22, fontSize: 13.5, lineHeight: 1.8 }}>
            {data.data_limitations.map((p, i) => (
              <li key={i} style={{ color: "#475569", marginBottom: 6 }}>{p}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── 3. תמונת מאקרו ── */}
      {data.macro_picture && (
        <Section title="התמונה הכוללת" emoji="📌" tone="primary">
          <p style={{ fontSize: 16, lineHeight: 1.8, color: "#0f172a",
                      fontWeight: 400, margin: 0 }}>
            {data.macro_picture}
          </p>
        </Section>
      )}

      {data.headline && data.headline !== data.macro_picture && (
        <Section title="כותרת מרכזית" emoji="🎯" tone="primary">
          <p style={{ fontSize: 18, lineHeight: 1.7, color: "#0f172a",
                      fontWeight: 500, margin: 0 }}>
            {data.headline}
          </p>
        </Section>
      )}

      {/* ── 4. מסע הלקוח ── */}
      {data.customer_journey_findings?.length > 0 && (
        <Section title="מסע הלקוח: התעניינות → ליד → הרשמה → קורס" emoji="🛤️" tone="neutral">
          <ul style={{ margin: 0, paddingInlineStart: 22, fontSize: 14, lineHeight: 1.85 }}>
            {data.customer_journey_findings.map((p, i) => (
              <li key={i} style={{ color: "#1e293b", marginBottom: 8 }}>{p}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── 5. פרופיל קהל ── */}
      {data.demographic_findings?.length > 0 && (
        <Section title="פרופיל הקהל (גילאים, קורסים, מקורות)" emoji="👥" tone="neutral">
          <ul style={{ margin: 0, paddingInlineStart: 22, fontSize: 14, lineHeight: 1.85 }}>
            {data.demographic_findings.map((p, i) => (
              <li key={i} style={{ color: "#1e293b", marginBottom: 8 }}>{p}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── 6. ממצאים מספריים ── */}
      {data.key_points?.length > 0 && (
        <Section title="ממצאים מספריים מרכזיים" emoji="🔑">
          <ul style={{ margin: 0, paddingInlineStart: 22, fontSize: 14, lineHeight: 1.85 }}>
            {data.key_points.map((p, i) => (
              <li key={i} style={{ color: "#1e293b", marginBottom: 8 }}>{p}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── 7. התראה ── */}
      {data.biggest_alert && (
        <Section title="הממצא הכי בולט" emoji="⚠️" tone="alert">
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#7c2d12", margin: 0 }}>
            {data.biggest_alert}
          </p>
        </Section>
      )}

      {/* ── 8. שאלות נוספות לדיון ── */}
      {allBriefs.length > 0 && (
        <Section title="שאלות נוספות לדיון" emoji="💭" tone="neutral">
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px", lineHeight: 1.7 }}>
            נושאים שעלו במהלך הניתוח ושכדאי להמשיך לחקור.
          </p>
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

      <div style={{
        marginTop: 32, padding: "14px 18px",
        background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
        fontSize: 12, color: "#64748b",
      }}>
        💾 דוח שמור · ניתן להשוות בין דוחות בעמוד{" "}
        <a href="#" onClick={(e) => { e.preventDefault(); navigate("/analytics/reports"); }}
           style={{ color: "#1e40af" }}>דוחות</a>.
      </div>
    </Page>
  );
}

// ─── Components ──────────────────────────────────────────────────────────────

function Page({ children }) {
  return (
    <div lang="he" dir="rtl" style={{
      background:  "#ffffff",
      color:       "#0f172a",
      minHeight:   "calc(100vh - 56px - 42px)",
      fontFamily:  "'Segoe UI', sans-serif",
    }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 28px", color: "#0f172a" }}>
          ניתוח מנהלים
        </h1>
        {children}
      </div>
    </div>
  );
}

function Section({ title, emoji, tone = "neutral", children }) {
  const palette = {
    neutral: { bg: "#ffffff", border: "#e2e8f0", title: "#0f172a" },
    primary: { bg: "#eff6ff", border: "#bfdbfe", title: "#1e3a8a" },
    alert:   { bg: "#fff7ed", border: "#fed7aa", title: "#9a3412" },
    action:  { bg: "#f0fdf4", border: "#bbf7d0", title: "#14532d" },
  }[tone];

  return (
    <div style={{
      background: palette.bg,
      border:     `1px solid ${palette.border}`,
      borderRadius: 12,
      padding:    "20px 22px",
      marginBottom: 20,
    }}>
      <h2 style={{
        fontSize: 17, fontWeight: 700, margin: "0 0 14px",
        color: palette.title, display: "flex", alignItems: "center", gap: 8,
      }}>
        {emoji && <span>{emoji}</span>}
        {title}
      </h2>
      {children}
    </div>
  );
}

function DeptCard({ name, briefs }) {
  const [open, setOpen] = useState(true);
  const icon = DEPT_ICON[name] || "📌";

  return (
    <div style={{
      background:   "#ffffff",
      border:       "1px solid #cbd5e1",
      borderRadius: 10,
      padding:      "14px 16px",
      marginBottom: 12,
    }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between",
          alignItems: "center", background: "none", border: "none",
          cursor: "pointer", padding: 0, fontFamily: "inherit",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
            {name}
          </span>
          <span style={{
            fontSize: 11, padding: "2px 8px", background: "#f1f5f9",
            color: "#475569", borderRadius: 99,
          }}>
            {briefs.length} {briefs.length === 1 ? "סוגיה" : "סוגיות"}
          </span>
        </span>
        <span style={{ fontSize: 13, color: "#94a3b8" }}>{open ? "▼" : "◀"}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          {briefs.map((b, i) => <BriefCard key={i} brief={b} index={i + 1} />)}
        </div>
      )}
    </div>
  );
}

function BriefCard({ brief, index }) {
  return (
    <div style={{
      background:   "#fafbfc",
      borderInlineStart: "3px solid #3b82f6",
      borderRadius: 6,
      padding:      "12px 14px",
    }}>
      <p style={{
        fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 6px",
      }}>
        {index}. {brief.issue}
      </p>

      {brief.where && (
        <p style={{ fontSize: 12, color: "#475569", margin: "0 0 6px" }}>
          <strong>איפה:</strong> {brief.where}
        </p>
      )}

      {brief.evidence && (
        <p style={{ fontSize: 12, color: "#475569", margin: "0 0 8px",
                    background: "#ffffff", padding: "6px 10px",
                    border: "1px solid #e2e8f0", borderRadius: 6 }}>
          <strong>ראיה:</strong> {brief.evidence}
        </p>
      )}

      {brief.next_questions?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#1e40af",
                      margin: "0 0 4px" }}>שאלות לחקירה:</p>
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13,
                       lineHeight: 1.7, color: "#1e293b" }}>
            {brief.next_questions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}
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
      borderRadius: 10, padding: "16px 20px", fontSize: 14,
    }}>
      ⚠ שגיאה בטעינת הניתוח: {message}
    </div>
  );
}

function EmptyState({ onRun, onHistory }) {
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
        כדי להפיק את הניתוח הראשון — בצע ריצה של שלב 0.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={onRun} style={btnPrimary}>הפעל ניתוח שלב 0</button>
        <button onClick={onHistory} style={btnSecondary}>היסטוריית דוחות</button>
      </div>
    </div>
  );
}

const btnPrimary = {
  background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8,
  padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
};
const btnSecondary = {
  background: "#fff", color: "#1e293b", border: "1px solid #cbd5e1",
  borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer",
};

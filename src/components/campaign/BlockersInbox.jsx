/**
 * BlockersInbox.jsx — "דורש פעולה" — רשימת משימות שמחכות למנהלת השיווק.
 *
 * UI terminology: we don't show the word "חסם" anywhere; the user sees
 * "משימה שמחכה לך" with a clear description of what to do.
 */
import React, { useState, useEffect } from "react";
import { listWorkflowBlockers, resolveBlocker } from "../../api.js";

// Friendly Hebrew labels for blocker_type values written by the backend.
const TYPE_LABELS = {
  awaiting_approval:           { label: "מחכה לאישור שלך",            icon: "✋", action: "סקרי וסמני כטופל" },
  qa_revision_required:        { label: "תיקון נדרש",                  icon: "🔧", action: "תקני ושלחי שוב" },
  missing_brief_field:         { label: "חסר שדה בבריף",               icon: "📝", action: "השלימי את החסר" },
  awaiting_human_input:        { label: "מחכה לקלט שלך",              icon: "✍",  action: "השלימי את הקלט" },
  connection_error:            { label: "בעיית חיבור לפלטפורמה",      icon: "🔌", action: "בדקי את החיבור" },
  human_only_otp:              { label: "נדרש קוד OTP",                icon: "📱", action: "הזיני קוד שנשלח לטלפון" },
  human_only_captcha:          { label: "נדרש פתרון CAPTCHA",          icon: "🤖", action: "השלימי את האימות" },
  human_only_owner_approval:   { label: "נדרש אישור בעלים",            icon: "👤", action: "פני לבעלי החשבון" },
  human_only_credentials:      { label: "נדרשים credentials",          icon: "🔑", action: "הזיני שם משתמש/סיסמה" },
  human_only_billing:          { label: "נדרשת התערבות בחיוב",         icon: "💳", action: "בדקי במחלקת הכספים" },
  missing_gemini_api_key:      { label: "חסר מפתח Gemini",             icon: "🔑", action: "פני לאדמין לעדכון המפתח" },
};

const SEVERITY_BG = {
  low:      { bg: "#f8fafc", border: "#e2e8f0", color: "#64748b" },
  normal:   { bg: "#fffbeb", border: "#fef3c7", color: "#a16207" },
  high:     { bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" },
  critical: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
};

export default function BlockersInbox() {
  const [rows, setRows]   = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState({});

  async function load() {
    setLoading(true); setError(null);
    try {
      const data = await listWorkflowBlockers({ ownerRole: "marketing_manager", onlyOpen: true });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function resolve(b) {
    const text = (resolution[b.id] || "").trim();
    if (!text) { alert("נא להוסיף תיאור של הפעולה שביצעת לפני סימון."); return; }
    setBusyId(b.id);
    try {
      await resolveBlocker(b.id, { resolution: text, resolved_by: "marketing_manager" });
      await load();
    } catch (e) {
      alert(`שגיאה: ${e.message}`);
    } finally { setBusyId(null); }
  }

  return (
    <div style={{
      background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0",
      padding: 20, direction: "rtl",
    }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "#0f172a", fontWeight: 700 }}>
          ✅ משימות שמחכות לך ({rows.length})
        </h3>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          אישורים, תיקונים והחלטות שדורשים את תשומת לבך כדי שהמערכת תוכל להמשיך.
        </div>
      </div>

      {error && <div style={{ color: "#b91c1c", marginBottom: 10 }}>שגיאה: {error}</div>}
      {loading && <div style={{ color: "#64748b" }}>טוען...</div>}

      {!loading && rows.length === 0 && (
        <div style={{ color: "#64748b", textAlign: "center", padding: 32, fontSize: 14 }}>
          🎉 הכל מטופל! אין משימות פתוחות כרגע.
        </div>
      )}

      {rows.map(b => {
        const sev = SEVERITY_BG[b.severity] || SEVERITY_BG.normal;
        const meta = TYPE_LABELS[b.blocker_type] || { label: b.blocker_type, icon: "📌", action: "סקרי את הפרטים" };
        return (
          <div key={b.id} style={{
            padding: 14, marginBottom: 12, background: sev.bg,
            border: `1px solid ${sev.border}`, borderRadius: 10,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{meta.icon}</span>
                  <strong style={{ color: "#0f172a", fontSize: 15 }}>{meta.label}</strong>
                </div>
                <div style={{ marginTop: 6, color: "#334155", fontSize: 13 }}>
                  <strong>מה צריך לעשות:</strong> {meta.action}
                </div>
                <div style={{ marginTop: 6, color: "#475569", fontSize: 13, fontStyle: "italic" }}>
                  {b.description}
                </div>
                {b.payload?.platform && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
                    🏷 פלטפורמה: <strong>{b.payload.platform}</strong>
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
                  התקבל ב-{new Date(b.opened_at).toLocaleString("he-IL")}
                </div>
              </div>
              <span style={{
                padding: "4px 10px", borderRadius: 12, background: "#fff",
                color: sev.color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                border: `1px solid ${sev.border}`,
              }}>{b.severity}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                placeholder="מה ביצעת? (חובה לתיעוד)"
                value={resolution[b.id] || ""}
                onChange={e => setResolution(prev => ({ ...prev, [b.id]: e.target.value }))}
                style={{
                  flex: 1, padding: "9px 12px", border: "1px solid #cbd5e1",
                  borderRadius: 6, fontSize: 13, direction: "rtl",
                }}
              />
              <button
                onClick={() => resolve(b)} disabled={busyId === b.id}
                style={{
                  padding: "9px 16px", background: "#16a34a", color: "#fff",
                  border: "none", borderRadius: 6, fontWeight: 700,
                  cursor: busyId === b.id ? "not-allowed" : "pointer", fontSize: 13,
                }}
              >{busyId === b.id ? "..." : "✓ סמני כטופל"}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

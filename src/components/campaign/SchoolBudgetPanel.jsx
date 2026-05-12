/**
 * SchoolBudgetPanel.jsx — תקציב בית-ספרי כללי (envelope בלבד).
 *
 * Manager sets only the "envelope": annual budget, monthly budget (optional),
 * and free-text notes. The PLATFORM SPLIT is NOT a manager setting — it's a
 * recommendation produced by `budget_allocation_agent` and approved via the
 * artifacts flow ("דורש פעולה" tab). Previously this panel had a `media_split`
 * editor; it has been removed because no agent consumed those values.
 */
import React, { useState, useEffect } from "react";
import { getSchoolBudget, updateSchoolBudget } from "../../api.js";
import { useToast } from "./Toast.jsx";

const card = {
  background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
  padding: 24, marginBottom: 16, boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
};
const fieldLabel = { display: "block", fontSize: 13, fontWeight: 700, color: "#1f2937", marginBottom: 6 };
const hint = { fontSize: 12, color: "#9ca3af", marginTop: 4, lineHeight: 1.5 };
const input = {
  width: "100%", padding: "11px 14px", fontSize: 14,
  border: "1px solid #e5e7eb", borderRadius: 8, direction: "rtl",
  background: "#f9fafb",
};

export default function SchoolBudgetPanel() {
  const toast = useToast();
  // Two scopes — annual, monthly. Each can be filled independently.
  const [annualEnabled,  setAnnualEnabled]  = useState(false);
  const [monthlyEnabled, setMonthlyEnabled] = useState(false);
  const [annual,  setAnnual]  = useState("");
  const [monthly, setMonthly] = useState("");
  const [notes,   setNotes]   = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState(null);

  async function load() {
    try {
      const budget = await getSchoolBudget();
      const a = budget.annual_budget_ils;
      const m = budget.monthly_budget_ils;
      setAnnualEnabled(a !== null && a !== undefined);
      setMonthlyEnabled(m !== null && m !== undefined);
      setAnnual(a ?? "");
      setMonthly(m ?? "");
      setNotes(budget.notes ?? "");
    } catch (e) { setMsg(`שגיאה: ${e.message}`); }
  }

  useEffect(() => { load(); }, []);

  const anyBudget = (annualEnabled && annual) || (monthlyEnabled && monthly);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      await updateSchoolBudget({
        annual_budget_ils:  annualEnabled && annual   ? Number(annual)  : null,
        monthly_budget_ils: monthlyEnabled && monthly ? Number(monthly) : null,
        media_split:        {},  // intentionally empty — split is agent-recommended, not manager-set
        notes:              notes || null,
        updated_by:         "marketing_manager",
      });
      toast.success("💰 תכנית התקציב נשמרה");
      await load();
    } catch (e) {
      toast.error(`שגיאה בשמירה: ${e.message}`);
    } finally { setBusy(false); }
  }

  return (
    <div style={card}>
      <div style={{ marginBottom: 18 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 18, color: "#111827", fontWeight: 700 }}>
          💰 תכנית תקציב בית-ספרית
        </h3>
        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
          התקציב הכללי של בית הספר. תיקיות יכולות לצאת מהתקציב הזה (<em>"מהתקציב הקיים"</em>) או לקבל תקציב נפרד (<em>"ייעודי"</em>).
        </div>
      </div>

      {/* Budget mode picker — flexible: annual, monthly, or both */}
      <div style={{ marginBottom: 22 }}>
        <div style={fieldLabel}>איזה תקציב את יודעת להגדיר כרגע?</div>
        <div style={hint}>אפשר רק שנתי, רק חודשי, או שניהם. אל תכריחי את עצמך אם אין מספר.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <BudgetToggle
            active={annualEnabled} onClick={() => setAnnualEnabled(v => !v)}
            icon="📆" label="תקציב שנתי" hint="סכום שמוקצה לכלל השנה" />
          <BudgetToggle
            active={monthlyEnabled} onClick={() => setMonthlyEnabled(v => !v)}
            icon="🗓" label="תקציב חודשי" hint="סכום קבוע לכל חודש" />
        </div>
      </div>

      {(annualEnabled || monthlyEnabled) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 18 }}>
          {annualEnabled && (
            <div>
              <label style={fieldLabel}>תקציב שנתי (₪)</label>
              <input style={input} type="number" value={annual} onChange={e => setAnnual(e.target.value)} placeholder="לדוגמה 300,000" />
              {annual && monthlyEnabled && monthly && (
                <div style={hint}>
                  {Number(monthly) * 12 === Number(annual)
                    ? "✓ מסונכרן עם החודשי (×12)"
                    : `שים לב: 12 × חודשי = ₪${(Number(monthly) * 12).toLocaleString("he-IL")}`}
                </div>
              )}
            </div>
          )}
          {monthlyEnabled && (
            <div>
              <label style={fieldLabel}>תקציב חודשי (₪)</label>
              <input style={input} type="number" value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="לדוגמה 25,000" />
              {monthly && !annualEnabled && (
                <div style={hint}>תקציב שנתי משוער (×12): ₪{(Number(monthly) * 12).toLocaleString("he-IL")}</div>
              )}
            </div>
          )}
        </div>
      )}

      {!anyBudget && (
        <div style={{
          background: "#fef3c7", color: "#854d0e", padding: "12px 16px",
          borderRadius: 10, fontSize: 13, marginBottom: 18,
        }}>
          ℹ עוד לא הזנת תקציב. סמני לפחות שנתי או חודשי כדי לאפשר חישוב תקציב.
        </div>
      )}

      <div style={{
        background: "#e0f2fe", border: "1px solid #7dd3fc", borderRadius: 10,
        padding: "14px 18px", marginBottom: 22,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#075985", marginBottom: 6 }}>
          💡 איך מתחלקים הכספים בין הפלטפורמות?
        </div>
        <div style={{ fontSize: 13, color: "#0c4a6e", lineHeight: 1.6 }}>
          החלוקה בין Meta / Google / TikTok <strong>אינה הגדרה שאת קובעת מראש</strong> — היא <strong>המלצה</strong>
          של סוכן ניהול התקציב, שמתבססת על:
          <ul style={{ margin: "8px 0 8px 0", paddingInlineStart: 22 }}>
            <li>תוצאות היסטוריות (CPL, CTR, איכות לידים לכל פלטפורמה)</li>
            <li>חיזוי ביצועים לתקופה הקרובה</li>
            <li>תנאי שוק נוכחיים ועונתיות</li>
          </ul>
          בכל פעם שתיקיית קמפיין נפתחת או שביצועים זזים — תקבלי המלצת חלוקה ב<strong>"דורש פעולה" → "המלצת תקציב"</strong>. שם תאשרי / תדחי / תבקשי שינוי.
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={fieldLabel}>הערות והנחיות כלליות</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  style={{ ...input, resize: "vertical", fontFamily: "inherit" }}
                  placeholder="לדוגמה: חוקי חלוקה לפי עונה, נקודות תשומת לב, יעדים חצי-שנתיים..." />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 18, borderTop: "1px solid #e5e7eb" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: msg?.startsWith("✓") ? "#15803d" : "#b91c1c" }}>
          {msg || ""}
        </span>
        <button onClick={save} disabled={busy} style={{
          padding: "11px 24px", background: "#1e3a5f", color: "#fff", border: "none",
          borderRadius: 8, cursor: busy ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14,
          boxShadow: "0 2px 6px rgba(30,58,95,0.25)", opacity: busy ? 0.6 : 1,
        }}>{busy ? "שומר..." : "💾 שמירת שינויים"}</button>
      </div>
    </div>
  );
}

function BudgetToggle({ active, onClick, icon, label, hint }) {
  return (
    <div onClick={onClick} style={{
      flex: 1, minWidth: 200, padding: "14px 16px", borderRadius: 10, cursor: "pointer",
      background: active ? "#eff6ff" : "#fff",
      border: `2px solid ${active ? "#1e3a5f" : "#e5e7eb"}`,
      display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s",
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: active ? "#1e3a5f" : "#111827" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{hint}</div>
      </div>
      <div style={{
        width: 20, height: 20, borderRadius: "50%",
        background: active ? "#1e3a5f" : "#fff",
        border: `2px solid ${active ? "#1e3a5f" : "#cbd5e1"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: 12, fontWeight: 700,
      }}>{active && "✓"}</div>
    </div>
  );
}

/**
 * SchoolBudgetPanel.jsx — תקציב בית-ספרי כללי (Spec 01 §8 — תוכנית פעילות בית ספרית ותקציבים).
 * Annual budget + monthly budget + media split per platform.
 * Saved to media_settings.payload.school_budget (no new table).
 */
import React, { useState, useEffect } from "react";
import { getSchoolBudget, updateSchoolBudget, listPlatformSettings } from "../../api.js";

const section = {
  background: "#ffffff", borderRadius: 10, border: "1px solid #e2e8f0",
  padding: 20, marginBottom: 16,
};

const fieldLabel = {
  display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 4,
};

const input = {
  width: "100%", padding: "10px 12px", fontSize: 14,
  border: "1px solid #cbd5e1", borderRadius: 6, direction: "rtl",
};

export default function SchoolBudgetPanel() {
  const [annual, setAnnual] = useState("");
  const [monthly, setMonthly] = useState("");
  const [notes, setNotes] = useState("");
  const [split, setSplit] = useState({});  // platform → fraction (0..1)
  const [platforms, setPlatforms] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function load() {
    try {
      const [budget, plats] = await Promise.all([
        getSchoolBudget(),
        listPlatformSettings({ activeOnly: false }),
      ]);
      setAnnual(budget.annual_budget_ils ?? "");
      setMonthly(budget.monthly_budget_ils ?? "");
      setNotes(budget.notes ?? "");
      setSplit(budget.media_split || {});
      setPlatforms(plats || []);
    } catch (e) {
      setMsg(`שגיאה: ${e.message}`);
    }
  }

  useEffect(() => { load(); }, []);

  const splitSum = Object.values(split).reduce((a, b) => a + (Number(b) || 0), 0);
  const splitOk = Math.abs(splitSum - 1) < 0.001 || splitSum === 0;

  function setPlat(platform, v) {
    const num = v === "" ? 0 : Number(v);
    setSplit(prev => ({ ...prev, [platform]: num }));
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      await updateSchoolBudget({
        annual_budget_ils:  annual ? Number(annual) : null,
        monthly_budget_ils: monthly ? Number(monthly) : null,
        media_split:        split,
        notes:              notes || null,
        updated_by:         "marketing_manager",
      });
      setMsg("✓ נשמר");
      await load();
    } catch (e) {
      setMsg(`שגיאה: ${e.message}`);
    } finally { setBusy(false); }
  }

  return (
    <div style={section}>
      <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "#0f172a", fontWeight: 700 }}>
        💰 תכנית תקציב בית-ספרית
      </h3>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 18 }}>
        התקציב הכללי של בית הספר. תיקיות יכולות לצאת מהתקציב הזה (`from_existing`) או לקבל תקציב נפרד (`dedicated`).
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 18 }}>
        <div>
          <label style={fieldLabel}>תקציב שנתי (₪)</label>
          <input style={input} type="number" value={annual} onChange={e => setAnnual(e.target.value)} placeholder="300000" />
        </div>
        <div>
          <label style={fieldLabel}>תקציב חודשי (₪)</label>
          <input style={input} type="number" value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="25000" />
          {annual && monthly && (
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              {Number(monthly) * 12 === Number(annual)
                ? "✓ מתואם עם שנתי (×12)"
                : `שנתי המחושב: ₪${(Number(monthly) * 12).toLocaleString()}`}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={fieldLabel}>חלוקה למדיה (סכום ל-100%)</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {platforms.map(p => (
            <div key={p.platform} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
              background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0",
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>{p.platform}</span>
              <input
                type="number" step="0.05" min="0" max="1"
                value={split[p.platform] ?? ""}
                onChange={e => setPlat(p.platform, e.target.value)}
                style={{ width: 80, padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13 }}
              />
              <span style={{ fontSize: 12, color: "#64748b" }}>= {Math.round((split[p.platform] || 0) * 100)}%</span>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 8, fontSize: 12,
          color: splitOk ? "#15803d" : "#b91c1c", fontWeight: 600,
        }}>
          סך החלוקה: {Math.round(splitSum * 100)}% {splitOk ? "✓" : "⚠ צריך להסתכם ל-100%"}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={fieldLabel}>הערות</label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          rows={3}
          style={{ ...input, resize: "vertical", fontFamily: "inherit" }}
          placeholder="הערות תכנון, דגשים מיוחדים, חוקי חלוקה..."
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: msg?.startsWith("✓") ? "#15803d" : "#b91c1c",
        }}>{msg}</span>
        <button onClick={save} disabled={busy} style={{
          padding: "10px 20px", background: "#1e3a5f", color: "#fff", border: "none",
          borderRadius: 6, cursor: busy ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14,
        }}>{busy ? "שומר..." : "💾 שמור"}</button>
      </div>
    </div>
  );
}

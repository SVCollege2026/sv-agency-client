/**
 * ImportLiveCampaignModal.jsx
 * ייבוא קמפיין שכבר באוויר — יוצר תיקייה ישירות בסטטוס 'live'
 * עם budget_allocation לכל פלטפורמה.
 *
 * Props:
 *   onClose()          — סגירת המודל
 *   onSuccess(folder)  — לאחר ייבוא מוצלח, מעביר את ה-folder שנוצר
 */
import React, { useState } from "react";
import { importLiveCampaign } from "../../api.js";
import { color, radius, space, type, button as btnTokens, fontFamily } from "./_tokens.js";
import { useToast } from "./Toast.jsx";

const PLATFORM_OPTIONS = [
  { id: "meta",   label: "Meta (Facebook / Instagram)", icon: "📘", placeholder: "84000" },
  { id: "google", label: "Google Ads (Search + PMax)",  icon: "🔎", placeholder: "36000" },
  { id: "tiktok", label: "TikTok",                      icon: "🎵", placeholder: "10000" },
];

const KNOWN_COURSES = [
  "שיווק / סושיאל / AI ערב",
  "שיווק / סושיאל / AI בוקר",
  "שיווק B2B",
  "QA",
  "QA פרימיום",
  "גיימינג",
  "DevOps",
  "פולסטאק (Full-Stack)",
  "סייבר",
  "AI ערב",
  "AI בוקר",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ImportLiveCampaignModal({ onClose, onSuccess }) {
  const toast = useToast();
  const [courseName, setCourseName] = useState("");
  const [customCourse, setCustomCourse] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState({ meta: true, google: true });
  const [budgets, setBudgets] = useState({ meta: "", google: "", tiktok: "" });
  const [goLiveDate, setGoLiveDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function togglePlatform(id) {
    setSelectedPlatforms(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function setBudget(id, val) {
    setBudgets(prev => ({ ...prev, [id]: val }));
  }

  const activePlatforms = PLATFORM_OPTIONS.filter(p => selectedPlatforms[p.id]);
  const totalMonthly = activePlatforms.reduce((sum, p) => sum + (Number(budgets[p.id]) || 0), 0);
  const dailyTotal   = totalMonthly > 0 ? Math.round(totalMonthly / 30) : 0;

  const canSubmit =
    courseName.trim() &&
    activePlatforms.length > 0 &&
    activePlatforms.every(p => Number(budgets[p.id]) > 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const platforms = activePlatforms.map(p => ({
        platform:           p.id,
        monthly_budget_ils: Number(budgets[p.id]),
      }));
      const result = await importLiveCampaign({
        course_name:   courseName.trim(),
        platforms,
        go_live_date:  goLiveDate || undefined,
        notes:         notes.trim() || undefined,
        imported_by:   "marketing_manager",
      });
      toast.success(`✓ "${courseName.trim()}" נוסף לקמפיינים באוויר`);
      onSuccess(result.folder);
    } catch (err) {
      toast.error(`שגיאה: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(15,23,42,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: space(4), direction: "rtl",
    }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: radius.xl,
        boxShadow: "0 20px 60px rgba(15,23,42,0.18)",
        width: "100%", maxWidth: 520,
        maxHeight: "90vh", overflowY: "auto",
        padding: space(5),
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: space(4) }}>
          <div>
            <h3 style={{ ...type.h2, margin: 0, fontSize: 18, color: color.fgDefault }}>
              ✈ ייבוא קמפיין פעיל
            </h3>
            <p style={{ ...type.bodySmall, color: color.fgSubtle, margin: `${space(1)} 0 0` }}>
              לקמפיין שכבר רץ — מתעדים אותו ישירות בסטטוס "באוויר"
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: 20, cursor: "pointer",
            color: color.fgMuted, lineHeight: 1, padding: space(1), fontFamily,
          }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Course name */}
          <div style={{ marginBottom: space(4) }}>
            <label style={labelStyle}>שם הקורס / הפעילות</label>
            {!customCourse ? (
              <>
                <select
                  value={courseName}
                  onChange={e => {
                    if (e.target.value === "__other__") { setCustomCourse(true); setCourseName(""); }
                    else setCourseName(e.target.value);
                  }}
                  style={inputStyle}
                  required
                >
                  <option value="">בחרי קורס...</option>
                  {KNOWN_COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__other__">אחר (הקלידי ידנית)</option>
                </select>
              </>
            ) : (
              <div style={{ display: "flex", gap: space(2) }}>
                <input
                  type="text"
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  placeholder="לדוגמה: מעצבי UX"
                  style={{ ...inputStyle, flex: 1 }}
                  autoFocus
                  required
                />
                <button type="button" onClick={() => { setCustomCourse(false); setCourseName(""); }}
                  style={{ ...btnTokens.ghost, fontSize: 12, padding: "8px 12px" }}>
                  ← רשימה
                </button>
              </div>
            )}
          </div>

          {/* Platforms + budgets */}
          <div style={{ marginBottom: space(4) }}>
            <label style={labelStyle}>פלטפורמות ותקציב חודשי (₪)</label>
            <p style={{ ...type.bodySmall, color: color.fgSubtle, marginBottom: space(2) }}>
              תקציב = כמה מוציאים לקורס זה בחודש בכל פלטפורמה
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: space(2) }}>
              {PLATFORM_OPTIONS.map(p => (
                <div key={p.id} style={{
                  border: `1.5px solid ${selectedPlatforms[p.id] ? color.primary : color.borderDefault}`,
                  borderRadius: radius.md, padding: space(3),
                  background: selectedPlatforms[p.id] ? "#eff6ff" : color.surfaceMuted,
                  transition: "all 0.12s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: space(2), marginBottom: selectedPlatforms[p.id] ? space(2) : 0 }}>
                    <input
                      type="checkbox"
                      checked={!!selectedPlatforms[p.id]}
                      onChange={() => togglePlatform(p.id)}
                      id={`chk-${p.id}`}
                      style={{ width: 16, height: 16, cursor: "pointer", accentColor: color.primary }}
                    />
                    <label htmlFor={`chk-${p.id}`} style={{
                      fontSize: 14, fontWeight: 600, color: color.fgDefault,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: space(1.5),
                    }}>
                      <span>{p.icon}</span> {p.label}
                    </label>
                  </div>
                  {selectedPlatforms[p.id] && (
                    <div style={{ display: "flex", alignItems: "center", gap: space(2) }}>
                      <span style={{ fontSize: 13, color: color.fgSubtle, whiteSpace: "nowrap" }}>₪/חודש:</span>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={budgets[p.id]}
                        onChange={e => setBudget(p.id, e.target.value)}
                        placeholder={p.placeholder}
                        style={{ ...inputStyle, flex: 1, textAlign: "left" }}
                        required
                      />
                      {Number(budgets[p.id]) > 0 && (
                        <span style={{ fontSize: 12, color: color.fgSubtle, whiteSpace: "nowrap" }}>
                          ≈ ₪{Math.round(Number(budgets[p.id]) / 30).toLocaleString("he-IL")}/יום
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {totalMonthly > 0 && (
              <div style={{
                marginTop: space(2), padding: `${space(2)} ${space(3)}`,
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: radius.md, fontSize: 13, color: "#166534",
                display: "flex", justifyContent: "space-between",
              }}>
                <span>סה"כ חודשי: <strong>₪{totalMonthly.toLocaleString("he-IL")}</strong></span>
                <span>סה"כ יומי: <strong>₪{dailyTotal.toLocaleString("he-IL")}</strong></span>
              </div>
            )}
          </div>

          {/* Go-live date */}
          <div style={{ marginBottom: space(4) }}>
            <label style={labelStyle}>תאריך עלייה לאוויר</label>
            <input
              type="date"
              value={goLiveDate}
              onChange={e => setGoLiveDate(e.target.value)}
              style={{ ...inputStyle, colorScheme: "light" }}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: space(5) }}>
            <label style={labelStyle}>הערות (אופציונלי)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="לדוגמה: קמפיין בניהול לימן, 4 adsets פעילים, נוצר ינואר 2026"
              rows={3}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5, fontFamily }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: space(2), justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose}
              style={{ ...btnTokens.ghost, fontSize: 14, padding: "10px 20px" }}>
              ביטול
            </button>
            <button type="submit" disabled={!canSubmit || busy}
              style={{
                ...btnTokens.primary, fontSize: 14, padding: "10px 20px",
                opacity: (!canSubmit || busy) ? 0.55 : 1,
                cursor: (!canSubmit || busy) ? "not-allowed" : "pointer",
              }}>
              {busy ? "מייבא..." : "✈ ייבוא לקמפיינים באוויר"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block", fontSize: 13, fontWeight: 700,
  color: "#1f2937", marginBottom: 6,
};

const inputStyle = {
  width: "100%", padding: "10px 12px", fontSize: 14,
  border: "1px solid #e5e7eb", borderRadius: 8, direction: "rtl",
  background: "#f9fafb", boxSizing: "border-box", fontFamily,
  outline: "none",
};

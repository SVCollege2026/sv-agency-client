/**
 * PortalHome.jsx — פורטל ניהול SV Agency
 * בחירת מחלקה · דיווח תקלות
 */
import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { submitBugReport } from "../api.js";

// ─── Departments ─────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  {
    id:     "analytics",
    icon:   "📊",
    label:  "מחלקת אנליזה",
    desc:   "לוח בקרה · ניתוח נתונים · אקו-סיסטם · יעדים",
    path:   "/analytics/dashboard",
    active: true,
  },
  {
    id:     "media",
    icon:   "📣",
    label:  "מחלקת מדיה",
    desc:   "דוחות יומיים/שבועיים · Meta · Google · לידים מ-Fireberry",
    path:   "/media-reports",
    active: true,
  },
  {
    id:     "creative",
    icon:   "🎨",
    label:  "קריאייטיב ועיצוב",
    desc:   "מודעות · קופי · ויזואלים · A/B",
    active: false,
  },
  {
    id:     "content",
    icon:   "📝",
    label:  "מחלקת תוכן",
    desc:   "בלוג · סושיאל · SEO · GEO",
    active: false,
  },
  {
    id:     "clients",
    icon:   "👤",
    label:  "מסעות לקוח",
    desc:   "גיוס · אונבורדינג · סטודנט · בוגר",
    active: false,
  },
  {
    id:     "strategy",
    icon:   "🧭",
    label:  "אסטרטגיה",
    desc:   "תוכנית שנתית · מיתוג · יעדים",
    active: false,
  },
];

// ─── Bug Report Modal ─────────────────────────────────────────────────────────

const PLATFORMS = [
  "Chrome / Windows", "Chrome / Mac",
  "Firefox / Windows", "Firefox / Mac",
  "Safari / Mac", "Edge / Windows",
  "נייד — Android", "נייד — iOS", "אחר",
];

const URGENCY = [
  { value: "low",      label: "נמוכה",   color: "#16a34a" },
  { value: "medium",   label: "בינונית", color: "#ca8a04" },
  { value: "high",     label: "גבוהה",   color: "#ea580c" },
  { value: "critical", label: "קריטי",   color: "#dc2626" },
];

function BugModal({ onClose }) {
  const [form, setForm]       = useState({ description: "", platform: "Chrome / Windows", urgency: "medium" });
  const [imageData, setImage] = useState(null);   // base64 data URL
  const [imageFile, setFile]  = useState(null);   // file name for display
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState(null);
  const fileRef = useRef(null);

  function handleImageFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("יש להעלות קובץ תמונה בלבד (PNG, JPG, GIF…)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("התמונה גדולה מדי — מקסימום 5MB");
      return;
    }
    setError(null);
    setFile(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await submitBugReport({
        description:    form.description,
        platform:       form.platform,
        urgency:        form.urgency,
        // send image as base64 data URL (stored in screenshot_url field)
        screenshot_url: imageData || null,
      });
      setSuccess(true);
      setTimeout(onClose, 2200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        dir="rtl"
        style={{
          background: "#fff", borderRadius: 18,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          width: "100%", maxWidth: 460, margin: "0 16px",
          overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ background: "#dc2626", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🐛</span>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>דיווח תקלות</span>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", fontSize: 24, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {success ? (
            <div style={{ textAlign: "center", padding: "28px 0" }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>✓</div>
              <p style={{ color: "#16a34a", fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>הדיווח נשלח!</p>
              <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>תודה — נטפל בזה בהקדם.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Description */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                  תיאור התקלה <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <textarea
                  style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 13, resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }}
                  rows={4}
                  placeholder="תאר מה קרה, מה ציפית שיקרה, וצעדים לשחזור..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                />
              </div>

              {/* Platform */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }}>פלטפורמה</label>
                <select
                  style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#fff", outline: "none", boxSizing: "border-box" }}
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                >
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Urgency */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>דחיפות</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {URGENCY.map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={() => setForm({ ...form, urgency: opt.value })}
                      style={{
                        padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: `2px solid ${form.urgency === opt.value ? opt.color : "#e5e7eb"}`,
                        color: form.urgency === opt.value ? opt.color : "#9ca3af",
                        background: form.urgency === opt.value ? opt.color + "15" : "transparent",
                        transition: "all 0.15s",
                      }}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Screenshot — file upload OR drag */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                  צילום מסך <span style={{ color: "#9ca3af", fontWeight: 400 }}>(אופציונלי)</span>
                </label>

                {/* Drop zone */}
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleImageFile(e.dataTransfer.files[0]); }}
                  style={{
                    border: `2px dashed ${imageData ? "#16a34a" : "#d1d5db"}`,
                    borderRadius: 10, padding: "14px 12px", cursor: "pointer",
                    background: imageData ? "#f0fdf4" : "#f9fafb",
                    textAlign: "center", transition: "all 0.15s",
                  }}
                >
                  {imageData ? (
                    <div>
                      <img
                        src={imageData}
                        alt="preview"
                        style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 6, marginBottom: 8, objectFit: "contain" }}
                      />
                      <p style={{ margin: 0, fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓ {imageFile}</p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setImage(null); setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                        style={{ marginTop: 6, fontSize: 11, color: "#dc2626", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                      >
                        הסר תמונה
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div>
                      <p style={{ margin: "0 0 2px", fontSize: 13, color: "#374151", fontWeight: 500 }}>גרור תמונה לכאן</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>או לחץ לבחירת קובץ · PNG, JPG, GIF עד 5MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => handleImageFile(e.target.files[0])}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#dc2626" }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !form.description.trim()}
                style={{
                  background: loading || !form.description.trim() ? "#fca5a5" : "#dc2626",
                  color: "#fff", border: "none", borderRadius: 9,
                  padding: "11px", fontSize: 14, fontWeight: 600,
                  cursor: loading || !form.description.trim() ? "default" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                {loading ? "שולח…" : "שלח דיווח"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Portal Home ──────────────────────────────────────────────────────────────

export default function PortalHome() {
  const navigate   = useNavigate();
  const [bugOpen, setBugOpen] = useState(false);

  return (
    <div
      lang="he"
      style={{
        background: "#060d1a", color: "#e2e8f0",
        fontFamily: "'Segoe UI', sans-serif", direction: "rtl",
        minHeight: "calc(100vh - 56px)",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* ── Main ── */}
      <div style={{ flex: 1, padding: "40px 24px", maxWidth: 1020, margin: "0 auto", width: "100%" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "#e2e8f0" }}>בחר מחלקה</h1>
        <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 36px" }}>
          כל מחלקה מופעלת על ידי מערך סוכני AI ייעודי
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
          {DEPARTMENTS.map((dept) => (
            <button
              key={dept.id}
              type="button"
              disabled={!dept.active}
              onClick={() => dept.active && navigate(dept.path)}
              aria-label={`${dept.label}${!dept.active ? " — בפיתוח" : ""}`}
              style={{
                background:   dept.active ? "#0d1626" : "#080e1a",
                border:       `1px solid ${dept.active ? "#1e3a5f" : "#1a2234"}`,
                borderRadius: 14, padding: "22px 20px",
                textAlign: "right", cursor: dept.active ? "pointer" : "default",
                opacity: dept.active ? 1 : 0.45, transition: "all 0.15s",
                display: "block", width: "100%", position: "relative", outline: "none",
              }}
              onMouseEnter={(e) => dept.active && (e.currentTarget.style.border = "1px solid #3b82f6")}
              onMouseLeave={(e) => dept.active && (e.currentTarget.style.border = `1px solid ${dept.active ? "#1e3a5f" : "#1a2234"}`)}
            >
              {!dept.active && (
                <span style={{
                  position: "absolute", top: 10, left: 10,
                  fontSize: 10, color: "#475569", background: "#0f172a",
                  borderRadius: 6, padding: "2px 8px", border: "1px solid #1e293b",
                }}>בפיתוח</span>
              )}
              <div style={{ fontSize: 30, marginBottom: 10 }}>{dept.icon}</div>
              <p style={{ margin: "0 0 5px", fontSize: 15, fontWeight: 700, color: dept.active ? "#e2e8f0" : "#475569" }}>
                {dept.label}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{dept.desc}</p>
              {dept.active && (
                <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>
                  כניסה למחלקה ←
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        borderTop: "1px solid #0f172a", padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 8,
      }}>
        <p style={{ margin: 0, fontSize: 11, color: "#334155" }}>
          SV Agency © {new Date().getFullYear()} — SVCollege
        </p>
        <button
          type="button"
          onClick={() => setBugOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "1px solid #1e293b",
            borderRadius: 7, padding: "5px 14px",
            fontSize: 12, color: "#64748b", cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#dc2626"; e.currentTarget.style.color = "#ef4444"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.color = "#64748b"; }}
        >
          🐛 דיווח תקלות
        </button>
      </div>

      {bugOpen && <BugModal onClose={() => setBugOpen(false)} />}
    </div>
  );
}

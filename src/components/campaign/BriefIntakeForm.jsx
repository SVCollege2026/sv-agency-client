/**
 * BriefIntakeForm.jsx — 2 brief types (Spec 03 §4) with file upload everywhere.
 *
 * school_level — שמות קורסים + סילבוסים (טקסט+קובץ) + קהלים + תקציב שנתי/חודשי + מדיה + יעדים.
 * new_course   — שם + קהל + סילבוס (טקסט+קובץ) + landing URL + מקור תקציב + מסר + יעדים + דוגמאות (טקסט+קבצים) + הערות.
 *
 * Two input modes per Spec 03 §4: structured form OR Word/PDF whole-brief upload.
 * Files go to Supabase Storage bucket `campaign-briefs` via /api/campaigns/upload.
 */
import React, { useState } from "react";
import { submitCampaignRequest, uploadCampaignFile } from "../../api.js";
import FileUpload from "./FileUpload.jsx";

const BUDGET_SOURCES = [
  { value: "from_existing",       label: "מהתקציב הבית-ספרי הקיים",       icon: "🏫" },
  { value: "dedicated",           label: "תקציב ייעודי נפרד לקורס",         icon: "🎯" },
  { value: "one_time",            label: "תקציב נוסף חד פעמי",              icon: "💸" },
  { value: "time_bound",          label: "תקציב לתקופה מוגדרת",             icon: "📅" },
  { value: "launch_then_ongoing", label: "תקציב השקה ואחריו שוטף",          icon: "🚀" },
  { value: "undefined",           label: "טרם הוגדר — דורש הבהרה",          icon: "❓" },
];

const Field = ({ label, children, hint, required }) => (
  <label style={{ display: "block", marginBottom: 14 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
      {label}{required && <span style={{ color: "#dc2626" }}> *</span>}
    </div>
    {children}
    {hint && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{hint}</div>}
  </label>
);

const inputStyle = {
  width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1",
  borderRadius: 6, fontSize: 14, direction: "rtl",
};

const sectionTitle = {
  fontSize: 15, fontWeight: 700, color: "#1e3a5f",
  marginTop: 18, marginBottom: 10, paddingBottom: 6,
  borderBottom: "2px solid #e2e8f0",
};

function BigChoice({ active, disabled, onClick, icon, title, subtitle }) {
  return (
    <div onClick={disabled ? undefined : onClick} style={{
      flex: 1, minWidth: 220,
      padding: "14px 16px", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
      background: active ? "#1e3a5f" : "#fff",
      border: `2px solid ${active ? "#1e3a5f" : "#e2e8f0"}`,
      transition: "all 0.15s ease",
      opacity: disabled ? 0.5 : 1,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ fontSize: 32, lineHeight: 1 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: active ? "#fff" : "#0f172a" }}>{title}</div>
        <div style={{ fontSize: 12, color: active ? "#cbd5e1" : "#64748b", marginTop: 2 }}>{subtitle}</div>
      </div>
    </div>
  );
}

export default function BriefIntakeForm({ folderId = null, onSubmitted = () => {}, onCancel = () => {} }) {
  const [requestType, setRequestType] = useState(folderId ? "new_course" : "school_level");
  const [briefType,   setBriefType]   = useState("structured_form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Whole-brief document
  const [briefDoc, setBriefDoc] = useState(null);

  // School-level
  const [courseNames, setCourseNames] = useState("");
  const [syllabiText, setSyllabiText] = useState("");
  const [syllabiFile, setSyllabiFile] = useState(null);
  const [audiences, setAudiences] = useState("");
  const [annualBudget, setAnnualBudget] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [importantMedia, setImportantMedia] = useState("");
  const [schoolGoals, setSchoolGoals] = useState("");

  // New course
  const [courseName, setCourseName] = useState("");
  const [audience, setAudience] = useState("");
  const [syllabusText, setSyllabusText] = useState("");
  const [syllabusFile, setSyllabusFile] = useState(null);
  const [landingUrl, setLandingUrl] = useState("");
  const [budgetSource, setBudgetSource] = useState("from_existing");
  const [message, setMessage] = useState("");
  const [courseGoals, setCourseGoals] = useState("");
  const [adExamples, setAdExamples] = useState("");
  const [adExamplesFiles, setAdExamplesFiles] = useState([]);
  const [notes, setNotes] = useState("");

  function buildPayload() {
    if (briefType === "document_upload") {
      return { course_name: courseName || null, brief_doc: briefDoc };
    }
    if (requestType === "school_level") {
      return {
        course_names:    courseNames.split("\n").map(s => s.trim()).filter(Boolean),
        syllabi_text:    syllabiText,
        syllabi_file:    syllabiFile,
        audiences:       audiences.split("\n").map(s => s.trim()).filter(Boolean),
        annual_budget:   annualBudget ? Number(annualBudget) : null,
        monthly_budget:  monthlyBudget ? Number(monthlyBudget) : null,
        important_media: importantMedia.split(",").map(s => s.trim()).filter(Boolean),
        goals:           schoolGoals,
      };
    }
    return {
      course_name:       courseName,
      audience,
      syllabus_text:     syllabusText,
      syllabus_file:     syllabusFile,
      landing_url:       landingUrl,
      budget_source:     budgetSource,
      message,
      goals:             courseGoals,
      ad_examples_text:  adExamples,
      ad_examples_files: adExamplesFiles,
      notes,
    };
  }

  async function submit() {
    setBusy(true); setError(null);
    try {
      const body = {
        folder_id:     folderId,
        request_type:  requestType,
        brief_type:    briefType,
        brief_payload: buildPayload(),
        brief_doc_url: briefType === "document_upload" ? (briefDoc?.path || null) : null,
        brief_doc_name: briefType === "document_upload" ? (briefDoc?.name || null) : null,
        brief_doc_mime: briefType === "document_upload" ? (briefDoc?.mime || null) : null,
        submitter:     "marketing_manager",
        metadata:      { ui: "BriefIntakeForm", v: 2 },
      };
      const result = await submitCampaignRequest(body);
      onSubmitted(result);
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div style={{ direction: "rtl", padding: 24, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h3 style={{ margin: 0, color: "#0f172a", fontSize: 20 }}>📝 שליחת בריף</h3>
        <button onClick={onCancel} style={{
          background: "transparent", border: "1px solid #cbd5e1", borderRadius: 6,
          padding: "6px 12px", cursor: "pointer", color: "#475569", fontSize: 13,
        }}>✗ ביטול</button>
      </div>

      {/* Step 1: brief type */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase" }}>
          1. סוג הבריף
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <BigChoice
            active={requestType === "school_level"} disabled={!!folderId}
            onClick={() => setRequestType("school_level")}
            icon="🏫" title="בריף בית-ספרי" subtitle="פעילות כללית של כלל הקורסים"
          />
          <BigChoice
            active={requestType === "new_course"}
            onClick={() => setRequestType("new_course")}
            icon="🎯" title="בריף קורס חדש" subtitle="פעילות ממוקדת לקורס/מחזור"
          />
        </div>
      </div>

      {/* Step 2: input mode */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase" }}>
          2. אופן ההגשה
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <BigChoice
            active={briefType === "structured_form"}
            onClick={() => setBriefType("structured_form")}
            icon="📋" title="שדות מובנים" subtitle="טופס פנימי + העלאת קבצים תומכים"
          />
          <BigChoice
            active={briefType === "document_upload"}
            onClick={() => setBriefType("document_upload")}
            icon="📄" title="העלאת מסמך מלא" subtitle="Word / PDF עם כל הפרטים"
          />
        </div>
      </div>

      <div style={{ height: 1, background: "#e2e8f0", margin: "20px 0" }} />

      {/* Document upload mode */}
      {briefType === "document_upload" && (
        <>
          <Field label="שם הקורס (לזיהוי)" required={requestType === "new_course"}>
            <input style={inputStyle} value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="לדוגמה: Python ל-Junior Dev" />
          </Field>
          <Field label="קובץ הבריף" hint="Word / PDF / טקסט · עד 25 MB" required>
            <FileUpload
              folderId={folderId} purpose="brief"
              value={briefDoc} onUploaded={setBriefDoc}
              label="גרור או לחץ להעלאת הבריף"
            />
          </Field>
        </>
      )}

      {/* School-level structured */}
      {briefType === "structured_form" && requestType === "school_level" && (
        <>
          <h4 style={sectionTitle}>🏫 פעילות בית-ספרית כללית</h4>

          <Field label="שמות הקורסים שיש לקדם" hint="קורס בכל שורה" required>
            <textarea style={{ ...inputStyle, minHeight: 80 }} value={courseNames} onChange={e => setCourseNames(e.target.value)} />
          </Field>

          <Field label="סילבוסים — תיאור חופשי">
            <textarea style={{ ...inputStyle, minHeight: 70 }} value={syllabiText} onChange={e => setSyllabiText(e.target.value)} />
          </Field>
          <div style={{ marginTop: -6, marginBottom: 14 }}>
            <FileUpload
              folderId={folderId} purpose="syllabus"
              value={syllabiFile} onUploaded={setSyllabiFile}
              label="📎 העלאת קובץ סילבוסים" hint="PDF / Word — אופציונלי, בנוסף לטקסט"
            />
          </div>

          <Field label="קהלי יעד עיקריים" hint="קהל בכל שורה">
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={audiences} onChange={e => setAudiences(e.target.value)} />
          </Field>

          <h4 style={sectionTitle}>💰 תקציב בית-ספרי</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="תקציב שנתי (₪)">
              <input style={inputStyle} type="number" value={annualBudget} onChange={e => setAnnualBudget(e.target.value)} placeholder="300000" />
            </Field>
            <Field label="תקציב חודשי (₪)">
              <input style={inputStyle} type="number" value={monthlyBudget} onChange={e => setMonthlyBudget(e.target.value)} placeholder="25000" />
            </Field>
          </div>

          <h4 style={sectionTitle}>📡 מדיה ויעדים</h4>
          <Field label="מדיות חשובות" hint="מופרדות בפסיק. לדוגמה: meta, google, tiktok">
            <input style={inputStyle} value={importantMedia} onChange={e => setImportantMedia(e.target.value)} />
          </Field>
          <Field label="יעדים">
            <textarea style={{ ...inputStyle, minHeight: 70 }} value={schoolGoals} onChange={e => setSchoolGoals(e.target.value)} placeholder="מספר נרשמים, CPL מקסימלי, יעדי הרשמה..." />
          </Field>
        </>
      )}

      {/* New course structured */}
      {briefType === "structured_form" && requestType === "new_course" && (
        <>
          <h4 style={sectionTitle}>🎯 פרטי הקורס</h4>

          <Field label="שם הקורס" required>
            <input style={inputStyle} value={courseName} onChange={e => setCourseName(e.target.value)} />
          </Field>

          <Field label="קהל יעד">
            <input style={inputStyle} value={audience} onChange={e => setAudience(e.target.value)} placeholder="לדוגמה: מתחילים בני 25-40 המעוניינים להסב מקצוע" />
          </Field>

          <Field label="סילבוס — תיאור חופשי">
            <textarea style={{ ...inputStyle, minHeight: 80 }} value={syllabusText} onChange={e => setSyllabusText(e.target.value)} />
          </Field>
          <div style={{ marginTop: -6, marginBottom: 14 }}>
            <FileUpload
              folderId={folderId} purpose="syllabus"
              value={syllabusFile} onUploaded={setSyllabusFile}
              label="📎 העלאת קובץ סילבוס" hint="PDF / Word / תמונה — אופציונלי, בנוסף לטקסט"
            />
          </div>

          <Field label="קישור לדף נחיתה">
            <input style={inputStyle} value={landingUrl} onChange={e => setLandingUrl(e.target.value)} placeholder="https://..." />
          </Field>

          <h4 style={sectionTitle}>💰 מקור תקציב</h4>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
            התקציב יכול להיות חלק מהבית-ספרי הקיים, ייעודי לקורס הזה, או לפי אחת מהאפשרויות הנוספות (Spec 01 §9).
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
            {BUDGET_SOURCES.map(s => (
              <div key={s.value} onClick={() => setBudgetSource(s.value)} style={{
                padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                background: budgetSource === s.value ? "#eff6ff" : "#fff",
                border: `2px solid ${budgetSource === s.value ? "#1e3a5f" : "#e2e8f0"}`,
                display: "flex", alignItems: "center", gap: 10,
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: budgetSource === s.value ? "#1e3a5f" : "#334155" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <h4 style={sectionTitle}>📣 מסר ויעדים</h4>
          <Field label="מסר מרכזי / דגשים מיוחדים">
            <textarea style={{ ...inputStyle, minHeight: 70 }} value={message} onChange={e => setMessage(e.target.value)} />
          </Field>
          <Field label="יעדים">
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={courseGoals} onChange={e => setCourseGoals(e.target.value)} />
          </Field>

          <h4 style={sectionTitle}>🖼 דוגמאות למודעות שאהבו</h4>
          <Field label="תיאור חופשי" hint="קישורים, רעיונות, דוגמאות מתחרים...">
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={adExamples} onChange={e => setAdExamples(e.target.value)} />
          </Field>
          <div style={{ marginBottom: 14 }}>
            <FileUpload
              folderId={folderId} purpose="ad_example"
              value={null}
              onUploaded={(res) => setAdExamplesFiles(prev => [...prev, res])}
              label="📎 הוסף דוגמת מודעה" hint="כל קובץ נשמר בנפרד. ניתן להוסיף כמה שצריך"
            />
          </div>
          {adExamplesFiles.length > 0 && (
            <div style={{ background: "#f0fdf4", padding: 12, borderRadius: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 6 }}>
                ✓ קבצים שעלו ({adExamplesFiles.length}):
              </div>
              {adExamplesFiles.map((f, i) => (
                <div key={i} style={{ fontSize: 13, color: "#334155", padding: "4px 0", display: "flex", justifyContent: "space-between" }}>
                  <span>📎 {f.name}</span>
                  <button onClick={() => setAdExamplesFiles(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>הסר ✗</button>
                </div>
              ))}
            </div>
          )}

          <Field label="הערות">
            <textarea style={{ ...inputStyle, minHeight: 50 }} value={notes} onChange={e => setNotes(e.target.value)} />
          </Field>
        </>
      )}

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 13 }}>
          ⚠ שגיאה: {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
        <button onClick={onCancel} style={{
          padding: "11px 20px", background: "transparent", color: "#475569",
          border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer", fontSize: 14,
        }}>ביטול</button>
        <button onClick={submit} disabled={busy} style={{
          padding: "11px 22px", background: "#1e3a5f", color: "#fff", border: "none",
          borderRadius: 8, cursor: busy ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 15,
          boxShadow: "0 2px 6px rgba(30, 58, 95, 0.3)", opacity: busy ? 0.6 : 1,
        }}>{busy ? "שולח..." : "🚀 שליחה לביצוע"}</button>
      </div>
    </div>
  );
}

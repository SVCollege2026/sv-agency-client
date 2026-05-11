/**
 * BriefIntakeForm.jsx — שני סוגי בריף (Spec 03 §4).
 *   • school_level — שמות קורסים, סילבוסים, קהלים, תקציבים שנתי/חודשי, מדיה חשובה, יעדים.
 *   • new_course   — שם, קהל, סילבוס, landing URL, מקור תקציב (6 סוגים), מסר, יעדים, דוגמאות.
 *
 * שני המסלולים: העלאת Word/PDF או מילוי שדות מובנים.
 * שמירה כ-draft ושליחה לביצוע — שניהם דרך submitCampaignRequest.
 */
import React, { useState } from "react";
import { submitCampaignRequest } from "../../api.js";

const BUDGET_SOURCES = [
  { value: "from_existing",       label: "מתוך תקציב קיים" },
  { value: "one_time",            label: "תקציב נוסף חד פעמי" },
  { value: "time_bound",          label: "תקציב נוסף לתקופה מוגדרת" },
  { value: "dedicated",           label: "תקציב נפרד לפעילות/קורס" },
  { value: "launch_then_ongoing", label: "תקציב השקה ולאחריו שוטף" },
  { value: "undefined",           label: "מקור לא מוגדר — דורש הבהרה" },
];

const Field = ({ label, children, hint }) => (
  <label style={{ display: "block", marginBottom: 12 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 4 }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{hint}</div>}
  </label>
);

const inputStyle = {
  width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1",
  borderRadius: 6, fontSize: 14, direction: "rtl",
};

export default function BriefIntakeForm({ folderId = null, onSubmitted = () => {}, onCancel = () => {} }) {
  const [requestType, setRequestType] = useState(folderId ? "new_course" : "school_level");
  const [briefType,   setBriefType]   = useState("structured_form"); // 'structured_form' | 'document_upload'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Shared fields
  const [submitter, setSubmitter] = useState("marketing_manager");
  const [briefDocUrl, setBriefDocUrl] = useState("");

  // School-level fields
  const [courseNames, setCourseNames] = useState("");
  const [syllabi, setSyllabi] = useState("");
  const [audiences, setAudiences] = useState("");
  const [annualBudget, setAnnualBudget] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [importantMedia, setImportantMedia] = useState("");
  const [goals, setGoals] = useState("");

  // New course fields
  const [courseName, setCourseName] = useState("");
  const [audience, setAudience] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [landingUrl, setLandingUrl] = useState("");
  const [budgetSource, setBudgetSource] = useState("dedicated");
  const [message, setMessage] = useState("");
  const [adExamples, setAdExamples] = useState("");
  const [notes, setNotes] = useState("");

  function buildPayload() {
    if (briefType === "document_upload") {
      return { course_name: courseName || null, brief_doc_url: briefDocUrl };
    }
    if (requestType === "school_level") {
      return {
        course_names:    courseNames.split("\n").map(s => s.trim()).filter(Boolean),
        syllabi,
        audiences:       audiences.split("\n").map(s => s.trim()).filter(Boolean),
        annual_budget:   annualBudget ? Number(annualBudget) : null,
        monthly_budget:  monthlyBudget ? Number(monthlyBudget) : null,
        important_media: importantMedia.split(",").map(s => s.trim()).filter(Boolean),
        goals,
      };
    }
    // new_course
    return {
      course_name:  courseName,
      audience,
      syllabus,
      landing_url:  landingUrl,
      budget_source: budgetSource,
      message,
      goals,
      ad_examples:  adExamples,
      notes,
    };
  }

  async function submit(submitNow = false) {
    setBusy(true);
    setError(null);
    try {
      const body = {
        folder_id:     folderId,
        request_type:  requestType,
        brief_type:    briefType,
        brief_payload: buildPayload(),
        brief_doc_url: briefType === "document_upload" ? briefDocUrl : null,
        submitter,
        metadata:      { submitted_now: submitNow, ui: "BriefIntakeForm" },
      };
      const result = await submitCampaignRequest(body);
      onSubmitted(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ direction: "rtl", padding: 20, background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: "#0f172a" }}>📝 שליחת בריף</h3>
        <button onClick={onCancel} style={{
          background: "transparent", border: "1px solid #cbd5e1", borderRadius: 6,
          padding: "4px 10px", cursor: "pointer", color: "#475569",
        }}>ביטול</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setRequestType("school_level")}
          disabled={!!folderId}
          style={{
            padding: "8px 14px", borderRadius: 6, cursor: folderId ? "not-allowed" : "pointer",
            background: requestType === "school_level" ? "#1e3a5f" : "#fff",
            color:      requestType === "school_level" ? "#fff" : "#475569",
            border: `1px solid ${requestType === "school_level" ? "#1e3a5f" : "#cbd5e1"}`,
            fontWeight: 700, fontSize: 13,
          }}
        >בריף בית-ספרי</button>
        <button
          onClick={() => setRequestType("new_course")}
          style={{
            padding: "8px 14px", borderRadius: 6, cursor: "pointer",
            background: requestType === "new_course" ? "#1e3a5f" : "#fff",
            color:      requestType === "new_course" ? "#fff" : "#475569",
            border: `1px solid ${requestType === "new_course" ? "#1e3a5f" : "#cbd5e1"}`,
            fontWeight: 700, fontSize: 13,
          }}
        >בריף קורס חדש</button>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 13 }}>
        <label>
          <input type="radio" name="brief_type" checked={briefType === "structured_form"}
                 onChange={() => setBriefType("structured_form")} /> שדות מובנים
        </label>
        <label>
          <input type="radio" name="brief_type" checked={briefType === "document_upload"}
                 onChange={() => setBriefType("document_upload")} /> העלאת Word / PDF
        </label>
      </div>

      {briefType === "document_upload" && (
        <Field label="קישור לקובץ הבריף (Storage URL)" hint="התקנה ב-Phase 2.1: העלאה ישירה ל-Supabase Storage bucket campaign-briefs">
          <input style={inputStyle} value={briefDocUrl} onChange={e => setBriefDocUrl(e.target.value)} placeholder="https://..." />
        </Field>
      )}

      {briefType === "structured_form" && requestType === "school_level" && (
        <>
          <Field label="שמות הקורסים שיש לקדם (כל אחד בשורה)">
            <textarea style={{ ...inputStyle, minHeight: 80 }} value={courseNames} onChange={e => setCourseNames(e.target.value)} />
          </Field>
          <Field label="סילבוסים / נושאי קורסים">
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={syllabi} onChange={e => setSyllabi(e.target.value)} />
          </Field>
          <Field label="קהלי יעד עיקריים (כל אחד בשורה)">
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={audiences} onChange={e => setAudiences(e.target.value)} />
          </Field>
          <div style={{ display: "flex", gap: 12 }}>
            <Field label="תקציב שנתי (₪)">
              <input style={inputStyle} type="number" value={annualBudget} onChange={e => setAnnualBudget(e.target.value)} />
            </Field>
            <Field label="תקציב חודשי (₪)">
              <input style={inputStyle} type="number" value={monthlyBudget} onChange={e => setMonthlyBudget(e.target.value)} />
            </Field>
          </div>
          <Field label="מדיות חשובות (מופרדות בפסיק)" hint="meta, google, tiktok, ...">
            <input style={inputStyle} value={importantMedia} onChange={e => setImportantMedia(e.target.value)} />
          </Field>
          <Field label="יעדים">
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={goals} onChange={e => setGoals(e.target.value)} />
          </Field>
        </>
      )}

      {briefType === "structured_form" && requestType === "new_course" && (
        <>
          <Field label="שם הקורס *">
            <input style={inputStyle} value={courseName} onChange={e => setCourseName(e.target.value)} required />
          </Field>
          <Field label="קהל יעד">
            <input style={inputStyle} value={audience} onChange={e => setAudience(e.target.value)} />
          </Field>
          <Field label="סילבוס">
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={syllabus} onChange={e => setSyllabus(e.target.value)} />
          </Field>
          <Field label="קישור לדף נחיתה">
            <input style={inputStyle} value={landingUrl} onChange={e => setLandingUrl(e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="מקור תקציב *">
            <select style={inputStyle} value={budgetSource} onChange={e => setBudgetSource(e.target.value)}>
              {BUDGET_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="מסר מרכזי / דגשים מיוחדים">
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={message} onChange={e => setMessage(e.target.value)} />
          </Field>
          <Field label="יעדים">
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={goals} onChange={e => setGoals(e.target.value)} />
          </Field>
          <Field label="דוגמאות למודעות שאהבו">
            <textarea style={{ ...inputStyle, minHeight: 50 }} value={adExamples} onChange={e => setAdExamples(e.target.value)} />
          </Field>
          <Field label="הערות">
            <textarea style={{ ...inputStyle, minHeight: 40 }} value={notes} onChange={e => setNotes(e.target.value)} />
          </Field>
        </>
      )}

      {error && (
        <div style={{ marginTop: 12, padding: 10, background: "#fee2e2", color: "#b91c1c", borderRadius: 6, fontSize: 13 }}>
          שגיאה: {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
        <button
          onClick={() => submit(true)} disabled={busy}
          style={{
            padding: "10px 18px", borderRadius: 6, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
            background: "#1e3a5f", color: "#fff", border: "none", fontSize: 14,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "שולח..." : "🚀 שליחה לביצוע"}
        </button>
      </div>
    </div>
  );
}

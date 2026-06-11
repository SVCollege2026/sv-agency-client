/**
 * NewRequestModal.jsx — חלון בקשה חדשה (מסך 5 מהמוקאפ).
 * טקסט חופשי · צירוף קובץ / קישור Drive · עדיפות · מועד רצוי · שליחה.
 * נשלח דרך דלת-הבקשות הקיימת (POST /api/workflow/requests) — בלי בחירת
 * מחלקה: המשרד מנתב לבד. שיוך לתיקייה הוא אופציונלי (פעילות בית-ספרית
 * כברירת-מחדל). טופס-הבריף המלא נשאר נגיש מכאן עד שיוחלף.
 */
import React, { useEffect, useRef, useState } from "react";
import { submitRequest, uploadBriefFile } from "../api.js";
import { courseFolders } from "../lib.js";

const PRIORITY = [["normal", "רגילה"], ["high", "דחופה"], ["low", "נמוכה"]];

export default function NewRequestModal({ courses = [], folders = [], initialFolderId = null, onClose }) {
  const [text, setText] = useState("");
  const [folderId, setFolderId] = useState(initialFolderId || "");
  const [priority, setPriority] = useState("normal");
  const [dueDate, setDueDate] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const dialogRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    dialogRef.current?.querySelector("textarea")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!text.trim()) { setError("כתבי מה תרצי שהמשרד יבדוק או יבצע"); return; }
    setBusy(true);
    setError(null);
    try {
      let docUrl = driveUrl.trim() || null;
      let docName = docUrl ? "קישור Drive" : null;
      if (file) {
        const up = await uploadBriefFile(file);
        docUrl = up.access_url || up.path;
        docName = up.name || file.name;
      }
      await submitRequest({
        folderId: folderId || null,
        requestType: folderId ? "course_activity" : "school_level",
        briefPayload: {
          free_text: text.trim(),
          priority,
          desired_date: dueDate || null,
          source: "manager_interface",
        },
        briefDocUrl: docUrl,
        briefDocName: docName,
      });
      setDone("הבקשה נשלחה למשרד — תופיע ב\"מה מחכה לך עכשיו\" ברגע שתידרש החלטה");
    } catch (e) {
      setError(`השליחה נכשלה: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mi-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mi-modal" role="dialog" aria-modal="true" ref={dialogRef}
           aria-label="בקשה חדשה"
           style={{ maxInlineSize: 520 }}>
        <div style={{ display: "flex", alignItems: "center", marginBlockEnd: 12 }}>
          <h2 className="mi-h2" style={{ fontSize: 18, flex: 1 }}>
            בקשה חדשה
          </h2>
          <button className="mi-btn mi-btn-ghost" aria-label="סגירה" onClick={onClose}>✕</button>
        </div>

        {done ? (
          <>
            <p className="mi-body" role="status" style={{
                 background: "var(--mi-success-bg)", color: "var(--mi-success)",
                 borderRadius: 10, padding: "12px 14px" }}>
              ✓ {done}
            </p>
            <div className="mi-actionbar" style={{ padding: 0, border: "none", marginBlockStart: 14 }}>
              <button className="mi-btn mi-btn-primary" onClick={onClose}
                      style={{ flex: 1, justifyContent: "center" }}>סגירה</button>
            </div>
          </>
        ) : (
        <>
          <label className="mi-field-label" htmlFor="nr-text">
            מה תרצי שהמשרד יבדוק או יבצע?
          </label>
          <textarea id="nr-text" className="mi-textarea" value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="לדוגמה: יש לנו רעיון לסרטון קצר עם בוגרת. אני רוצה לבדוק אותו לקמפיין יולי." />

          <div style={{ display: "flex", gap: 8, marginBlockStart: 12, flexWrap: "wrap" }}>
            <button type="button" className="mi-btn mi-btn-secondary"
                    onClick={() => fileRef.current?.click()}>
              📎 {file ? file.name : "צרפי קובץ"}
            </button>
            <input ref={fileRef} type="file" hidden
                   onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <input className="mi-field" type="url" dir="ltr" value={driveUrl}
                   onChange={(e) => setDriveUrl(e.target.value)}
                   placeholder="או קישור מ-Drive"
                   aria-label="קישור מ-Drive"
                   style={{ flex: 1, minInlineSize: 180 }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBlockStart: 12 }}>
            <div>
              <label className="mi-field-label" htmlFor="nr-priority">עדיפות</label>
              <select id="nr-priority" className="mi-field" value={priority}
                      onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mi-field-label" htmlFor="nr-date">מועד רצוי</label>
              <input id="nr-date" className="mi-field" type="date" value={dueDate}
                     onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBlockStart: 12 }}>
            <label className="mi-field-label" htmlFor="nr-folder">שיוך (לא חובה)</label>
            <select id="nr-folder" className="mi-field" value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}>
              <option value="">פעילות בית-ספרית (כללי)</option>
              {/* קורס מנוהל ⇒ תיקיית-העבודה העדכנית שלו */}
              {courses.map((key) => {
                const latest = courseFolders(key, folders)[0];
                return latest
                  ? <option key={key} value={latest.id}>{key}</option>
                  : null;
              })}
            </select>
          </div>

          {error && (
            <p className="mi-meta" role="alert"
               style={{ color: "var(--mi-danger)", marginBlockStart: 10 }}>{error}</p>
          )}

          <div className="mi-actionbar" style={{ padding: 0, border: "none", marginBlockStart: 16 }}>
            <button className="mi-btn mi-btn-primary" disabled={busy} onClick={submit}
                    style={{ flex: 1, justifyContent: "center" }}>
              {busy ? "שולחת…" : "שליחת הבקשה"}
            </button>
            <button className="mi-btn mi-btn-ghost" disabled={busy} onClick={onClose}>ביטול</button>
          </div>
          <p className="mi-meta" style={{ marginBlockStart: 10 }}>
            צריך בריף מלא ומפורט?{" "}
            <a href="/media-reports?tab=marketing&sub=intake"
               style={{ color: "var(--mi-primary)" }}>טופס הבריף המלא</a>
          </p>
        </>
        )}
      </div>
    </div>
  );
}

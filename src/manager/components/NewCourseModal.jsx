/**
 * NewCourseModal.jsx — "+ פתיחת קורס חדש" פעיל (סעיף ב.7 בפרומפט המאוחד).
 * טופס קצר: שם · קישור תיקיית-Drive · תאריך-עלייה · תקציב.
 * הזרימה הקיימת בשרת: ① יצירת תיקייה (campaign_folders — הקורס מופיע בסרגל
 * מהדאטה מיד) ② בריף new_course לתוכה (workflow/requests → רצף המחלקות).
 * סריקת-Drive בקרון = שלב המשך, לא כאן.
 */
import React, { useEffect, useRef, useState } from "react";
import { createFolder, submitRequest } from "../api.js";

export default function NewCourseModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [goLiveDate, setGoLiveDate] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    dialogRef.current?.querySelector("input")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!name.trim()) { setError("שם הקורס חובה"); return; }
    setBusy(true);
    setError(null);
    try {
      const folder = await createFolder({
        courseName: name.trim(),
        plannedGoLiveDate: goLiveDate || null,
        metadata: { ui: "manager_interface_new_course" },
      });
      await submitRequest({
        folderId: folder.id,
        requestType: "new_course",
        briefPayload: {
          course_name: name.trim(),
          drive_folder_url: driveUrl.trim() || null,
          planned_go_live_date: goLiveDate || null,
          budget: budget ? Number(budget) : null,
          source: "manager_interface_new_course",
        },
        briefDocUrl: driveUrl.trim() || null,
        briefDocName: driveUrl.trim() ? "תיקיית חומרי הקורס ב-Drive" : null,
      });
      setDone(true);
      onCreated?.();
    } catch (e) {
      setError(`הפתיחה נכשלה: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mi-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mi-modal" role="dialog" aria-modal="true" ref={dialogRef}
           aria-label="פתיחת קורס חדש" style={{ maxInlineSize: 520 }}>
        <div style={{ display: "flex", alignItems: "center", marginBlockEnd: 12 }}>
          <h2 className="mi-h2" style={{ fontSize: 18, flex: 1 }}>פתיחת קורס חדש</h2>
          <button className="mi-btn mi-btn-ghost" aria-label="סגירה" onClick={onClose}>✕</button>
        </div>

        {done ? (
          <>
            <p className="mi-body" role="status" style={{
                 background: "var(--mi-success-bg)", color: "var(--mi-success)",
                 borderRadius: 10, padding: "12px 14px" }}>
              ✓ הקורס "{name.trim()}" נפתח — התיקייה כבר בסרגל, והמשרד התחיל לעבוד.
              כל דבר שידרוש החלטה שלך יופיע ב"מה מחכה לך עכשיו".
            </p>
            <div className="mi-actionbar" style={{ padding: 0, border: "none", marginBlockStart: 14 }}>
              <button className="mi-btn mi-btn-primary" onClick={onClose}
                      style={{ flex: 1, justifyContent: "center" }}>סגירה</button>
            </div>
          </>
        ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="mi-field-label" htmlFor="nc-name">שם הקורס</label>
              <input id="nc-name" className="mi-field" value={name}
                     onChange={(e) => setName(e.target.value)}
                     placeholder='לדוגמה: "דאטה אנליסט"' />
            </div>
            <div>
              <label className="mi-field-label" htmlFor="nc-drive">קישור תיקיית החומרים ב-Drive</label>
              <input id="nc-drive" className="mi-field" type="url" dir="ltr" value={driveUrl}
                     onChange={(e) => setDriveUrl(e.target.value)}
                     placeholder="https://drive.google.com/…" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="mi-field-label" htmlFor="nc-date">תאריך-עלייה מתוכנן</label>
                <input id="nc-date" className="mi-field" type="date" value={goLiveDate}
                       onChange={(e) => setGoLiveDate(e.target.value)} />
              </div>
              <div>
                <label className="mi-field-label" htmlFor="nc-budget">תקציב (₪)</label>
                <input id="nc-budget" className="mi-field" type="number" min="0" dir="ltr"
                       value={budget} onChange={(e) => setBudget(e.target.value)}
                       placeholder="לדוגמה: 50000" />
              </div>
            </div>
          </div>

          {error && (
            <p className="mi-meta" role="alert"
               style={{ color: "var(--mi-danger)", marginBlockStart: 10 }}>{error}</p>
          )}

          <div className="mi-actionbar" style={{ padding: 0, border: "none", marginBlockStart: 16 }}>
            <button className="mi-btn mi-btn-primary" disabled={busy} onClick={submit}
                    style={{ flex: 1, justifyContent: "center" }}>
              {busy ? "פותחת…" : "פתיחת הקורס"}
            </button>
            <button className="mi-btn mi-btn-ghost" disabled={busy} onClick={onClose}>ביטול</button>
          </div>
        </>
        )}
      </div>
    </div>
  );
}

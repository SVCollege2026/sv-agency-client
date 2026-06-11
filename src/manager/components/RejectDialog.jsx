/**
 * RejectDialog.jsx — "לתקן": דחיית גרסה מחייבת סיבה (חוזה request-revision).
 * מודאל נגיש: לוכד פוקוס, Esc סוגר, התראה ב-aria.
 */
import React, { useEffect, useRef, useState } from "react";

export default function RejectDialog({ item, onConfirm, onClose, busy }) {
  const [reason, setReason] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector("textarea")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const valid = reason.trim().length > 0;

  return (
    <div className="mi-modal-backdrop" onClick={onClose}>
      <div className="mi-modal" ref={ref} role="dialog" aria-modal="true"
           aria-label="שליחת בקשת שינויים" onClick={(e) => e.stopPropagation()}>
        <h3 className="mi-h2">שליחת בקשת שינויים</h3>
        <p className="mi-body" style={{ marginBlock: 8 }}>
          {item.title}
          {item.version != null && <> · <span className="mi-ltr">V{item.version}</span></>}
        </p>
        <label className="mi-meta" htmlFor="mi-reject-reason" style={{ display: "block", marginBlockEnd: 4 }}>
          מה לתקן? (חובה — ההערה עוברת למשרד)
        </label>
        <textarea id="mi-reject-reason" className="mi-textarea" value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="לדוגמה: הלוגו קטן מדי, להגדיל. הניסוח קצת מאיים — אפשר חיובי יותר." />
        <div style={{ display: "flex", gap: 8, marginBlockStart: 16, justifyContent: "flex-end" }}>
          <button className="mi-btn mi-btn-ghost" onClick={onClose} disabled={busy}>
            ביטול
          </button>
          <button className="mi-btn mi-btn-primary" disabled={!valid || busy}
                  onClick={() => onConfirm(reason.trim())}>
            {busy ? "שולחת…" : "שליחת בקשת שינויים"}
          </button>
        </div>
      </div>
    </div>
  );
}

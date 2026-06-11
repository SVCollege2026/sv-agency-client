/**
 * EmergencyStopButton.jsx — כפתור עצירת-חירום ליד כל קמפיין (EMERGENCY-STOP-HAND-3)
 * ===================================================================================
 * המדיניות: לחיצת מנהלת-השיווק = האישור (פעולה אנושית מפורשת). לכן:
 *   • אישור-לחיצה כפול — הכפתור פותח דיאלוג "לעצור את X?" עם אישור אדום מפורש.
 *   • אחרי ביצוע: המערכת עוצרת במטא → read-back → מוצג "נעצר ע"י מנהלת השיווק"
 *     + כפתור החזרה-לאוויר (אותו מסלול בכיוון ההפוך, גם הוא באישור כפול).
 *   • mobile-first: יעדי-מגע ≥44px, דיאלוג כ-bottom-sheet במסכים צרים — לחיץ גם
 *     מהטלפון בשבת.
 *
 * Meta בלבד (היד-הכותבת תומכת רק במטא) — פלטפורמות אחרות לא מציגות כפתור.
 * כל קריאה נושאת operator="marketing_manager" — צד השרת חוסם כל זהות שאינה
 * מפעיל אנושי מזוהה (סוכנים אסורים בקוד).
 */
import React, { useState } from "react";
import { emergencyStopPause, emergencyStopResume } from "../../api.js";

const OPERATOR = "marketing_manager";

const palette = {
  red: "#dc2626",
  redDark: "#b91c1c",
  redBg: "#fef2f2",
  redBorder: "#fecaca",
  green: "#16a34a",
  greenBg: "#f0fdf4",
  greenBorder: "#bbf7d0",
  fg: "#0f172a",
  fgMuted: "#64748b",
};

/** דיאלוג אישור כפול — overlay מלא, כפתורים גדולים (mobile-first). */
function ConfirmDialog({ title, body, confirmLabel, confirmColor, busy, onConfirm, onCancel }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        direction: "rtl",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: "16px 16px 0 0", width: "100%",
        maxWidth: 480, padding: "20px 18px calc(18px + env(safe-area-inset-bottom, 0px))",
        boxShadow: "0 -8px 30px rgba(0,0,0,0.25)",
      }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: palette.fg, marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 14, color: palette.fgMuted, lineHeight: 1.7, marginBottom: 18 }}>
          {body}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              minHeight: 48, borderRadius: 12, border: "none", cursor: busy ? "wait" : "pointer",
              background: confirmColor, color: "#fff", fontSize: 16, fontWeight: 700,
              opacity: busy ? 0.7 : 1, width: "100%",
            }}
          >
            {busy ? "מבצע…" : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              minHeight: 48, borderRadius: 12, border: "1px solid #e2e8f0",
              background: "#fff", color: palette.fg, fontSize: 15, fontWeight: 600,
              cursor: busy ? "wait" : "pointer", width: "100%",
            }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * props:
 *   platform     — "meta" בלבד מציג כפתור (הוא היחיד שהיד תומכת בו)
 *   campaignId   — מזהה הקמפיין במטא (target_id)
 *   campaignName — לשאלת האישור ("לעצור את X?")
 *   stopInfo     — רשומת stop מ-GET /api/media/emergency-stop/active (או null)
 *   onChanged    — נקרא אחרי פעולה מוצלחת (ההורה מרענן את רשימת העצורים)
 */
export default function EmergencyStopButton({ platform, campaignId, campaignName, stopInfo, onChanged }) {
  const [confirming, setConfirming] = useState(null); // null | "stop" | "resume"
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);         // הודעת תוצאה אחרונה (message_he)
  const [error, setError] = useState(null);

  if ((platform || "").toLowerCase() !== "meta" || !campaignId) return null;

  const stopped = !!stopInfo;
  const name = campaignName || campaignId;

  async function run(kind) {
    setBusy(true);
    setError(null);
    try {
      const call = kind === "stop" ? emergencyStopPause : emergencyStopResume;
      const out = await call({
        target_type: "campaign",
        target_id: String(campaignId),
        target_name: name,
        operator: OPERATOR,
        reason: kind === "stop" ? "עצירת חירום מהממשק" : "החזרה לאוויר מהממשק",
      });
      setResult(out.message_he || "");
      // ביצוע אמיתי או noop — שניהם משנים/מאשררים מצב; חסם (executed=false+blockers) — שגיאה.
      if (out.executed === false && (out.blockers || []).length) {
        setError(out.message_he || "הפעולה נחסמה");
      } else if (onChanged) {
        onChanged();
      }
      setConfirming(null);
    } catch (e) {
      setError(e.message || "שגיאת שרת");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      {stopped ? (
        <>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: palette.redBg, border: `1px solid ${palette.redBorder}`,
            color: palette.redDark, borderRadius: 999, padding: "4px 10px",
            fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
          }}>
            ⏸ נעצר ע"י מנהלת השיווק
          </span>
          <button
            type="button"
            onClick={() => setConfirming("resume")}
            disabled={busy}
            style={{
              minHeight: 44, minWidth: 44, padding: "6px 14px", borderRadius: 10,
              border: `1px solid ${palette.greenBorder}`, background: palette.greenBg,
              color: palette.green, fontSize: 13, fontWeight: 700, cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            ▶ החזרה לאוויר
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming("stop")}
          disabled={busy}
          aria-label={`עצירת חירום — ${name}`}
          style={{
            minHeight: 44, minWidth: 44, padding: "6px 14px", borderRadius: 10,
            border: "none", background: palette.red, color: "#fff",
            fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            boxShadow: "0 1px 3px rgba(220,38,38,0.4)",
          }}
        >
          ⏹ עצירת חירום
        </button>
      )}

      {error && (
        <span style={{ fontSize: 11, color: palette.redDark, maxWidth: 220, lineHeight: 1.5 }}>
          ⚠ {error}
        </span>
      )}
      {!error && result && (
        <span style={{ fontSize: 11, color: palette.fgMuted, maxWidth: 220, lineHeight: 1.5 }}>
          {result}
        </span>
      )}

      {confirming === "stop" && (
        <ConfirmDialog
          title={`לעצור את ${name}?`}
          body={`הלחיצה שלך היא האישור: המערכת תעצור את הקמפיין במטא מיד, תאמת מול הפלטפורמה, ותציג "נעצר ע"י מנהלת השיווק". אפשר להחזיר לאוויר בכל רגע.`}
          confirmLabel="כן — לעצור עכשיו"
          confirmColor={palette.red}
          busy={busy}
          onConfirm={() => run("stop")}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === "resume" && (
        <ConfirmDialog
          title={`להחזיר את ${name} לאוויר?`}
          body="הקמפיין יחזור למצב שבו היה לפני העצירה, והמערכת תאמת מול מטא שהשינוי נקלט."
          confirmLabel="כן — להחזיר לאוויר"
          confirmColor={palette.green}
          busy={busy}
          onConfirm={() => run("resume")}
          onCancel={() => setConfirming(null)}
        />
      )}
    </span>
  );
}

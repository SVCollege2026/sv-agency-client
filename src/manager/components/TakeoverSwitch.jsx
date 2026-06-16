/**
 * TakeoverSwitch.jsx — מתג-אישור-ההשתלטות הבולט (§7 + הכרעת-נירית 17/06).
 *
 * ⚠ השער **גלובלי לחשבון** (אומת מול agents/workflow/takeover_gate.py):
 *   אישור-ההשתלטות הראשון מדליק את ניהול-החשבון האוטומטי **כולו** — שרשרת-
 *   הבוקר, סנכרון-הקהלים וההמלצות — לא רק קורס בודד. לכן ההודעה משתנה:
 *   • אישור-ראשון (החשבון עוד כבוי) = "מדליק את ניהול-החשבון כולו".
 *   • החשבון כבר דלוק           = "מעלה את הקורס הזה לאוויר" (לא מרמז על שער פר-קורס).
 *   • הקורס כבר עלה (folder live) = "הקורס עלה לאוויר" + "ניהול-החשבון פעיל".
 *
 * ⚠ אישור ≠ עלייה-לאוויר: אישור-עם-תאריך-עתידי מתזמן (folder=ready_to_launch),
 *   לא מעלה מיד. לכן מצב-"עלה לאוויר" נגזר מ-**courseLive** (סטטוס-התיקייה),
 *   לא מסטטוס-ההקצאה. אושר-וטרם-עלה = "אושר, ממתין לעלייה" (לא טענת-live שקרית).
 *
 * המנגנון אינו חדש: אישור = אישור הקצאות-ההשתלטות (recommendation_kind=
 * takeover_redeploy) של הקורס דרך decideAllocation('approved') — מה שמחווט
 * בשרת ל-request_go_live. תצוגה + פעולה בלבד; הגידור האמיתי בשרת, fail-closed.
 */
import React, { useState } from "react";
import { fullDate } from "../lib.js";

const today = () => new Date().toISOString().slice(0, 10);

/** שורת-✓ של הראיות (מתוך חבילת-המוכנות §7). ✓ מוכן · ✗ חסר — לא צבע-בלבד. */
function EvidenceRow({ checklist }) {
  const items = [
    ["תקציב", checklist.budget_recommended],
    ["קהלים", checklist.audiences_ready],
    ["קראייטיב + עיצוב", checklist.creative_ready],
    ["טופס", checklist.form_present],
    ["צילומי-מסך", checklist.screenshots_clean],
  ];
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBlockEnd: 10 }}>
      {items.map(([label, ok]) => (
        <span key={label} className={`mi-chip ${ok ? "mi-chip-success" : "mi-chip-warning"}`}
              style={{ whiteSpace: "nowrap" }}>
          {ok ? "✓ " : "✗ "}{label}
        </span>
      ))}
    </div>
  );
}

export default function TakeoverSwitch({
  courseName, state, accountOn, accountKnown, courseLive, plannedGoLiveDate,
  readiness, busy, onApprove, onReject, onPrepare,
}) {
  const [dateOpen, setDateOpen] = useState(false);
  const [date, setDate] = useState("");
  const [override, setOverride] = useState(false); // שחרור דגל-QA שגוי

  const checklist = readiness?.readiness?.checklist || {};
  const blocked = !!readiness?.readiness?.go_live_blocked;
  const blockingFlags = readiness?.readiness?.blocking_flags || [];
  const { proposals = [], approved } = state || {};

  /* ── מצב ג': הקורס כבר אושר ── */
  if (approved) {
    // אושר **ועלה בפועל** (סטטוס-התיקייה live) — מול אושר-וטרם-עלה (תוזמן/ממתין).
    if (courseLive) {
      return (
        <section className="mi-card" role="status"
                 style={{ padding: 16, marginBlockEnd: 16, borderColor: "transparent",
                          background: "var(--mi-success-bg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 22 }} aria-hidden="true">✓</span>
            <h2 className="mi-h2" style={{ margin: 0, color: "var(--mi-success)" }}>
              הקורס עלה לאוויר — המשרד מנהל אותו
            </h2>
          </div>
          <p className="mi-meta" style={{ marginBlockStart: 6, color: "var(--mi-success)" }}>
            ניהול-החשבון האוטומטי פעיל: שרשרת-הבוקר, סנכרון-הקהלים וההמלצות רצים.
          </p>
        </section>
      );
    }
    // אושר אך טרם עלה — תוזמן לתאריך עתידי, או ממתין להשלמת-עלייה. לא טוענים "live".
    return (
      <section className="mi-card" role="status"
               style={{ padding: 16, marginBlockEnd: 16, borderColor: "transparent",
                        background: "var(--mi-info-bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">✓</span>
          <h2 className="mi-h2" style={{ margin: 0, color: "var(--mi-info)" }}>
            ההשתלטות אושרה — {plannedGoLiveDate
              ? <>הקורס יעלה לאוויר ב-<span className="mi-ltr">{fullDate(plannedGoLiveDate)}</span></>
              : "הקורס ממתין לעלייה-לאוויר"}
          </h2>
        </div>
        <p className="mi-meta" style={{ marginBlockStart: 6, color: "var(--mi-info)" }}>
          ניהול-החשבון האוטומטי כבר פעיל (שרשרת-הבוקר, סנכרון-הקהלים, ההמלצות).
        </p>
      </section>
    );
  }

  /* ── מצב א': אין עדיין תוכנית-השתלטות לקורס ── */
  if (proposals.length === 0) {
    return (
      <section className="mi-card" style={{ padding: 16, marginBlockEnd: 16 }}>
        <h2 className="mi-h2" style={{ marginBlockEnd: 6 }}>אישור השתלטות לקורס</h2>
        <p className="mi-body" style={{ marginBlockEnd: 12 }}>
          המשרד טרם הכין תוכנית-השתלטות לקורס. לחצי כדי שהאסטרטג יבנה אותה —
          תקציב, קהלים, קראייטיב — ותחזור אלייך לאישור.
        </p>
        {accountKnown && accountOn && (
          <p className="mi-meta" style={{ marginBlockEnd: 12 }}>
            ניהול-החשבון האוטומטי כבר פעיל (אושר בקורסים אחרים).
          </p>
        )}
        <button className="mi-btn mi-btn-secondary" disabled={busy?.preparing}
                onClick={onPrepare}>
          {busy?.preparing ? "האסטרטג מכין…" : "הכן תוכנית השתלטות"}
        </button>
      </section>
    );
  }

  /* ── מצב ב': הצעת-השתלטות מוכנה — המתג ── */
  // firstApproval נטען רק כשמצב-החשבון **ידוע** (אחרת לא טוענים "ראשון" בטעות).
  const firstApproval = accountKnown && !accountOn;
  const accountAlreadyOn = accountKnown && accountOn;
  const canApprove = !busy?.approving && (!blocked || override);

  return (
    <section className="mi-card"
             style={{ padding: 16, marginBlockEnd: 16,
                      borderColor: firstApproval ? "var(--mi-primary)" : "var(--mi-border)",
                      borderWidth: firstApproval ? 2 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                    marginBlockEnd: 8 }}>
        <span style={{ fontSize: 20 }} aria-hidden="true">{firstApproval ? "🔑" : "🚀"}</span>
        <h2 className="mi-h2" style={{ margin: 0 }}>אישור השתלטות לקורס</h2>
      </div>

      {/* ההסבר המהותי — תלוי במצב-החשבון הגלובלי (ורק כשהוא ידוע) */}
      {firstApproval ? (
        <div role="note" style={{ background: "var(--mi-primary-soft)", color: "var(--mi-primary)",
             borderRadius: 10, padding: "12px 14px", marginBlockEnd: 12 }}>
          <strong>זהו אישור-ההשתלטות הראשון.</strong> אישורו מדליק את <strong>ניהול-החשבון
          האוטומטי כולו</strong> — שרשרת-הבוקר, סנכרון-הקהלים וההמלצות — ומעלה את הקורס
          הזה לאוויר. מרגע זה המשרד מנהל את החשבון; את מאשרת תוצרים, לא כל צעד.
        </div>
      ) : accountAlreadyOn ? (
        <p className="mi-body" style={{ marginBlockEnd: 12 }}>
          ניהול-החשבון האוטומטי כבר פעיל. אישור זה מעלה את <strong>הקורס הזה</strong> לאוויר.
        </p>
      ) : (
        <p className="mi-body" style={{ marginBlockEnd: 12 }}>
          אישור ההשתלטות מעלה את הקורס לאוויר ומפעיל את ניהול-החשבון האוטומטי של המשרד.
        </p>
      )}

      <p className="mi-meta" style={{ marginBlockEnd: 8 }}>
        כל מה שצריך לראות לפני אישור מופיע למעלה (תקציב · קהלים · קראייטיב · טופס · צילומים):
      </p>
      <EvidenceRow checklist={checklist} />

      {/* חסימת-QA: המכונה סימנה חשד ויזואלי מאומת — התראה (טקסט בלבד) */}
      {blocked && (
        <>
          <div role="alert" style={{ background: "var(--mi-warning-bg)", color: "var(--mi-warning)",
               borderRadius: 10, padding: "10px 14px", marginBlockEnd: 8 }}>
            <strong>⚠ המכונה סימנה חשד בקראייטיב</strong> — הקמפיין חסום לעלייה עד תיקון.
            {blockingFlags.length > 0 && (
              <ul style={{ margin: "6px 0 0", paddingInlineStart: 18 }}>
                {blockingFlags.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            )}
          </div>
          {/* פקד-השחרור מחוץ ל-role="alert" (לא מטמיעים פקד אינטראקטיבי בהתראה) */}
          <label className="mi-meta" style={{ display: "flex", alignItems: "center", gap: 6,
                 marginBlockEnd: 12, color: "var(--mi-warning)", cursor: "pointer" }}>
            <input type="checkbox" checked={override}
                   onChange={(e) => setOverride(e.target.checked)} />
            הסימון שגוי — הקראייטיב תקין, אאשר באחריותי
          </label>
        </>
      )}

      {/* פעולות */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="mi-btn mi-btn-primary" disabled={!canApprove}
                onClick={() => onApprove(null)}
                style={{ minInlineSize: 180, justifyContent: "center" }}>
          {busy?.approving ? "מאשרת…" : (firstApproval ? "אשרי השתלטות — הדלקת ניהול-החשבון" : "אשרי — העלאת הקורס לאוויר")}
        </button>
        <button className="mi-btn mi-btn-ghost" disabled={!canApprove}
                onClick={() => setDateOpen((o) => !o)}>
          אשרי מתאריך…
        </button>
        <button className="mi-btn mi-btn-ghost" disabled={busy?.approving}
                onClick={onReject}>
          החזרה לאסטרטג
        </button>
      </div>

      {/* override פר-קמפיין (§7): "מאושר אבל מתאריך Y" */}
      {dateOpen && (
        <div style={{ marginBlockStart: 10 }}>
          <label className="mi-field-label" htmlFor="ts-golive">תאריך עלייה-לאוויר</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input id="ts-golive" type="date" className="mi-field" value={date} min={today()}
                   style={{ inlineSize: "auto" }}
                   onChange={(e) => setDate(e.target.value)} />
            <button className="mi-btn mi-btn-secondary" disabled={!date || !canApprove}
                    onClick={() => onApprove(date)}>
              אשרי לתאריך זה
            </button>
            <span className="mi-meta">הקורס יעלה לאוויר ביום שתבחרי, לא מיד.</span>
          </div>
        </div>
      )}
    </section>
  );
}

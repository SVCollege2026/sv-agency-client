/**
 * RecommendationDrawer.jsx — ההמלצה המלאה, מול העיניים, עם כפתורי ההחלטה לידה.
 * נפתח בלחיצה על כרטיס המלצה בתיבת האישורים: טקסט ההמלצה והנימוק, המספרים
 * (תקציב/תחזית/חריגה, פירוט פר-פלטפורמה), על איזה קורס, מי המליץ ומתי.
 * ההחלטה מתקבלת מול התוכן — לא מול כותרת.
 *
 * הנתונים: GET /api/recommendations/{id} (השורה המלאה). אפס נתונים מומצאים —
 * סקשן שאין לו דאטה לא מוצג.
 */
import React, { useEffect, useRef, useState } from "react";
import { getRecommendation } from "../api.js";
import { ErrorBanner, SkeletonCard, timeAgoHe } from "./ui.jsx";

const URGENCY_HE = {
  critical:  ["קריטי",  "mi-chip-danger"],
  important: ["חשוב",   "mi-chip-warning"],
  normal:    ["רגיל",   "mi-chip-info"],
  idea:      ["רעיון",  "mi-chip-info"],
};

const CONFIDENCE_HE = { high: "ביטחון גבוה", medium: "ביטחון בינוני", low: "ביטחון נמוך" };

const PLATFORM_HE = { all: "כל הפלטפורמות", meta: "Meta", google: "Google" };

function fmtIls(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 0 })}` : null;
}

function Section({ title, children }) {
  return (
    <section style={{ marginBlockEnd: 18 }}>
      <h3 className="mi-h2" style={{ fontSize: 14, marginBlockEnd: 8 }}>{title}</h3>
      {children}
    </section>
  );
}

function NumberRow({ label, value }) {
  if (value == null) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12,
                  padding: "6px 0", borderBlockEnd: "1px solid var(--mi-border)" }}>
      <span className="mi-meta">{label}</span>
      <span className="mi-body mi-ltr" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/** המספרים של המלצת-תקציב — מ-data_window שנכתב ע"י שומרת התקציב. */
function BudgetNumbers({ dw }) {
  const rows = [
    ["תקציב מאושר (חודשי)",  fmtIls(dw.spend_approved)],
    ["הוצאה בפועל",          fmtIls(dw.spend_actual)],
    ["קצב יומי",             fmtIls(dw.daily_pace)],
    ["תחזית סוף-חודש",       fmtIls(dw.projected_month_end)],
    ["חריגה צפויה",          Number(dw.overage) > 0 ? fmtIls(dw.overage) : null],
    ["ניצול תקציב",          dw.utilization_pct != null ? `${Number(dw.utilization_pct).toFixed(0)}%` : null],
  ].filter(([, v]) => v != null);
  if (!rows.length) return null;
  return (
    <Section title="המספרים">
      <div className="mi-card" style={{ padding: "4px 14px" }}>
        {rows.map(([label, value]) => <NumberRow key={label} label={label} value={value} />)}
      </div>
      {dw.by_platform && Object.keys(dw.by_platform).length > 0 && (
        <div className="mi-card" style={{ padding: "4px 14px", marginBlockStart: 8 }}>
          {Object.entries(dw.by_platform).map(([plat, d]) => (
            <NumberRow key={plat}
                       label={PLATFORM_HE[plat] || plat}
                       value={[fmtIls(d.spend), d.leads != null ? `${d.leads} לידים` : null]
                         .filter(Boolean).join(" · ")} />
          ))}
        </div>
      )}
    </Section>
  );
}

/** מדד→ערך→רף מתוך ה-signal — להמלצות שאינן תקציב (למשל השהיית Google). */
function SignalNumbers({ signal }) {
  if (!signal?.metric || signal.value == null) return null;
  return (
    <Section title="המספרים">
      <div className="mi-card" style={{ padding: "4px 14px" }}>
        <NumberRow label={String(signal.metric)} value={String(signal.value)} />
        {signal.threshold != null && <NumberRow label="הרף שהוגדר" value={String(signal.threshold)} />}
      </div>
    </Section>
  );
}

export default function RecommendationDrawer({ item, busy, onApprove, onReject, onClose }) {
  const [rec, setRec] = useState(null);
  const [error, setError] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setRec(null);
    setError(null);
    getRecommendation(item.id)
      .then((r) => alive && setRec(r))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [item.id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const urgency = URGENCY_HE[rec?.urgency];
  const dw = rec?.data_window || {};
  const payload = rec?.recommendation_payload || {};

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
         style={{ position: "fixed", inset: 0, zIndex: 55, /* מתחת ל-RejectDialog (60) — "לתקן" נפתח מעל הפאנל */
                  background: "rgba(15,23,42,0.45)", display: "flex",
                  justifyContent: "flex-start" }}>
      <div role="dialog" aria-modal="true" aria-label={`המלצה — ${item.course || item.title}`}
           dir="rtl"
           style={{ background: "var(--mi-bg, #fff)", height: "100%",
                    width: "min(560px, 100vw)", boxShadow: "0 0 40px rgba(0,0,0,0.25)",
                    display: "flex", flexDirection: "column" }}>

        {/* ── כותרת ── */}
        <header style={{ padding: "16px 20px", borderBlockEnd: "1px solid var(--mi-border)",
                         display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBlockEnd: 8 }}>
              {item.course && <span className="mi-chip mi-chip-info">{item.course}</span>}
              {urgency && <span className={`mi-chip ${urgency[1]}`}>{urgency[0]}</span>}
              {rec?.platform && (
                <span className="mi-chip mi-chip-primary">
                  {PLATFORM_HE[rec.platform] || rec.platform}
                </span>
              )}
            </div>
            <h2 className="mi-h1" style={{ fontSize: 17, margin: 0 }}>המלצת מדיה</h2>
            <p className="mi-meta" style={{ margin: "4px 0 0" }}>
              {[item.source_he,
                rec?.created_at ? `נוצרה ${timeAgoHe(rec.created_at)}` : null,
                Number(rec?.times_seen) > 1 ? `הופיעה ב-${rec.times_seen} ריצות` : null,
                CONFIDENCE_HE[rec?.confidence_level]]
                .filter(Boolean).join(" · ")}
            </p>
          </div>
          <button ref={closeRef} className="mi-btn mi-btn-ghost" onClick={onClose}
                  aria-label="סגירה">✕</button>
        </header>

        {/* ── תוכן ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {error && <ErrorBanner errors={[{ source: error }]} />}
          {!error && !rec && <SkeletonCard lines={6} />}

          {rec && (
            <>
              <Section title="ההמלצה">
                <p className="mi-body" style={{ margin: 0, whiteSpace: "pre-line", lineHeight: 1.7 }}>
                  {rec.recommendation_text || item.title}
                </p>
              </Section>

              {rec.human_explanation && (
                <Section title="הנימוק המלא">
                  <p className="mi-body" style={{ margin: 0, whiteSpace: "pre-line", lineHeight: 1.7 }}>
                    {rec.human_explanation}
                  </p>
                </Section>
              )}

              {dw.spend_approved != null
                ? <BudgetNumbers dw={dw} />
                : <SignalNumbers signal={rec.signal} />}

              {payload.what && (
                <Section title="מה מוצע">
                  <p className="mi-body" style={{ margin: 0, whiteSpace: "pre-line" }}>{payload.what}</p>
                </Section>
              )}
              {payload.why && (
                <Section title="למה">
                  <p className="mi-body" style={{ margin: 0, whiteSpace: "pre-line" }}>{payload.why}</p>
                </Section>
              )}
              {(rec.expected_impact || payload.expected_impact) && (
                <Section title="השפעה צפויה">
                  <p className="mi-body" style={{ margin: 0, whiteSpace: "pre-line" }}>
                    {rec.expected_impact || payload.expected_impact}
                  </p>
                </Section>
              )}
              {rec.why_not_now && (
                <Section title="למה לא עכשיו">
                  <p className="mi-body" style={{ margin: 0, whiteSpace: "pre-line" }}>{rec.why_not_now}</p>
                </Section>
              )}
            </>
          )}
        </div>

        {/* ── ההחלטה — מול התוכן, לא מול כותרת ── */}
        <footer className="mi-actionbar"
                style={{ padding: "14px 20px", borderBlockStart: "1px solid var(--mi-border)",
                         display: "flex", gap: 10, position: "static" }}>
          <button className="mi-btn mi-btn-primary" disabled={busy || !rec}
                  onClick={() => onApprove(item)} style={{ flex: 1, justifyContent: "center" }}>
            ✓ אישור
          </button>
          <button className="mi-btn mi-btn-secondary" disabled={busy || !rec}
                  onClick={() => onReject(item)} style={{ flex: 1, justifyContent: "center" }}>
            ✎ לתקן
          </button>
        </footer>
      </div>
    </div>
  );
}

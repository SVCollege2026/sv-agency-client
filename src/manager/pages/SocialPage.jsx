/**
 * SocialPage.jsx — "קידומי סושיאל": פעילות שאינה קשורה לקורס ספציפי
 * (בקשות ותוצרים בית-ספריים). תקציב סושיאל הוא מקור-תקציב — ההקצאות
 * עצמן מנוהלות תחת "פריסות מדיה ותקציב".
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { getArtifacts, getBudgetSources } from "../api.js";
import { EmptyState, ErrorBanner, SkeletonCard, StatusChip } from "../components/ui.jsx";
import { fullDate, shortDate, typeHe } from "../lib.js";

const ils = (n) => (typeof n === "number" ? `₪${Math.round(n).toLocaleString()}` : "—");
const SOURCE_TYPE_HE = {
  from_existing:        "מתוך תקציב קיים",
  one_time:             "תקציב חד-פעמי",
  time_bound:           "תקציב לתקופה מוגדרת",
  dedicated:            "תקציב ייעודי",
  launch_then_ongoing:  "השקה ואז שוטף",
  undefined:            "מקור לא מוגדר",
};

export default function SocialPage() {
  const { openNewRequest } = useOutletContext() ?? {};
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [sources, setSources] = useState(null);
  const [error, setError] = useState(null);

  // סושיאל = פעילות בית-ספרית שאינה משויכת לקורס (folder_id ריק). מסירים רק תוצרי-
  // אסטרטגיה/מחקר/תקציב פנימיים שאינם "תוכן" — כל היתר (קראייטיב/קופי/פוסט/בקשות
  // בית-ספריות) מוצג. רשימת-החסימה רחבה מספיק שלא יחסום בקשות-תוכן אמיתיות (fix #9).
  const _isInternalNonContent = (t) =>
    /market_research|competitor|media_plan|media_deployment|budget|allocation|redeploy|forecast|strategy/i
      .test(t || "");

  const load = useCallback(() => {
    setError(null);
    getArtifacts({ limit: 200 })
      .then((rows) => setItems(rows.filter(
        (a) => !a.folder_id && !_isInternalNonContent(a.artifact_type))))
      .catch((e) => setError(e.message));
    // מקור-תקציב הסושיאל = מקורות בית-ספריים שאינם משויכים לקורס (folder_id ריק) —
    // קריאה-בלבד; ההקצאות עצמן מנוהלות תחת "פריסות מדיה ותקציב".
    getBudgetSources()
      .then((d) => {
        const list = Array.isArray(d) ? d : d?.sources ?? [];
        setSources(list.filter((s) => !s.folder_id));
      })
      .catch(() => setSources([]));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="mi-page">
      <header style={{ marginBlockEnd: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 className="mi-h1" style={{ fontSize: 22 }}>קידומי סושיאל</h1>
          <span style={{ flex: 1 }} />
          <button className="mi-btn mi-btn-primary" onClick={() => openNewRequest?.({})}>
            ＋ בקשה חדשה
          </button>
        </div>
        <p className="mi-meta" style={{ marginBlockStart: 4 }}>
          תוכן וקידום בית-ספריים שאינם משויכים לקורס. תקציב הסושיאל עצמו מנוהל תחת "תוכנית ותקציב".
        </p>
      </header>

      {error && <ErrorBanner errors={[{ source: error }]} onRetry={load} />}

      {/* מקור-תקציב הסושיאל — קריאה-בלבד (fix #9) */}
      {sources?.length > 0 && (
        <section aria-label="מקור תקציב סושיאל" style={{ marginBlockEnd: 16 }}>
          <h2 className="mi-h2" style={{ marginBlockEnd: 8 }}>מקור תקציב הסושיאל</h2>
          <div className="mi-cards-grid">
            {sources.map((s) => (
              <div key={s.id} className="mi-card"
                   style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <strong style={{ fontSize: 15, color: "var(--mi-ink)" }}>
                  {s.description || SOURCE_TYPE_HE[s.source_type] || "מקור תקציב"}
                </strong>
                <span className="mi-body mi-ltr" style={{ fontWeight: 700, color: "var(--mi-ink)" }}>
                  {ils(s.amount_ils)}
                </span>
                <span className="mi-meta">{SOURCE_TYPE_HE[s.source_type] || s.source_type}</span>
                {s.period_start && (
                  <span className="mi-meta mi-ltr">
                    {fullDate(s.period_start)} – {fullDate(s.period_end)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!error && items == null && <div aria-busy="true"><SkeletonCard lines={4} /></div>}

      {items?.length === 0 && (
        <EmptyState icon="📣" title="אין כרגע פעילות סושיאל בית-ספרית"
                    hint='בקשה חדשה בלי שיוך לקורס — תופיע כאן' />
      )}

      {items?.length > 0 && (
        <div className="mi-cards-grid">
          {items.map((a) => (
            <button key={a.id} className="mi-card"
                    onClick={() => navigate(`/media/items/${a.id}`)}
                    style={{ textAlign: "start", display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="mi-chip mi-chip-info">{typeHe(a.artifact_type)}</span>
                <StatusChip status={a.status} />
              </span>
              <strong style={{ fontSize: 14, color: "var(--mi-ink)" }}>
                {a.title || typeHe(a.artifact_type)}
              </strong>
              <span className="mi-meta mi-ltr">{shortDate(a.updated_at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

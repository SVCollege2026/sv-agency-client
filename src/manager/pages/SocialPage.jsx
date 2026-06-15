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

  // fix #3: סושיאל = תוכן בית-ספרי אמיתי שאינו משויך לקורס — לא פלט-מכונה פנימי.
  // עברנו מ"רשימת-חסימה" (שדלפו דרכה make_scenario / *_performance / takeover_plan /
  // limann / art_direction) ל**רשימת-היתר מפורשת** של סוגי-תוכן בלבד: נכסים, קופי,
  // ופעילות-סושיאל בית-ספרית. כל השאר לא מוצג.
  const _CONTENT_TYPES = new Set([
    "creative_rendered", "creative_asset", "creative", "visual", "video",
    "ad_copy_meta", "ad_copy_google", "ad_copy_tiktok", "copy",
    "school_level", "course_activity",
  ]);
  const _isContentType = (t) => {
    const k = String(t || "").toLowerCase();
    if (_CONTENT_TYPES.has(k)) return true;
    return /^ad_copy_/.test(k); // קופי לכל פלטפורמה עתידית
  };
  // פריטים בסטטוס פנימי/מת או בארכיון לא מוצגים כפעילות חיה.
  const _isDeadOrArchived = (s) =>
    /^(draft|internal_review|in_progress|superseded|archived|rejected)$/i.test(s || "");
  // שאריות ריצות-בדיקה (אותם מזהים כמו isTestFolder, על כותרת/שם-התוצר).
  const _isTestResidue = (a) =>
    /\btest\b|בדיקה|טסט|demo|דמו|\be2e\b|\bsim\b|\bdiag\b|sanity|integration/i
      .test(`${a?.title || ""} ${a?.artifact_type || ""}`);

  const load = useCallback(() => {
    setError(null);
    // limit מורם ל-500 (המקסימום בשרת): המסנן צד-לקוח, וברירת-המחדל 200 הסתירה
    // תוכן-אמיתי ישן יותר (sweep). השרת לא תומך ב-include-list רב-ערכי, לכן מסננים כאן.
    getArtifacts({ limit: 500 })
      .then((rows) => setItems(rows.filter(
        (a) => !a.folder_id && _isContentType(a.artifact_type)
               && !_isDeadOrArchived(a.status) && !_isTestResidue(a))))
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

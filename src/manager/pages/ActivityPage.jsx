/**
 * ActivityPage.jsx — "לכל הפעילות": יומן-ההחלטות המלא, מסונן למה
 * שרלוונטי למנהלת (החלטות-שלה + בוצע/טופל), בעברית עסקית.
 */
import React, { useCallback, useEffect, useState } from "react";
import { getRecentDecisions } from "../api.js";
import { EmptyState, ErrorBanner, SkeletonCard, timeAgoHe } from "../components/ui.jsx";
import { activityIcon, filterActivityForManager, fullDate } from "../lib.js";

export default function ActivityPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getRecentDecisions(200).then(setRows).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const visible = rows == null ? null
    : showAll ? rows : filterActivityForManager(rows);

  return (
    <div className="mi-page">
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                       marginBlockEnd: 16 }}>
        <h1 className="mi-h1" style={{ fontSize: 22 }}>פעילות</h1>
        <span style={{ flex: 1 }} />
        <label className="mi-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={showAll}
                 onChange={(e) => setShowAll(e.target.checked)} />
          הצגת כל פעילות-המערכת (כולל רעש פנימי)
        </label>
      </header>

      {error && <ErrorBanner errors={[{ source: error }]} onRetry={load} />}
      {!error && visible == null && <div aria-busy="true"><SkeletonCard lines={6} /></div>}

      {visible?.length === 0 && (
        <EmptyState icon="🕘" title="אין עדיין פעילות לתצוגה" />
      )}

      {visible?.length > 0 && (
        <div className="mi-card" style={{ padding: 8 }}>
          {visible.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 10, padding: "10px 12px",
                 borderBlockEnd: "1px solid var(--mi-border)", alignItems: "flex-start" }}>
              <span aria-hidden="true" style={{
                background: "var(--mi-accent-bg)", color: "var(--mi-accent)",
                borderRadius: 8, inlineSize: 28, blockSize: 28, fontSize: 13, flexShrink: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {activityIcon(r.decision_type)}
              </span>
              <span style={{ flex: 1, minInlineSize: 0 }}>
                <span className="mi-body" style={{ display: "block" }}>{r.display_he}</span>
                <span className="mi-meta">
                  <span className="mi-ltr">{fullDate(r.decided_at)}</span> · {timeAgoHe(r.decided_at)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

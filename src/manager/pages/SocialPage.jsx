/**
 * SocialPage.jsx — "קידומי סושיאל": פעילות שאינה קשורה לקורס ספציפי
 * (בקשות ותוצרים בית-ספריים). תקציב סושיאל הוא מקור-תקציב — ההקצאות
 * עצמן מנוהלות תחת "פריסות מדיה ותקציב".
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { getArtifacts } from "../api.js";
import { EmptyState, ErrorBanner, SkeletonCard, StatusChip } from "../components/ui.jsx";
import { shortDate, typeHe } from "../lib.js";

export default function SocialPage() {
  const { openNewRequest } = useOutletContext() ?? {};
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    // פריטים בית-ספריים = תוצרים בלי שיוך לתיקיית-קורס
    getArtifacts({ limit: 200 })
      .then((rows) => setItems(rows.filter((a) => !a.folder_id)))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="mi-page">
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 16 }}>
        <h1 className="mi-h1" style={{ fontSize: 22 }}>קידומי סושיאל</h1>
        <span style={{ flex: 1 }} />
        <button className="mi-btn mi-btn-primary" onClick={() => openNewRequest?.({})}>
          ＋ בקשה חדשה
        </button>
      </header>

      {error && <ErrorBanner errors={[{ source: error }]} onRetry={load} />}
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

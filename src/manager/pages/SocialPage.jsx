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

  // תוצרי-מדיה/תקציב (תוכנית-מדיה, המלצת-תקציב, תרחיש-Make, פריסה) אינם פעילות-סושיאל —
  // הם מנוהלים תחת "תוכנית ותקציב". סושיאל = תוכן בית-ספרי (קופי/קראייטיב/קידום).
  const _isMediaDeployment = (t) =>
    /media|budget|deploy|plan|scenario|allocation|forecast|redeploy/i.test(t || "");

  const load = useCallback(() => {
    setError(null);
    // פעילות-סושיאל בית-ספרית = תוצרי-תוכן בלי שיוך לקורס (לא תוצרי-מדיה/תקציב)
    getArtifacts({ limit: 200 })
      .then((rows) => setItems(rows.filter(
        (a) => !a.folder_id && !_isMediaDeployment(a.artifact_type))))
      .catch((e) => setError(e.message));
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

/**
 * CoursesPage.jsx — "כל הקורסים": כרטיס לכל קורס מנוהל-פעיל (מהיקף-הניהול
 * שב-DB, שם קנוני אחד). שער-הכניסה לסביבת-העבודה של כל קורס.
 */
import React, { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { getCycles } from "../api.js";
import { EmptyState, ErrorBanner, SkeletonCard } from "../components/ui.jsx";
import Icon, { courseIconName } from "../components/icons.jsx";
import {
  courseFolders, courseStatus, cyclesForCourse, folderStatus, monthHe,
  pctOfTarget, pickRelevantCycle,
} from "../lib.js";

export default function CoursesPage() {
  const { courses, folders, foldersError, openNewRequest } = useOutletContext() ?? {};
  const [cycles, setCycles] = useState(null);

  useEffect(() => {
    getCycles().then((d) => setCycles(d?.cycles ?? [])).catch(() => setCycles([]));
  }, []);

  return (
    <div className="mi-page">
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 16 }}>
        <h1 className="mi-h1" style={{ fontSize: 22 }}>כל הקורסים</h1>
        <span style={{ flex: 1 }} />
        <button className="mi-btn mi-btn-secondary"
                onClick={() => openNewRequest?.({ newCourse: true })}>
          ＋ פתיחת קורס חדש
        </button>
      </header>

      {foldersError && <ErrorBanner errors={[{ source: foldersError }]} />}
      {!(courses || []).length && !foldersError && (
        <div aria-busy="true"><SkeletonCard lines={4} /></div>
      )}

      {(courses || []).length === 0 && foldersError == null && cycles != null && (
        <EmptyState icon="🗂" title="עוד אין קורסים בניהול"
                    hint='פתיחת קורס ראשון — דרך "פתיחת קורס חדש"' />
      )}

      <div className="mi-cards-grid">
        {(courses || []).map((key) => {
          const [statusHe, statusCls] = folderStatus(courseStatus(key, folders || []));
          const cycle = pickRelevantCycle(cyclesForCourse(cycles || [], key));
          const pct = pctOfTarget(cycle);
          const month = monthHe(cycle?.start_date);
          return (
            <Link key={key} to={`/media/courses/${encodeURIComponent(key)}`}
                  className="mi-card"
                  style={{ display: "flex", flexDirection: "column", gap: 10,
                           textDecoration: "none", color: "inherit" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="mi-sidelink-icon" aria-hidden="true" style={{
                  inlineSize: 38, blockSize: 38,
                  background: "var(--mi-accent-bg)", color: "var(--mi-accent)" }}>
                  <Icon name={courseIconName(key)} size={19} />
                </span>
                <strong style={{ fontSize: 16, color: "var(--mi-ink)", flex: 1 }}>
                  {key}
                </strong>
                <span className={`mi-chip ${statusCls}`}>{statusHe}</span>
              </span>
              <span className="mi-meta">
                {pct != null
                  ? `קמפיין לידים ${month || ""} — ${pct}% מהיעד`.trim()
                  : cycle
                    ? `מחזור ${month || ""} — טרם הוגדר יעד`.trim()
                    : "טרם הוגדר מחזור"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

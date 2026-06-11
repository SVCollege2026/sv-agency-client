/**
 * CoursesPage.jsx — "כל הקורסים": כרטיס לכל קורס אמיתי (projection שמאחד
 * את תיקיות-העבודה שלו). שער-הכניסה לסביבת-העבודה. תיקיות-טסט לא מוצגות.
 */
import React, { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { getCycles } from "../api.js";
import { EmptyState, ErrorBanner, SkeletonCard } from "../components/ui.jsx";
import {
  courseTone, cyclesForCourse, folderStatus, groupFoldersByCourse,
  monthHe, pctOfTarget, pickRelevantCycle,
} from "../lib.js";

export default function CoursesPage() {
  const { folders, foldersError, openNewRequest } = useOutletContext() ?? {};
  const [cycles, setCycles] = useState(null);

  useEffect(() => {
    getCycles().then((d) => setCycles(d?.cycles ?? [])).catch(() => setCycles([]));
  }, []);

  const courses = groupFoldersByCourse(folders || []);

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
      {!foldersError && !folders && <div aria-busy="true"><SkeletonCard lines={4} /></div>}

      {folders && courses.length === 0 && (
        <EmptyState icon="🗂" title="עוד אין קורסים"
                    hint='פתיחת קורס ראשון — דרך "פתיחת קורס חדש"' />
      )}

      <div className="mi-cards-grid">
        {courses.map((c) => {
          const tone = courseTone(c.name);
          const [statusHe, statusCls] = folderStatus(c.status);
          const cycle = pickRelevantCycle(cyclesForCourse(cycles || [], c.key));
          const pct = pctOfTarget(cycle);
          const month = monthHe(cycle?.start_date);
          return (
            <Link key={c.key} to={`/media/courses/${encodeURIComponent(c.key)}`}
                  className="mi-card"
                  style={{ display: "flex", flexDirection: "column", gap: 10,
                           textDecoration: "none", color: "inherit" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="mi-sidelink-icon" aria-hidden="true" style={{
                  inlineSize: 38, blockSize: 38, fontSize: 17,
                  background: `var(--mi-${tone}-bg, var(--mi-accent-bg))`,
                  color: `var(--mi-${tone}, var(--mi-accent))` }}>
                  {(c.name || "?").trim().charAt(0)}
                </span>
                <strong style={{ fontSize: 16, color: "var(--mi-ink)", flex: 1 }}>
                  {c.name}
                </strong>
                <span className={`mi-chip ${statusCls}`}>{statusHe}</span>
              </span>
              <span className="mi-meta">
                {pct != null
                  ? `קמפיין לידים ${month || ""} — ${pct}% מהיעד`.trim()
                  : cycle
                    ? `מחזור ${month || ""} — טרם הוגדר יעד`.trim()
                    : "טרם הוגדר מחזור"}
                {c.folders.length > 1 && ` · ${c.folders.length} תיקיות עבודה`}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ItemPage.jsx — תיק-פריט (מסך 2 מהמוקאפ): "מסך פריט סקירה".
 * Breadcrumb (קורס › סוג › פריט) · פרטי הפריט · קבצים וגרסאות (כולל Drive) ·
 * סיכום בדיקות-מערכת (qa_history אמיתי) · פעילות (trace מיומן-ההחלטות).
 * הכפתור "צפייה ובדיקה" פותח Review צמוד-גרסה.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getArtifact, getArtifacts, getDecisionsFor } from "../api.js";
import { ErrorBanner, SkeletonCard, StatusChip, timeAgoHe } from "../components/ui.jsx";
import {
  PENDING_STATUSES, activityIcon, artifactThumb, canonicalCourseOf, fullDate,
  shortDate, typeHe,
} from "../lib.js";

/* קישור-הקורס הקנוני — מתוך שם התיקייה של התוצר (טבלת פנימי↔פרסום) */
function courseLink(artifact) {
  const key = canonicalCourseOf(artifact?.folder_name);
  return key ? `/media/courses/${encodeURIComponent(key)}` : "/media/courses";
}

/* מסך ה-Review הוא לתוצרי-קראייטיב/קופי (מודעה כפי שהגולש רואה). תוצר-תקציב/מדיה/מחקר
   אינו "נכס ויזואלי" — אסור שכפתור "צפייה ובדיקה" יוביל אותו למסך-הקראייטיב ("אין נכס ויזואלי"). */
function isReviewable(artifact) {
  const t = (artifact?.artifact_type || "").toLowerCase();
  const d = (artifact?.producing_department || "").toLowerCase();
  if (d === "creative" || d === "copy") return true;
  if (/media|budget|deploy|plan|scenario|allocation|forecast|research|redeploy/.test(t)) return false;
  return /creative|visual|design|ad_copy|copy|concept|render/.test(t);
}

function Panel({ title, children }) {
  return (
    <section className="mi-card" aria-label={title}
             style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 className="mi-h2" style={{ fontSize: 14, color: "var(--mi-ink-3)" }}>{title}</h2>
      {children}
    </section>
  );
}

function QaLine({ ok, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span aria-hidden="true" className={`mi-chip ${ok ? "mi-chip-success" : "mi-chip-danger"}`}
            style={{ padding: "1px 7px" }}>{ok ? "✓" : "✗"}</span>
      <span className="mi-body">{label}</span>
    </div>
  );
}

const QA_RESULT_HE = {
  passed: "עבר",
  revision_required: "נדרש תיקון",
  failed: "נכשל",
};

export default function ItemPage() {
  const { artifactId } = useParams();
  const navigate = useNavigate();
  const [artifact, setArtifact] = useState(null);
  const [versions, setVersions] = useState(null);
  const [trace, setTrace] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    getArtifact(artifactId)
      .then((a) => {
        setArtifact(a);
        // כל הגרסאות של אותו תוצר — אותה תיקייה + אותו סוג
        if (a.folder_id && a.artifact_type) {
          getArtifacts({ folderId: a.folder_id, artifactType: a.artifact_type, limit: 50 })
            .then((rows) => setVersions(
              rows.sort((x, y) => (y.version_number || 0) - (x.version_number || 0))))
            .catch(() => setVersions([]));
        } else setVersions([]);
      })
      .catch((e) => setError(e.message));
    getDecisionsFor(artifactId).then(setTrace).catch(() => setTrace([]));
  }, [artifactId]);
  useEffect(load, [load]);

  if (error) {
    return <div className="mi-page"><ErrorBanner errors={[{ source: error }]} onRetry={load} /></div>;
  }
  if (!artifact) {
    return (
      <div className="mi-page" aria-busy="true">
        <SkeletonCard lines={2} />
        <div className="mi-cards-grid" style={{ marginBlockStart: 16 }}>
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      </div>
    );
  }

  const payload = artifact.payload || {};
  const thumb = artifactThumb(artifact);
  const qa = artifact.qa_history || [];
  const driveUrl = payload.drive_url || payload.drive_folder_url || payload.attached_file?.access_url;
  const pending = PENDING_STATUSES.includes(artifact.status);

  const details = [
    ["מטרה",          payload.goal || payload.purpose || payload.objective],
    ["שימושים מוצעים", Array.isArray(payload.usages) ? payload.usages.join(" · ") : payload.usages],
    ["תקציב משוער",   payload.estimated_budget != null ? `${Number(payload.estimated_budget).toLocaleString()} ₪` : null],
    ["תאריך יעד",     payload.due_date ? fullDate(payload.due_date) : null],
    ["מחלקה מבצעת",   null], // שמות-מחלקות פנימיים לא מוצגים למנהלת (עיקרון UX)
  ].filter(([, v]) => v);

  return (
    <div className="mi-page">
      <nav className="mi-crumbs" aria-label="ניווט משני" style={{ marginBlockEnd: 10 }}>
        {artifact.folder_id
          ? <Link to={courseLink(artifact)}>{artifact.folder_name || "קורס"}</Link>
          : <Link to="/media/courses">קורסים</Link>}
        <span aria-hidden="true">‹</span>
        <span className="mi-meta">{typeHe(artifact.artifact_type)}</span>
        <span aria-hidden="true">‹</span>
        <span style={{ fontWeight: 700, color: "var(--mi-ink)" }}>
          {artifact.title || typeHe(artifact.artifact_type)}
        </span>
      </nav>

      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                       marginBlockEnd: 16 }}>
        <h1 className="mi-h1" style={{ fontSize: 22 }}>
          {artifact.title || typeHe(artifact.artifact_type)}
        </h1>
        <StatusChip status={artifact.status} />
        {artifact.version_number != null && (
          <span className="mi-chip mi-chip-info mi-ltr">V{artifact.version_number}</span>
        )}
        <span style={{ flex: 1 }} />
        {isReviewable(artifact) && (
          <button className="mi-btn mi-btn-primary"
                  onClick={() => navigate(`/media/items/${artifact.id}/review`)}>
            {pending ? "צפייה ובדיקה" : "פתח Review"}
          </button>
        )}
      </header>

      <div className="mi-cards-grid" style={{ alignItems: "start" }}>
        <Panel title="פרטי הפריט">
          {details.length === 0 && (
            <p className="mi-meta">המשרד עוד לא צירף פרטים מובנים לפריט הזה</p>
          )}
          {details.map(([label, value]) => (
            <div key={label}>
              <span className="mi-field-label">{label}</span>
              <span className="mi-body" style={{ color: "var(--mi-ink)" }}>{value}</span>
            </div>
          ))}
        </Panel>

        <Panel title="קבצים וגרסאות">
          {versions == null && <SkeletonCard lines={2} />}
          {versions?.length === 0 && <p className="mi-meta">אין עדיין גרסאות שמורות</p>}
          {(versions || []).map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {artifactThumb(v)
                ? <img className="mi-thumb" src={artifactThumb(v)} alt="" loading="lazy" />
                : <span className="mi-thumb" aria-hidden="true">🗂</span>}
              <span style={{ flex: 1, minInlineSize: 0 }}>
                <span className="mi-body" style={{ display: "block", fontWeight: 600, color: "var(--mi-ink)" }}>
                  <span className="mi-ltr">V{v.version_number}</span> · <span className="mi-ltr">{shortDate(v.updated_at)}</span>
                  {v.id === artifact.id && " · הגרסה הנוכחית"}
                </span>
                <StatusChip status={v.status} />
              </span>
              {v.id !== artifact.id && (
                <Link to={`/media/items/${v.id}`} className="mi-meta"
                      style={{ color: "var(--mi-primary)", fontWeight: 600 }}>
                  צפייה
                </Link>
              )}
            </div>
          ))}
          {driveUrl && (
            <a href={driveUrl} target="_blank" rel="noreferrer" className="mi-body"
               style={{ color: "var(--mi-primary)", fontWeight: 600 }}>
              🗂 פתיחה ב-Drive
            </a>
          )}
        </Panel>

        <Panel title="סיכום בדיקות מערכת">
          {qa.length === 0 && <p className="mi-meta">הפריט עוד לא עבר בדיקות מערכת</p>}
          {qa.map((q, i) => (
            <QaLine key={q.id || i}
                    ok={q.result === "passed"}
                    label={`${q.qa_level === "quality_gate" ? "שער איכות" : "בדיקת מחלקה"} — ${QA_RESULT_HE[q.result] || q.result}`} />
          ))}
          {qa.length > 0 && (
            <details>
              <summary className="mi-meta" style={{ cursor: "pointer", color: "var(--mi-primary)" }}>
                לפרטי הבדיקות
              </summary>
              {qa.map((q, i) => (
                <div key={`d-${q.id || i}`} className="mi-meta" style={{ marginBlockStart: 6 }}>
                  {(Array.isArray(q.issues) && q.issues.length > 0)
                    ? q.issues.map((iss, j) => <div key={j}>• {typeof iss === "string" ? iss : iss.description || JSON.stringify(iss)}</div>)
                    : "ללא הערות"}
                </div>
              ))}
            </details>
          )}
        </Panel>

        <Panel title="פעילות">
          {trace == null && <SkeletonCard lines={2} />}
          {trace?.length === 0 && <p className="mi-meta">אין עדיין פעילות מתועדת</p>}
          {trace?.length > 0 && (
            <ul className="mi-timeline">
              {trace.map((d) => (
                <li key={d.id}>
                  <span className="mi-meta mi-ltr">{shortDate(d.decided_at)}</span>
                  <div className="mi-body" style={{ color: "var(--mi-ink)" }}>
                    <span aria-hidden="true" style={{ marginInlineEnd: 6 }}>{activityIcon(d.decision_type)}</span>
                    {d.display_he}
                  </div>
                  <span className="mi-meta">{timeAgoHe(d.decided_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

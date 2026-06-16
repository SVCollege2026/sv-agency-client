/**
 * ItemPage.jsx — תיק-פריט (מסך 2 מהמוקאפ): "מסך פריט סקירה".
 * Breadcrumb (קורס › סוג › פריט) · פרטי הפריט · קבצים וגרסאות (כולל Drive) ·
 * סיכום בדיקות-מערכת (qa_history אמיתי) · פעילות (trace מיומן-ההחלטות).
 * הכפתור "צפייה ובדיקה" פותח Review צמוד-גרסה.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  approveArtifact, getArtifact, getArtifacts, getDecisionsFor,
  requestArtifactRevision,
} from "../api.js";
import { ErrorBanner, SkeletonCard, StatusChip, timeAgoHe } from "../components/ui.jsx";
import {
  PENDING_STATUSES, activityIcon, artifactThumb, canonicalCourseOf, fullDate,
  isMediaDeployment, mediaDeploymentRows, monthLabelHe,
  opensReview, shortDate, typeHe,
} from "../lib.js";

/* קישור-הקורס הקנוני — מתוך שם התיקייה של התוצר (טבלת פנימי↔פרסום) */
function courseLink(artifact) {
  const key = canonicalCourseOf(artifact?.folder_name);
  return key ? `/media/courses/${encodeURIComponent(key)}` : "/media/courses";
}

function fmtIls(n) {
  return typeof n === "number" ? `₪${Math.round(n).toLocaleString()}` : "—";
}

/* פאנל פריסת-המדיה המלאה (תוצר media_deployment משינוי-תקציב): טבלת בסיס→חדש
   פר-קורס, סך-תקופתי, והוצאה-עד-כה — כך שהמנהלת רואה את החלוקה-המחדש שהיא
   מאשרת, לא רק שורת-הקצאה בודדת. הכל נגזר מה-payload (deltas/months) — אפס המצאה. */
function MediaDeploymentPanel({ payload }) {
  const data = mediaDeploymentRows(payload);
  if (!data) {
    return (
      <p className="mi-meta">פירוט הפריסה עוד לא צורף לתוצר הזה</p>
    );
  }
  const { months, currentMonthIndex, period, rationale, courses } = data;
  const periodLabel = period
    ? `${period.budget_period_start ? fullDate(period.budget_period_start) : "—"} – ${period.period_end ? fullDate(period.period_end) : "—"}`
    : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p className="mi-body" style={{ margin: 0 }}>
        שינוי-התקציב פורס מחדש את כל התקופה. לכל קורס: כמה הוקצב לפי הבסיס, מה כבר
        הוצא, ומה הפריסה המעודכנת קדימה — הסך-התקופתי נשמר (לא מנופח).
      </p>
      {periodLabel && (
        <p className="mi-meta mi-ltr" style={{ margin: 0 }}>תקופה: {periodLabel}</p>
      )}

      <div className="mi-table-wrap">
        <table className="mi-table">
          <thead>
            <tr>
              <th>קורס</th>
              <th>הוצא עד כה</th>
              <th>סך בסיס</th>
              <th>סך מעודכן</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.courseKey}>
                <td style={{ fontWeight: 600, color: "var(--mi-ink)" }}>{c.label}</td>
                <td className="mi-ltr">{fmtIls(c.spend)}</td>
                <td className="mi-ltr">{fmtIls(c.baselineTotal)}</td>
                <td className="mi-ltr" style={{ fontWeight: 600 }}>{fmtIls(c.newTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* פריסה חודשית מעודכנת פר-קורס — החודש-הנוכחי מסומן */}
      {months.length > 0 && (
        <details>
          <summary className="mi-meta" style={{ cursor: "pointer", color: "var(--mi-primary)" }}>
            פריסה חודשית מעודכנת (₪ לכל חודש)
          </summary>
          <div className="mi-table-wrap" style={{ marginBlockStart: 8 }}>
            <table className="mi-table">
              <thead>
                <tr>
                  <th>קורס</th>
                  {months.map((m, i) => (
                    <th key={m} className="mi-ltr"
                        style={i === currentMonthIndex
                          ? { color: "var(--mi-primary)", fontWeight: 700 } : undefined}>
                      {monthLabelHe(m)}{i === currentMonthIndex ? " ●" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.courseKey}>
                    <td style={{ fontWeight: 600, color: "var(--mi-ink)" }}>{c.label}</td>
                    {months.map((m, i) => {
                      const v = c.newMonthly[i];
                      return (
                        <td key={m} className="mi-ltr"
                            style={i === currentMonthIndex ? { fontWeight: 600 } : undefined}>
                          {typeof v === "number" ? fmtIls(v) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {rationale && (
        <p className="mi-meta" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{rationale}</p>
      )}
    </div>
  );
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
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [revising, setRevising] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");

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

  // החלטה על תוצר-לא-קראייטיב (פריסת-מדיה/תקציב) — נעשית כאן, לא במסך-הקראייטיב.
  // אותן דלתות גנריות של ReviewPage (approve / request-revision), צמודות-גרסה.
  const doApprove = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await approveArtifact(artifactId, null);
      setNotice({ kind: "ok", text: "הפריסה אושרה ✓ — המשרד מתחיל לפעול לפיה" });
      load();
    } catch (e) {
      setNotice({ kind: "err", text: `האישור נכשל: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const doRevision = async () => {
    if (!revisionNote.trim()) {
      setNotice({ kind: "err", text: "בקשת שינויים חייבת סיבה — כתבי מה לתקן" });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await requestArtifactRevision(artifactId, revisionNote.trim());
      setNotice({ kind: "ok", text: "בקשת השינויים נשלחה למשרד — פריסה מעודכנת תחזור לאישור" });
      setRevising(false);
      load();
    } catch (e) {
      setNotice({ kind: "err", text: `השליחה נכשלה: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

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
  const reviewable = opensReview(artifact);
  const isDeployment = isMediaDeployment(artifact);
  // החלטה מוצגת בתיק-הפריט עבור תוצר-לא-קראייטיב שממתין לאישורה (פריסת-מדיה/תקציב).
  // קראייטיב/קופי מוכרעים במסך ה-Review; שם לא כופלים פעולות-החלטה.
  const showDecision = pending && !reviewable;

  // sweep: תוצרי-מדיה (media_plan/market_research/budget_recommendation) לא נושאים
  // goal/usages/due_date, ולכן הפאנל היה כמעט-ריק. מרחיבים לשדות שהם **כן** נושאים
  // (summary/period/platform/amount/rationale) — מוצגים רק אם קיימים בפועל, בלי המצאה.
  const _period = payload.period_start || payload.period_end
    ? `${payload.period_start ? fullDate(payload.period_start) : "—"} – ${payload.period_end ? fullDate(payload.period_end) : "—"}`
    : (payload.period || null);
  const _amount = payload.amount_ils ?? payload.estimated_budget ?? payload.amount;
  const details = [
    ["מטרה",          payload.goal || payload.purpose || payload.objective],
    ["תקציר",         payload.summary || payload.overview || payload.description],
    ["שימושים מוצעים", Array.isArray(payload.usages) ? payload.usages.join(" · ") : payload.usages],
    ["פלטפורמה",      payload.platform],
    ["תקופה",         _period],
    ["סכום",          _amount != null ? `${Number(_amount).toLocaleString()} ₪` : null],
    ["נימוק",         payload.rationale],
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
        {reviewable && (
          <button className="mi-btn mi-btn-primary"
                  onClick={() => navigate(`/media/items/${artifact.id}/review`)}>
            {pending ? "צפייה ובדיקה" : "פתח Review"}
          </button>
        )}
      </header>

      {notice && (
        <div className="mi-card" role="status" aria-live="polite"
             style={{ marginBlockEnd: 14, padding: "10px 16px",
                      background: notice.kind === "ok" ? "var(--mi-success-bg)" : "var(--mi-danger-bg)",
                      color: notice.kind === "ok" ? "var(--mi-success)" : "var(--mi-danger)",
                      borderColor: "transparent" }}>
          {notice.text}
          {notice.kind === "ok" && artifact.folder_id && (
            <Link to={courseLink(artifact)}
                  style={{ marginInlineStart: 10, color: "inherit", fontWeight: 700 }}>
              חזרה ללוח הקורס
            </Link>
          )}
        </div>
      )}

      {/* פריסת-מדיה מלאה — טבלת החלוקה-המחדש (בסיס→חדש), כך שיש מה לאשר על בסיסו */}
      {isDeployment && (
        <Panel title="פריסת המדיה המעודכנת">
          <MediaDeploymentPanel payload={payload} />
        </Panel>
      )}

      {/* פעולת-ההחלטה לתוצר-לא-קראייטיב הממתין לאישור (פריסת-מדיה/תקציב) */}
      {showDecision && (
        <Panel title="ההחלטה שלך">
          {!revising ? (
            <div className="mi-actionbar" style={{ paddingInline: 0, position: "static", border: "none" }}>
              <button className="mi-btn mi-btn-primary" disabled={busy} onClick={doApprove}
                      style={{ flex: 1, justifyContent: "center" }}>
                ✓ אישור
              </button>
              <button className="mi-btn mi-btn-secondary" disabled={busy}
                      onClick={() => setRevising(true)}
                      style={{ flex: 1, justifyContent: "center" }}>
                ✎ שליחת בקשת שינויים
              </button>
            </div>
          ) : (
            <div>
              <label className="mi-field-label" htmlFor="it-rv-note">מה לתקן? (חובה)</label>
              <textarea id="it-rv-note" className="mi-textarea" value={revisionNote} autoFocus
                        onChange={(e) => setRevisionNote(e.target.value)}
                        placeholder="תיאור השינויים המבוקשים בפריסה…" />
              <div className="mi-actionbar" style={{ paddingInline: 0, position: "static", border: "none" }}>
                <button className="mi-btn mi-btn-primary" disabled={busy} onClick={doRevision}
                        style={{ flex: 1, justifyContent: "center" }}>
                  שליחה למשרד
                </button>
                <button className="mi-btn mi-btn-ghost" disabled={busy}
                        onClick={() => setRevising(false)}>
                  ביטול
                </button>
              </div>
            </div>
          )}
        </Panel>
      )}

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

/**
 * ReviewPage.jsx — מסך אישור Review (מסך 3 מהמוקאפ). צמוד-גרסה.
 * ימין (RTL: צד פותח): טאבים קופי / עיצוב / פרטי הנכס / הערות(n) + פעולות.
 * שמאל: המודעה כפי שהגולש רואה אותה — Feed / Story / Reel + בחירת גרסה
 * + השוואה לגרסה קודמת. "אישור למרות ההערות" שומר snapshot של ההערות
 * הפתוחות בהחלטה; "שליחת בקשת שינויים" מחייבת סיבה. אין bulk.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addComment, approveArtifact, getArtifact, getArtifacts, getComments,
  requestArtifactRevision,
} from "../api.js";
import { ErrorBanner, SkeletonCard, StatusChip, timeAgoHe } from "../components/ui.jsx";
import {
  MANAGER, PENDING_STATUSES, artifactThumb, canonicalCourse, copyFields,
  fullDate, isVideoAsset, rawAssetUrl, typeHe,
} from "../lib.js";

/* קישור-הקורס בנתיב הקנוני (projection) — מתוך שם התיקייה של התוצר */
function courseLink(artifact) {
  if (!artifact?.folder_name) return "/media/courses";
  return `/media/courses/${encodeURIComponent(canonicalCourse({ course_name: artifact.folder_name }))}`;
}

const PLACEMENTS = [["feed", "Feed"], ["story", "Story"], ["reel", "Reel"]];
const PANEL_TABS = [["copy", "קופי"], ["design", "עיצוב"],
                    ["details", "פרטי הנכס"], ["comments", "הערות"]];

/* המודעה כפי שהגולש רואה אותה — פר-placement, מנכס אמיתי בלבד.
   נכס ששמור ב-Drive ולא נגיש לדפדפן: קישור ל-Drive, לא תצוגה מזויפת. */
function PlacementPreview({ placement, asset, driveHref, copy }) {
  const [mediaError, setMediaError] = React.useState(false);
  React.useEffect(() => setMediaError(false), [asset]);

  if (!asset || mediaError) {
    return (
      <div className="mi-card" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 36 }} aria-hidden="true">🖼</div>
        <p className="mi-body" style={{ marginBlockStart: 8 }}>
          {asset
            ? "הנכס שמור ב-Drive ולא זמין לתצוגה ישירה כאן"
            : "לפריט הזה אין עדיין נכס ויזואלי — אין תצוגה מדומה"}
        </p>
        {asset && driveHref && (
          <a className="mi-btn mi-btn-secondary" href={driveHref} target="_blank"
             rel="noreferrer" style={{ marginBlockStart: 12 }}>
            🗂 צפייה בקובץ ב-Drive
          </a>
        )}
      </div>
    );
  }
  const media = isVideoAsset(asset)
    ? <video className="mi-placement-media" src={asset} controls playsInline
             onError={() => setMediaError(true)} />
    : <img className="mi-placement-media" src={asset} alt="תצוגת הנכס"
           onLoad={(e) => { if (!e.target.naturalWidth) setMediaError(true); }}
           onError={() => setMediaError(true)} />;

  if (placement === "feed") {
    return (
      <div className="mi-placement mi-placement-feed">
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
          <span className="mi-avatar" style={{ inlineSize: 30, blockSize: 30, fontSize: 13 }}
                aria-hidden="true">SV</span>
          <span>
            <strong style={{ display: "block", fontSize: 13, color: "var(--mi-ink)" }}>SVCollege</strong>
            <span className="mi-meta">ממומן</span>
          </span>
        </div>
        {media}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                      background: "var(--mi-bg)" }}>
          <span className="mi-body" style={{ flex: 1, fontWeight: 600, color: "var(--mi-ink)" }}>
            {copy.find((f) => f.key.startsWith("headline"))?.value || ""}
          </span>
          <span className="mi-btn mi-btn-secondary" aria-hidden="true"
                style={{ minBlockSize: 32, padding: "4px 12px", pointerEvents: "none" }}>
            {copy.find((f) => f.key.startsWith("cta"))?.value || "לפרטים"}
          </span>
        </div>
      </div>
    );
  }
  /* Story / Reel — 9:16, טקסט על הסצנה */
  return (
    <div className={`mi-placement mi-placement-${placement}`} style={{ position: "relative" }}>
      {media}
      <div style={{ position: "absolute", insetInline: 0, insetBlockEnd: 0,
                    padding: "28px 14px 14px", color: "#fff",
                    background: "linear-gradient(to top, rgba(0,0,0,.65), transparent)" }}>
        <strong style={{ display: "block", fontSize: 15 }}>
          {copy.find((f) => f.key.startsWith("headline"))?.value || ""}
        </strong>
        <span style={{ fontSize: 12, opacity: .9 }}>
          {copy.find((f) => f.key.startsWith("cta"))?.value || ""}
        </span>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const { artifactId } = useParams();
  const navigate = useNavigate();
  const [artifact, setArtifact] = useState(null);
  const [versions, setVersions] = useState([]);
  const [comments, setComments] = useState(null);
  const [commentsOff, setCommentsOff] = useState(false);
  const [placement, setPlacement] = useState("feed");
  const [panelTab, setPanelTab] = useState("copy");
  const [compare, setCompare] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [revising, setRevising] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    getArtifact(artifactId)
      .then((a) => {
        setArtifact(a);
        if (a.folder_id && a.artifact_type) {
          getArtifacts({ folderId: a.folder_id, artifactType: a.artifact_type, limit: 50 })
            .then((rows) => setVersions(
              rows.sort((x, y) => (y.version_number || 0) - (x.version_number || 0))))
            .catch(() => setVersions([]));
        }
      })
      .catch((e) => setError(e.message));
    getComments("artifact", artifactId)
      .then(setComments)
      .catch((e) => {
        // טבלת ההערות (sql/091) עוד לא חיה? שקיפות, לא כשל שקט
        setComments([]);
        if (String(e.message).includes("503") || /הערות/.test(e.message)) setCommentsOff(true);
      });
  }, [artifactId]);
  useEffect(load, [load]);

  const copy = useMemo(() => copyFields(artifact?.payload), [artifact]);
  const asset = artifactThumb(artifact);
  const openComments = (comments || []).filter((c) => (c.status || "open") === "open");
  const prevVersion = useMemo(() => {
    if (!artifact || !versions.length) return null;
    return versions.find((v) => (v.version_number || 0) < (artifact.version_number || 0)) || null;
  }, [artifact, versions]);
  const pending = artifact && PENDING_STATUSES.includes(artifact.status);

  const submitComment = async () => {
    if (!newComment.trim()) return;
    setBusy(true);
    try {
      await addComment({
        object_type: "artifact",
        object_id: artifactId,
        version: artifact?.version_number ?? null,
        section_key: panelTab === "comments" ? null : panelTab,
        body: newComment.trim(),
        author: "marketing_manager",
      });
      setNewComment("");
      const updated = await getComments("artifact", artifactId);
      setComments(updated);
    } catch (e) {
      setNotice({ kind: "err", text: `ההערה לא נשמרה: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const doApprove = async () => {
    setBusy(true);
    setNotice(null);
    try {
      // "אישור למרות ההערות" — ההערות הפתוחות נשמרות כ-snapshot בהחלטה עצמה
      const note = openComments.length
        ? `אושר למרות ${openComments.length} הערות פתוחות. snapshot: ` +
          openComments.map((c) => `"${(c.body || "").slice(0, 120)}"`).join(" · ")
        : null;
      await approveArtifact(artifactId, note);
      setNotice({ kind: "ok", text: `הגרסה V${artifact.version_number} אושרה ✓` });
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
      setNotice({ kind: "ok", text: "בקשת השינויים נשלחה למשרד — גרסה מתוקנת תחזור לאישור" });
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
        <div className="mi-review-grid">
          <SkeletonCard lines={8} /><SkeletonCard lines={8} />
        </div>
      </div>
    );
  }

  const FieldRow = ({ label, value, fieldKey }) => (
    <div>
      <span className="mi-field-label">{label}</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span className="mi-field" style={{ background: "var(--mi-bg)" }}>{value}</span>
        <button className="mi-btn mi-btn-ghost" title={`הערה על ${label}`}
                aria-label={`הערה על ${label}`}
                style={{ minBlockSize: 36, padding: "4px 8px" }}
                onClick={() => {
                  setPanelTab("comments");
                  setNewComment((t) => t || `${label}: `);
                }}>
          💬
        </button>
      </div>
    </div>
  );

  return (
    <div className="mi-page" style={{ maxInlineSize: 1320 }}>
      <nav className="mi-crumbs" aria-label="ניווט משני" style={{ marginBlockEnd: 10 }}>
        {artifact.folder_id
          ? <Link to={courseLink(artifact)}>{artifact.folder_name || "קורס"}</Link>
          : <Link to="/media/courses">קורסים</Link>}
        <span aria-hidden="true">‹</span>
        <Link to={`/media/items/${artifact.id}`}>{artifact.title || typeHe(artifact.artifact_type)}</Link>
        <span aria-hidden="true">‹</span>
        <span style={{ fontWeight: 700, color: "var(--mi-ink)" }}>Review</span>
      </nav>

      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                       marginBlockEnd: 14 }}>
        <h1 className="mi-h1" style={{ fontSize: 22 }}>מסך אישור Review</h1>
        <StatusChip status={artifact.status} />
        <span style={{ flex: 1 }} />
        <label className="mi-meta" htmlFor="rv-version">גרסה</label>
        <select id="rv-version" className="mi-field" style={{ inlineSize: "auto" }}
                value={artifact.id}
                onChange={(e) => navigate(`/media/items/${e.target.value}/review`)}>
          {(versions.length ? versions : [artifact]).map((v) => (
            <option key={v.id} value={v.id}>V{v.version_number}</option>
          ))}
        </select>
        {prevVersion && (
          <button className="mi-btn mi-btn-secondary" aria-pressed={compare}
                  onClick={() => setCompare((c) => !c)}>
            {compare ? "בלי השוואה" : "השוואה לגרסה קודמת"}
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

      <div className="mi-review-grid">
        {/* המודעה כפי שהגולש רואה אותה */}
        <section aria-label="תצוגת המודעה">
          <div className="mi-tabs" role="tablist" aria-label="Placement" style={{ marginBlockEnd: 14 }}>
            {PLACEMENTS.map(([key, label]) => (
              <button key={key} role="tab" aria-selected={placement === key}
                      className="mi-tab" onClick={() => setPlacement(key)}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <div>
              <p className="mi-meta" style={{ textAlign: "center", marginBlockEnd: 6 }}>
                <span className="mi-ltr">V{artifact.version_number}</span> — הגרסה הנבדקת
              </p>
              <PlacementPreview placement={placement} asset={asset}
                                driveHref={rawAssetUrl(artifact)} copy={copy} />
            </div>
            {compare && prevVersion && (
              <div>
                <p className="mi-meta" style={{ textAlign: "center", marginBlockEnd: 6 }}>
                  <span className="mi-ltr">V{prevVersion.version_number}</span> — הגרסה הקודמת
                </p>
                <PlacementPreview placement={placement}
                                  asset={artifactThumb(prevVersion)}
                                  driveHref={rawAssetUrl(prevVersion)}
                                  copy={copyFields(prevVersion.payload)} />
              </div>
            )}
          </div>
        </section>

        {/* פאנל הקופי / עיצוב / פרטים / הערות */}
        <section aria-label="פרטי הגרסה" className="mi-card" style={{ alignSelf: "start" }}>
          <div className="mi-tabs" role="tablist" aria-label="תוכן הפריט" style={{ marginBlockEnd: 14 }}>
            {PANEL_TABS.map(([key, label]) => (
              <button key={key} role="tab" aria-selected={panelTab === key}
                      className="mi-tab" onClick={() => setPanelTab(key)}>
                {label}
                {key === "comments" && comments?.length > 0 && ` (${comments.length})`}
              </button>
            ))}
          </div>

          {panelTab === "copy" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {copy.length === 0 && (
                <p className="mi-meta">לגרסה הזו אין שדות קופי מובנים</p>
              )}
              {copy.map((f) => (
                <FieldRow key={f.key} label={f.label} value={f.value} fieldKey={f.key} />
              ))}
            </div>
          )}

          {panelTab === "design" && (
            asset ? (
              <>
                <img src={asset} alt="הנכס הוויזואלי"
                     style={{ inlineSize: "100%", borderRadius: 12 }}
                     onError={(e) => { e.target.style.display = "none"; }} />
                {rawAssetUrl(artifact) && (
                  <a href={rawAssetUrl(artifact)} target="_blank" rel="noreferrer"
                     className="mi-body" style={{ color: "var(--mi-primary)", fontWeight: 600 }}>
                    🗂 צפייה בקובץ המקורי ב-Drive
                  </a>
                )}
              </>
            ) : <p className="mi-meta">אין נכס ויזואלי לגרסה הזו</p>
          )}

          {panelTab === "details" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <FieldRow label="סוג" value={typeHe(artifact.artifact_type)} />
              <FieldRow label="קורס" value={artifact.folder_name || "פעילות בית-ספרית"} />
              <FieldRow label="גרסה" value={`V${artifact.version_number}`} />
              <FieldRow label="עודכן" value={fullDate(artifact.updated_at)} />
            </div>
          )}

          {panelTab === "comments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {commentsOff && (
                <p className="mi-meta" role="note" style={{
                     background: "var(--mi-warning-bg)", color: "var(--mi-warning)",
                     borderRadius: 8, padding: "8px 10px" }}>
                  מערכת ההערות עוד לא הופעלה — אפשר בינתיים לכתוב את ההערות
                  ב"שליחת בקשת שינויים"
                </p>
              )}
              {comments == null && <SkeletonCard lines={2} />}
              {comments?.length === 0 && !commentsOff && (
                <p className="mi-meta">אין עדיין הערות על הגרסה הזו</p>
              )}
              {(comments || []).map((c) => (
                <div key={c.id} style={{ display: "flex", gap: 8 }}>
                  <span className="mi-avatar" style={{ inlineSize: 28, blockSize: 28, fontSize: 12 }}
                        aria-hidden="true">
                    {c.author === "marketing_manager" ? MANAGER.name.charAt(0) : "מ"}
                  </span>
                  <span style={{ flex: 1, minInlineSize: 0 }}>
                    <span className="mi-meta" style={{ display: "block" }}>
                      {c.author === "marketing_manager" ? MANAGER.name : "המשרד"}
                      {" · "}{timeAgoHe(c.created_at)}
                      {c.section_key && ` · ${PANEL_TABS.find(([k]) => k === c.section_key)?.[1] || c.section_key}`}
                      {(c.status || "open") !== "open" && " · טופל ✓"}
                    </span>
                    <span className="mi-body" style={{ color: "var(--mi-ink)" }}>{c.body}</span>
                  </span>
                </div>
              ))}
              {!commentsOff && (
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="mi-field" value={newComment} placeholder="הערה חדשה…"
                         onChange={(e) => setNewComment(e.target.value)}
                         onKeyDown={(e) => e.key === "Enter" && submitComment()} />
                  <button className="mi-btn mi-btn-secondary" disabled={busy || !newComment.trim()}
                          onClick={submitComment}>
                    שליחה
                  </button>
                </div>
              )}
            </div>
          )}

          {/* פעולות ההחלטה — צמודות-גרסה, סיבה חובה לתיקון */}
          {pending && !revising && (
            <div className="mi-actionbar" style={{ marginBlockStart: 16, paddingInline: 0 }}>
              <button className="mi-btn mi-btn-primary" disabled={busy}
                      onClick={() => setRevising(true)}
                      style={{ flex: 1, justifyContent: "center" }}>
                ✎ שליחת בקשת שינויים
              </button>
              <button className="mi-btn mi-btn-secondary" disabled={busy} onClick={doApprove}
                      style={{ flex: 1, justifyContent: "center" }}>
                {openComments.length ? "אישור למרות ההערות" : "✓ אישור"}
              </button>
              <button className="mi-btn mi-btn-ghost" disabled={busy}
                      onClick={() => navigate(-1)}>
                ביטול
              </button>
            </div>
          )}
          {pending && revising && (
            <div style={{ marginBlockStart: 16 }}>
              <label className="mi-field-label" htmlFor="rv-note">מה לתקן? (חובה)</label>
              <textarea id="rv-note" className="mi-textarea" value={revisionNote} autoFocus
                        onChange={(e) => setRevisionNote(e.target.value)}
                        placeholder={openComments.length
                          ? "אפשר להתבסס על ההערות הפתוחות…"
                          : "תיאור השינויים המבוקשים…"} />
              <div className="mi-actionbar" style={{ paddingInline: 0 }}>
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
          {!pending && (
            <p className="mi-meta" style={{ marginBlockStart: 14 }}>
              הגרסה הזו כבר הוכרעה — ההחלטות נשארות צמודות לגרסה המדויקת
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

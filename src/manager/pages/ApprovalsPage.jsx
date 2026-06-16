/**
 * ApprovalsPage.jsx — תצוגת אישורים — גלריה (מסך 4 מהמוקאפ).
 * טאבים: "מחכה לאישור שלי" / "אישורים שניתנו". כרטיס-גלריה לכל פריט:
 * thumbnail אמיתי · קורס · גרסה · סטטוס · "פתח Review".
 * תוצרים נשפטים ב-Review צמוד-גרסה; תקציב/המלצות מוכרעים כאן —
 * פריט-פריט, דחייה מחייבת סיבה, אין שום bulk.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  decideAllocation, decideRecommendation, getApprovalsInbox, getArtifacts,
  getRecommendations,
} from "../api.js";
import { StatusChip, EmptyState, ErrorBanner, SkeletonCard, timeAgoHe } from "../components/ui.jsx";
import RejectDialog from "../components/RejectDialog.jsx";
import {
  artifactThumb, filterInboxItems, isVideoAsset, opensReview,
  stripInternalSteps, testFolderIdSet, typeHe,
} from "../lib.js";

const KIND_ICON = { budget_allocation: "💰", recommendation: "💡", artifact: "🖼" };

function GalleryCard({ item, thumb, busy, onOpen, onApprove, onReject }) {
  const isArtifact = item.kind === "artifact";
  // תוצר-קראייטיב/קופי נפתח למסך-Review (מודעה כפי שהגולש רואה); תוצר-מדיה/תקציב
  // (כמו פריסת-מדיה מלאה) נפתח לתיק-הפריט, שם מוצג תוכנו האמיתי + פעולת-ההחלטה.
  const review = isArtifact && opensReview({ artifact_type: item.item_type, producing_department: item.producing_department });
  const [thumbFailed, setThumbFailed] = React.useState(false);
  const showThumb = thumb && !thumbFailed;
  return (
    <article className="mi-card" aria-label={item.title}
             style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14 }}>
      <div className="mi-gallery-thumb">
        {showThumb
          ? <img src={thumb} alt="" loading="lazy" onError={() => setThumbFailed(true)} />
          : <span aria-hidden="true">{KIND_ICON[item.kind] || "🖼"}</span>}
        {showThumb && isVideoAsset(thumb) && (
          <span className="mi-play-badge" aria-label="וידאו">▶</span>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {item.course && <span className="mi-chip mi-chip-info">{item.course}</span>}
        {!isArtifact && (
          <span className="mi-chip mi-chip-primary">{typeHe(item.item_type)}</span>
        )}
        {item.version != null && (
          <span className="mi-chip mi-chip-info mi-ltr" title="אישור צמוד-גרסה">V{item.version}</span>
        )}
      </div>

      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--mi-ink)" }}>
        {item.rec_text || item.title}
      </h3>
      {/* הנימוק המלא — כדי שיהיה על מה להחליט (תקציב: rationale; המלצה: human_explanation) */}
      {(item.rationale || item.rec_explanation) && (
        <p className="mi-body" style={{ margin: 0, color: "var(--mi-ink-soft, #555)", whiteSpace: "pre-wrap" }}>
          {item.rationale || item.rec_explanation}
        </p>
      )}
      {item.rec_campaign && (
        <p className="mi-meta" style={{ margin: 0 }}>קמפיין: {item.rec_campaign}</p>
      )}

      {item.reopened_from_version != null && (
        <p className="mi-meta" role="note" style={{
             margin: 0, background: "var(--mi-warning-bg)", color: "var(--mi-warning)",
             borderRadius: 8, padding: "6px 10px" }}>
          גרסה חדשה אחרי שאושרה <span className="mi-ltr">V{item.reopened_from_version}</span> —
          נפתח מחדש לאישור שלך
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <StatusChip status={item.status} />
        <span className="mi-meta" style={{ flex: 1, textAlign: "end" }}>
          {timeAgoHe(item.updated_at)}
        </span>
      </div>

      {isArtifact ? (
        <button className="mi-btn mi-btn-secondary" style={{ justifyContent: "center" }}
                onClick={() => onOpen(item, review)}>
          {review ? "פתח Review" : "פתחי לצפייה ואישור"}
        </button>
      ) : (
        <div className="mi-actionbar" style={{ padding: 0, border: "none", position: "static" }}>
          <button className="mi-btn mi-btn-primary" disabled={busy}
                  onClick={() => onApprove(item)} style={{ flex: 1, justifyContent: "center" }}>
            ✓ אישור
          </button>
          <button className="mi-btn mi-btn-secondary" disabled={busy}
                  onClick={() => onReject(item)} style={{ flex: 1, justifyContent: "center" }}>
            ✎ לתקן
          </button>
        </div>
      )}
    </article>
  );
}

export default function ApprovalsPage() {
  const { setPendingCount, folders } = useOutletContext() ?? {};
  const navigate = useNavigate();
  const [tab, setTab] = useState("pending");
  const [data, setData] = useState(null);
  const [thumbs, setThumbs] = useState({});
  const [recById, setRecById] = useState({});
  const [error, setError] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback((t = tab) => {
    setError(null);
    setData(null);
    getApprovalsInbox(t)
      .then((d) => {
        // מסנן-התצוגה הקבוע: פריטים של תיקיות-טסט לא מוצגים ולא נספרים.
        let items = filterInboxItems(d.items || [], testFolderIdSet(folders || []));
        // שלבי-ביניים פנימיים (internal_review וכו') לא דולפים לתיבת-האישורים —
        // השרת עדיין מחזיר אותם בפיד ה-pending, אז מסירים בצד-הלקוח (fix #1).
        if (t === "pending") items = stripInternalSteps(items);
        setData({ ...d, items });
        if (t === "pending") setPendingCount?.(items.length);
      })
      .catch((e) => setError(e.message));
    // thumbnails אמיתיים לתוצרים — מהרשימה הממתינה (קריאה אחת, לא N+1)
    getArtifacts({ limit: 200 })
      .then((rows) => {
        const map = {};
        for (const a of rows) {
          const u = artifactThumb(a);
          if (u) map[a.id] = u;
        }
        setThumbs(map);
      })
      .catch(() => {});
    // תוכן-ההמלצה האמיתי (recommendation_text) — ה-read-model מחזיר רק כותרת גנרית
    getRecommendations(100)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : rows?.recommendations ?? rows?.items ?? [];
        const map = {};
        for (const r of list) map[r.id] = r;
        setRecById(map);
      })
      .catch(() => {});
  }, [tab, setPendingCount, folders]);
  useEffect(() => load(tab), [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const doApprove = async (item) => {
    setBusyId(item.id);
    setNotice(null);
    try {
      if (item.kind === "budget_allocation") await decideAllocation(item.id, "approved");
      else await decideRecommendation(item.id, "approve");
      setNotice({ kind: "ok", text: `"${item.title}" אושר ✓` });
      load();
    } catch (e) {
      setNotice({ kind: "err", text: `האישור נכשל: ${e.message}` });
    } finally {
      setBusyId(null);
    }
  };

  const doReject = async (item, reason) => {
    setBusyId(item.id);
    setNotice(null);
    try {
      if (item.kind === "budget_allocation") await decideAllocation(item.id, "rejected", reason);
      else await decideRecommendation(item.id, "reject", reason);
      setNotice({ kind: "ok", text: "ההחלטה נרשמה ונשלחה למשרד" });
      setRejecting(null);
      load();
    } catch (e) {
      setNotice({ kind: "err", text: `השליחה נכשלה: ${e.message}` });
    } finally {
      setBusyId(null);
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="mi-page">
      <header style={{ marginBlockEnd: 16 }}>
        <h1 className="mi-h1" style={{ fontSize: 22 }}>תצוגת אישורים — גלריה</h1>
        <p className="mi-meta" style={{ marginBlockStart: 4 }}>
          כל החלטה נפרדת וצמודה לגרסה המדויקת — אין אישור קבוצתי
        </p>
      </header>

      <div className="mi-tabs" role="tablist" aria-label="סינון אישורים"
           style={{ marginBlockEnd: 16 }}>
        {[["pending", "מחכה לאישור שלי"], ["decided", "אישורים שניתנו"]].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key}
                  className="mi-tab" onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="mi-card" role="status" aria-live="polite"
             style={{ marginBlockEnd: 16, padding: "10px 16px",
                      background: notice.kind === "ok" ? "var(--mi-success-bg)" : "var(--mi-danger-bg)",
                      color: notice.kind === "ok" ? "var(--mi-success)" : "var(--mi-danger)",
                      borderColor: "transparent" }}>
          {notice.text}
        </div>
      )}

      {error && <ErrorBanner errors={[{ source: error }]} onRetry={() => load()} />}
      {!error && !data && (
        <div className="mi-cards-grid" aria-busy="true">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={5} />)}
        </div>
      )}
      {data && <ErrorBanner errors={data.fetch_errors} onRetry={() => load()} />}

      {data && tab === "pending" && (
        items.length === 0 ? (
          <EmptyState title="אין פריטים שמחכים לאישור שלך"
                      hint="כשהמשרד יסיים תוצר — הוא יופיע כאן" />
        ) : (
          <div className="mi-cards-grid">
            {items.map((item) => {
              const rec = item.kind === "recommendation" ? recById[item.id] : null;
              const enriched = rec ? {
                ...item,
                rec_text: (rec.recommendation_text || "").slice(0, 160) || null,
                rec_campaign: rec.campaign_ref || null,
                rec_explanation: rec.human_explanation || null,
              } : item;
              return (
                <GalleryCard key={`${item.kind}-${item.id}`} item={enriched}
                             thumb={item.kind === "artifact" ? thumbs[item.id] : null}
                             busy={busyId === item.id}
                             onOpen={(it, toReview) => navigate(
                               toReview ? `/media/items/${it.id}/review` : `/media/items/${it.id}`)}
                             onApprove={doApprove}
                             onReject={setRejecting} />
              );
            })}
          </div>
        )
      )}

      {data && tab === "decided" && (
        items.length === 0 ? (
          <EmptyState icon="📭" title="עוד לא ניתנו אישורים" />
        ) : (
          <div className="mi-card" style={{ padding: 8 }}>
            {items.map((item) => (
              <div key={item.id}
                   style={{ display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 12px",
                            borderBlockEnd: "1px solid var(--mi-border)" }}>
                <StatusChip status={item.status} />
                <span className="mi-body" style={{ flex: 1, minInlineSize: 0 }}>
                  {item.title}
                  {item.version != null && <> · <span className="mi-ltr">V{item.version}</span></>}
                  {item.course && <> · {item.course}</>}
                </span>
                <button className="mi-btn mi-btn-ghost"
                        style={{ minBlockSize: 32, padding: "4px 10px" }}
                        onClick={() => navigate(`/media/items/${item.id}`)}>
                  לפריט
                </button>
                <span className="mi-meta">{timeAgoHe(item.updated_at)}</span>
              </div>
            ))}
          </div>
        )
      )}

      {rejecting && (
        <RejectDialog item={rejecting} busy={busyId === rejecting.id}
                      onClose={() => setRejecting(null)}
                      onConfirm={(reason) => doReject(rejecting, reason)} />
      )}
    </div>
  );
}

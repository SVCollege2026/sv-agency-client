/**
 * CoursePage.jsx — סביבת-העבודה לקורס (מסך 1 מהמוקאפ): "לוח ניהול קורס".
 * טאבים: טבלה / ציר זמן / פעילים / אישורים.
 * הקורס הוא projection שמאחד את כל תיקיות-העבודה שלו (תיקייה-פר-ריצה
 * בדאטה הנוכחית) — הפריטים של כולן בטבלה אחת.
 * שלוש עמודות-סטטוס נפרדות: עבודת-המשרד ≠ סטטוס-אישור ≠ הפעולה שלך.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { getApprovalsInbox, getArtifacts, getFolder } from "../api.js";
import { EmptyState, ErrorBanner, SkeletonCard, StatusChip } from "../components/ui.jsx";
import {
  PENDING_STATUSES, approvalStatus, artifactThumb, groupFoldersByCourse,
  requiredOfYou, shortDate, typeHe, workStatus,
} from "../lib.js";

const TABS = [["table", "טבלה"], ["timeline", "ציר זמן"],
              ["active", "פעילים"], ["approvals", "אישורים"]];

function Chip({ pair }) {
  if (!pair) return <span className="mi-meta">—</span>;
  const [label, cls] = pair;
  if (!cls) return <span className="mi-meta">{label}</span>;
  return <span className={`mi-chip ${cls}`}>{label}</span>;
}

function Thumb({ item }) {
  const [failed, setFailed] = React.useState(false);
  const url = item.thumb;
  if (url && !failed) {
    return <img className="mi-thumb" src={url} alt="" loading="lazy"
                onError={() => setFailed(true)} />;
  }
  return <span className="mi-thumb" aria-hidden="true">{item.rowKind === "request" ? "📨" : "🖼"}</span>;
}

export default function CoursePage() {
  const { courseKey } = useParams();
  const { folders, openNewRequest } = useOutletContext() ?? {};
  const navigate = useNavigate();
  const [tab, setTab] = useState("table");
  const [artifacts, setArtifacts] = useState(null);
  const [briefs, setBriefs] = useState([]);
  const [inboxItems, setInboxItems] = useState(null);
  const [error, setError] = useState(null);

  const course = useMemo(() => {
    const key = decodeURIComponent(courseKey || "");
    return groupFoldersByCourse(folders || []).find((c) => c.key === key) || null;
  }, [folders, courseKey]);

  const folderIds = useMemo(
    () => new Set((course?.folders || []).map((f) => f.id)), [course]);

  const load = useCallback(() => {
    if (!course) return;
    setError(null);
    // איחוד הפריטים מכל תיקיות-העבודה של הקורס
    Promise.all(course.folders.map((f) =>
      getArtifacts({ folderId: f.id }).catch(() => [])))
      .then((lists) => setArtifacts(lists.flat()))
      .catch((e) => setError(e.message));
    Promise.all(course.folders.map((f) =>
      getFolder(f.id).then((d) => d.briefs || []).catch(() => [])))
      .then((lists) => setBriefs(lists.flat()))
      .catch(() => setBriefs([]));
    getApprovalsInbox("pending")
      .then((d) => setInboxItems((d.items || []).filter(
        (i) => i.folder_id && folderIds.has(i.folder_id))))
      .catch(() => setInboxItems([]));
  }, [course, folderIds]);
  useEffect(load, [load]);

  /* שורות הטבלה — תוצרים (גרסה עדכנית) + בקשות, מכל תיקיות הקורס */
  const rows = useMemo(() => {
    const out = [];
    for (const a of artifacts || []) {
      if (a.is_current_version === false) continue;
      out.push({
        rowKind: "artifact",
        id: a.id,
        title: a.title || typeHe(a.artifact_type),
        type: typeHe(a.artifact_type),
        thumb: artifactThumb(a),
        work: workStatus(a.status),
        approval: approvalStatus(a.status),
        action: requiredOfYou(a.status),
        date: a.updated_at,
        version: a.version_number,
      });
    }
    for (const b of briefs) {
      if (b.is_current_version === false) continue;
      out.push({
        rowKind: "request",
        id: b.id,
        title: b.brief_payload?.free_text?.slice(0, 60)
               || b.brief_doc_name || typeHe(b.request_type),
        type: "בקשה",
        thumb: null,
        work: workStatus(b.status === "pending" ? "in_progress" : b.status),
        approval: ["—", null],
        action: null,
        date: b.updated_at || b.created_at,
        version: b.version_number,
      });
    }
    return out.sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));
  }, [artifacts, briefs]);

  const activeRows = rows.filter((r) =>
    !["הושלם", "נדחה", "בארכיון"].includes(r.work[0]));

  const openRow = (r) => {
    if (r.rowKind === "artifact") navigate(`/media/items/${r.id}`);
  };

  if (folders && !course) {
    return (
      <div className="mi-page">
        <EmptyState icon="🗂" title="הקורס לא נמצא"
                    hint="ייתכן שהתיקייה אוחדה או הועברה — חזרי לכל הקורסים" />
      </div>
    );
  }
  if (error) {
    return <div className="mi-page"><ErrorBanner errors={[{ source: error }]} onRetry={load} /></div>;
  }

  return (
    <div className="mi-page">
      <header style={{ display: "flex", alignItems: "center", gap: 10,
                       flexWrap: "wrap", marginBlockEnd: 14 }}>
        <h1 className="mi-h1" style={{ fontSize: 22, display: "flex", alignItems: "center", gap: 8 }}>
          {course ? course.name : "…"}
          <span aria-hidden="true" style={{ color: "var(--mi-warning)", fontSize: 18 }}>☆</span>
        </h1>
        <span className="mi-meta">
          לוח ניהול קורס
          {course && course.folders.length > 1 && ` · ${course.folders.length} תיקיות עבודה`}
        </span>
        <span style={{ flex: 1 }} />
        <button className="mi-btn mi-btn-primary"
                onClick={() => openNewRequest?.({ folderId: course?.latest?.id })}>
          ＋ בקשה חדשה
        </button>
      </header>

      <div className="mi-tabs" role="tablist" aria-label="תצוגות הקורס"
           style={{ marginBlockEnd: 16 }}>
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key}
                  className="mi-tab" onClick={() => setTab(key)}>
            {label}
            {key === "approvals" && (inboxItems?.length || 0) > 0 && (
              <span className="mi-nav-badge" style={{ marginInlineStart: 6 }}>
                {inboxItems.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {!artifacts && !error && (
        <div aria-busy="true"><SkeletonCard lines={5} /></div>
      )}

      {artifacts && tab === "table" && (
        rows.length === 0 ? (
          <EmptyState icon="🗂" title="אין עדיין פריטי עבודה בקורס הזה"
                      hint='אפשר לפתוח עבודה דרך "בקשה חדשה"' />
        ) : (
          <div className="mi-table-wrap">
            <table className="mi-table">
              <thead>
                <tr>
                  <th>נושא</th>
                  <th>סוג</th>
                  <th>תצוגה</th>
                  <th>סטטוס עבודה</th>
                  <th>אישור</th>
                  <th>נדרש ממך</th>
                  <th>תאריך</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.rowKind}-${r.id}`} onClick={() => openRow(r)}
                      tabIndex={r.rowKind === "artifact" ? 0 : -1}
                      onKeyDown={(e) => e.key === "Enter" && openRow(r)}
                      aria-label={r.title}
                      style={r.rowKind !== "artifact" ? { cursor: "default" } : undefined}>
                    <td style={{ fontWeight: 600, color: "var(--mi-ink)", maxInlineSize: 260 }}>
                      {r.title}
                      {r.version != null && (
                        <span className="mi-meta mi-ltr" style={{ marginInlineStart: 6 }}>V{r.version}</span>
                      )}
                    </td>
                    <td className="mi-meta" style={{ whiteSpace: "nowrap" }}>{r.type}</td>
                    <td><Thumb item={r} /></td>
                    <td><Chip pair={r.work} /></td>
                    <td><Chip pair={r.approval} /></td>
                    <td>
                      {r.action
                        ? <span className="mi-chip mi-chip-primary">{r.action}</span>
                        : <span className="mi-meta">—</span>}
                    </td>
                    <td className="mi-meta mi-ltr" style={{ whiteSpace: "nowrap" }}>
                      {shortDate(r.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {artifacts && tab === "timeline" && (
        rows.length === 0 ? (
          <EmptyState icon="🕘" title="אין עדיין פעילות בקורס הזה" />
        ) : (
          <div className="mi-card">
            <ul className="mi-timeline">
              {rows.map((r) => (
                <li key={`${r.rowKind}-${r.id}`}>
                  <span className="mi-meta mi-ltr">{shortDate(r.date)}</span>
                  <div className="mi-body" style={{ fontWeight: 600, color: "var(--mi-ink)" }}>
                    {r.title}
                  </div>
                  <Chip pair={r.work} />
                </li>
              ))}
            </ul>
          </div>
        )
      )}

      {artifacts && tab === "active" && (
        activeRows.length === 0 ? (
          <EmptyState title="אין פריטים פעילים כרגע" />
        ) : (
          <div className="mi-cards-grid">
            {activeRows.map((r) => (
              <button key={`${r.rowKind}-${r.id}`} className="mi-card"
                      onClick={() => openRow(r)}
                      style={{ textAlign: "start", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="mi-chip mi-chip-info">{r.type}</span>
                  <Chip pair={r.work} />
                </span>
                <strong style={{ fontSize: 14, color: "var(--mi-ink)" }}>{r.title}</strong>
                <span className="mi-meta mi-ltr">{shortDate(r.date)}</span>
              </button>
            ))}
          </div>
        )
      )}

      {artifacts && tab === "approvals" && (
        !inboxItems || inboxItems.length === 0 ? (
          <EmptyState title="אין פריטים שמחכים לאישור בקורס הזה" />
        ) : (
          <div className="mi-card" style={{ padding: 8 }}>
            {inboxItems.map((item) => (
              <div key={`${item.kind}-${item.id}`}
                   style={{ display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 12px", borderBlockEnd: "1px solid var(--mi-border)" }}>
                <StatusChip status={item.status} />
                <span className="mi-body" style={{ flex: 1, minInlineSize: 0 }}>
                  {item.title}
                  {item.version != null && <> · <span className="mi-ltr">V{item.version}</span></>}
                </span>
                {item.kind === "artifact" ? (
                  <button className="mi-btn mi-btn-secondary"
                          style={{ minBlockSize: 36, padding: "6px 14px" }}
                          onClick={() => navigate(`/media/items/${item.id}/review`)}>
                    פתח Review
                  </button>
                ) : (
                  <button className="mi-btn mi-btn-secondary"
                          style={{ minBlockSize: 36, padding: "6px 14px" }}
                          onClick={() => navigate("/media/approvals")}>
                    להחלטה
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

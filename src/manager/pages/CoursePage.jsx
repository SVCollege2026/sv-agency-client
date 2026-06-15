/**
 * CoursePage.jsx — סביבת-העבודה לקורס (מסך 1 מהמוקאפ): "לוח ניהול קורס".
 * טאבים: טבלה / ציר זמן / פעילים / אישורים.
 * הקורס הוא projection שמאחד את כל תיקיות-העבודה שלו (תיקייה-פר-ריצה
 * בדאטה הנוכחית) — הפריטים של כולן בטבלה אחת.
 * שלוש עמודות-סטטוס נפרדות: עבודת-המשרד ≠ סטטוס-אישור ≠ הפעולה שלך.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { getApprovalsInbox, getArtifacts, getFolder, getBudgetAllocations, decideAllocation, submitRequest, requestGoLive } from "../api.js";
import { EmptyState, ErrorBanner, SkeletonCard, StatusChip } from "../components/ui.jsx";
import {
  PENDING_STATUSES, approvalStatus, artifactThumb, courseFolders,
  requiredOfYou, shortDate, typeHe, workStatus,
} from "../lib.js";

const TABS = [["table", "טבלה"], ["timeline", "ציר זמן"],
              ["active", "פעילים"], ["approvals", "אישורים"]];

/* טבלת-התקציב הייעודית של הקורס (אפיון נירית: כל קורס נפתח עם התקציב שלו) */
const fmtIls = (n) => (n != null && !isNaN(Number(n))) ? `₪${Math.round(Number(n)).toLocaleString()}` : "—";
const platformHe = (p) => ({ meta: "מטא", google: "גוגל", social: "סושיאל", all: "כללי" }[p] || p || "כללי");
const allocStatusHe = (s) =>
  s === "recommended" ? { he: "ממתין לאישורך", cls: "mi-chip-primary" }
  : (s === "active" || s === "approved") ? { he: "מאושר ✓", cls: "mi-chip-info" }
  : { he: s, cls: "" };

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
  const [allocations, setAllocations] = useState(null);
  const [budgetBusy, setBudgetBusy] = useState({});
  const [starting, setStarting] = useState(false);
  const [goLiveBusy, setGoLiveBusy] = useState(false);
  const [goLiveMsg, setGoLiveMsg] = useState(null);
  const [error, setError] = useState(null);

  const course = useMemo(() => {
    const key = decodeURIComponent(courseKey || "");
    if (!key || !folders) return null;
    // הקורס הקנוני; תיקיות-העבודה שלו נפתרות מטבלת-השמות פנימי↔פרסום.
    // קורס חדש בלי תיקיות (לדוגמה AI ARCHITECT לפני פתיחה) — לוח ריק, אמיתי.
    const list = courseFolders(key, folders);
    return { key, name: key, folders: list, latest: list[0] || null };
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
    // טבלת-התקציב הייעודית: ההקצאות של כל תיקיות-הקורס
    Promise.all(course.folders.map((f) =>
      getBudgetAllocations(f.id).catch(() => [])))
      .then((lists) => setAllocations(lists.flat()))
      .catch(() => setAllocations([]));
  }, [course, folderIds]);
  useEffect(load, [load]);

  // רק התקציב הרלוונטי: ממתין-לאישור + מאושר/פעיל (בלי ארכיון/נדחה — בלי בלגן).
  const budgetRows = useMemo(() =>
    (allocations || [])
      .filter((a) => ["recommended", "active", "approved"].includes(a.status))
      .sort((x, y) => new Date(y.created_at || 0) - new Date(x.created_at || 0)),
    [allocations]);

  const approveAlloc = (id) => {
    setBudgetBusy((b) => ({ ...b, [id]: true }));
    decideAllocation(id, "approved")
      .then(load).catch((e) => setError(e.message))
      .finally(() => setBudgetBusy((b) => ({ ...b, [id]: false })));
  };
  const rejectAlloc = (id) => {
    const reason = window.prompt("סיבת הדחייה (חובה):");
    if (!reason || !reason.trim()) return;
    setBudgetBusy((b) => ({ ...b, [id]: true }));
    decideAllocation(id, "rejected", reason.trim())
      .then(load).catch((e) => setError(e.message))
      .finally(() => setBudgetBusy((b) => ({ ...b, [id]: false })));
  };

  // "התחל עבודה על הקורס" — לקורס שתיקייתו קיימת אך אין בה עבודה (למשל AI ARCHITECT):
  // משגר בקשת new_course על התיקייה הקיימת → המשרד מפיק תוכנית-מדיה + קראייטיב, וחוזר לאישור.
  const startWork = () => {
    const folderId = course?.latest?.id;
    if (!folderId) { setError("אין תיקייה לקורס — פתחי קורס חדש כדי להתחיל"); return; }
    setStarting(true);
    setError(null);
    submitRequest({
      folderId,
      requestType: "new_course",
      briefPayload: { course_name: course.name, source: "manager_interface_start_work" },
    }).then(() => load())
      .catch((e) => setError(e.message))
      .finally(() => setStarting(false));
  };

  // "העלאה לאוויר" — דרך שער-הבטיחות (request_go_live): מעלה כל פלטפורמה מוכנה, מחזיר
  // pending/blockers על מה שלא מוכן (לא הכל-או-כלום). שולח רק folder; ה-workflow נפתר בשרת.
  const doGoLive = () => {
    const folderId = course?.latest?.id;
    if (!folderId) { setError("אין תיקייה לקורס"); return; }
    if (!window.confirm("להעלות את הקמפיין של הקורס לאוויר? יעלו רק הפלטפורמות המוכנות.")) return;
    setGoLiveBusy(true); setGoLiveMsg(null); setError(null);
    requestGoLive(folderId)
      .then((r) => {
        if (r.ok) {
          const live = (r.live_platforms || []).join(", ") || "—";
          const pend = (r.pending_platforms || []).join(", ");
          setGoLiveMsg({ ok: true, text: `עלה לאוויר: ${live}${pend ? ` · ממתינות: ${pend}` : ""}` });
        } else {
          const why = (r.blockers || []).join(" · ") || (r.pending_platforms || []).join(", ") || "טרם מוכן";
          setGoLiveMsg({ ok: false, text: `טרם מוכן לעלייה: ${why}` });
        }
        load();
      })
      .catch((e) => setError(e.message))
      .finally(() => setGoLiveBusy(false));
  };

  /* שורות הטבלה — תוצרים (גרסה עדכנית) + בקשות, מכל תיקיות הקורס.
     תוצרי-תקציב מיוצגים בטבלת-התקציב שלמעלה — לא כופלים אותם כאן (היה מבלבל). */
  const _isBudgetArtifact = (t) => /budget|allocation|redeploy/i.test(t || "");
  const rows = useMemo(() => {
    const out = [];
    for (const a of artifacts || []) {
      if (a.is_current_version === false) continue;
      if (_isBudgetArtifact(a.artifact_type)) continue;
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
        <button className="mi-btn mi-btn-secondary" disabled={goLiveBusy || !course?.latest?.id}
                onClick={doGoLive}>
          {goLiveBusy ? "מעלה…" : "🚀 העלאה לאוויר"}
        </button>
        <button className="mi-btn mi-btn-primary"
                onClick={() => openNewRequest?.({ folderId: course?.latest?.id })}>
          ＋ בקשה חדשה
        </button>
      </header>

      {goLiveMsg && (
        <div className="mi-card" role="status" aria-live="polite"
             style={{ marginBlockEnd: 14, padding: "10px 16px", borderColor: "transparent",
                      background: goLiveMsg.ok ? "var(--mi-success-bg)" : "var(--mi-warning-bg)",
                      color: goLiveMsg.ok ? "var(--mi-success)" : "var(--mi-warning)" }}>
          {goLiveMsg.text}
        </div>
      )}

      {/* טבלת-התקציב הייעודית של הקורס — בראש העמוד (אפיון נירית) */}
      <section className="mi-card" style={{ padding: 16, marginBlockEnd: 16 }}>
        <h2 className="mi-h2" style={{ marginBlockEnd: 10 }}>תקציב הקורס</h2>
        {allocations == null ? (
          <SkeletonCard lines={2} />
        ) : budgetRows.length === 0 ? (
          <p className="mi-meta">
            אין עדיין תקציב מאושר או מומלץ לקורס — יופק מתוכנית-ההשתלטות או מבקשה.
          </p>
        ) : (
          <div className="mi-table-wrap">
            <table className="mi-table">
              <thead>
                <tr><th>פלטפורמה</th><th>סכום</th><th>סטטוס</th><th>נימוק</th><th>נדרש ממך</th></tr>
              </thead>
              <tbody>
                {budgetRows.map((a) => {
                  const st = allocStatusHe(a.status);
                  return (
                    <tr key={a.id}>
                      <td className="mi-meta" style={{ whiteSpace: "nowrap" }}>{platformHe(a.platform)}</td>
                      <td className="mi-ltr" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{fmtIls(a.amount_ils)}</td>
                      <td><span className={`mi-chip ${st.cls}`}>{st.he}</span></td>
                      <td className="mi-meta" style={{ maxInlineSize: 300 }}>{a.rationale || "—"}</td>
                      <td>
                        {a.status === "recommended" ? (
                          <span style={{ display: "flex", gap: 6 }}>
                            <button className="mi-btn mi-btn-secondary" disabled={!!budgetBusy[a.id]}
                                    style={{ minBlockSize: 34, padding: "4px 12px" }}
                                    onClick={() => approveAlloc(a.id)}>
                              {budgetBusy[a.id] ? "…" : "אשרי"}
                            </button>
                            <button className="mi-btn mi-btn-ghost" disabled={!!budgetBusy[a.id]}
                                    style={{ minBlockSize: 34, padding: "4px 10px" }}
                                    onClick={() => rejectAlloc(a.id)}>
                              דחייה
                            </button>
                          </span>
                        ) : <span className="mi-meta">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
          <div>
            <EmptyState icon="🗂" title="אין עדיין פריטי עבודה בקורס הזה"
                        hint="התחילי עבודה — והמשרד יפיק תוכנית-מדיה וקראייטיב שיחזרו אלייך לאישור." />
            <div style={{ marginBlockStart: 16, textAlign: "center" }}>
              <button className="mi-btn mi-btn-primary" disabled={starting} onClick={startWork}>
                {starting ? "מתחיל…" : "התחל עבודה על הקורס"}
              </button>
            </div>
          </div>
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

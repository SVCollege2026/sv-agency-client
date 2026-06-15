/**
 * CoursePage.jsx — סביבת-העבודה לקורס (מסך 1 מהמוקאפ): "לוח ניהול קורס".
 * טאבים: טבלה / ציר זמן / פעילים / אישורים.
 * הקורס הוא projection שמאחד את כל תיקיות-העבודה שלו (תיקייה-פר-ריצה
 * בדאטה הנוכחית) — הפריטים של כולן בטבלה אחת.
 * שלוש עמודות-סטטוס נפרדות: עבודת-המשרד ≠ סטטוס-אישור ≠ הפעולה שלך.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { getApprovalsInbox, getArtifacts, getFolder, getBudgetAllocations, decideAllocation, submitRequest, requestGoLive, getTakeoverPlan } from "../api.js";
import { EmptyState, ErrorBanner, SkeletonCard, StatusChip } from "../components/ui.jsx";
import RejectDialog from "../components/RejectDialog.jsx";
import {
  artifactThumb, courseFolders, fullDate, requiredOfYou,
  shortDate, stripInternalSteps, typeHe, workStatus,
} from "../lib.js";

const TABS = [["table", "טבלה"], ["timeline", "ציר זמן"],
              ["active", "פעילים"], ["approvals", "אישורים"]];

/* התאמת שם-קורס ל-course_key של תוכנית-ההשתלטות (זהה ל-TakeoverPlanPage) — הספציפי לפני הכללי */
const CANON = { marketing_social_ai: "marketing" };
const canon = (k) => (k && CANON[k]) || k;
const COURSE_ALIASES = [
  ["ai_architect", ["architect", "ארכיטקט"]],
  ["marketing_b2b", ["b2b"]],
  ["qa", ["qa", "פיתוח טכנולוגיות", "בדיקות"]],
  ["cyber", ["cyber", "סייבר"]],
  ["gaming", ["gaming", "גיימינג", "פיתוח משחקים"]],
  ["marketing_social_ai", ["סושיאל"]],
  ["marketing", ["שיווק", "marketing"]],
  ["ai", ["ai", "בינה"]],
];
function matchCourseKey(name) {
  const s = (name || "").toLowerCase();
  for (const [key, aliases] of COURSE_ALIASES) if (aliases.some((a) => s.includes(a))) return key;
  return "_other";
}

/* טבלת-התקציב הייעודית של הקורס (אפיון נירית: כל קורס נפתח עם התקציב שלו) */
const fmtIls = (n) => (n != null && !isNaN(Number(n))) ? `₪${Math.round(Number(n)).toLocaleString()}` : "—";
const platformHe = (p) => ({ meta: "מטא", google: "גוגל", social: "סושיאל", all: "כללי" }[p] || p || "כללי");

// טקסונומיית-סטטוס לפי המקור-האמיתי, לא לפי פלטפורמה (fix #2):
//   recommended            → "ממתין לאישורך" (כפתורי אשרי/דחייה)
//   decided_by=manager      → "מאושר על ידך" (רק החלטה שלה בפועל)
//   active/approved בלי שלה → "קיים בחשבון (לא אישור שלך)" — מצב-נוכחי שיובא, גם גוגל.
// אף פעם לא מציגים active/approved של המערכת כאישור שלה.
const allocStatusHe = (a) => {
  if (a.status === "recommended") return { he: "ממתין לאישורך", cls: "mi-chip-primary" };
  if (a.decided_by === "marketing_manager") return { he: "מאושר על ידך ✓", cls: "mi-chip-info" };
  return { he: "קיים בחשבון (לא אישור שלך)", cls: "" };
};

// תקופת-ההקצאה (from→to) — טבלת-תקציב מתוארכת (fix #4). מקורות, בסדר עדיפות:
//   1. עמודות period_start/period_end (הקצאות סוכן רגילות; כמו PlansBudgetPage).
//   2. metadata של takeover_redeploy: התחלה = pacing_start | go_live | computed_for;
//      סיום = period_month_end. ל-AI מאוחד אין שורת-תקציב פשוטה — הטווח נגזר משלבי-
//      האופציות (option_a/b.phases[].from/to: ההתחלה המוקדמת ביותר → הסיום המאוחר).
//   3. אין נתון אמיתי → null (מוצג "—" ביושר, בלי להמציא תאריך).
const _minMaxPhaseDates = (md) => {
  const phases = [];
  for (const opt of [md?.option_a_convert, md?.option_b_adset_to_end]) {
    for (const ph of (opt?.phases || [])) {
      if (ph?.from) phases.push(ph.from);
      if (ph?.to) phases.push(ph.to);
    }
  }
  if (!phases.length) return [null, null];
  const sorted = phases.filter(Boolean).sort();
  return [sorted[0], sorted[sorted.length - 1]];
};
const allocPeriod = (a) => {
  if (a.period_start || a.period_end) return [a.period_start || null, a.period_end || null];
  const md = a.metadata || {};
  const [phaseFrom, phaseTo] = _minMaxPhaseDates(md);
  const start = md.pacing_start || md.go_live || phaseFrom || md.computed_for || null;
  const end = phaseTo || md.period_month_end || null;
  return [start, end];
};
const periodHe = (a) => {
  const [start, end] = allocPeriod(a);
  if (!start && !end) return "—";
  return `${fullDate(start)} – ${fullDate(end)}`;
};

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
  const [rejectingAlloc, setRejectingAlloc] = useState(null);  // ההקצאה שנדחית (RejectDialog)
  const [starting, setStarting] = useState(false);
  const [goLiveBusy, setGoLiveBusy] = useState(false);
  const [goLiveMsg, setGoLiveMsg] = useState(null);
  const [takeover, setTakeover] = useState(null);
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
      .then((d) => setInboxItems(stripInternalSteps((d.items || []).filter(
        (i) => i.folder_id && folderIds.has(i.folder_id)))))
      .catch(() => setInboxItems([]));
    // הנחיית-האסטרטג לקורס מתוך תוכנית-ההשתלטות (best-effort; חסר ⇒ פשוט לא מוצג)
    getTakeoverPlan().then(setTakeover).catch(() => setTakeover(null));
    // טבלת-התקציב הייעודית: ההקצאות של כל תיקיות-הקורס
    Promise.all(course.folders.map((f) =>
      getBudgetAllocations(f.id).catch(() => [])))
      .then((lists) => setAllocations(lists.flat()))
      .catch(() => setAllocations([]));
  }, [course, folderIds]);
  useEffect(load, [load]);

  // טבלת-התקציב מציגה רק את **תקציב-ההשתלטות** (recommendation_kind=takeover_redeploy) +
  // מה שהמנהלת אישרה בפועל (decided_by) — לא את ערימת ההמלצות-מאתמול (initial_allocation/
  // spend_rate), ואחת פר-פלטפורמה (בלי כפילויות). זה מה ש"תקציב הקורס" אמור להיות:
  // ההצעה הנקייה לאישור, לא רשימת-כל-השורות.
  // fix #2: גוגל **כן** מוצגת — בכנות תחת "קיים בחשבון (לא אישור שלך)" דרך הטקסונומיה;
  // לא מסתירים אותה ולא מתייגים אותה כאישור-שלה. ה-hack שדילג על גוגל הוסר.
  const allocKind = (a) => (a.metadata || {}).recommendation_kind || (a.metadata || {}).decision_kind || "";
  const budgetRows = useMemo(() => {
    const relevant = (allocations || []).filter((a) =>
      allocKind(a) === "takeover_redeploy" || a.decided_by === "marketing_manager");
    const seen = new Set(); const out = [];
    for (const a of relevant.sort((x, y) => new Date(y.created_at || 0) - new Date(x.created_at || 0))) {
      const grp = a.status === "recommended"
        ? "proposal"
        : (a.decided_by === "marketing_manager" ? "approved" : "current");
      const key = `${grp}:${a.platform}`;
      if (seen.has(key)) continue;
      seen.add(key); out.push(a);
    }
    return out;
  }, [allocations]);

  // הנחיית-האסטרטג לקורס הזה מתוך תוכנית-ההשתלטות (נימוק + פעולות פר-קורס) — הסיגנל,
  // לא הטקסט הגנרי על שורת-תקציב. מותאם לפי course_key.
  const courseGuidance = useMemo(() => {
    const plan = takeover?.plan;
    if (!plan || !course) return null;
    const want = canon(matchCourseKey(course.key));
    const c = (plan.courses || []).find((x) => canon(x.course_key) === want) || null;
    const prs = (plan.course_priorities || []).filter((p) => canon(matchCourseKey(p.course)) === want);
    return (c || prs.length) ? { c, prs } : null;
  }, [takeover, course]);

  const approveAlloc = (id) => {
    setBudgetBusy((b) => ({ ...b, [id]: true }));
    decideAllocation(id, "approved")
      .then(load).catch((e) => setError(e.message))
      .finally(() => setBudgetBusy((b) => ({ ...b, [id]: false })));
  };
  // דחיית-תקציב מחייבת סיבה — דרך RejectDialog (אותו מודאל נגיש כמו ApprovalsPage),
  // לא window.prompt (fix #3). פותחים את הדיאלוג עם הקצאה כ-item; ההכרעה ב-confirmRejectAlloc.
  const rejectAlloc = (a) => setRejectingAlloc({
    id: a.id,
    title: `${platformHe(a.platform)} · ${fmtIls(a.amount_ils)}`,
  });
  const confirmRejectAlloc = (reason) => {
    const id = rejectingAlloc?.id;
    if (!id) return;
    setBudgetBusy((b) => ({ ...b, [id]: true }));
    decideAllocation(id, "rejected", reason)
      .then(() => { setRejectingAlloc(null); load(); })
      .catch((e) => setError(e.message))
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
  // fix #7: שורות קראייטיב/קופי נפתחות ישירות למסך ה-Review (קונספט+קופי+ויזואל),
  // לא לתווית-פריט סתמית. שאר התוצרים נפתחים לתיק-הפריט.
  const _opensReview = (t) =>
    /creative|copy|concept|render|visual|video|art_direction|ad_copy/i.test(t || "");
  // fix #5: עמודת-מצב אחת במקום שתיים (סטטוס-עבודה + אישור). שלושה מצבים בלבד:
  //   "מחכה לך" — נדרשת ממנה פעולה (requiredOfYou) ⇒ בראש העדיפות.
  //   "הושלם"   — עבודת-המשרד הסתיימה (הושלם/בוצע) ובלי פעולה פתוחה.
  //   "בעבודה"  — כל השאר (כולל בקשות בעבודה).
  const STATE = {
    waiting: ["מחכה לך", "mi-chip-warning"],
    done:    ["הושלם",   "mi-chip-success"],
    working: ["בעבודה",  "mi-chip-info"],
  };
  const deriveState = (workLabel, action) => {
    if (action) return "waiting";
    if (["הושלם", "בוצע"].includes(workLabel)) return "done";
    return "working";
  };
  const rows = useMemo(() => {
    const out = [];
    for (const a of artifacts || []) {
      if (a.is_current_version === false) continue;
      if (_isBudgetArtifact(a.artifact_type)) continue;
      const work = workStatus(a.status);
      const action = requiredOfYou(a.status);
      out.push({
        rowKind: "artifact",
        id: a.id,
        title: a.title || typeHe(a.artifact_type),
        type: typeHe(a.artifact_type),
        artifactType: a.artifact_type,
        opensReview: _opensReview(a.artifact_type),
        thumb: artifactThumb(a),
        work,
        action,
        state: deriveState(work[0], action),
        date: a.updated_at,
        version: a.version_number,
      });
    }
    for (const b of briefs) {
      if (b.is_current_version === false) continue;
      const work = workStatus(b.status === "pending" ? "in_progress" : b.status);
      out.push({
        rowKind: "request",
        id: b.id,
        title: b.brief_payload?.free_text?.slice(0, 60)
               || b.brief_doc_name || typeHe(b.request_type),
        type: "בקשה",
        artifactType: null,
        opensReview: false,
        thumb: null,
        work,
        action: null,
        state: deriveState(work[0], null),
        date: b.updated_at || b.created_at,
        version: b.version_number,
      });
    }
    return out.sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));
  }, [artifacts, briefs]);

  // fix #5: ברירת-המחדל של תצוגת-הטבלה = "מחכה לך"; "הכל" משני.
  const [tableFilter, setTableFilter] = useState("waiting");
  const tableRows = useMemo(
    () => tableFilter === "waiting" ? rows.filter((r) => r.state === "waiting") : rows,
    [rows, tableFilter]);

  const activeRows = rows.filter((r) =>
    !["הושלם", "נדחה", "בארכיון"].includes(r.work[0]));

  // fix #7: קראייטיב/קופי → ישר ל-Review; שאר התוצרים → תיק-הפריט.
  const openRow = (r) => {
    if (r.rowKind !== "artifact") return;
    navigate(r.opensReview ? `/media/items/${r.id}/review` : `/media/items/${r.id}`);
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

      {/* הנחיית-האסטרטג לקורס — הסיגנל האמיתי (נימוק + פעולות פר-קורס), לא טקסט גנרי */}
      {courseGuidance && (
        <section className="mi-card" style={{ padding: 16, marginBlockEnd: 16 }}>
          <h2 className="mi-h2" style={{ marginBlockEnd: 8 }}>הנחיית האסטרטג לקורס</h2>
          {courseGuidance.c?.reasoning && (
            <p className="mi-body" style={{ whiteSpace: "pre-wrap", marginBlockEnd: 8 }}>
              {courseGuidance.c.reasoning}
            </p>
          )}
          {courseGuidance.prs.map((pr, i) => (
            <div key={i} style={{ borderInlineStart: "3px solid var(--mi-border)",
                                  paddingInlineStart: 10, marginBlockStart: 6 }}>
              {pr.why && <p className="mi-body" style={{ whiteSpace: "pre-wrap", margin: "4px 0" }}>{pr.why}</p>}
              {pr.note_to_platform_manager && (
                <p className="mi-body" style={{ whiteSpace: "pre-wrap", margin: "4px 0",
                                                color: "var(--mi-ink-soft, #444)" }}>
                  📌 {pr.note_to_platform_manager}
                </p>
              )}
            </div>
          ))}
        </section>
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
                <tr><th>פלטפורמה</th><th>תקופה</th><th>סכום</th><th>סטטוס</th><th>נדרש ממך</th></tr>
              </thead>
              <tbody>
                {budgetRows.map((a) => {
                  const st = allocStatusHe(a);
                  return (
                    <tr key={a.id}>
                      <td className="mi-meta" style={{ whiteSpace: "nowrap" }}>{platformHe(a.platform)}</td>
                      <td className="mi-meta mi-ltr" style={{ whiteSpace: "nowrap" }}>{periodHe(a)}</td>
                      <td className="mi-ltr" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{fmtIls(a.amount_ils)}</td>
                      <td><span className={`mi-chip ${st.cls}`}>{st.he}</span></td>
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
                                    onClick={() => rejectAlloc(a)}>
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
          <>
            {/* fix #5: ברירת-מחדל "מחכה לך"; "הכל" משני */}
            <div className="mi-tabs" role="tablist" aria-label="סינון מצב"
                 style={{ marginBlockEnd: 12 }}>
              {[["waiting", "מחכה לך"], ["all", "הכל"]].map(([key, label]) => (
                <button key={key} role="tab" aria-selected={tableFilter === key}
                        className="mi-tab" onClick={() => setTableFilter(key)}>
                  {label}
                  {key === "waiting" && rows.filter((r) => r.state === "waiting").length > 0 && (
                    <span className="mi-nav-badge" style={{ marginInlineStart: 6 }}>
                      {rows.filter((r) => r.state === "waiting").length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {tableRows.length === 0 ? (
              <EmptyState title="אין כרגע פריטים שמחכים לך"
                          hint='הכל בעבודה או הושלם — לחצי "הכל" כדי לראות את המצב המלא' />
            ) : (
          <div className="mi-table-wrap">
            <table className="mi-table">
              <thead>
                <tr>
                  <th>נושא</th>
                  <th>סוג</th>
                  <th>תצוגה</th>
                  <th>מצב</th>
                  <th>תאריך</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => (
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
                    <td><Chip pair={STATE[r.state]} /></td>
                    <td className="mi-meta mi-ltr" style={{ whiteSpace: "nowrap" }}>
                      {shortDate(r.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            )}
          </>
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

      {/* fix #3: דחיית-תקציב דרך RejectDialog (סיבה חובה), במקום window.prompt */}
      {rejectingAlloc && (
        <RejectDialog item={rejectingAlloc} busy={!!budgetBusy[rejectingAlloc.id]}
                      onClose={() => setRejectingAlloc(null)}
                      onConfirm={confirmRejectAlloc} />
      )}
    </div>
  );
}

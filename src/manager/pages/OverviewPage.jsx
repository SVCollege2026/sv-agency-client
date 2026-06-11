/**
 * OverviewPage.jsx — מסך-הבית, אחד-לאחד מהמוקאפ:
 * "בוקר טוב, [שם] 👋" · 4 מוני-סטטוס אמיתיים · "מה מחכה לך עכשיו" עם
 * פסי-צבע לפי סוג · "פעילות אחרונה" (רק החלטות-שלה + בוצע/טופל) ·
 * "בקצרה — מצב הקמפיינים" מול יעד עסקי (נרשמים מול יעד-מחזור, לא מדדי-מדיה).
 * אין כרטיס בלי תוכן מאחוריו — כשל-שליפה מוצג, לא מוסתר.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import {
  getApprovalsInbox, getBlockers, getCycles, getOverview, getRecentDecisions,
  resolveBlocker,
} from "../api.js";
import {
  ErrorBanner, EmptyState, PriorityCard, SkeletonCard, StatCard, timeAgoHe,
} from "../components/ui.jsx";
import {
  MANAGER, activityIcon, cyclesForCourse, filterActivityForManager,
  filterInboxItems, filterWaitingForMe, folderStatus, groupFoldersByCourse,
  isManagerBlocker, monthHe, pctOfTarget, pickRelevantCycle, testFolderIdSet,
} from "../lib.js";

function greetingHe() {
  const h = new Date().getHours();
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  return "ערב טוב";
}

/* "דורש החלטה" על חסם — דיאלוג פתרון קטן, ההחלטה נרשמת בדלת הקיימת */
function BlockerDialog({ blocker, onClose, onResolved }) {
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!resolution.trim()) { setError("כתבי איך טיפלת או מה ההחלטה"); return; }
    setBusy(true);
    try {
      await resolveBlocker(blocker.id, resolution.trim());
      onResolved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="mi-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mi-modal" role="dialog" aria-modal="true" aria-label="טיפול בחסם">
        <h2 className="mi-h2" style={{ marginBlockEnd: 8 }}>{blocker.title}</h2>
        <p className="mi-meta" style={{ marginBlockEnd: 12 }}>
          המשרד ממתין להחלטה או למידע ממך כדי להמשיך
        </p>
        <textarea className="mi-textarea" value={resolution} autoFocus
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="ההחלטה / המידע החסר…" />
        {error && <p className="mi-meta" role="alert" style={{ color: "var(--mi-danger)", marginBlockStart: 8 }}>{error}</p>}
        <div className="mi-actionbar" style={{ padding: 0, border: "none", marginBlockStart: 14 }}>
          <button className="mi-btn mi-btn-primary" disabled={busy} onClick={submit}
                  style={{ flex: 1, justifyContent: "center" }}>שליחה למשרד</button>
          <button className="mi-btn mi-btn-ghost" disabled={busy} onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { folders } = useOutletContext() ?? {};
  const [data, setData] = useState(null);
  const [activity, setActivity] = useState(null);
  const [cycles, setCycles] = useState(null);
  const [pendingItems, setPendingItems] = useState(null);
  const [blockers, setBlockers] = useState(null);
  const [error, setError] = useState(null);
  const [blockerDialog, setBlockerDialog] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setError(null);
    getOverview().then(setData).catch((e) => setError(e.message));
    // המונה "מחכים לאישור" נספר אחרי סינון תיקיות-טסט (מונה ↔ תוכן עקביים)
    getApprovalsInbox("pending", null, 200)
      .then((d) => setPendingItems(d?.items ?? []))
      .catch(() => setPendingItems(null));
    // רשימת-החסמים המלאה — בשביל ה-join לסוג (פריטי ה-overview בלי blocker_type)
    getBlockers()
      .then((rows) => setBlockers(Array.isArray(rows) ? rows : rows?.blockers ?? []))
      .catch(() => setBlockers(null));
    // "פעילות אחרונה" — מסונן למה שרלוונטי למנהלת (החלטות-שלה + בוצע/טופל)
    getRecentDecisions(50)
      .then((rows) => setActivity(filterActivityForManager(rows).slice(0, 8)))
      .catch(() => setActivity([]));
    getCycles()
      .then((d) => setCycles(d?.cycles ?? []))
      .catch(() => setCycles([]));
  }, []);
  useEffect(load, [load]);

  if (error) {
    return (
      <div className="mi-page">
        <ErrorBanner errors={[{ source: error }]} onRetry={load} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mi-page" aria-busy="true">
        <div className="mi-kpis">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={2} />)}
        </div>
        <div className="mi-cols">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      </div>
    );
  }

  const { kpis, fetch_errors: fetchErrors } = data;
  // מסנני-התצוגה הקבועים: חסמי-מערכת מנותבים מהפיד, תיקיות-טסט לא נספרות
  const testIds = testFolderIdSet(folders || []);
  const filteredPending = pendingItems != null
    ? filterInboxItems(pendingItems, testIds)
    : null;
  const pendingCount = filteredPending != null
    ? filteredPending.length
    : kpis.pending_approvals;
  const managerBlockers = blockers != null ? blockers.filter(isManagerBlocker) : null;
  const blockersCount = managerBlockers != null ? managerBlockers.length : kpis.open_blockers;

  /* "מה מחכה לך עכשיו" מורכב לוקאלית: רשימת-ה-20 של השרת מוצפת בחסמי-מערכת,
     אז בונים מהמקורות המסוננים — חסמים-שלה (דחופים תחילה) ואז אישורים. */
  let waiting;
  if (managerBlockers != null && filteredPending != null) {
    const blockerCards = managerBlockers.map((b) => ({
      kind: "blocker",
      id: b.id,
      tag_he: /brief|info|clarification/.test(b.blocker_type || "") ? "חסר מידע" : "דורש החלטה",
      title: b.description || b.blocker_type,
      since: b.opened_at,
      urgent: b.severity === "critical" || b.severity === "high",
    }));
    const approvalCards = filteredPending.map((i) => ({
      kind: i.kind, id: i.id, tag_he: "דורש אישור", title: i.title,
      course: i.course, version: i.version, since: i.updated_at,
      // תגית-תיקייה: כל פריט מציג את שיוכו בכל הופעה. תקציב/המלצות בלי
      // קורס שייכים לתיקיית "פריסות מדיה ותקציב".
      folder_tag: i.course
        || (["budget_allocation", "recommendation"].includes(i.kind)
            ? "פריסות מדיה ותקציב" : "פעילות בית-ספרית"),
    }));
    waiting = [
      ...blockerCards.filter((b) => b.urgent),
      ...approvalCards,
      ...blockerCards.filter((b) => !b.urgent),
    ];
  } else {
    // fallback לרשימת-השרת כשאחת השליפות נכשלה — מסונן ככל האפשר
    const blockerTypeById = blockers != null
      ? new Map(blockers.map((b) => [b.id, b.blocker_type]))
      : null;
    waiting = filterWaitingForMe(data.waiting_for_me ?? [], testIds, blockerTypeById);
  }

  const openItem = (w) => {
    if (w.kind === "artifact") navigate(`/media/items/${w.id}`);
    else if (w.kind === "blocker") setBlockerDialog(w);
    else navigate("/media/approvals");
  };

  /* "בקצרה" — קורסים אמיתיים מול יעד-המחזור העסקי (נרשמים מול יעד, לא מדיה) */
  const briefRows = groupFoldersByCourse(folders || []).map((c) => {
    const cycle = pickRelevantCycle(cyclesForCourse(cycles || [], c.key));
    const pct = pctOfTarget(cycle);
    const month = monthHe(cycle?.start_date);
    const [statusHe, statusCls] = folderStatus(c.status);
    let line;
    if (pct != null) line = `קמפיין לידים ${month || ""} — ${pct}% מהיעד`.trim();
    else if (cycle) line = `מחזור ${month || ""} — טרם הוגדר יעד`.trim();
    else line = "טרם הוגדר מחזור";
    return { key: c.key, name: c.name, statusHe, statusCls, line, pct };
  });

  return (
    <div className="mi-page">
      <header style={{ textAlign: "center", marginBlockEnd: 24 }}>
        <h1 className="mi-h1">{greetingHe()}, {MANAGER.name} 👋</h1>
        <p className="mi-meta" style={{ marginBlockStart: 4, fontSize: 13 }}>
          ברוכים הבאים למערכת ניהול המדיה והקמפיינים ·{" "}
          עודכן <span className="mi-ltr">{timeAgoHe(data.freshness?.generated_at) || "עכשיו"}</span>
        </p>
      </header>

      <ErrorBanner errors={fetchErrors} onRetry={load} />

      <section aria-label="מונים" className="mi-kpis">
        <StatCard value={pendingCount} label="פריטים מחכים לאישור" icon="✋"
                  tone="primary" onClick={() => navigate("/media/approvals")} />
        <StatCard value={kpis.new_requests} label="בקשות חדשות" icon="📨" tone="info" />
        <StatCard value={kpis.active_items} label="פרויקטים פעילים" icon="🚀" tone="success" />
        <StatCard value={blockersCount} label="חסמים פתוחים" icon="⛔" tone="danger" />
      </section>

      <div className="mi-cols">
        <section aria-label="מה מחכה לך עכשיו">
          <h2 className="mi-h2" style={{ marginBlockEnd: 10 }}>מה מחכה לך עכשיו</h2>
          {waiting.length === 0 ? (
            <EmptyState title="אין פריטים שמחכים לך" hint="כל מה שדורש אותך — יופיע כאן" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {waiting.slice(0, 6).map((w) => (
                <PriorityCard key={`${w.kind}-${w.id}`} tag={w.tag_he}
                  folder={w.folder_tag || w.course}
                  title={w.title}
                  meta={[w.version != null ? `V${w.version}` : null,
                         timeAgoHe(w.since)].filter(Boolean).join(" · ")}
                  onClick={() => openItem(w)} />
              ))}
            </div>
          )}
          <Link to="/media/approvals" className="mi-meta"
                style={{ display: "inline-block", marginBlockStart: 10, color: "var(--mi-primary)", fontWeight: 600 }}>
            ‹ לכל הפריטים שמחכים לי
          </Link>
        </section>

        <section aria-label="פעילות אחרונה">
          <h2 className="mi-h2" style={{ marginBlockEnd: 10 }}>פעילות אחרונה</h2>
          <div className="mi-card" style={{ padding: 8 }}>
            {activity == null && <SkeletonCard lines={3} />}
            {activity?.length === 0 && (
              <p className="mi-meta" style={{ padding: 12 }}>עוד אין פעילות לתצוגה</p>
            )}
            {(activity || []).map((r) => (
              <div key={r.id} style={{ display: "flex", gap: 10, padding: "10px 12px",
                   borderBlockEnd: "1px solid var(--mi-border)", alignItems: "flex-start" }}>
                <span aria-hidden="true" style={{
                  background: "var(--mi-accent-bg)", color: "var(--mi-accent)",
                  borderRadius: 8, inlineSize: 28, blockSize: 28, fontSize: 13, flexShrink: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {activityIcon(r.decision_type)}
                </span>
                <span style={{ flex: 1, minInlineSize: 0 }}>
                  <span className="mi-body" style={{ display: "block" }}>{r.display_he}</span>
                  <span className="mi-meta">{timeAgoHe(r.decided_at)}</span>
                </span>
              </div>
            ))}
          </div>
          <Link to="/media/activity" className="mi-meta"
                style={{ display: "inline-block", marginBlockStart: 10, color: "var(--mi-primary)", fontWeight: 600 }}>
            ‹ לכל הפעילות
          </Link>
        </section>

        <section aria-label="בקצרה — מצב הקמפיינים">
          <h2 className="mi-h2" style={{ marginBlockEnd: 10 }}>בקצרה — מצב הקמפיינים</h2>
          <div className="mi-card" style={{ padding: "4px 16px" }}>
            {cycles == null && <SkeletonCard lines={3} />}
            {cycles != null && briefRows.length === 0 && (
              <p className="mi-meta" style={{ padding: 12 }}>
                עוד אין קורסים פעילים — אפשר לפתוח דרך "פתיחת קורס חדש"
              </p>
            )}
            {cycles != null && briefRows.map((row) => (
              <div key={row.key} className="mi-brief-row">
                <span style={{ minInlineSize: 0, flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 14, color: "var(--mi-ink)" }}>{row.name}</strong>
                    <span className={`mi-chip ${row.statusCls}`}>{row.statusHe}</span>
                  </span>
                  <span className="mi-meta" style={{ display: "block", marginBlockStart: 3 }}>
                    {row.line}
                  </span>
                </span>
                <Link to={`/media/courses/${encodeURIComponent(row.key)}`} aria-label={`לתיקיית ${row.name}`}
                      style={{ color: "var(--mi-ink-3)", textDecoration: "none", fontSize: 18 }}>
                  ‹
                </Link>
              </div>
            ))}
          </div>
          <Link to="/media/courses" className="mi-meta"
                style={{ display: "inline-block", marginBlockStart: 10, color: "var(--mi-primary)", fontWeight: 600 }}>
            ‹ לכל הקמפיינים
          </Link>
        </section>
      </div>

      {blockerDialog && (
        <BlockerDialog blocker={blockerDialog}
                       onClose={() => setBlockerDialog(null)}
                       onResolved={() => { setBlockerDialog(null); load(); }} />
      )}
    </div>
  );
}

/**
 * ApprovalsPage.jsx — תיבת האישורים המאוחדת (מסך 4 מהמוקאפ).
 * פריט-פריט · צמוד-גרסה · דחייה מחייבת סיבה · אין שום bulk.
 * מאחדת: תוצרים (artifacts) + הקצאות-תקציב + המלצות-מדיה.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  getApprovalsInbox, approveArtifact, requestArtifactRevision,
  decideAllocation, decideRecommendation,
} from "../api.js";
import { StatusChip, EmptyState, ErrorBanner, SkeletonCard, timeAgoHe } from "../components/ui.jsx";
import RejectDialog from "../components/RejectDialog.jsx";

const KIND_HE = {
  artifact: "תוצר",
  budget_allocation: "תקציב",
  recommendation: "המלצת מדיה",
};

function ApprovalCard({ item, onApprove, onReject, busy }) {
  return (
    <article className="mi-card" aria-label={item.title}
             style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {item.course && <span className="mi-chip mi-chip-info">{item.course}</span>}
        <span className="mi-chip mi-chip-primary">{KIND_HE[item.kind] || item.kind}</span>
        {item.version != null && (
          <span className="mi-chip mi-chip-info mi-ltr" title="אישור צמוד-גרסה">
            V{item.version}
          </span>
        )}
        <StatusChip status={item.status} />
      </div>

      {item.reopened_from_version != null && (
        <div className="mi-meta" role="note"
             style={{ background: "var(--mi-warning-bg)", color: "var(--mi-warning)",
                      borderRadius: 8, padding: "6px 10px" }}>
          גרסה חדשה אחרי שאושרה <span className="mi-ltr">V{item.reopened_from_version}</span> —
          נפתח מחדש לאישור שלך
        </div>
      )}

      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--mi-ink)" }}>
        {item.title}
      </h3>
      {item.rationale && <p className="mi-meta" style={{ margin: 0 }}>{item.rationale}</p>}
      <p className="mi-meta" style={{ margin: 0 }}>{timeAgoHe(item.updated_at)}</p>

      {/* החלטה פר-פריט בלבד — אין מסלול קבוצתי */}
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
    </article>
  );
}

export default function ApprovalsPage({ onPendingCount }) {
  const [tab, setTab] = useState("pending");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [rejecting, setRejecting] = useState(null);   // הפריט שבדיאלוג "לתקן"
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback((t = tab) => {
    setError(null);
    setData(null);
    getApprovalsInbox(t)
      .then((d) => {
        setData(d);
        if (t === "pending") onPendingCount?.(d.count);
      })
      .catch((e) => setError(e.message));
  }, [tab, onPendingCount]);
  useEffect(() => load(tab), [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const doApprove = async (item) => {
    setBusyId(item.id);
    setNotice(null);
    try {
      if (item.kind === "artifact") await approveArtifact(item.id);
      else if (item.kind === "budget_allocation") await decideAllocation(item.id, "approved");
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
      if (item.kind === "artifact") await requestArtifactRevision(item.id, reason);
      else if (item.kind === "budget_allocation") await decideAllocation(item.id, "rejected", reason);
      else await decideRecommendation(item.id, "reject", reason);
      setNotice({ kind: "ok", text: "בקשת השינויים נשלחה למשרד — גרסה מתוקנת תחזור לאישור" });
      setRejecting(null);
      load();
    } catch (e) {
      setNotice({ kind: "err", text: `השליחה נכשלה: ${e.message}` });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mi-page">
      <header style={{ marginBlockEnd: 16 }}>
        <h1 className="mi-h1" style={{ fontSize: 22 }}>אישורים</h1>
        <p className="mi-meta" style={{ marginBlockStart: 4 }}>
          כל החלטה נפרדת וצמודה לגרסה המדויקת — אין אישור קבוצתי
        </p>
      </header>

      <div role="tablist" aria-label="סינון אישורים"
           style={{ display: "flex", gap: 4, marginBlockEnd: 16 }}>
        {[["pending", "מחכה לאישור שלי"], ["decided", "אישורים שניתנו"]].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key}
                  className={`mi-navlink${tab === key ? " mi-navlink-active" : ""}`}
                  onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="mi-card" role="status" aria-live="polite"
             style={{
               marginBlockEnd: 16, padding: "10px 16px",
               background: notice.kind === "ok" ? "var(--mi-success-bg)" : "var(--mi-danger-bg)",
               color: notice.kind === "ok" ? "var(--mi-success)" : "var(--mi-danger)",
               borderColor: "transparent",
             }}>
          {notice.text}
        </div>
      )}

      {error && <ErrorBanner errors={[{ source: error }]} onRetry={() => load()} />}
      {!error && !data && (
        <div className="mi-cards-grid" aria-busy="true">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      )}

      {data && <ErrorBanner errors={data.fetch_errors} onRetry={() => load()} />}

      {data && tab === "pending" && (
        data.items.length === 0 ? (
          <EmptyState title="אין פריטים שמחכים לאישור שלך"
                      hint="כשהמשרד יסיים תוצר — הוא יופיע כאן" />
        ) : (
          <div className="mi-cards-grid">
            {data.items.map((item) => (
              <ApprovalCard key={`${item.kind}-${item.id}`} item={item}
                            busy={busyId === item.id}
                            onApprove={doApprove}
                            onReject={setRejecting} />
            ))}
          </div>
        )
      )}

      {data && tab === "decided" && (
        data.items.length === 0 ? (
          <EmptyState icon="📭" title="עוד לא ניתנו אישורים" />
        ) : (
          <div className="mi-card" style={{ padding: 8 }}>
            {data.items.map((item) => (
              <div key={item.id}
                   style={{ display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 12px",
                            borderBlockEnd: "1px solid var(--mi-border)" }}>
                <StatusChip status={item.status} />
                <span className="mi-body" style={{ flex: 1 }}>
                  {item.title}
                  {item.version != null && <> · <span className="mi-ltr">V{item.version}</span></>}
                  {item.course && <> · {item.course}</>}
                </span>
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

/**
 * OverviewPage.jsx — "הסקירה שלי" (מסך 1 מהמוקאפ).
 * KPI ×4 · "מה מחכה לך עכשיו" · פעילות אחרונה · טריות.
 * נתונים: GET /api/manager/overview בלבד. אין נתונים מומצאים —
 * כשל-שליפה מוצג ב-ErrorBanner.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { getOverview } from "../api.js";
import {
  StatCard, PriorityCard, ErrorBanner, EmptyState, SkeletonCard, timeAgoHe,
} from "../components/ui.jsx";

function greetingHe() {
  const h = new Date().getHours();
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  return "ערב טוב";
}

export default function OverviewPage() {
  const { setPendingCount } = useOutletContext() ?? {};
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setError(null);
    getOverview()
      .then((d) => {
        setData(d);
        // ה-badge בתפריט ניזון מכאן — ה-layout לא שולף overview בעצמו
        setPendingCount?.(d?.kpis?.pending_approvals ?? 0);
      })
      .catch((e) => setError(e.message));
  }, [setPendingCount]);
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

  const { kpis, waiting_for_me: waiting, recent_activity: recent,
          freshness, fetch_errors: fetchErrors } = data;

  const openItem = (w) => {
    if (w.tag_he === "דורש אישור") navigate("/media/approvals");
    // חסמים נפתרים בינתיים בממשק הקיים — קישור חי, לא כפתור מת.
    else navigate("/media-reports?tab=marketing&sub=tasks");
  };

  return (
    <div className="mi-page">
      <header style={{ marginBlockEnd: 20 }}>
        <h1 className="mi-h1">{greetingHe()} 👋</h1>
        <p className="mi-meta" style={{ marginBlockStart: 4 }}>
          המשרד שלך — מבט אחד על מה שחשוב עכשיו ·{" "}
          עודכן <span className="mi-ltr">{timeAgoHe(freshness?.generated_at) || "עכשיו"}</span>
        </p>
      </header>

      <ErrorBanner errors={fetchErrors} onRetry={load} />

      <section aria-label="מונים" className="mi-kpis">
        <StatCard value={kpis.pending_approvals} label="פריטים מחכים לאישור" icon="✋"
                  tone="primary" onClick={() => navigate("/media/approvals")} />
        <StatCard value={kpis.new_requests} label="בקשות בעבודה" icon="📨" tone="info" />
        <StatCard value={kpis.active_items} label="פרויקטים פעילים" icon="🚀" tone="success" />
        <StatCard value={kpis.open_blockers} label="חסמים פתוחים" icon="⛔" tone="danger" />
      </section>

      <div className="mi-cols">
        <section aria-label="מה מחכה לך עכשיו">
          <h2 className="mi-h2" style={{ marginBlockEnd: 10 }}>מה מחכה לך עכשיו</h2>
          {waiting.length === 0 ? (
            <EmptyState title="אין פריטים שמחכים לך" hint="כל מה שדורש אותך — יופיע כאן" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {waiting.map((w) => (
                <PriorityCard key={`${w.kind}-${w.id}`} tag={w.tag_he}
                  title={w.title}
                  meta={[w.course, w.version != null ? `V${w.version}` : null,
                         timeAgoHe(w.since)].filter(Boolean).join(" · ")}
                  onClick={() => openItem(w)} />
              ))}
            </div>
          )}
        </section>

        <section aria-label="פעילות אחרונה">
          <h2 className="mi-h2" style={{ marginBlockEnd: 10 }}>פעילות אחרונה</h2>
          <div className="mi-card" style={{ padding: 8 }}>
            {recent.length === 0 && (
              <p className="mi-meta" style={{ padding: 12 }}>עוד אין פעילות לתצוגה</p>
            )}
            {recent.map((r) => (
              <div key={r.id} style={{ padding: "10px 12px",
                   borderBlockEnd: "1px solid var(--mi-border)" }}>
                <div className="mi-body">{r.display_he}</div>
                <div className="mi-meta">{timeAgoHe(r.decided_at)}</div>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="קיצורי דרך">
          <h2 className="mi-h2" style={{ marginBlockEnd: 10 }}>קיצורי דרך</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="mi-btn mi-btn-secondary"
                    onClick={() => navigate("/media/approvals")}
                    style={{ justifyContent: "center" }}>
              ✋ לתיבת האישורים
            </button>
            <button className="mi-btn mi-btn-secondary"
                    onClick={() => navigate("/media-reports?tab=marketing")}
                    style={{ justifyContent: "center" }}>
              🗂 לממשק הקיים (לוח הקמפיינים)
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * BudgetDashboardPage.jsx — דשבורד תקציב-המדיה הכולל (מסך #7, נבנה מאפס).
 *
 * מקור = ה-read-model הנקי GET /api/campaigns/budget-overview, שמצרף
 * approved_media_budget (מעטפת+פר-קורס) + media_settings (שנתי-ייחוס) +
 * monthly_school_kpi (הוצאה-בפועל). **מתעלם מ-budget_allocations הרקוב.**
 * שתי רמות: כללי (פלטפורמה + לאורך-זמן) ופר-קורס (טבלה דינמית, לא pie/static).
 * אין מספרי-דמה — כל מספר נשלף חי (עודכן + auto-refresh).
 */
import React, { useCallback, useEffect, useState } from "react";
import { getBudgetOverview } from "../api.js";
import { EmptyState, ErrorBanner, SkeletonCard, StatCard, timeAgoHe } from "../components/ui.jsx";

const REFRESH_MS = 45000; // הרמה הפר-קורסית מתעדכנת מעצמה מהנתון החי

const ils = (n) =>
  (n != null && !isNaN(Number(n))) ? `₪${Math.round(Number(n)).toLocaleString()}` : "—";

const PLATFORM_HE = { meta: "מטא", google: "גוגל", social: "סושיאל", tiktok: "טיקטוק" };
const COURSE_LABEL = {
  ai: "AI", qa: "QA", marketing_social_ai: "שיווק", cyber: "סייבר", gaming: "גיימינג",
  content_calendar: "יומן תוכן", schoolwide_always_on: "כלל בית-ספרי",
};
const courseLabel = (c) => COURSE_LABEL[c.course_key] || c.course_name || c.course_key;

function Bar({ value, max, tone = "primary" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ background: "var(--mi-border)", borderRadius: 6, blockSize: 8, overflow: "hidden" }}>
      <div style={{ inlineSize: `${pct}%`, blockSize: "100%",
                    background: `var(--mi-${tone})`, borderRadius: 6 }} />
    </div>
  );
}

export default function BudgetDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [level, setLevel] = useState("course"); // "general" | "course"
  const [loadedAt, setLoadedAt] = useState(null);

  const load = useCallback(() => {
    getBudgetOverview()
      .then((d) => { setData(d); setError(null); setLoadedAt(new Date().toISOString()); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  if (error) {
    return <div className="mi-page"><ErrorBanner errors={[{ source: error }]} onRetry={load} /></div>;
  }
  if (!data) {
    return (
      <div className="mi-page" aria-busy="true">
        <div className="mi-kpis">{[1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={2} />)}</div>
      </div>
    );
  }

  const { annual_reference_ils, period, spent, remaining, by_course, over_time } = data;
  const platforms = Object.entries(period?.by_platform || {});
  const platMax = Math.max(1, ...platforms.map(([, v]) => Number(v) || 0));
  const courses = by_course || [];
  const courseTotal = courses.reduce((s, c) => s + (Number(c.planned_ils) || 0), 0);
  const recent = (over_time || []).slice(-6);
  const overMax = Math.max(1, ...recent.map((m) => Number(m.spend_total) || 0));

  return (
    <div className="mi-page">
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                       marginBlockEnd: 16 }}>
        <h1 className="mi-h1" style={{ fontSize: 22 }}>דשבורד תקציב מדיה</h1>
        <span className="mi-meta">המעטפת המאושרת מול ההוצאה בפועל — לפי קורס ופלטפורמה</span>
        <span style={{ flex: 1 }} />
        <span className="mi-meta">עודכן <span className="mi-ltr">{timeAgoHe(loadedAt) || "עכשיו"}</span></span>
        <button className="mi-btn mi-btn-ghost" onClick={load} style={{ minBlockSize: 36 }}>↻ רענון</button>
      </header>

      {!data.available && (
        <ErrorBanner errors={[{ source: `נתוני-התקציב חלקית לא זמינים — ${data.blocking_reason || ""}` }]}
                     onRetry={load} />
      )}

      {/* ── מונים ראשיים (מספרים אמיתיים מהמקור הנקי, לא דמה) ── */}
      <section aria-label="מונים" className="mi-kpis" style={{ marginBlockEnd: 8 }}>
        <StatCard value={ils(annual_reference_ils)} label="תקציב שנתי (ייחוס)" icon="🎯" tone="accent" />
        <StatCard value={ils(period?.envelope_ils)} label="מעטפת מאושרת לתקופה" icon="📦" tone="primary" />
        <StatCard value={ils(spent?.ytd_ils)} label="הוצאה בפועל (2026)" icon="💸" tone="info" />
        <StatCard value={ils(remaining?.period_envelope_ils)} label="נותר מהמעטפת" icon="✓" tone="success" />
      </section>
      <p className="mi-meta" style={{ marginBlockEnd: 16 }}>
        תקופת-הפריסה: <span className="mi-ltr">{period?.start} – {period?.end}</span> ·
        הוצאה בתוך-התקופה עד כה: <span className="mi-ltr">{ils(spent?.period_ils)}</span>
      </p>

      {/* ── מתג שתי-הרמות ── */}
      <div className="mi-tabs" role="tablist" aria-label="רמת-תצוגה" style={{ marginBlockEnd: 16 }}>
        {[["course", "פר-קורס"], ["general", "כללי"]].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={level === key}
                  className="mi-tab" onClick={() => setLevel(key)}>{label}</button>
        ))}
      </div>

      {/* ── פר-קורס: טבלה דינמית-מתעדכנת (לא pie, לא static) ── */}
      {level === "course" && (
        courses.length === 0 ? (
          <EmptyState title="אין עדיין תקציב מאושר פר-קורס" />
        ) : (
          <div className="mi-table-wrap">
            <table className="mi-table">
              <thead>
                <tr><th>קורס</th><th>תקציב מתוכנן (מאושר)</th><th>חלק מהמעטפת</th><th /></tr>
              </thead>
              <tbody>
                {courses.map((c) => {
                  const pct = courseTotal > 0 ? Math.round((c.planned_ils / courseTotal) * 100) : 0;
                  const isCourse = c.scope === "course";
                  return (
                    <tr key={c.course_key}>
                      <td style={{ fontWeight: 600, color: "var(--mi-ink)" }}>
                        {courseLabel(c)}
                        {!isCourse && <span className="mi-meta" style={{ marginInlineStart: 6 }}>(כלל-מערכתי)</span>}
                      </td>
                      <td className="mi-ltr" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{ils(c.planned_ils)}</td>
                      <td className="mi-ltr" style={{ whiteSpace: "nowrap" }}>{pct}%</td>
                      <td style={{ minInlineSize: 140 }}>
                        <Bar value={c.planned_ils} max={courseTotal} tone={isCourse ? "primary" : "accent"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── כללי: פירוק-פלטפורמה + הוצאה לאורך זמן ── */}
      {level === "general" && (
        <div className="mi-cols" style={{ gridTemplateColumns: "1fr 1fr", marginBlockStart: 0 }}>
          <section className="mi-card">
            <h2 className="mi-h2" style={{ marginBlockEnd: 12 }}>פירוק המעטפת לפי פלטפורמה</h2>
            {platforms.map(([p, v]) => (
              <div key={p} style={{ marginBlockEnd: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBlockEnd: 4 }}>
                  <span className="mi-body" style={{ fontWeight: 600 }}>{PLATFORM_HE[p] || p}</span>
                  <span className="mi-ltr" style={{ fontWeight: 600 }}>{ils(v)}</span>
                </div>
                <Bar value={Number(v)} max={platMax} tone="primary" />
              </div>
            ))}
          </section>

          <section className="mi-card">
            <h2 className="mi-h2" style={{ marginBlockEnd: 12 }}>הוצאה בפועל לאורך זמן</h2>
            {recent.length === 0 ? (
              <p className="mi-meta">אין עדיין נתוני-הוצאה</p>
            ) : recent.map((m) => (
              <div key={m.month_ym} style={{ marginBlockEnd: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBlockEnd: 4 }}>
                  <span className="mi-meta mi-ltr">{m.month_ym}</span>
                  <span className="mi-ltr" style={{ fontWeight: 600 }}>{ils(m.spend_total)}</span>
                </div>
                <Bar value={Number(m.spend_total)} max={overMax} tone="info" />
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}

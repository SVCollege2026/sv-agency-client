/**
 * BudgetDashboardPage.jsx — דשבורד תקציב-המדיה הכולל (מסך #7, נבנה מאפס).
 *
 * מקור = ה-read-model הנקי GET /api/campaigns/budget-overview:
 *   • מאושר (planned) = approved_media_budget — מעטפת · פר-פלטפורמה · פר-קורס · פר-קורס×פלטפורמה.
 *   • הוצאה-בפועל (בתוך-התקופה, פר-פלטפורמה כולל גוגל) = media.daily_reports (טרי).
 *   • שנתי-ייחוס 1.44M = media_settings. **מתעלם מ-budget_allocations הרקוב.**
 * הוצאה-פר-קורס = שלב-ב' (מסומן "בבנייה" — לא מזייפים 0). אין מספרי-דמה — הכל חי + auto-refresh.
 */
import React, { useCallback, useEffect, useState } from "react";
import { getBudgetOverview } from "../api.js";
import { EmptyState, ErrorBanner, SkeletonCard, StatCard, timeAgoHe } from "../components/ui.jsx";
import { fullDate } from "../lib.js";

const REFRESH_MS = 45000;

const ils = (n) =>
  (n != null && !isNaN(Number(n))) ? `₪${Math.round(Number(n)).toLocaleString()}` : "—";

const PLATFORM_HE = { meta: "מטא", google: "גוגל", social: "סושיאל", tiktok: "טיקטוק" };
const COURSE_LABEL = {
  ai: "AI", qa: "QA", marketing_social_ai: "שיווק", cyber: "סייבר", gaming: "גיימינג",
  content_calendar: "יומן תוכן", schoolwide_always_on: "כלל בית-ספרי",
};
const courseLabel = (c) => COURSE_LABEL[c.course_key] || c.course_name || c.course_key;

function Bar({ value, max, tone = "primary" }) {
  const pct = max > 0 && Number.isFinite(value) ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ background: "var(--mi-border)", borderRadius: 6, blockSize: 8, overflow: "hidden" }}>
      <div style={{ inlineSize: `${pct}%`, blockSize: "100%", background: `var(--mi-${tone})`, borderRadius: 6 }} />
    </div>
  );
}

export default function BudgetDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [level, setLevel] = useState("course"); // "course" | "platform"
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

  // כשל-שליפה מלא רק כשאין עדיין דאטה; כשל-רענון-רקע → באנר-inline (לא מוחקים דשבורד טעון).
  if (error && !data) {
    return <div className="mi-page"><ErrorBanner errors={[{ source: error }]} onRetry={load} /></div>;
  }
  if (!data) {
    return (
      <div className="mi-page" aria-busy="true">
        <div className="mi-kpis">{[1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={2} />)}</div>
      </div>
    );
  }

  const { annual_reference_ils, period, spent, remaining, by_course, by_course_platform,
          course_spend_available, daily_spend } = data;

  // מאושר פר-פלטפורמה (planned) + הוצאה פר-פלטפורמה (daily_reports). איחוד מפתחות.
  const plannedByPlat = period?.by_platform || {};
  const spentByPlat = spent?.by_platform || {};
  const platKeys = [...new Set([...Object.keys(plannedByPlat), ...Object.keys(spentByPlat)])];

  // פר-קורס×פלטפורמה → מקובץ פר-קורס {meta,google,...} להצגה לצד הסכום.
  const cpByCourse = {};
  (by_course_platform || []).forEach((e) => {
    (cpByCourse[e.course_key] ||= {})[e.platform] = Number(e.planned_ils) || 0;
  });

  const courses = by_course || [];
  const courseTotal = courses.reduce((s, c) => s + (Number(c.planned_ils) || 0), 0);
  const recent = (daily_spend || []).slice(-10);
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

      {error && data && (
        <ErrorBanner errors={[{ source: `רענון נכשל — מוצגים הנתונים האחרונים: ${error}` }]} onRetry={load} />
      )}
      {!data.available && (
        <ErrorBanner errors={[{ source: `נתוני-התקציב חלקית לא זמינים — ${data.blocking_reason || ""}` }]}
                     onRetry={load} />
      )}

      {/* ── מונים ראשיים — חלון-עקבי: מעטפת − הוצאה-בתקופה = נותר. השנתי = ייחוס. ── */}
      <section aria-label="מונים" className="mi-kpis" style={{ marginBlockEnd: 8 }}>
        <StatCard value={ils(annual_reference_ils)} label="תקציב שנתי (ייחוס)" icon="🎯" tone="accent" />
        <StatCard value={ils(period?.envelope_ils)} label="מעטפת מאושרת לתקופה" icon="📦" tone="primary" />
        <StatCard value={ils(spent?.period_ils)} label="הוצאה בפועל בתקופה" icon="💸" tone="info" />
        <StatCard value={ils(remaining?.period_envelope_ils)} label="נותר מהמעטפת" icon="✓" tone="success" />
      </section>
      <p className="mi-meta" style={{ marginBlockEnd: 16 }}>
        תקופת-הפריסה: <span className="mi-ltr">{fullDate(period?.start)} – {fullDate(period?.end)}</span>
        {spent?.as_of && <> · הוצאה מעודכנת ל-<span className="mi-ltr">{fullDate(spent.as_of)}</span></>}
        {" "}· מקור-ההוצאה: דוחות-מדיה יומיים (לא הקצאות).
      </p>

      <div className="mi-tabs" role="tablist" aria-label="רמת-תצוגה" style={{ marginBlockEnd: 16 }}>
        {[["course", "פר-קורס"], ["platform", "פר-פלטפורמה"]].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={level === key}
                  className="mi-tab" onClick={() => setLevel(key)}>{label}</button>
        ))}
      </div>

      {/* ── פר-קורס: תקציב-מאושר + פירוק-פלטפורמה; הוצאה-פר-קורס = שלב-ב' (בבנייה) ── */}
      {level === "course" && (
        courses.length === 0 ? (
          <EmptyState title="אין עדיין תקציב מאושר פר-קורס" />
        ) : (
          <div className="mi-table-wrap">
            <table className="mi-table">
              <thead>
                <tr><th>קורס</th><th>תקציב מאושר</th><th>פירוק פלטפורמה</th><th>הוצאה</th><th>חלק מהמעטפת</th><th /></tr>
              </thead>
              <tbody>
                {courses.map((c) => {
                  const planned = Number(c.planned_ils) || 0;
                  const pct = courseTotal > 0 ? Math.round((planned / courseTotal) * 100) : 0;
                  const isCourse = c.scope === "course";
                  const split = cpByCourse[c.course_key] || {};
                  return (
                    <tr key={c.course_key}>
                      <td style={{ fontWeight: 600, color: "var(--mi-ink)" }}>
                        {courseLabel(c)}
                        {!isCourse && <span className="mi-meta" style={{ marginInlineStart: 6 }}>(כלל-מערכתי)</span>}
                      </td>
                      <td className="mi-ltr" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{ils(planned)}</td>
                      <td className="mi-meta mi-ltr" style={{ whiteSpace: "nowrap" }}>
                        {Object.entries(split).map(([p, v]) => `${PLATFORM_HE[p] || p} ${ils(v)}`).join(" · ") || "—"}
                      </td>
                      <td><span className="mi-chip" title="הוצאה-פר-קורס בבנייה — דורשת מיפוי קמפיין↔קורס">בבנייה</span></td>
                      <td className="mi-ltr" style={{ whiteSpace: "nowrap" }}>{pct}%</td>
                      <td style={{ minInlineSize: 120 }}>
                        <Bar value={planned} max={courseTotal} tone={isCourse ? "primary" : "accent"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mi-meta" style={{ marginBlockStart: 8 }}>
              עמודת "הוצאה" פר-קורס תיפתח בשלב הבא (מיפוי שם-קמפיין לקורס). בינתיים ההוצאה-בפועל מוצגת
              ברמת בית-ספר ופלטפורמה (לשונית "פר-פלטפורמה").
            </p>
          </div>
        )
      )}

      {/* ── פר-פלטפורמה: מאושר מול הוצאה-בפועל (הוצאה אמיתית מ-daily_reports) + מגמה יומית ── */}
      {level === "platform" && (
        <div className="mi-cols" style={{ gridTemplateColumns: "1fr 1fr", marginBlockStart: 0 }}>
          <section className="mi-card">
            <h2 className="mi-h2" style={{ marginBlockEnd: 12 }}>מאושר מול הוצאה — פר-פלטפורמה</h2>
            <div className="mi-table-wrap" style={{ border: "none", boxShadow: "none" }}>
              <table className="mi-table" style={{ minInlineSize: 0 }}>
                <thead><tr><th>פלטפורמה</th><th>מאושר</th><th>הוצא</th><th>נותר</th></tr></thead>
                <tbody>
                  {platKeys.map((p) => {
                    const pl = Number(plannedByPlat[p]) || 0;
                    const hasSpend = p in spentByPlat;
                    const sp = Number(spentByPlat[p]) || 0;
                    return (
                      <tr key={p}>
                        <td style={{ fontWeight: 600 }}>{PLATFORM_HE[p] || p}</td>
                        <td className="mi-ltr" style={{ whiteSpace: "nowrap" }}>{ils(pl)}</td>
                        <td className="mi-ltr" style={{ whiteSpace: "nowrap" }}>
                          {hasSpend ? ils(sp) : <span className="mi-meta">— (אין דיווח)</span>}
                        </td>
                        <td className="mi-ltr" style={{ whiteSpace: "nowrap" }}>
                          {hasSpend ? ils(pl - sp) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mi-card">
            <h2 className="mi-h2" style={{ marginBlockEnd: 12 }}>הוצאה יומית בתקופה</h2>
            {recent.length === 0 ? (
              <p className="mi-meta">אין עדיין דיווחי-הוצאה בתקופה</p>
            ) : recent.map((m) => (
              <div key={m.report_date} style={{ marginBlockEnd: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBlockEnd: 4 }}>
                  <span className="mi-meta mi-ltr">{m.report_date}</span>
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

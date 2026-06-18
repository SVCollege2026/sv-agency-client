/**
 * PlansBudgetPage.jsx — "פריסות מדיה ותקציב": דשבורד-תקציב נקי מ-/api/campaigns/budget-overview.
 * נותר מחושב מול הבסיס-השנתי (1.44M − הוצאה-מצטברת מ-1/1), לא מול המעטפת (הכרעת נירית 18/06).
 * סושיאל ₪60K (הקצאה ייעודית). AI / שיווק / AI ARCHITECT מופרדים. הוצאה מ-media.daily_reports
 * (טרי) — לא budget_allocations הרקוב. אין עדכון-תקציב ידני: המשרד ממליץ, המנהלת מאשרת.
 */
import React, { useCallback, useEffect, useState } from "react";
import { getBudgetOverview } from "../api.js";
import { EmptyState, ErrorBanner, SkeletonCard } from "../components/ui.jsx";
import { fullDate } from "../lib.js";

function ils(n) {
  return typeof n === "number" ? `${Math.round(n).toLocaleString()} ₪` : "—";
}

const PLATFORM_HE = { meta: "מטא", google: "גוגל", social: "סושיאל" };

function Metric({ label, value, strong }) {
  return (
    <div className="mi-card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="mi-meta">{label}</span>
      <strong style={{ fontSize: 22, color: "var(--mi-ink)", fontWeight: strong ? 700 : 600 }}>{value}</strong>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderBlockEnd: "1px solid var(--mi-border)" }}>
      <span className="mi-body" style={{ flex: 1, minInlineSize: 160 }}>{label}</span>
      <strong style={{ color: "var(--mi-ink)" }}>{value}</strong>
    </div>
  );
}

export default function PlansBudgetPage() {
  const [data, setData] = useState(null);
  const [errors, setErrors] = useState([]);

  const load = useCallback(() => {
    setErrors([]); setData(null);
    getBudgetOverview()
      .then(setData)
      .catch((e) => { setData(false); setErrors([{ source: `תקציב: ${e.message}` }]); });
  }, []);
  useEffect(load, [load]);

  const loading = data == null;
  const ok = data && data !== false;
  const annual = (ok && data.annual) || {};
  const period = (ok && data.period) || {};
  const byPlatform = period.by_platform || {};
  const byCourse = (ok && data.by_course) || [];
  const ytdByPlatform = annual.spent_by_platform || {};

  return (
    <div className="mi-page">
      <header style={{ marginBlockEnd: 16 }}>
        <h1 className="mi-h1" style={{ fontSize: 22 }}>פריסות מדיה ותקציב</h1>
        <p className="mi-meta" style={{ marginBlockStart: 4 }}>
          המשרד ממליץ — את מאשרת. אין עדכון-תקציב ידני.
        </p>
      </header>

      <ErrorBanner errors={errors} onRetry={load} />
      {loading && !errors.length && <div aria-busy="true"><SkeletonCard lines={5} /></div>}

      {ok && (
        <>
          <section aria-label="תמונת תקציב" style={{ marginBlockEnd: 20 }}>
            <div className="mi-cards-grid">
              <Metric label="תקציב שנתי (ייחוס)" value={ils(annual.reference_ils)} />
              <Metric label="נותר מהשנתי" value={ils(annual.remaining_ils)} strong />
              <Metric label="הוצא מ-1/1" value={ils(annual.spent_ytd_ils)} />
              <Metric label="מעטפת התקופה" value={ils(period.envelope_ils)} />
            </div>
            {period.start && (
              <p className="mi-meta mi-ltr" style={{ marginBlockStart: 6 }}>
                {fullDate(period.start)} – {fullDate(period.end)}
              </p>
            )}
          </section>

          <section aria-label="מתוכנן פר פלטפורמה" style={{ marginBlockEnd: 20 }}>
            <h2 className="mi-h2" style={{ marginBlockEnd: 10 }}>מתוכנן פר פלטפורמה</h2>
            <div className="mi-card" style={{ padding: 8 }}>
              {["meta", "google", "social"].filter((p) => byPlatform[p] != null)
                .map((p) => <Row key={p} label={PLATFORM_HE[p] || p} value={ils(byPlatform[p])} />)}
            </div>
            {data.social_earmark_ils != null && (
              <p className="mi-meta" style={{ marginBlockStart: 6 }}>
                סושיאל = {ils(data.social_earmark_ils)} — הקצאה ייעודית מתוך התקציב הכללי.
              </p>
            )}
          </section>

          <section aria-label="מתוכנן פר קורס" style={{ marginBlockEnd: 20 }}>
            <h2 className="mi-h2" style={{ marginBlockEnd: 10 }}>מתוכנן פר קורס</h2>
            {byCourse.length === 0 ? (
              <EmptyState icon="📊" title="אין עדיין פריסת תקציב פר קורס" />
            ) : (
              <div className="mi-card" style={{ padding: 8 }}>
                {byCourse.map((c) => (
                  <Row key={c.course_key} label={c.course_name || c.course_key} value={ils(c.planned_ils)} />
                ))}
              </div>
            )}
          </section>

          <section aria-label="הוצאה בפועל מ-1/1">
            <h2 className="mi-h2" style={{ marginBlockEnd: 10 }}>הוצאה בפועל (מ-1/1)</h2>
            <div className="mi-card" style={{ padding: 8 }}>
              <Row label="מטא" value={ils(ytdByPlatform.meta)} />
              <Row label="גוגל" value={ils(ytdByPlatform.google)} />
            </div>
            {annual.as_of && (
              <p className="mi-meta mi-ltr" style={{ marginBlockStart: 6 }}>נכון ל-{fullDate(annual.as_of)}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

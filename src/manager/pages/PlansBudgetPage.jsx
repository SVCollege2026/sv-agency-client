/**
 * PlansBudgetPage.jsx — "פריסות מדיה ותקציב": מקורות-התקציב והקצאותיהם
 * מהדלתות הקיימות. הקצאה שממתינה להחלטה מוכרעת בגלריית האישורים —
 * עדכון-תקציב ידני אסור (אסטרטג ממליץ ← המנהלת מאשרת).
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getBudgetAllocations, getBudgetSources } from "../api.js";
import { EmptyState, ErrorBanner, SkeletonCard } from "../components/ui.jsx";
import { fullDate } from "../lib.js";

const ALLOC_STATUS = {
  recommended: ["ממתינה לאישור שלך", "mi-chip-warning"],
  approved:    ["מאושרת",            "mi-chip-success"],
  rejected:    ["נדחתה",             "mi-chip-danger"],
  active:      ["פעילה",             "mi-chip-success"],
};

function ils(n) {
  return typeof n === "number" ? `${n.toLocaleString()} ₪` : "—";
}

export default function PlansBudgetPage() {
  const [sources, setSources] = useState(null);
  const [allocations, setAllocations] = useState(null);
  const [errors, setErrors] = useState([]);

  const load = useCallback(() => {
    setErrors([]);
    getBudgetSources()
      .then((d) => setSources(Array.isArray(d) ? d : d?.sources ?? []))
      .catch((e) => { setSources([]); setErrors((p) => [...p, { source: `מקורות תקציב: ${e.message}` }]); });
    getBudgetAllocations()
      .then((d) => setAllocations(Array.isArray(d) ? d : d?.allocations ?? []))
      .catch((e) => { setAllocations([]); setErrors((p) => [...p, { source: `הקצאות: ${e.message}` }]); });
  }, []);
  useEffect(load, [load]);

  const loading = sources == null || allocations == null;
  const pending = (allocations || []).filter((a) => a.status === "recommended");
  // מציגים רק הקצאות רלוונטיות (ממתינות/מאושרות/פעילות) — לא ישנות/נדחות/ארכיון.
  // כך לא מתערבבות הקצאות-עבר (מאי) עם ההווה ויוצרות בלבול.
  const shown = (allocations || []).filter((a) =>
    ["recommended", "active", "approved"].includes(a.status));

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

      {pending.length > 0 && (
        <div className="mi-card" role="note"
             style={{ background: "var(--mi-warning-bg)", borderColor: "transparent",
                      marginBlockEnd: 16 }}>
          <span className="mi-body" style={{ color: "var(--mi-warning)", fontWeight: 600 }}>
            {pending.length} הקצאות תקציב ממתינות להחלטה שלך —{" "}
            <Link to="/media/approvals" style={{ color: "inherit" }}>לגלריית האישורים</Link>
          </span>
        </div>
      )}

      {!loading && (
        <div className="mi-cols" style={{ gridTemplateColumns: "1fr" }}>
          <section aria-label="מקורות תקציב">
            <h2 className="mi-h2" style={{ marginBlockEnd: 10 }}>מקורות תקציב</h2>
            {(sources || []).length === 0 ? (
              <EmptyState icon="💰" title="עוד לא הוגדרו מקורות תקציב" />
            ) : (
              <div className="mi-cards-grid">
                {sources.map((s) => (
                  <div key={s.id} className="mi-card"
                       style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <strong style={{ fontSize: 15, color: "var(--mi-ink)" }}>
                      {s.name || s.source_name || s.label || "מקור תקציב"}
                    </strong>
                    <span className="mi-body" style={{ fontWeight: 700, color: "var(--mi-ink)" }}>
                      {ils(s.total_amount_ils ?? s.amount_ils ?? s.total_ils)}
                    </span>
                    {s.period_start && (
                      <span className="mi-meta mi-ltr">
                        {fullDate(s.period_start)} – {fullDate(s.period_end)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section aria-label="הקצאות">
            <h2 className="mi-h2" style={{ marginBlockEnd: 10 }}>הקצאות</h2>
            {shown.length === 0 ? (
              <EmptyState icon="📊" title="אין עדיין הקצאות תקציב פעילות"
                          hint="כשהמשרד ימליץ על פריסה — היא תופיע כאן ובגלריית האישורים" />
            ) : (
              <div className="mi-card" style={{ padding: 8 }}>
                {shown.map((a) => {
                  const [label, cls] = ALLOC_STATUS[a.status] || [a.status, "mi-chip-info"];
                  return (
                    <div key={a.id}
                         style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                                  padding: "10px 12px", borderBlockEnd: "1px solid var(--mi-border)" }}>
                      <span className={`mi-chip ${cls}`}>{label}</span>
                      <span className="mi-body" style={{ flex: 1, minInlineSize: 160 }}>
                        {a.platform || "כל הפלטפורמות"}
                        {a.rationale && <span className="mi-meta" style={{ display: "block" }}>{a.rationale}</span>}
                      </span>
                      <strong style={{ color: "var(--mi-ink)" }}>{ils(a.amount_ils)}</strong>
                      {a.period_start && (
                        <span className="mi-meta mi-ltr">
                          {fullDate(a.period_start)} – {fullDate(a.period_end)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

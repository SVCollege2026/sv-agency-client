/**
 * TakeoverPlanPage.jsx — "תוכנית השתלטות" (מסך-אחד, פירוט פר-קורס + תגובה פר-קורס).
 *
 * זו ההמלצה של האסטרטג לתוכנית-ההשתלטות — מה מתכוונים לעשות בכל קורס (רענון-קראייטיב,
 * מבנה-קמפיין/CBO, דגש-פלטפורמה), עם נימוק-העל והחלטת-ה-AI. המנהלת קוראת פר-קורס,
 * ומגיבה פר-קורס (מנגנון-ההערות האחוד, section_key = course_key) — לפני פקודת-ההשתלטות.
 *
 * נתונים: GET /api/media/takeover-plan בלבד. אין נתונים מומצאים. ה-₪ הפרטני אינו כאן —
 * הוא באחריות מנהלי-הפלטפורמה.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  getTakeoverPlan, generateTakeoverPlan, addCourseComment,
  prepareTakeoverDirectives, generateTakeoverBudget,
} from "../api.js";
import { ErrorBanner, EmptyState, SkeletonCard, timeAgoHe } from "../components/ui.jsx";

const COURSE_LABELS = {
  qa: "QA — פיתוח טכנולוגיות",
  ai: "AI",
  ai_architect: "AI Architect",
  cyber: "סייבר",
  gaming: "גיימינג",
  marketing: "שיווק",
  marketing_b2b: "שיווק B2B",
  marketing_social_ai: "שיווק / סושיאל / AI",
};

// מיפוי שם-קורס (כפי שהאסטרטג כתב) ל-course_key — הספציפי לפני הכללי
// (ai_architect לפני ai, marketing_b2b לפני marketing).
// קונסולידציה: וריאנטים של אותו קורס מתאחדים למפתח אחד → כרטיס אחד פר-קורס,
// לא כרטיס פר-מחזור (תיקון נירית 14/06: "כבר יש התייחסות לשיווק, למה שוב?").
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

function matchCourseKey(courseName) {
  const s = (courseName || "").toLowerCase();
  for (const [key, aliases] of COURSE_ALIASES) {
    if (aliases.some((a) => s.includes(a))) return key;
  }
  return "_other";
}

function labelFor(key) {
  return COURSE_LABELS[key] || key;
}

const VERDICT_TONE = {
  keep: { bg: "var(--mi-success-bg, #e6f7ec)", ink: "var(--mi-success, #1a7f44)", he: "להשאיר" },
  adjust: { bg: "var(--mi-warn-bg, #fff4e0)", ink: "var(--mi-warn, #9a6700)", he: "לתקן" },
};

function VerdictChip({ verdict }) {
  if (!verdict) return null;
  const t = VERDICT_TONE[verdict] || { bg: "var(--mi-chip-bg, #eef)", ink: "var(--mi-ink)", he: verdict };
  return (
    <span style={{
      background: t.bg, color: t.ink, borderRadius: 999, padding: "2px 10px",
      fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
    }}>{t.he}</span>
  );
}

function fmtIls(n) {
  return typeof n === "number" ? `₪${Math.round(n).toLocaleString()}` : null;
}

// העובדות הדטרמיניסטיות שהמנהלת שואלת פר-קורס: CBO? · תקציב 10-ימי-למידה · אחרי-המעבר.
// מחושב מההקצאה הקיימת (לא קביעת-תקציב) — מוצג כך שלא צריך לשאול.
function FactsPanel({ facts }) {
  if (!facts) return null;
  const cbo = facts.cbo === true ? "CBO" : facts.cbo === false ? "Adset" : "—";
  const items = [
    ["מבנה", cbo],
    facts.transition_date ? ["מעבר", facts.transition_date] : null,
    fmtIls(facts.learning_10d_ils) ? ["10 ימי-למידה", fmtIls(facts.learning_10d_ils)] : null,
    fmtIls(facts.budget_after_ils) ? ["אחרי המעבר", fmtIls(facts.budget_after_ils)] : null,
  ].filter(Boolean);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "6px 0 10px",
                  padding: "8px 10px", background: "var(--mi-soft, #f6f7f9)", borderRadius: 8 }}>
      {items.map(([k, v]) => (
        <span key={k} className="mi-meta" style={{ whiteSpace: "nowrap" }}>
          <strong style={{ color: "var(--mi-ink)" }}>{k}:</strong> {v}
        </span>
      ))}
      {facts.computed_note && (
        <span className="mi-meta" style={{ opacity: 0.65, whiteSpace: "nowrap" }}>· {facts.computed_note}</span>
      )}
    </div>
  );
}

export default function TakeoverPlanPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [posting, setPosting] = useState({});
  const [acting, setActing] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  const load = useCallback(() => {
    setError(null);
    getTakeoverPlan().then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const generate = () => {
    setGenerating(true);
    setError(null);
    generateTakeoverPlan()
      .then(() => load())
      .catch((e) => setError(e.message))
      .finally(() => setGenerating(false));
  };

  // שליחת ההערות-פר-קורס הפתוחות למשרד — הן עוברות מ'פתוח' ל'בעבודה' ומגיעות למבצע.
  const sendDirectives = () => {
    setActing("directives"); setActionMsg(null); setError(null);
    prepareTakeoverDirectives()
      .then((r) => {
        const n = r.course_count ?? 0;
        setActionMsg(n > 0
          ? `נשלחו הוראות מ-${n} קורסים למשרד — ההערות שטרם טופלו עוברות לביצוע (רענון-קראייטיב / שינויי-מבנה).`
          : "אין כרגע הערות חדשות לשליחה (כולן כבר נשלחו למשרד).");
        load();
      })
      .catch((e) => setError(e.message))
      .finally(() => setActing(null));
  };

  // הפקת המלצות-תקציב-ההשתלטות → נכנסות לתיבת-האישורים; אישורן שם מפעיל את ההשתלטות.
  const armBudget = () => {
    setActing("budget"); setActionMsg(null); setError(null);
    generateTakeoverBudget()
      .then(() => setActionMsg(
        "המלצות-תקציב ההשתלטות הופקו ונכנסו לתיבת-האישורים. אישור ההמלצות שם = הפעלת ההשתלטות בפועל."))
      .catch((e) => setError(e.message))
      .finally(() => setActing(null));
  };

  const submitComment = (courseKey) => {
    const body = (drafts[courseKey] || "").trim();
    if (!body || !data?.artifact_id) return;
    setPosting((p) => ({ ...p, [courseKey]: true }));
    addCourseComment(data.artifact_id, courseKey, body)
      .then(() => { setDrafts((d) => ({ ...d, [courseKey]: "" })); load(); })
      .catch((e) => setError(e.message))
      .finally(() => setPosting((p) => ({ ...p, [courseKey]: false })));
  };

  if (error && !data) {
    return (
      <div className="mi-page">
        <ErrorBanner errors={[{ source: error }]} onRetry={load} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mi-page" aria-busy="true">
        <div className="mi-cols">{[1, 2, 3].map((i) => <SkeletonCard key={i} lines={4} />)}</div>
      </div>
    );
  }

  if (!data.available) {
    return (
      <div className="mi-page">
        <header style={{ marginBlockEnd: 20 }}>
          <h1 className="mi-h1">תוכנית השתלטות</h1>
          <p className="mi-meta" style={{ marginBlockStart: 4 }}>
            ההמלצה של האסטרטג למה עושים בכל קורס — לפני פקודת-ההשתלטות.
          </p>
        </header>
        <ErrorBanner errors={error ? [{ source: error }] : []} onRetry={load} />
        <EmptyState icon="🧭" title="עוד לא הופקה תוכנית"
          hint="האסטרטג יפיק תוכנית פר-קורס (מה עושים · רענון-קראייטיב · מבנה-קמפיין) ותראי אותה כאן." />
        <div style={{ marginBlockStart: 16 }}>
          <button className="mi-btn mi-btn-primary" onClick={generate} disabled={generating}>
            {generating ? "האסטרטג חושב… (עד כדקה-שתיים)" : "הפק תוכנית עכשיו"}
          </button>
        </div>
      </div>
    );
  }

  const plan = data.plan || {};
  const overall = plan.overall || {};
  const courses = plan.courses || [];
  const priorities = plan.course_priorities || [];
  const commentsByCourse = data.comments_by_course || {};

  // קיבוץ המחזורים תחת מפתח-הקורס הקנוני (וריאנטים מתאחדים → מחזורים בתוך כרטיס אחד).
  const prioritiesByCourse = {};
  for (const pr of priorities) {
    const key = canon(matchCourseKey(pr.course));
    (prioritiesByCourse[key] = prioritiesByCourse[key] || []).push(pr);
  }
  // כרטיס אחד פר-קורס: course מהתוכנית (קנוני) + קורס שיש לו רק מחזורים/הערות.
  const courseKeys = [...new Set([
    ...courses.map((c) => canon(c.course_key)).filter(Boolean),
    ...Object.keys(prioritiesByCourse).filter((k) => k !== "_other"),
  ])];
  const courseByKey = Object.fromEntries(
    courses.filter((c) => c.course_key).map((c) => [canon(c.course_key), c]));

  const dep = overall.macro_deployment_ils || {};

  return (
    <div className="mi-page">
      <header style={{ marginBlockEnd: 16 }}>
        <h1 className="mi-h1">תוכנית השתלטות</h1>
        <p className="mi-meta" style={{ marginBlockStart: 4 }}>
          המלצת האסטרטג — פירוט פר-קורס · עודכן{" "}
          <span className="mi-ltr">{timeAgoHe(data.generated_at) || "עכשיו"}</span>
          {data.status ? ` · סטטוס: ${data.status}` : ""}
        </p>
      </header>

      <ErrorBanner errors={error ? [{ source: error }] : []} onRetry={load} />

      {/* נימוק-העל + פריסת-מאקרו + החלטת-AI */}
      <section className="mi-card" style={{ padding: 16, marginBlockEnd: 16 }}>
        <h2 className="mi-h2" style={{ marginBlockEnd: 8 }}>התמונה הכוללת</h2>
        {overall.rationale && (
          <p className="mi-body" style={{ whiteSpace: "pre-wrap", marginBlockEnd: 10 }}>
            {overall.rationale}
          </p>
        )}
        {(dep.meta != null || dep.google != null || dep.social != null) && (
          <p className="mi-meta">
            פריסת-מאקרו לתקופה:{" "}
            {["meta", "google", "social"].filter((p) => dep[p] != null)
              .map((p) => `${p === "meta" ? "מטא" : p === "google" ? "גוגל" : "סושיאל"} ₪${Math.round(dep[p]).toLocaleString()}`)
              .join(" · ")}
          </p>
        )}
        {overall.ai_decision?.decision && (
          <div style={{ marginBlockStart: 10, padding: 10, background: "var(--mi-soft, #f6f7f9)", borderRadius: 8 }}>
            <strong>החלטת AI:</strong> {overall.ai_decision.decision}
            {overall.ai_decision.reasoning ? ` — ${overall.ai_decision.reasoning}` : ""}
          </div>
        )}
      </section>

      {/* הפעלת ההשתלטות — חיבור "אישור בממשק" לביצוע בפועל */}
      <section className="mi-card" style={{ padding: 16, marginBlockEnd: 16 }}>
        <h2 className="mi-h2" style={{ marginBlockEnd: 8 }}>הפעלת ההשתלטות</h2>
        <p className="mi-meta" style={{ marginBlockEnd: 12 }}>
          התוכנית שלמעלה היא האסטרטגיה <strong>במילים</strong>. שני צעדים הופכים אותה למעשה:
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minInlineSize: 230 }}>
            <button className="mi-btn mi-btn-secondary" disabled={acting === "directives"}
                    onClick={sendDirectives} style={{ inlineSize: "100%", justifyContent: "center" }}>
              {acting === "directives" ? "שולח…" : "1 · שלחי את ההערות למשרד"}
            </button>
            <p className="mi-meta" style={{ marginBlockStart: 6 }}>
              ההערות שכתבת על הקורסים נשלחות למבצעים (קראייטיב/מדיה) ויחזרו אלייך לאישור.
            </p>
          </div>
          <div style={{ flex: 1, minInlineSize: 230 }}>
            <button className="mi-btn mi-btn-primary" disabled={acting === "budget"}
                    onClick={armBudget} style={{ inlineSize: "100%", justifyContent: "center" }}>
              {acting === "budget" ? "מפיק…" : "2 · הפק תקציב-השתלטות לאישור"}
            </button>
            <p className="mi-meta" style={{ marginBlockStart: 6 }}>
              התוכנית במילים לא מכילה ₪. זה מחשב את חלוקת-התקציב פר-קורס ושם אותה בתיבת-האישורים —
              <strong> אישורה שם = ההשתלטות מתחילה בפועל.</strong>
            </p>
          </div>
        </div>
        {actionMsg && (
          <p className="mi-body" role="status" style={{
               marginBlockStart: 10, background: "var(--mi-success-bg, #e6f7ec)",
               color: "var(--mi-success, #1a7f44)", borderRadius: 8, padding: "8px 12px" }}>
            ✓ {actionMsg}
          </p>
        )}
      </section>

      {/* פר-קורס */}
      <section aria-label="פירוט פר-קורס" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {courseKeys.length === 0 && (
          <EmptyState title="התוכנית אינה כוללת פירוט פר-קורס" hint="ייתכן שצריך להפיק מחדש." />
        )}
        {courseKeys.map((key) => {
          const c = courseByKey[key] || {};
          const prs = prioritiesByCourse[key] || [];
          const comments = commentsByCourse[key] || [];
          return (
            <article key={key} className="mi-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 6 }}>
                <h3 className="mi-h2" style={{ margin: 0 }}>{labelFor(key)}</h3>
                <VerdictChip verdict={c.verdict} />
              </div>

              <FactsPanel facts={c.facts} />

              {c.reasoning && (
                <p className="mi-body" style={{ whiteSpace: "pre-wrap", marginBlockEnd: 6 }}>{c.reasoning}</p>
              )}
              {c.adjustment && (
                <p className="mi-meta" style={{ marginBlockEnd: 6 }}><strong>התאמה:</strong> {c.adjustment}</p>
              )}

              {prs.map((pr, i) => (
                <div key={i} style={{ borderInlineStart: "3px solid var(--mi-border)", paddingInlineStart: 10, marginBlockStart: 8 }}>
                  <div className="mi-meta">
                    {[pr.course, pr.priority && `עדיפות: ${pr.priority}`, pr.platform_emphasis].filter(Boolean).join(" · ")}
                  </div>
                  {pr.why && <p className="mi-body" style={{ whiteSpace: "pre-wrap", margin: "4px 0" }}>{pr.why}</p>}
                  {pr.note_to_platform_manager && (
                    <p className="mi-body" style={{ whiteSpace: "pre-wrap", margin: "4px 0", color: "var(--mi-ink-soft, #444)" }}>
                      📌 {pr.note_to_platform_manager}
                    </p>
                  )}
                </div>
              ))}

              {/* הערות/תגובות פר-קורס */}
              <div style={{ marginBlockStart: 12, borderBlockStart: "1px solid var(--mi-border)", paddingBlockStart: 10 }}>
                {comments.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBlockEnd: 8 }}>
                    {comments.map((cm) => (
                      <div key={cm.id} style={{ background: "var(--mi-soft, #f6f7f9)", borderRadius: 8, padding: "6px 10px" }}>
                        <div className="mi-body" style={{ whiteSpace: "pre-wrap" }}>{cm.body}</div>
                        <div className="mi-meta">
                          {cm.author} · {timeAgoHe(cm.created_at)}
                          {cm.status === "resolved" ? " · נסגר" : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea
                    className="mi-textarea"
                    rows={2}
                    placeholder={`תגובה לגבי ${labelFor(key)} — למשל: לא להפעיל לפני רענון קראייטיב`}
                    value={drafts[key] || ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                    style={{ flex: 1, resize: "vertical", fontFamily: "inherit" }}
                  />
                  <button className="mi-btn mi-btn-secondary"
                    disabled={!!posting[key] || !(drafts[key] || "").trim()}
                    onClick={() => submitComment(key)}>
                    {posting[key] ? "שולח…" : "הגב"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {/* פירוט-מחזורים שלא שויך לקורס */}
      {(prioritiesByCourse._other || []).length > 0 && (
        <section className="mi-card" style={{ padding: 16, marginBlockStart: 14 }}>
          <h3 className="mi-h2" style={{ marginBlockEnd: 8 }}>מחזורים נוספים</h3>
          {prioritiesByCourse._other.map((pr, i) => (
            <div key={i} style={{ marginBlockEnd: 8 }}>
              <div className="mi-meta">{[pr.course, pr.platform_emphasis].filter(Boolean).join(" · ")}</div>
              {pr.note_to_platform_manager && <p className="mi-body" style={{ whiteSpace: "pre-wrap" }}>📌 {pr.note_to_platform_manager}</p>}
            </div>
          ))}
        </section>
      )}

      <div style={{ marginBlockStart: 16 }}>
        <button className="mi-btn mi-btn-ghost" onClick={generate} disabled={generating}>
          {generating ? "האסטרטג חושב…" : "↻ הפק תוכנית מעודכנת"}
        </button>
      </div>
    </div>
  );
}

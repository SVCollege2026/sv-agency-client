/**
 * src/manager/lib.js — ההיגיון התצוגתי הדטרמיניסטי של ממשק המנהלת.
 *
 * כאן גרים: מיפויי עברית-עסקית, מסנני-התצוגה הקבועים (רק החלטות-שלה +
 * "בוצע/טופל", חסמי-מערכת מנותבים מהפיד), וחישוב %-מהיעד העסקי
 * (נרשמים מול יעד-מחזור — לא מדדי-מדיה). מספרים בקוד, לא ב-LLM.
 */

export const MANAGER = { name: "נירית", role: "מנהלת שיווק" };

/* ── סוגי פריטים — עברית עסקית ─────────────────────────── */

const TYPE_HE = {
  // סוגי התוצרים בפועל (אומתו מול campaign_artifacts בפרודקשן 11/06)
  creative_rendered:            "נכס לקמפיין",
  creative_strategy:            "כיוון קריאייטיבי",
  art_direction:                "כיוון ויזואלי",
  ad_copy_meta:                 "קופי למטא",
  ad_copy_google:               "קופי לגוגל",
  ad_copy_tiktok:               "קופי לטיקטוק",
  budget_recommendation:        "המלצת תקציב",
  media_plan:                   "פריסת מדיה",
  market_research:              "מחקר שוק",
  creative_performance_meta:    "ניתוח קראייטיב — מטא",
  creative_performance_google:  "ניתוח קראייטיב — גוגל",
  make_scenario_created:        "תרחיש אוטומציה",
  // סוגים כלליים
  creative_asset:       "נכס לקמפיין",
  creative_concept:     "קונספט קראייטיב",
  creative:             "נכס לקמפיין",
  copy:                 "קופי",
  visual:               "ויזואל",
  video:                "סרטון",
  media_deployment:     "פריסת מדיה",
  campaign_structure:   "מבנה קמפיין",
  campaign:             "קמפיין חדש",
  new_campaign:         "קמפיין חדש",
  new_course:           "פתיחת קורס חדש",
  budget_allocation:    "תקציב",
  budget_change:        "שינוי תקציב",
  media_recommendation: "המלצת מדיה",
  question:             "שאלה",
  school_level:         "פעילות בית-ספרית",
  course_activity:      "בקשה לקורס",
};

export function typeHe(type) {
  if (!type) return "פריט";
  return TYPE_HE[type] || TYPE_HE[String(type).toLowerCase()] || type;
}

/* ── שלוש עמודות-סטטוס נפרדות (לקח-המוקאפ): עבודה ≠ אישור ≠ נדרש-ממך ── */

/* סטטוס-העבודה של המשרד */
const WORK_STATUS = {
  draft:                          ["בהכנה",        "mi-chip-info"],
  in_progress:                    ["בהכנה",        "mi-chip-info"],
  internal_review:                ["בבדיקה",       "mi-chip-info"],
  qa_passed:                      ["מוכן",         "mi-chip-success"],
  waiting_for_marketing_approval: ["מחכה לאישור",  "mi-chip-warning"],
  approved:                       ["הושלם",        "mi-chip-success"],
  revision_required:              ["בתיקון",       "mi-chip-warning"],
  rejected:                       ["נדחה",         "mi-chip-danger"],
  sent_for_execution:             ["נשלח לביצוע",  "mi-chip-info"],
  executed:                       ["בוצע",         "mi-chip-success"],
  completed:                      ["הושלם",        "mi-chip-success"],
  submitted:                      ["התקבל במשרד",  "mi-chip-info"],
  superseded:                     ["הוחלף בגרסה חדשה", "mi-chip-info"],
};

export function workStatus(status) {
  return WORK_STATUS[status] || [status || "—", "mi-chip-info"];
}

/* סטטוס-האישור — נפרד מסטטוס-העבודה */
const APPROVAL_STATUS = {
  qa_passed:                      ["מוכן לבדיקה",   "mi-chip-success"],
  waiting_for_marketing_approval: ["ממתין לאישור",  "mi-chip-warning"],
  approved:                       ["מאושר",         "mi-chip-success"],
  revision_required:              ["הוחזר לתיקון",  "mi-chip-danger"],
  draft:                          ["לא נדרש עדיין", null],
  in_progress:                    ["לא נדרש עדיין", null],
  internal_review:                ["לא נדרש עדיין", null],
};

export function approvalStatus(status) {
  return APPROVAL_STATUS[status] || ["—", null];
}

/* "נדרש ממך" — הפעולה המדויקת של המנהלת, אם יש */
export function requiredOfYou(status) {
  if (status === "qa_passed" || status === "waiting_for_marketing_approval") {
    return "צפייה ובדיקה";
  }
  return null; // אין פעולה => "—". לעולם לא ממציאים משימה.
}

/* פריט שמחכה להחלטת המנהלת. internal_review = שלב פנימי של המשרד (כיוון/בדיקה
   באמצע הפס), לא תוצר-גמור — לא נספר כ"מחכה לך" כדי שלא ידלוף לתיבת-האישורים. */
export const PENDING_STATUSES = ["qa_passed", "waiting_for_marketing_approval"];

/* שלבי-עבודה פנימיים של המשרד — לעולם לא מוצגים כ"החלטה שמחכה לה". השרת
   (api/routes/manager.py) עדיין מחזיר internal_review בפיד ה-pending; כל מסך
   שטוען pending מסנן אותם בצד-הלקוח דרך isInternalStep, כך שאף שלב-ביניים
   לא דולף לתיבת-האישורים — גם אם השרת יחזיר אותו. */
const INTERNAL_STEP_STATUSES = ["internal_review", "draft", "in_progress"];

export function isInternalStep(status) {
  return INTERNAL_STEP_STATUSES.includes(status);
}

/** מסנן פריטי-pending: משאיר רק החלטות אמיתיות, מסיר כל שלב-ביניים פנימי. */
export function stripInternalSteps(items = []) {
  return items.filter((i) => !isInternalStep(i?.status));
}

/* ── מסנני-התצוגה הקבועים של המנהלת ─────────────────────── */

/**
 * חסם שמוצג למנהלת = חסם שמחכה להחלטה/מידע ממנה (בריף חסר, אישור, OTP).
 * חסמי-מערכת (make_routing_not_ready, department_failed, critical_finding,
 * תקלות חיבור) מנותבים מהפיד שלה — הם באחריות המשרד.
 * (project_takeover_delivery_definition; אומת מול הדאטה החיה 11/06)
 */
const HUMAN_BLOCKER_TYPES = [
  "missing_brief_field", "awaiting_approval", "awaiting_human_input",
  "qa_revision_required", "incomplete_creative_brief",
];

export function isManagerBlocker(blocker) {
  const t = blocker?.blocker_type || "";
  const typeOk = HUMAN_BLOCKER_TYPES.includes(t) || t.startsWith("human_only");
  if (!typeOk) return false;
  // הבעלות מכריעה: חסם שממוען למחלקה (owner=media/admin) הוא עבודת-המשרד
  const owner = blocker?.owner_role;
  if (owner && !["marketing_manager", "human", "school_director"].includes(owner)) return false;
  // שאריות ריצות-בדיקה לא מגיעות לפיד (היגיינה — תצוגה בלבד).
  // בלי \b — מזהי-טסט כמו int_complete_test_777f33 עטופים בקו-תחתון.
  if (/test|טסט/i.test(blocker?.description || "")) return false;
  return true;
}

/**
 * פריטי-overview של חסמים לא נושאים blocker_type — הסינון נעשה עם join
 * לרשימת-החסמים המלאה (blockerTypeById: id → blocker_type).
 */
export function filterWaitingForMe(waiting = [], testFolderIds = null, blockerTypeById = null) {
  return waiting.filter((w) => {
    if (w.kind === "blocker") {
      const t = w.blocker_type || blockerTypeById?.get?.(w.id);
      // בלי מידע על הסוג — משאירים (עדיף רעש מהשתקה של חסם אמיתי)
      return t == null ? true : isManagerBlocker({ blocker_type: t });
    }
    if (testFolderIds && w.folder_id && testFolderIds.has(w.folder_id)) return false;
    return true;
  });
}

/** מזהי תיקיות-הטסט — לסינון עקבי של פריטים בכל המסכים והמונים */
export function testFolderIdSet(folders = []) {
  return new Set(folders.filter(isTestFolder).map((f) => f.id));
}

/** פריטי-אישור שמוצגים למנהלת: בלי פריטים של תיקיות-טסט */
export function filterInboxItems(items = [], testFolderIds) {
  if (!testFolderIds) return items;
  return items.filter((i) => !i.folder_id || !testFolderIds.has(i.folder_id));
}

/**
 * "פעילות אחרונה" = רק החלטות-שלה + "בוצע/טופל".
 * בלי רעש-מערכת: מעברי-שלבים פנימיים, ריצות גוגל/Make וכו' לא מוצגים.
 */
const HER_DECISION_TYPES = ["approval", "rejection", "campaign_closure",
                            "manager_created_artifact", "recommendation_decision"];

export function filterActivityForManager(decisions = []) {
  return decisions.filter((d) => {
    if ((d.decided_by || "") === "marketing_manager") return true;
    if (HER_DECISION_TYPES.includes(d.decision_type)) return true;
    // "בוצע/טופל" — תהליך שהושלם
    const decision = String(d.decision || "").toLowerCase();
    return decision === "completed" || decision === "resolved";
  });
}

const ACTIVITY_ICON = {
  approval:                 "✅",
  rejection:                "✎",
  campaign_closure:         "🏁",
  recommendation_decision:  "💡",
  manager_created_artifact: "📤",
  workflow_transition:      "🔄",
  status_change:            "🔄",
};

export function activityIcon(decisionType) {
  return ACTIVITY_ICON[decisionType] || "•";
}

/* ── "בקצרה" — קמפיין מול יעד עסקי, לא מדדי-מדיה ─────────── */

const MONTH_HE = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
                  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export function monthHe(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : MONTH_HE[d.getMonth()];
}

/**
 * בוחר את המחזור הרלוונטי לקורס: הקרוב ביותר שעוד לא הסתיים;
 * אם אין — האחרון. מחזיר null אם אין מחזורים בכלל.
 */
export function pickRelevantCycle(cycles = []) {
  if (!cycles.length) return null;
  const now = Date.now();
  const open = cycles
    .filter((c) => c.start_date && new Date(c.start_date).getTime() >= now)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  if (open.length) return open[0];
  return [...cycles].sort(
    (a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0))[0];
}

/** % מהיעד העסקי: נרשמים בפועל מול יעד-נרשמים של המחזור. null = אין יעד מוגדר. */
export function pctOfTarget(cycle) {
  const target = cycle?.target_min_enrollments;
  const actual = cycle?.total_enrollees;
  if (!target || target <= 0 || actual == null) return null;
  return Math.round((100 * actual) / target);
}

const FOLDER_STATUS = {
  active:   ["פעיל",   "mi-chip-success"],
  live:     ["פעיל",   "mi-chip-success"],
  planning: ["בתכנון", "mi-chip-warning"],
  draft:    ["בתכנון", "mi-chip-warning"],
  paused:   ["מושהה",  "mi-chip-info"],
  archived: ["בארכיון", "mi-chip-info"],
  closed:   ["נסגר",   "mi-chip-info"],
};

export function folderStatus(status) {
  return FOLDER_STATUS[status] || [status || "—", "mi-chip-info"];
}

/* תיקיות-טסט לא נספרות ולא מוצגות בניווט (היגיינה — תצוגה בלבד, אפס מחיקה).
   אומת מול הדאטה החיה 11/06: E2E / Sim / diag / Integration-Test / LLM-Test /
   "(טרם זוהה)" — שאריות ריצות-בדיקה של המשרד, לא עבודה של המנהלת. */
export function isTestFolder(folder) {
  const name = `${folder?.course_name || ""} ${folder?.activity_label || ""}`.trim();
  if (!name || name === "(טרם זוהה)") return true;
  return /\btest\b|בדיקה|טסט|demo|דמו|\be2e\b|\bsim\b|\bdiag\b|sanity|integration/i
    .test(name) || /sim [0-9a-f]{6}/i.test(name);
}

/* ── הקורסים המנוהלים — עמוד-השדרה של הסרגל (תיקון נירית 11/06) ──
   המקור: היקף-הניהול שב-DB — media_settings.payload.media_deployment.per_course
   (פריסת-המדיה המאושרת). לא טבלת-התיקיות הגולמית.
   שם קנוני אחד לכל קורס לפי טבלת פנימי↔פרסום (agents/_brand_rules.py:
   COURSE_NAMES) — בלי כפילויות QA/בודק-תוכנה, שיווק/שיווק-דיגיטלי וכו'.
   קורסים שהוצאו מניהול (Full Stack, DevOps, AI ערב, הייטק) לא בניווט —
   ההיסטוריה נשארת בדאטה. */

/* קנוני → וריאציות-הזיהוי (פנימי + פרסומי + EN). שיקוף של COURSE_NAMES
   בצד-הלקוח, לזיהוי תיקיות ומפתחות-פריסה בלבד. */
const COURSE_MATCHERS = [
  // 'integration' מצומצם ל-AI Integration Specialist בלבד — שלא יתפוס תיקיות-בדיקה
  // כמו "Integration Test Course" (שגם נחסמות ב-isTestFolder, אך הדיוק חשוב כאן).
  ["AI ARCHITECT", [/architect/i, /ai\s*integration/i, /אינטגרצי/]],
  ["QA",           [/\bqa\b/i, /בודק תוכנה/, /פיתוח טכנולוגיות/]],
  ["AI",           [/mastermind/i, /בינה מלאכותית/, /^ai(?!.*(ערב|בוקר))/i]],
  ["שיווק לבעלי עסקים", [/בעלי עסקים/]],
  ["שיווק",        [/^שיווק/, /שיווק דיגיטלי/]],
  ["גיימינג",      [/גיימינג/, /gaming/i, /פיתוח משחקים/]],
  ["סייבר",        [/סייבר/]],
];

/* סדר-התצוגה שאישרה נירית. מפתח-פריסה שלא זוהה — מצטרף בסוף בשמו. */
const COURSE_ORDER = ["QA", "AI", "שיווק", "AI ARCHITECT", "גיימינג", "סייבר"];

/** שם תיקייה/מפתח-פריסה → הקורס הקנוני, או null אם לא מנוהל/לא זוהה */
export function canonicalCourseOf(name = "") {
  const n = String(name).trim();
  if (!n) return null;
  for (const [key, patterns] of COURSE_MATCHERS) {
    if (patterns.some((p) => p.test(n))) return key;
  }
  return null;
}

/** רשימת הקורסים המנוהלים מתוך הגדרות-המדיה, בסדר שאישרה נירית */
export function managedCourses(settings) {
  const perCourse = settings?.payload?.media_deployment?.per_course || {};
  const seen = new Set();
  const extras = [];
  for (const key of Object.keys(perCourse)) {
    const canonical = canonicalCourseOf(key);
    if (canonical) seen.add(canonical);
    else if (!extras.includes(key)) extras.push(key); // קורס חדש בפריסה — מוצג בשמו
  }
  return [...COURSE_ORDER.filter((c) => seen.has(c)), ...extras];
}

/** תיקיות-העבודה של קורס קנוני (בלי תיקיות-טסט), מהעדכנית לישנה */
export function courseFolders(courseKey, folders = []) {
  return folders
    .filter((f) => !isTestFolder(f) && canonicalCourseOf(f.course_name) === courseKey)
    .sort((a, b) =>
      new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
}

/** סטטוס מצרפי לקורס: live של תיקייה כלשהי גובר, אחרת העדכנית, אחרת בתכנון */
export function courseStatus(courseKey, folders = []) {
  const list = courseFolders(courseKey, folders);
  const live = list.find((f) => ["live", "active"].includes(f.status));
  return (live || list[0])?.status || "planning";
}

/* התאמת מחזורי-Fireberry לקורס לפי שם — דטרמיניסטי, בניקוד:
   שוויון מלא (3) > מתחיל-ב (2) > מכיל (1). מונע ש"AI" יתפוס את
   "שיווק, סושיאל ו-AI ערב" כשקיימים מחזורי "AI" ישירים.
   aliases רק לתרגום EN↔HE — לא רשימת-קורסים קשיחה. */
const COURSE_ALIASES = { gaming: "גיימינג", cyber: "סייבר", marketing: "שיווק" };

function courseMatchKey(courseKey = "") {
  let key = String(courseKey).toLowerCase().trim();
  key = COURSE_ALIASES[key] || key;
  // "בודק תוכנה (QA)" ↔ "פיתוח טכנולוגיות (QA)" — הסוגריים הם המזהה
  const m = key.match(/\(([^)]+)\)/);
  return m ? m[1].trim() : key;
}

function cycleMatchScore(cycleCourseName = "", matchKey = "") {
  const cyc = String(cycleCourseName).toLowerCase().trim();
  if (!cyc || !matchKey) return 0;
  if (cyc === matchKey) return 3;
  if (cyc.startsWith(matchKey)) return 2;
  if (cyc.includes(matchKey)) return 1;
  return 0;
}

/** המחזורים ששייכים לקורס — רק ההתאמות החזקות ביותר שנמצאו */
export function cyclesForCourse(cycles = [], courseKey = "") {
  const key = courseMatchKey(courseKey);
  let best = 0;
  const scored = cycles.map((c) => {
    const s = cycleMatchScore(c.course_name || c.name, key);
    if (s > best) best = s;
    return [s, c];
  });
  if (best === 0) return [];
  return scored.filter(([s]) => s === best).map(([, c]) => c);
}

/* ── מפתח-קורס של תוכנית-ההשתלטות (course_key) — מקור-אמת אחד ──
   האסטרטג כותב course_keys כמו 'ai_architect'/'marketing_b2b'; CoursePage
   צריך למפות שם-קורס חופשי לאותו מפתח (מאוחד כאן במקום שכפול פר-עמוד).
   הספציפי לפני הכללי (ai_architect
   לפני ai, marketing_b2b לפני marketing). קונסולידציה: וריאנטים של אותו קורס
   מתאחדים למפתח קנוני אחד דרך PLAN_KEY_CANON (כרטיס אחד פר-קורס). */
const PLAN_KEY_CANON = { marketing_social_ai: "marketing" };

/** מאחד וריאנטים של אותו course_key למפתח-קורס קנוני אחד */
export function canonPlanKey(k) {
  return (k && PLAN_KEY_CANON[k]) || k;
}

const PLAN_COURSE_ALIASES = [
  ["ai_architect", ["architect", "ארכיטקט", "ai integration", "אינטגרצי"]],
  ["marketing_b2b", ["b2b", "בעלי עסקים"]],
  ["qa", ["qa", "פיתוח טכנולוגיות", "בדיקות"]],
  ["cyber", ["cyber", "סייבר"]],
  ["gaming", ["gaming", "גיימינג", "פיתוח משחקים"]],
  ["marketing_social_ai", ["סושיאל"]],
  ["marketing", ["שיווק", "marketing"]],
  ["ai", ["ai", "בינה"]],
];

/** שם-קורס חופשי → course_key של תוכנית-ההשתלטות (הספציפי לפני הכללי) */
export function matchPlanCourseKey(name) {
  const s = (name || "").toLowerCase();
  for (const [key, aliases] of PLAN_COURSE_ALIASES) {
    if (aliases.some((a) => s.includes(a))) return key;
  }
  return "_other";
}

/* תוויות-עברית פר course_key של תוכנית-ההשתלטות (לכותרות-קורס בעמודי-ההשתלטות) */
const PLAN_COURSE_LABELS = {
  qa: "QA — פיתוח טכנולוגיות",
  ai: "AI",
  ai_architect: "AI Architect",
  cyber: "סייבר",
  gaming: "גיימינג",
  marketing: "שיווק",
  marketing_b2b: "שיווק B2B",
  marketing_social_ai: "שיווק / סושיאל / AI",
};

/** תווית-עברית ל-course_key של תוכנית-ההשתלטות, או המפתח עצמו אם לא ידוע */
export function planCourseLabel(key) {
  return PLAN_COURSE_LABELS[key] || key;
}

/* ── עזרי תצוגה ─────────────────────────────────────────── */

export function shortDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

export function fullDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/* ── הצגה כנה של מבנה-הקמפיין והמעבר (facts.cbo + facts.transition_date) ──
   facts.cbo הוא המבנה ה**מתוכנן/יעד** (CBO/Adset), ו-transition_date הוא **מתי**
   מתוכנן לעבור אליו. לעולם לא מציגים מבנה-מתוכנן כעובדה-קיימת ("כבר CBO"): אם
   המעבר עוד לפנינו — זה "מתוכנן", ואם התאריך כבר עבר — מציינים זאת ביושר במקום
   להעמיד פנים שהמעבר טרי/עתידי. אין נתון → null (לא ממציאים מבנה/תאריך). */

/** מסווג תאריך-מעבר מול היום: "future" | "past" | "today" | null (אין/לא-תקין) */
export function transitionWhen(iso, now = new Date()) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = (x) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = day(d) - day(now);
  if (diff > 0) return "future";
  if (diff < 0) return "past";
  return "today";
}

/** שם-המבנה ה**מתוכנן** בעברית-עסקית (בלי ז'רגון CBO/Adset), או null אם לא ידוע.
    CBO = המערכת מחלקת תקציב אוטומטית למודעות-המנצחות → "תקציב חכם".
    ABO/Adset = תקציב קבוע ידני פר-קבוצת-מודעות → "תקציב פר-קבוצה". */
export function structureName(cbo) {
  if (cbo === true) return "תקציב חכם";
  if (cbo === false) return "תקציב פר-קבוצה";
  return null;
}

/**
 * הצגה כנה של מבנה-הקמפיין: המבנה-המתוכנן + מתי, ביחס להיום. מחזיר
 * { structure, when, label } — label הוא המחרוזת המוצגת ("—" אם אין מבנה).
 *   • מעבר עתידי  → "תקציב חכם — מתוכנן ל-DD.MM.YYYY" (לא "כבר עברנו")
 *   • מעבר שעבר   → "תקציב חכם — מעבר תוכנן ל-DD.MM.YYYY (עבר)"
 *   • מעבר היום   → "תקציב חכם — מעבר מתוכנן להיום (DD.MM.YYYY)"
 *   • בלי תאריך   → המבנה בלבד ("תקציב חכם"/"תקציב פר-קבוצה"), בלי טענת-מעבר.
 * אף פעם לא ממציא: אין מבנה → label "—".
 */
export function deploymentStructure(facts, now = new Date()) {
  const structure = structureName(facts?.cbo);
  const when = transitionWhen(facts?.transition_date, now);
  if (!structure) {
    // אין מבנה מתוכנן — אם בכל-זאת יש תאריך-מעבר אמיתי, מציגים אותו ביושר.
    if (when) return { structure: null, when, label: `מעבר ${fullDate(facts.transition_date)}` };
    return { structure: null, when: null, label: "—" };
  }
  if (!when) return { structure, when: null, label: structure };
  const d = fullDate(facts.transition_date);
  const label = when === "future" ? `${structure} — מתוכנן ל-${d}`
    : when === "past" ? `${structure} — מעבר תוכנן ל-${d} (עבר)`
    : `${structure} — מעבר מתוכנן להיום (${d})`;
  return { structure, when, label };
}

/* ── מצב שער-ההשתלטות (מראה את agents/workflow/takeover_gate.py — מקור-האמת) ──
   ⚠ השער **גלובלי לחשבון**, לא פר-קורס: ברגע שהקצאת-השתלטות אחת
   (metadata.recommendation_kind=takeover_redeploy) מגיעה ל-status
   approved/active — ניהול-החשבון האוטומטי כולו נדלק (שרשרת-הבוקר, סנכרון-
   הקהלים, ההמלצות). כאן מחושב המצב ל**תצוגה בלבד**; הגידור האמיתי בשרת,
   fail-closed. שינוי הפילטר בשרת ⇒ לעדכן גם כאן. */
const _isTakeoverAlloc = (a) =>
  ((a?.metadata || {}).recommendation_kind || (a?.metadata || {}).decision_kind) === "takeover_redeploy";

/** האם ניהול-החשבון כבר נדלק — קיימת הקצאת-השתלטות מאושרת/פעילה כלשהי (גלובלי).
    מקבל את **כל** ההקצאות (לא פר-קורס). מראה את takeover_gate.takeover_approved(). */
export function takeoverGloballyApproved(allAllocations) {
  return (allAllocations || []).some(
    (a) => _isTakeoverAlloc(a) && ["approved", "active"].includes(a.status));
}

/** מצב-ההשתלטות של קורס בודד מתוך הקצאותיו:
 *  { proposals, approved } — proposals=הצעות-השתלטות שממתינות לאישורה;
 *  approved=הקורס כבר עלה (הקצאת-השתלטות מאושרת/פעילה לקורס). */
export function courseTakeoverState(courseAllocations) {
  const tk = (courseAllocations || []).filter(_isTakeoverAlloc);
  const proposals = tk.filter((a) => a.status === "recommended");
  // approved = סטטוס-ההקצאה בלבד — זהה ל-takeoverGloballyApproved ול-takeover_gate.py.
  // ⚠ לא לסמוך על decided_by='marketing_manager': השרת רושם אותו גם ב**דחייה**
  //   (status→closed, recommendation_kind נשאר), אז דחיית-הצעה הייתה מציגה כוזב "אושר/עלה לאוויר".
  const approved = tk.some((a) => ["approved", "active"].includes(a.status));
  return { proposals, approved };
}

/** קישור-צפייה של Drive → קישור-תמונה שנטען ב-<img> (אותו קובץ, אותו Drive) */
export function displayableAssetUrl(url) {
  if (!url) return null;
  const m = String(url).match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
  return url;
}

/** הנכס כפי שהוא שמור (לרוב קישור Drive) — לקישור-צפייה, לא ל-<img> */
export function rawAssetUrl(artifact) {
  const p = artifact?.payload || {};
  const variant = Array.isArray(p.variants)
    ? p.variants.find((v) => v?.asset_url)
    : null;
  return (
    artifact?.asset_url || p.asset_url || variant?.asset_url || p.image_url ||
    p.preview_url || p.thumbnail_url || p.attached_file?.access_url || null
  );
}

/** thumbnail אמיתי מתוך ה-payload של תוצר — או null. אין תמונות מומצאות.
    creative_rendered מחזיק את הנכסים תחת payload.variants[].asset_url. */
export function artifactThumb(artifact) {
  return displayableAssetUrl(rawAssetUrl(artifact));
}

/** האם הנכס וידאו (לתג ▶ בגלריה ולנגן ב-Review) */
export function isVideoAsset(url) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url || "");
}

/* שדות-הקופי מתוך payload של תוצר — לפי המבנה בפועל (ad_copy_*: מערכים
   headlines/primary_texts/ctas + lead_form_intro), בלי להמציא. */
export function copyFields(payload = {}) {
  const src = payload.copy || payload;
  const out = [];
  const push = (key, label, val) => {
    if (typeof val === "string" && val.trim()) out.push({ key, label, value: val });
  };
  const pushList = (baseKey, baseLabel, list, cap = 5) => {
    if (!Array.isArray(list)) return;
    list.slice(0, cap).forEach((v, i) =>
      push(`${baseKey}-${i}`, list.length > 1 ? `${baseLabel} ${i + 1}` : baseLabel, v));
  };
  pushList("headline", "כותרת", src.headlines);
  push("headline", "כותרת", src.headline);
  pushList("body", "טקסט ראשי", src.primary_texts);
  push("subheadline", "שורת משנה", src.subheadline || src.subtitle);
  push("course_line", "שורת קורס", src.course_line);
  push("body", "טקסט", src.body);
  pushList("cta", "CTA", src.ctas);
  push("cta", "CTA", src.cta);
  push("lead_form_intro", "פתיח טופס לידים", src.lead_form_intro);
  return out;
}

/* ── ניתוב-תוצר: Review (קראייטיב/קופי) או תיק-הפריט (מדיה/תקציב/מחקר) ──
   מסך ה-Review מציג את "המודעה כפי שהגולש רואה אותה" (קונספט+קופי+ויזואל),
   ולכן מתאים רק לתוצרי-קראייטיב/קופי. תוצר-תקציב/פריסת-מדיה/מחקר אינו "נכס
   ויזואלי" — הוא נפתח בתיק-הפריט (ItemPage), שם מוצג תוכנו האמיתי (למשל טבלת
   פריסת-המדיה). מקור-אמת אחד לכל הממשק (היה משוכפל ב-ItemPage כ-isReviewable
   וב-CoursePage כ-_opensReview). */
export function opensReview(artifact) {
  const t = (artifact?.artifact_type || "").toLowerCase();
  const d = (artifact?.producing_department || "").toLowerCase();
  if (d === "creative" || d === "copy") return true;
  if (/media|budget|deploy|plan|scenario|allocation|forecast|research|redeploy/.test(t)) return false;
  return /creative|visual|design|ad_copy|copy|concept|render|video|art_direction/.test(t);
}

/** האם התוצר הוא פריסת-מדיה מלאה (מ-takeover_redeploy) — שמצריך טבלת-פריסה ייעודית. */
export function isMediaDeployment(artifact) {
  return (artifact?.artifact_type || "").toLowerCase() === "media_deployment";
}

/* תווית-חודש קצרה מ-"YYYY-MM" (לכותרות-עמודות של טבלת-הפריסה). חודש לא-תקין → המחרוזת כמות-שהיא. */
export function monthLabelHe(ym) {
  const m = String(ym || "").match(/^(\d{4})-(\d{2})/);
  if (!m) return String(ym || "");
  const idx = Number(m[2]) - 1;
  return MONTH_HE[idx] ? `${MONTH_HE[idx]} ${m[1]}` : String(ym);
}

/**
 * טרנספורם דטרמיניסטי של payload של תוצר media_deployment לטבלה הניתנת-לרינדור.
 * אפס המצאת-מספר: רק נגזרות מ-deltas/months/new_per_course שכבר נכתבו בשרת.
 * מחזיר { months, currentMonthIndex, period, rationale, courses[] } או null אם אין נתון.
 *   courses[]: { courseKey, label, spend, baselineTotal, newTotal, baselineMonthly[], newMonthly[] }
 */
export function mediaDeploymentRows(payload = {}) {
  const deltas = Array.isArray(payload.deltas) ? payload.deltas : [];
  const months = Array.isArray(payload.months) ? payload.months.map(String) : [];
  if (!deltas.length) return null;
  const courses = deltas.map((d) => {
    const key = d.deployment_key || d.course_key || "";
    return {
      courseKey: key,
      label: planCourseLabel(matchPlanCourseKey(key)) || key,
      spend: typeof d.spend_to_date_ils === "number" ? d.spend_to_date_ils : null,
      baselineTotal: typeof d.baseline_period_total === "number" ? d.baseline_period_total : null,
      newTotal: typeof d.new_period_total === "number" ? d.new_period_total : null,
      baselineMonthly: Array.isArray(d.baseline_meta_monthly) ? d.baseline_meta_monthly : [],
      newMonthly: Array.isArray(d.new_meta_monthly) ? d.new_meta_monthly : [],
    };
  });
  return {
    months,
    currentMonthIndex: typeof payload.current_month_index === "number" ? payload.current_month_index : null,
    period: payload.period || null,
    rationale: payload.pacing_rationale || null,
    courses,
  };
}

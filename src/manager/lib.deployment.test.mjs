/**
 * lib.deployment.test.mjs — בדיקות הרמטיות לעזרי-התצוגה הדטרמיניסטיים שנוספו
 * לחיווט-ההשתלטות (פריסת-מדיה מלאה): opensReview / isMediaDeployment /
 * monthLabelHe / mediaDeploymentRows.
 *
 * הרמטי: אין רשת, אין DB, אין React. ה-lib טהור (אפס imports) — מתרגמים אותו
 * עם ה-esbuild של ה-client הראשי למודול-ESM זמני ומייבאים את הפונקציות. הרצה:
 *   node --test src/manager/lib.deployment.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = join(__dirname, "lib.js");

// ה-esbuild של ה-client הראשי (אותו בינארי של ה-build) — אפס התקנה. ניתן לעקוף
// דרך SVC_ESBUILD; אחרת מנסים את הנתיב הקנוני של ה-client הראשי (+.cmd ב-Windows).
function resolveEsbuild() {
  const base = "C:/Users/azril/OneDrive/Desktop/projects/SVCollege/client/node_modules";
  const candidates = [
    process.env.SVC_ESBUILD,
    // הבינארי הנייטיב הישיר (ניתן ל-spawn ללא shell) — מועדף
    join(base, "@esbuild/win32-x64/esbuild.exe"),
    join(base, "esbuild/bin/esbuild"),
    // עטיפת ה-.cmd של npm (דורש shell)
    join(base, ".bin/esbuild.cmd"),
    join(base, ".bin/esbuild"),
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

const ESBUILD = resolveEsbuild();
const dir = mkdtempSync(join(tmpdir(), "svc-lib-test-"));
const outFile = join(dir, "lib.mjs");
const args = [LIB, "--bundle", "--format=esm", `--outfile=${outFile}`];
// .cmd דורש shell; בינארי נייטיב/סקריפט מורץ ישירות. ב-shell עוטפים בגרשיים.
const useShell = /\.cmd$/i.test(ESBUILD);
execFileSync(ESBUILD, args, { stdio: "ignore", ...(useShell ? { shell: true } : {}) });
const lib = await import(pathToFileURL(outFile).href);
test.after(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ } });

const { opensReview, isMediaDeployment, monthLabelHe, mediaDeploymentRows } = lib;

test("opensReview: קראייטיב/קופי → Review; מדיה/תקציב/פריסה → תיק-פריט", () => {
  // קראייטיב/קופי לפי סוג
  for (const t of ["creative_rendered", "art_direction", "creative_strategy",
                   "ad_copy_meta", "ad_copy_google", "creative_concept", "visual", "video"]) {
    assert.equal(opensReview({ artifact_type: t }), true, `${t} צריך Review`);
  }
  // מדיה/תקציב/מחקר → לא Review (כולל ה-media_deployment החדש)
  for (const t of ["media_deployment", "media_plan", "market_research",
                   "budget_recommendation", "budget_allocation", "make_scenario_created"]) {
    assert.equal(opensReview({ artifact_type: t }), false, `${t} לא צריך Review`);
  }
  // department גובר על סוג עמום
  assert.equal(opensReview({ artifact_type: "thing", producing_department: "creative" }), true);
  assert.equal(opensReview({ artifact_type: "thing", producing_department: "copy" }), true);
  // סוג לא-מוכר וללא department → לא Review (ברירת-מחדל בטוחה — תיק-פריט)
  assert.equal(opensReview({ artifact_type: "totally_unknown" }), false);
  assert.equal(opensReview({}), false);
});

test("isMediaDeployment מזהה רק media_deployment", () => {
  assert.equal(isMediaDeployment({ artifact_type: "media_deployment" }), true);
  assert.equal(isMediaDeployment({ artifact_type: "MEDIA_DEPLOYMENT" }), true);
  assert.equal(isMediaDeployment({ artifact_type: "media_plan" }), false);
  assert.equal(isMediaDeployment({}), false);
  assert.equal(isMediaDeployment(null), false);
});

test("monthLabelHe ממיר YYYY-MM לתווית עברית; קלט לא-תקין → כמות-שהוא", () => {
  assert.equal(monthLabelHe("2026-06"), "יוני 2026");
  assert.equal(monthLabelHe("2026-07"), "יולי 2026");
  assert.equal(monthLabelHe("2026-01"), "ינואר 2026");
  assert.equal(monthLabelHe("not-a-month"), "not-a-month");
  assert.equal(monthLabelHe(""), "");
  assert.equal(monthLabelHe(null), "");
});

test("mediaDeploymentRows: טרנספורם דטרמיניסטי של ה-payload האמיתי", () => {
  // payload בצורה שכותב takeover_redeploy._write_deployment_artifact
  const payload = {
    months: ["2026-06", "2026-07", "2026-08"],
    current_month_index: 0,
    period: { budget_period_start: "2026-06-04", period_end: "2026-12-31" },
    pacing_rationale: "פריסה מלאה מחדש (general)",
    deltas: [
      {
        course_key: "ai_architect",
        deployment_key: "AI Integration (חדש)",
        spend_to_date_ils: 0,
        baseline_meta_monthly: [18214, 18214, 18214],
        new_meta_monthly: [18214, 18214, 18214],
        baseline_period_total: 54642,
        new_period_total: 54642,
      },
      {
        course_key: "qa",
        deployment_key: "QA",
        spend_to_date_ils: 1200,
        baseline_meta_monthly: [5000, 5000, 5000],
        new_meta_monthly: [4600, 4600, 4600],
        baseline_period_total: 15000,
        new_period_total: 13800,
      },
    ],
  };
  const out = mediaDeploymentRows(payload);
  assert.ok(out, "צריך להחזיר אובייקט");
  assert.deepEqual(out.months, ["2026-06", "2026-07", "2026-08"]);
  assert.equal(out.currentMonthIndex, 0);
  assert.equal(out.period.period_end, "2026-12-31");
  assert.equal(out.rationale, "פריסה מלאה מחדש (general)");
  assert.equal(out.courses.length, 2);

  const arch = out.courses[0];
  assert.equal(arch.courseKey, "AI Integration (חדש)"); // deployment_key מועדף
  assert.equal(arch.label, "AI Architect");              // ממופה לתווית-עברית
  assert.equal(arch.spend, 0);
  assert.equal(arch.baselineTotal, 54642);
  assert.equal(arch.newTotal, 54642);
  assert.deepEqual(arch.newMonthly, [18214, 18214, 18214]);

  const qa = out.courses[1];
  assert.equal(qa.label, "QA — פיתוח טכנולוגיות");
  assert.equal(qa.spend, 1200);
  assert.equal(qa.newTotal, 13800);
});

test("mediaDeploymentRows: אין deltas → null (אפס המצאה)", () => {
  assert.equal(mediaDeploymentRows({}), null);
  assert.equal(mediaDeploymentRows({ deltas: [] }), null);
  assert.equal(mediaDeploymentRows(undefined), null);
});

test("mediaDeploymentRows: שדות חסרים → null במקום מספר מומצא", () => {
  const out = mediaDeploymentRows({
    deltas: [{ course_key: "x", deployment_key: "X" }],
  });
  assert.equal(out.courses[0].spend, null);
  assert.equal(out.courses[0].baselineTotal, null);
  assert.equal(out.courses[0].newTotal, null);
  assert.deepEqual(out.courses[0].baselineMonthly, []);
  assert.deepEqual(out.months, []);
});

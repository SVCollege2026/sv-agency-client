/**
 * check-contrast.mjs — אכיפת ניגודיות WCAG-AA על טוקני ממשק-המנהלת.
 * רץ ב-prebuild: אם זוג טקסט/רקע יורד מתחת לסף — הבילד נופל.
 * מקור-האמת לערכים: src/manager/tokens.css (נקרא משם, לא משוכפל).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "../src/manager/tokens.css"), "utf8");

const tokens = {};
for (const m of css.matchAll(/(--mi-[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
  tokens[m[1]] = m[2];
}

function luminance(hex) {
  const c = [1, 3, 5].map((i) => {
    let v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(fg, bg) {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

// [שם-לתצוגה, טקסט, רקע, סף] — 4.5 לטקסט רגיל, 3.0 לרכיבי-UI/טקסט-גדול
const PAIRS = [
  ["כותרות על כרטיס",        "--mi-ink",     "--mi-surface",     4.5],
  ["גוף על כרטיס",           "--mi-ink-2",   "--mi-surface",     4.5],
  ["מטא על כרטיס",           "--mi-ink-3",   "--mi-surface",     4.5],
  ["מטא על רקע-עמוד",        "--mi-ink-3",   "--mi-bg",          4.5],
  ["גוף על רקע-עמוד",        "--mi-ink-2",   "--mi-bg",          4.5],
  ["לבן על כפתור ראשי",      null,           "--mi-primary",     4.5, "#FFFFFF"],
  ["מג'נטה על לבן (לינק)",   "--mi-primary", "--mi-surface",     4.5],
  ["מג'נטה על רקע-רך",       "--mi-primary", "--mi-primary-soft", 4.5],
  ["הצלחה על רקע-רך",        "--mi-success", "--mi-success-bg",  4.5],
  ["אזהרה על רקע-רך",        "--mi-warning", "--mi-warning-bg",  4.5],
  ["מידע על רקע-רך",         "--mi-info",    "--mi-info-bg",     4.5],
  ["סכנה על רקע-רך",         "--mi-danger",  "--mi-danger-bg",   4.5],
  ["אקסנט על רקע-רך",        "--mi-accent",  "--mi-accent-bg",   4.5],
  ["מסגרת-פוקוס על עמוד",    "--mi-focus",   "--mi-bg",          3.0],
];

let failed = 0;
for (const [name, fgTok, bgTok, min, fgRaw] of PAIRS) {
  const fg = fgRaw || tokens[fgTok];
  const bg = tokens[bgTok];
  if (!fg || !bg) {
    console.error(`✗ ${name}: טוקן חסר (${fgTok || fgRaw} / ${bgTok})`);
    failed++;
    continue;
  }
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}: ${r.toFixed(2)}:1 (סף ${min})`);
}

if (failed) {
  console.error(`\n${failed} זוגות מתחת לסף AA — תקני את tokens.css לפני build.`);
  process.exit(1);
}
console.log("\nכל זוגות-הניגודיות עוברים AA ✓");

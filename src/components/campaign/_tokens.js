/**
 * _tokens.js — מערכת עיצוב מאוחדת לקמפיין-מנג'מנט (Campaign Management).
 *
 * כל קומפוננטה בתת-העץ campaign/* משתמשת בערכים האלה ולא בערכי hex/spacing
 * אקראיים. כך נשמרת אחידות וויזואלית כמו ב-SaaS מקצועיים (Linear, Monday,
 * Notion).
 *
 * Usage:
 *   import { color, space, radius, shadow, type, transition } from "./_tokens";
 *   <div style={{ padding: space(4), borderRadius: radius.card, background: color.surface }}>
 */

// ─── Color tokens — semantic, not raw hex usage ──────────────────────────────
export const color = {
  // Canvas + surfaces
  canvas:        "#f7f8fa",   // page background
  surface:       "#ffffff",   // card background
  surfaceMuted:  "#f9fafb",   // secondary card / well
  surfaceSunken: "#f1f3f5",   // input background

  // Borders
  borderSubtle:  "#f1f3f5",
  borderDefault: "#e5e7eb",
  borderStrong:  "#d1d5db",

  // Text
  fgDefault: "#111827",
  fgMuted:   "#4b5563",
  fgSubtle:  "#9ca3af",
  fgOnDark:  "#ffffff",

  // Brand — deep blue
  primary:        "#1e3a5f",
  primaryHover:   "#162a45",
  primarySoftBg:  "#eff6ff",
  primarySoftFg:  "#1e40af",

  // Semantic
  success:        "#16a34a",
  successSoftBg:  "#dcfce7",
  successSoftFg:  "#15803d",

  warning:        "#d97706",
  warningSoftBg:  "#fef3c7",
  warningSoftFg:  "#a16207",

  danger:         "#dc2626",
  dangerSoftBg:   "#fee2e2",
  dangerSoftFg:   "#b91c1c",

  info:           "#0369a1",
  infoSoftBg:     "#e0f2fe",
  infoSoftFg:     "#0c4a6e",

  // Accents for status tiles
  accentMuted:    "#94a3b8",
  accentMutedBg:  "#f1f5f9",
  accentVibrant:  "#4338ca",
  accentVibrantBg:"#e0e7ff",
};

// ─── Monday-style status palette — single source of truth for board pills ───
// Used by FolderBoard StatusDropdown, ApprovalDropdown, group strips,
// RecommendationsBadge. Hex values match the manager's reference Monday board.
export const monday = {
  // Status tile colors — pills + group strips
  orange:  "#fdab3d",    // working / pending
  green:   "#00c875",    // done / approved / live
  red:     "#df2f4a",    // stuck / rejected / closed
  grey:    "#c4c4c4",    // not started / draft
  purple:  "#a25ddc",    // notes / revision required
  blue:    "#579bfc",    // planned / recommendations
  white:   "#ffffff",
  ink:     "#1e293b",    // dark text on light tiles
};

// ─── Spacing scale — strict 4pt grid ─────────────────────────────────────────
const _spaceStep = 4;
export const space = (n) => `${n * _spaceStep}px`;        // space(1) = 4px, space(4) = 16px
export const spaceN = (n) => n * _spaceStep;              // numeric variant when needed

// ─── Border radius scale ─────────────────────────────────────────────────────
export const radius = {
  none:    0,
  xs:      4,
  sm:      6,
  md:      8,
  lg:      12,
  xl:      16,
  pill:    999,
  // Semantic
  input:   8,
  button:  8,
  card:    12,
  badge:   999,
};

// ─── Shadow scale ────────────────────────────────────────────────────────────
export const shadow = {
  none: "none",
  xs:   "0 1px 2px rgba(15,23,42,0.04)",
  sm:   "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
  md:   "0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.05)",
  lg:   "0 12px 28px rgba(15,23,42,0.12), 0 4px 8px rgba(15,23,42,0.06)",
  xl:   "0 24px 48px rgba(15,23,42,0.18), 0 8px 16px rgba(15,23,42,0.08)",
};

// ─── Typography — Heebo (he), 5-step scale, deliberate weights ──────────────
export const fontFamily =
  "Heebo, 'Noto Sans Hebrew', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

export const type = {
  caption:    { fontSize: 11, lineHeight: "16px", fontWeight: 500, letterSpacing: 0.2 },
  small:      { fontSize: 12, lineHeight: "18px", fontWeight: 500 },
  bodySmall:  { fontSize: 13, lineHeight: "20px", fontWeight: 400 },
  body:       { fontSize: 14, lineHeight: "22px", fontWeight: 400 },
  bodyStrong: { fontSize: 14, lineHeight: "22px", fontWeight: 600 },
  label:      { fontSize: 13, lineHeight: "20px", fontWeight: 600, color: color.fgDefault },
  h4:         { fontSize: 14, lineHeight: "20px", fontWeight: 700, color: color.fgDefault, letterSpacing: 0.2, textTransform: "uppercase" },
  h3:         { fontSize: 16, lineHeight: "24px", fontWeight: 700, color: color.fgDefault },
  h2:         { fontSize: 20, lineHeight: "28px", fontWeight: 700, color: color.fgDefault, letterSpacing: -0.2 },
  h1:         { fontSize: 24, lineHeight: "32px", fontWeight: 800, color: color.fgDefault, letterSpacing: -0.4 },
  hero:       { fontSize: 32, lineHeight: "40px", fontWeight: 800, color: color.fgDefault, letterSpacing: -0.5 },
};

// ─── Motion ──────────────────────────────────────────────────────────────────
export const transition = {
  fast:   "all 120ms cubic-bezier(0.2, 0, 0, 1)",
  base:   "all 180ms cubic-bezier(0.2, 0, 0, 1)",
  slow:   "all 300ms cubic-bezier(0.2, 0, 0, 1)",
  spring: "all 240ms cubic-bezier(0.34, 1.56, 0.64, 1)",
};

// ─── Component presets — combos used a lot ───────────────────────────────────
export const card = {
  background:   color.surface,
  borderRadius: radius.card,
  border:       `1px solid ${color.borderDefault}`,
  boxShadow:    shadow.sm,
  padding:      space(5),     // 20px
};

export const cardSubtle = {
  ...card,
  border:    `1px solid ${color.borderSubtle}`,
  boxShadow: shadow.xs,
};

export const input = {
  width:        "100%",
  padding:      `${space(2.5)} ${space(3)}`,  // 10px 12px
  border:       `1px solid ${color.borderDefault}`,
  borderRadius: radius.input,
  fontSize:     14,
  fontFamily,
  background:   color.surfaceSunken,
  color:        color.fgDefault,
  direction:    "rtl",
  transition:   transition.fast,
  outline:      "none",
};

export const button = {
  primary: {
    padding:      `${space(2.5)} ${space(4)}`,   // 10 16
    background:   color.primary,
    color:        color.fgOnDark,
    border:       "none",
    borderRadius: radius.button,
    fontSize:     14,
    fontWeight:   700,
    cursor:       "pointer",
    boxShadow:    `0 1px 2px rgba(30,58,95,0.18), 0 1px 3px rgba(30,58,95,0.12)`,
    transition:   transition.fast,
    fontFamily,
  },
  secondary: {
    padding:      `${space(2.5)} ${space(4)}`,
    background:   color.surface,
    color:        color.fgMuted,
    border:       `1px solid ${color.borderDefault}`,
    borderRadius: radius.button,
    fontSize:     14,
    fontWeight:   600,
    cursor:       "pointer",
    boxShadow:    shadow.xs,
    transition:   transition.fast,
    fontFamily,
  },
  danger: {
    padding:      `${space(2.5)} ${space(4)}`,
    background:   color.dangerSoftBg,
    color:        color.dangerSoftFg,
    border:       `1px solid #fecaca`,
    borderRadius: radius.button,
    fontSize:     14,
    fontWeight:   700,
    cursor:       "pointer",
    transition:   transition.fast,
    fontFamily,
  },
  success: {
    padding:      `${space(2.5)} ${space(4)}`,
    background:   color.success,
    color:        color.fgOnDark,
    border:       "none",
    borderRadius: radius.button,
    fontSize:     14,
    fontWeight:   700,
    cursor:       "pointer",
    boxShadow:    `0 1px 2px rgba(22,163,74,0.2)`,
    transition:   transition.fast,
    fontFamily,
  },
  ghost: {
    padding:      `${space(2)} ${space(3)}`,
    background:   "transparent",
    color:        color.fgMuted,
    border:       "none",
    borderRadius: radius.button,
    fontSize:     13,
    fontWeight:   600,
    cursor:       "pointer",
    transition:   transition.fast,
    fontFamily,
  },
};

// ─── Pill — used for status badges ───────────────────────────────────────────
export const pill = (tone = "neutral") => {
  const tones = {
    neutral: { bg: color.accentMutedBg,    fg: color.fgMuted },
    primary: { bg: color.primarySoftBg,    fg: color.primarySoftFg },
    success: { bg: color.successSoftBg,    fg: color.successSoftFg },
    warning: { bg: color.warningSoftBg,    fg: color.warningSoftFg },
    danger:  { bg: color.dangerSoftBg,     fg: color.dangerSoftFg },
    info:    { bg: color.infoSoftBg,       fg: color.infoSoftFg },
    accent:  { bg: color.accentVibrantBg,  fg: color.accentVibrant },
  };
  const t = tones[tone] || tones.neutral;
  return {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          space(1),
    padding:      `${space(0.5)} ${space(2.5)}`,
    borderRadius: radius.pill,
    background:   t.bg,
    color:        t.fg,
    fontSize:     11,
    fontWeight:   700,
    letterSpacing: 0.2,
    whiteSpace:   "nowrap",
  };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const emptyState = {
  textAlign:    "center",
  padding:      `${space(8)} ${space(3)}`,   // 32 12
  color:        color.fgMuted,
  background:   color.surfaceMuted,
  borderRadius: radius.card,
  fontSize:     14,
  fontWeight:   600,
};

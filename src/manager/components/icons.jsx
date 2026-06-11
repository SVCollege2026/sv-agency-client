/**
 * icons.jsx — אייקוני-קו מינימליים לסרגל (נאמנות למוקאפ: אייקונים אפורים
 * עדינים, לא אותיות בעיגולים צבעוניים). stroke=currentColor.
 */
import React from "react";

const PATHS = {
  overview: ["M3 12 L12 4 L21 12", "M5.5 10.5 V20 H18.5 V10.5"],
  folders:  ["M3 8 a2 2 0 0 1 2 -2 h4 l2 2 h8 a2 2 0 0 1 2 2 v8 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 z"],
  flask:    ["M9.5 3 h5", "M10.5 3 v5.5 l-4.7 7.8 A3 3 0 0 0 8.4 21 h7.2 a3 3 0 0 0 2.6 -4.7 L13.5 8.5 V3"],
  spark:    ["M12 3 l2.1 5.2 5.6 .6 -4.2 3.8 1.2 5.5 -4.7 -2.9 -4.7 2.9 1.2 -5.5 -4.2 -3.8 5.6 -.6 z"],
  megaphone:["M3 10.5 v3 a1 1 0 0 0 1 1 h2.2 l2.8 4.5 h2 v-4.5", "M11 15 l9 4 V5 l-9 4 H4 a1 1 0 0 0 -1 1", "M20 9 a3 3 0 0 1 0 6"],
  building: ["M4 21 V6 a1 1 0 0 1 1 -1 h8 a1 1 0 0 1 1 1 v15", "M14 21 h6 V11 h-6", "M7 9 h1", "M10 9 h1", "M7 13 h1", "M10 13 h1", "M7 17 h1", "M10 17 h1", "M17 14 h1", "M17 17 h1", "M2 21 h20"],
  gamepad:  ["M6 9 h12 a4 4 0 0 1 4 4 v2 a3 3 0 0 1 -5.5 1.7 L15 15 H9 l-1.5 1.7 A3 3 0 0 1 2 15 v-2 a4 4 0 0 1 4 -4 z", "M8 11 v3", "M6.5 12.5 h3", "M15.5 12 h.01", "M17.5 13.5 h.01"],
  shield:   ["M12 3 l8 3 v5.5 c0 4.8 -3.4 8 -8 9.5 c-4.6 -1.5 -8 -4.7 -8 -9.5 V6 z"],
  users:    ["M16 21 v-2 a4 4 0 0 0 -4 -4 H7 a4 4 0 0 0 -4 4 v2", "M9.5 11 a4 4 0 1 0 0 -8 a4 4 0 0 0 0 8 z", "M21 21 v-2 a4 4 0 0 0 -3 -3.9", "M16 3.1 a4 4 0 0 1 0 7.8"],
  chart:    ["M4 4 v16 h16", "M8.5 16 V11", "M13 16 V7", "M17.5 16 v-3"],
  plus:     ["M12 5 v14", "M5 12 h14"],
  grid:     ["M4 4 h6.5 v6.5 H4 z", "M13.5 4 H20 v6.5 h-6.5 z", "M4 13.5 h6.5 V20 H4 z", "M13.5 13.5 H20 V20 h-6.5 z"],
  gallery:  ["M4 5 h16 a1 1 0 0 1 1 1 v12 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 V6 a1 1 0 0 1 1 -1 z", "M3 16 l5 -5 4 4 3 -3 6 6", "M9 9.2 h.01"],
  sliders:  ["M5 21 v-7", "M5 10 V3", "M12 21 v-9", "M12 8 V3", "M19 21 v-5", "M19 12 V3", "M2.5 14 h5", "M9.5 8 h5", "M16.5 16 h5"],
  chevron:  ["M8 10 l4 4 4 -4"],
};

/* אייקון לפי קורס קנוני — גלגול עדין של נושא-הקורס, כמו במוקאפ */
const COURSE_ICON = {
  QA:                  "flask",
  AI:                  "spark",
  "שיווק":             "megaphone",
  "AI ARCHITECT":      "building",
  "גיימינג":           "gamepad",
  "סייבר":             "shield",
  "שיווק לבעלי עסקים": "megaphone",
};

export function courseIconName(courseKey) {
  return COURSE_ICON[courseKey] || "folders";
}

export default function Icon({ name, size = 18, style }) {
  const paths = PATHS[name] || PATHS.folders;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
         strokeLinejoin="round" style={style}>
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

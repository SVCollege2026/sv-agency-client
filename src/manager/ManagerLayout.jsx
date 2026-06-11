/**
 * ManagerLayout.jsx — שלד ממשק ניהול המדיה (PHASE-1).
 * חי לצד הממשק הקיים תחת /media (הנתיב הישן /manager מפנה לכאן) — לא מחליף אותו עדיין.
 * RTL מלא + טוקנים + תפריט עליון; badge האישורים מתעדכן מה-overview.
 */
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import TopNav from "./components/TopNav.jsx";
import "./tokens.css";

export default function ManagerLayout() {
  // ה-badge מתעדכן מהדפים דרך ה-outlet context — בלי fetch עצמאי של ה-layout.
  // (ה-fetch הכפול של overview הכפיל את זמן הכניסה ל-/media; הדפים ממילא
  // שולפים את אותם נתונים ומדווחים את המונה.)
  const [pendingCount, setPendingCount] = useState(0);

  return (
    <div className="mi-root" dir="rtl" lang="he">
      <a href="#mi-main" className="mi-meta"
         style={{ position: "absolute", insetInlineStart: -9999 }}
         onFocus={(e) => { e.target.style.insetInlineStart = "8px"; }}
         onBlur={(e) => { e.target.style.insetInlineStart = "-9999px"; }}>
        דלגי לתוכן
      </a>
      <TopNav pendingCount={pendingCount} />
      <main id="mi-main">
        <Outlet context={{ setPendingCount }} />
      </main>
    </div>
  );
}

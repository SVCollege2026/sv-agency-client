/**
 * ManagerLayout.jsx — שלד ממשק ניהול המדיה (PHASE-1).
 * חי לצד הממשק הקיים תחת /media (הנתיב הישן /manager מפנה לכאן) — לא מחליף אותו עדיין.
 * RTL מלא + טוקנים + תפריט עליון; badge האישורים מתעדכן מה-overview.
 */
import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import TopNav from "./components/TopNav.jsx";
import { getOverview } from "./api.js";
import "./tokens.css";

export default function ManagerLayout() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let alive = true;
    getOverview()
      .then((d) => alive && setPendingCount(d?.kpis?.pending_approvals ?? 0))
      .catch(() => {});  // ה-badge הוא קישוט — הדפים עצמם מדווחים כשל במלואו
    return () => { alive = false; };
  }, []);

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

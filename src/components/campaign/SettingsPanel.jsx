/**
 * SettingsPanel.jsx — slimmed orchestrator (manager-facing only).
 *
 * Per manager mandate: "אני לא צריכה להגדיר מיליון דברים בהגדרות של הספים".
 * The over-engineered tabs (RulesTab, BudgetApprovalsTab, PlatformsFormatsTab)
 * have been REMOVED from her view — the agents own those decisions:
 *   • signal thresholds → dynamic_threshold_agent (computes from history)
 *   • budget caps + defaults → media_dept (per campaign, smart)
 *   • per-format char limits + image sizes → platform facts (hardcoded by Meta/Google)
 *
 * What stays — what an actual ad agency CLIENT defines once a year:
 *   ⚙ כללי           — Dry Run, working hours, weekends, holidays, blackouts
 *   ✏ שפת מותג       — voice, forbidden words, disclaimers, CTAs, brand assets
 *   🔔 התראות         — channels + per-event prefs + quiet hours
 *   🛑 סגירת קמפיינים — reason categories, mandatory questions
 *
 * The deleted tab files remain on disk (RulesTab.jsx, BudgetApprovalsTab.jsx,
 * PlatformsFormatsTab.jsx) — not imported anywhere. They can be revived later
 * if needed for an admin/debug view, but they're NOT shown to the manager.
 */
import React, { useState } from "react";
import { color, radius, space, type, transition, fontFamily } from "./_tokens.js";
import GeneralTab          from "./settings/GeneralTab.jsx";
import CopyCreativeTab     from "./settings/CopyCreativeTab.jsx";
import NotificationsTab    from "./settings/NotificationsTab.jsx";
import ClosureTab          from "./settings/ClosureTab.jsx";

const TABS = [
  { id: "general", icon: "⚙",  label: "כללי + מצב בטוח",  component: GeneralTab },
  { id: "brand",   icon: "✏",  label: "שפת מותג + נכסים", component: CopyCreativeTab },
  { id: "notify",  icon: "🔔", label: "התראות",            component: NotificationsTab },
  { id: "closure", icon: "🛑", label: "סגירת קמפיינים",   component: ClosureTab },
];

export default function SettingsPanel() {
  const [tab, setTab] = useState("general");
  const Active = TABS.find(t => t.id === tab)?.component || GeneralTab;

  return (
    <div style={{ direction: "rtl", fontFamily }}>
      <div style={{
        background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: radius.md,
        padding: `${space(3)} ${space(4)}`, marginBottom: space(4),
        ...type.bodySmall, color: "#1e3a8a", lineHeight: 1.6,
      }}>
        💡 <strong>הגדרות פעם בשנה.</strong> כאן רק ערכים שאת קובעת ושלא משתנים יום-יום:
        טון מותג, צבעים, לוגו, מתי לא לפעול. <strong>ספים, חלוקת תקציב, גדלי מודעות, חוקי החלטה
        של מתי-להמליץ-מה</strong> — אלו של הסוכנים החכמים, לא שלך.
      </div>

      <div style={{
        display: "flex", gap: 2, borderBottom: `2px solid ${color.borderDefault}`,
        marginBottom: space(5), overflowX: "auto", scrollbarWidth: "none",
      }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: `${space(2.5)} ${space(4)}`, border: "none", background: "transparent",
              cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? color.primary : color.fgMuted,
              borderBottom: `3px solid ${active ? color.primary : "transparent"}`,
              marginBottom: -2, whiteSpace: "nowrap", fontFamily,
              transition: transition.fast,
            }}>
              <span style={{ marginInlineEnd: space(1.5) }}>{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>

      <Active />
    </div>
  );
}

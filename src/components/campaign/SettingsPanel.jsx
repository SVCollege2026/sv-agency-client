/**
 * SettingsPanel.jsx — orchestrator for the 7 settings sub-tabs.
 *
 * Each tab is a self-contained component under `settings/`:
 *   • GeneralTab          — dry-run, working hours, weekends, holidays, blackouts
 *   • RulesTab            — signal thresholds, context windows, high-risk policies,
 *                           QA dimensions, media_rules CRUD
 *   • BudgetApprovalsTab  — daily caps, defaults by course type, split deviation,
 *                           approval rules per artifact type
 *   • PlatformsFormatsTab — platform on/off + per-format editor (aspect / char limits)
 *   • CopyCreativeTab     — brand voice, forbidden words, disclaimers, CTAs,
 *                           creative visual guidelines
 *   • NotificationsTab    — channels, per-event preferences, quiet hours, severity routing
 *   • ClosureTab          — closure reason categories, mandatory questions, cool-down
 */
import React, { useState } from "react";
import { color, radius, space, type, transition, fontFamily } from "./_tokens.js";
import GeneralTab          from "./settings/GeneralTab.jsx";
import RulesTab            from "./settings/RulesTab.jsx";
import BudgetApprovalsTab  from "./settings/BudgetApprovalsTab.jsx";
import PlatformsFormatsTab from "./settings/PlatformsFormatsTab.jsx";
import CopyCreativeTab     from "./settings/CopyCreativeTab.jsx";
import NotificationsTab    from "./settings/NotificationsTab.jsx";
import ClosureTab          from "./settings/ClosureTab.jsx";

const TABS = [
  { id: "general",   icon: "⚙",  label: "כללי + מצב בטוח",     component: GeneralTab },
  { id: "rules",     icon: "📐", label: "חוקים וספים",           component: RulesTab },
  { id: "budgets",   icon: "💰", label: "תקציב ואישורים",       component: BudgetApprovalsTab },
  { id: "platforms", icon: "📱", label: "פלטפורמות + פורמטים", component: PlatformsFormatsTab },
  { id: "copy",      icon: "✏",  label: "קופי + קריאייטיב",      component: CopyCreativeTab },
  { id: "notify",    icon: "🔔", label: "התראות",                 component: NotificationsTab },
  { id: "closure",   icon: "🛑", label: "סגירת קמפיינים",       component: ClosureTab },
];

export default function SettingsPanel() {
  const [tab, setTab] = useState("general");
  const Active = TABS.find(t => t.id === tab)?.component || GeneralTab;

  return (
    <div style={{ direction: "rtl", fontFamily }}>
      <div style={{
        background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: radius.md,
        padding: `${space(3)} ${space(4)}`, marginBottom: space(4),
        ...type.bodySmall, color: "#1e3a8a",
      }}>
        💡 ההגדרות כאן חלות על <strong>כלל המערכת</strong>. שינוי משפיע על כל הקורסים והסוכנים. כל שינוי מתועד ב-`settings_change_log`.
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

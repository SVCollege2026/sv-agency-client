/**
 * CampaignTab.jsx — orchestrator לטאב "🎯 פעילות שיווקית".
 * Uses design tokens for consistent visual hierarchy.
 */
import React, { useState } from "react";
import FolderBoard from "./FolderBoard.jsx";
import FolderDetail from "./FolderDetail.jsx";
import BriefIntakeForm from "./BriefIntakeForm.jsx";
import SettingsPanel from "./SettingsPanel.jsx";
import SchoolBudgetPanel from "./SchoolBudgetPanel.jsx";
import NotificationBell from "./NotificationBell.jsx";
import BlockersInbox from "./BlockersInbox.jsx";
import ArtifactsApprovalPanel from "./ArtifactsApprovalPanel.jsx";
import MakeHub from "./MakeHub.jsx";
import TransitionTrackerPanel from "./TransitionTrackerPanel.jsx";
import HelpCenter, { useHelpFirstVisit } from "./HelpCenter.jsx";
import { ApprovalGuardBadge } from "./ApprovalGuard.jsx";
import { color, radius, shadow, space, type, transition, fontFamily } from "./_tokens.js";

// MAKE removed from manager view per mandate: "make בממשק לא מעניין בכלל".
// MakeHub.jsx + the back-end code remain intact (admin/QA use).
// Lead routing scenarios are verified by the workflow gate on go-live —
// the manager only sees relevant blockers in "דורש פעולה" if something needs
// her attention, never the operational dashboard.
const SUB_TABS = [
  { id: "board",     label: "לוח קמפיינים",     icon: "🗂", desc: "כל תיקיות הקמפיין לפי סטטוס" },
  { id: "intake",    label: "בריף חדש",         icon: "📝", desc: "שליחת בריף בית-ספרי או לקורס" },
  { id: "approvals", label: "תוצרים לאישור",    icon: "✋", desc: "כל מה שמחלקות הסוכנים הכינו ומחכה לאישור שלך — קופי, קריאייטיב, פריסות מדיה ותקציבים" },
  { id: "tasks",     label: "דורש פעולה",       icon: "✅", desc: "אישורים מהירים, תיקונים והחלטות שמחכות לך" },
  { id: "budget",    label: "תקציב בית-ספרי",   icon: "💰", desc: "תכנית התקציב הכוללת — שנתי + חודשי (אופציונלי)" },
  { id: "transition",label: "Transition מ-Limann", icon: "🔄", desc: "מצב המעבר מסוכנות Limann — חיבורי make.com שצריכים reauth" },
  { id: "settings",  label: "הגדרות מערכת",     icon: "⚙",  desc: "ערכי מותג, התראות, חגים — מה שאת קובעת פעם בשנה" },
];

export default function CampaignTab() {
  const [sub, setSub] = useState("board");
  const [folderId, setFolderId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const help = useHelpFirstVisit();
  const current = SUB_TABS.find(t => t.id === sub) || SUB_TABS[0];

  // Listen for global "open help" event (dispatched from UserAvatar menu)
  React.useEffect(() => {
    const handler = () => help.setOpen(true);
    window.addEventListener("sv:open-help", handler);
    return () => window.removeEventListener("sv:open-help", handler);
  }, [help]);

  // Deep-link to a sub-tab via ?sub=... (used by CommandPalette)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("sub");
    if (wanted && SUB_TABS.some(t => t.id === wanted)) {
      setSub(wanted);
    }
  }, []);

  return (
    <div style={{ direction: "rtl", fontFamily }}>
      {/* Section banner — clean blue gradient, clearly distinct from main tabs */}
      <div style={{
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        border: `1px solid ${color.borderDefault}`,
        borderRadius: radius.lg,
        padding: `${space(4)} ${space(5)}`,
        marginBottom: space(3),
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: space(3),
        boxShadow: shadow.sm,
      }}>
        <div>
          <div style={{ ...type.caption, color: color.fgSubtle, textTransform: "uppercase" }}>
            ניהול קמפיינים · פעילות שיווקית
          </div>
          <h2 style={{ ...type.h2, margin: `${space(1)} 0 0`, display: "flex", alignItems: "center", gap: space(2) }}>
            <span style={{ fontSize: 22 }}>{current.icon}</span>
            {current.label}
          </h2>
          <div style={{ ...type.bodySmall, color: color.fgMuted, marginTop: space(1) }}>{current.desc}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: space(2), flexWrap: "wrap" }}>
          <ApprovalGuardBadge />
          <button onClick={() => help.setOpen(true)} style={{
            background: color.surfaceMuted, border: `1px solid ${color.borderDefault}`,
            borderRadius: radius.pill, padding: `${space(1.5)} ${space(3)}`,
            fontSize: 13, fontWeight: 600, color: color.fgDefault, cursor: "pointer",
            fontFamily, display: "inline-flex", alignItems: "center", gap: space(1),
            transition: transition.fast,
          }}
          onMouseEnter={e => e.currentTarget.style.background = color.surface}
          onMouseLeave={e => e.currentTarget.style.background = color.surfaceMuted}>
            <span>❓</span><span>עזרה</span>
          </button>
          <NotificationBell />
        </div>
      </div>
      <HelpCenter open={help.open} onClose={() => help.setOpen(false)} />

      {/* Sub-tabs — underline style, subordinate to main tabs */}
      <div style={{
        display: "flex", gap: space(1), borderBottom: `2px solid ${color.borderSubtle}`,
        marginBottom: space(4), overflowX: "auto",
      }}>
        {SUB_TABS.map(t => {
          const active = sub === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setSub(t.id); setFolderId(null); }}
              style={{
                padding: `${space(2.5)} ${space(4)}`, border: "none", background: "transparent",
                cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? color.primary : color.fgMuted,
                borderBottom: `3px solid ${active ? color.primary : "transparent"}`,
                marginBottom: -2, whiteSpace: "nowrap", transition: transition.fast,
                fontFamily,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = color.fgDefault; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = color.fgMuted; }}
            >
              <span style={{ marginInlineEnd: space(1.5) }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {sub === "board" && (
        folderId
          ? <FolderDetail folderId={folderId} onBack={() => { setFolderId(null); setRefreshKey(k => k + 1); }} />
          : <FolderBoard onSelectFolder={setFolderId} refreshKey={refreshKey} />
      )}

      {sub === "intake" && (
        <BriefIntakeForm
          onSubmitted={() => { setSub("board"); setRefreshKey(k => k + 1); }}
          onCancel={() => setSub("board")}
        />
      )}

      {sub === "approvals"  && <ArtifactsApprovalPanel />}
      {sub === "tasks"      && <BlockersInbox />}
      {sub === "budget"     && <SchoolBudgetPanel />}
      {sub === "transition" && <TransitionTrackerPanel />}
      {sub === "make"       && <MakeHub />}
      {sub === "settings"   && <SettingsPanel />}
    </div>
  );
}

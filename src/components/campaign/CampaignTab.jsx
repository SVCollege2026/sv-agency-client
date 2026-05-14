/**
 * CampaignTab.jsx — orchestrator לטאב "🎯 פעילות שיווקית".
 * Uses design tokens for consistent visual hierarchy.
 */
import React, { useState, useEffect } from "react";
import FolderBoard from "./FolderBoard.jsx";
import FolderDetail from "./FolderDetail.jsx";
import BriefIntakeForm from "./BriefIntakeForm.jsx";
import SettingsPanel from "./SettingsPanel.jsx";
import NotificationBell from "./NotificationBell.jsx";
import BlockersInbox from "./BlockersInbox.jsx";
import ArtifactsApprovalPanel from "./ArtifactsApprovalPanel.jsx";
import MakeHub from "./MakeHub.jsx";
import HelpCenter, { useHelpFirstVisit } from "./HelpCenter.jsx";
import { ApprovalGuardBadge } from "./ApprovalGuard.jsx";
import { color, radius, shadow, space, type, transition, fontFamily } from "./_tokens.js";

const SUB_TABS = [
  { id: "board",     label: "לוח קמפיינים",     icon: "🗂", desc: "כל תיקיות הקמפיין לפי סטטוס" },
  { id: "intake",    label: "בריף חדש",         icon: "📝", desc: "שליחת בריף בית-ספרי או לקורס" },
  { id: "approvals", label: "תוצרים לאישור",    icon: "✋", desc: "כל מה שמחלקות הסוכנים הכינו ומחכה לאישור שלך" },
  { id: "tasks",     label: "דורש פעולה",       icon: "✅", desc: "אישורים מהירים, תיקונים והחלטות שמחכות לך" },
];

export default function CampaignTab() {
  const [sub, setSub] = useState("board");
  const [folderId, setFolderId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const help = useHelpFirstVisit();
  const current = SUB_TABS.find(t => t.id === sub) || SUB_TABS[0];

  React.useEffect(() => {
    const handler = () => help.setOpen(true);
    window.addEventListener("sv:open-help", handler);
    return () => window.removeEventListener("sv:open-help", handler);
  }, [help]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("sub");
    if (wanted && SUB_TABS.some(t => t.id === wanted)) setSub(wanted);
  }, []);

  return (
    <div style={{ direction: "rtl", fontFamily }}>
      {/* Section banner */}
      <div style={{
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        border: `1px solid ${color.borderDefault}`,
        borderRadius: radius.lg,
        padding: `${space(3)} ${space(5)}`,
        marginBottom: space(3),
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: space(2),
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

          {/* Settings gear — small icon only */}
          <button onClick={() => setSettingsOpen(true)} title="הגדרות" style={{
            background: color.surfaceMuted, border: `1px solid ${color.borderDefault}`,
            borderRadius: radius.pill, padding: `${space(1.5)} ${space(2.5)}`,
            fontSize: 16, cursor: "pointer",
            color: color.fgMuted, fontFamily,
            display: "inline-flex", alignItems: "center",
            transition: transition.fast,
          }}
          onMouseEnter={e => e.currentTarget.style.color = color.fgDefault}
          onMouseLeave={e => e.currentTarget.style.color = color.fgMuted}>
            ⚙
          </button>

          <NotificationBell />
        </div>
      </div>
      <HelpCenter open={help.open} onClose={() => help.setOpen(false)} />

      {/* Sub-tabs */}
      <div style={{
        display: "flex", gap: space(1), borderBottom: `2px solid ${color.borderSubtle}`,
        marginBottom: space(4), overflowX: "auto",
      }}>
        {SUB_TABS.map(t => {
          const active = sub === t.id;
          return (
            <button key={t.id} onClick={() => { setSub(t.id); setFolderId(null); }} style={{
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
      {sub === "intake"    && <BriefIntakeForm onSubmitted={() => { setSub("board"); setRefreshKey(k => k + 1); }} onCancel={() => setSub("board")} />}
      {sub === "approvals" && <ArtifactsApprovalPanel />}
      {sub === "tasks"     && <BlockersInbox />}
      {sub === "make"      && <MakeHub />}

      {/* Settings modal */}
      {settingsOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center",
          padding: space(4),
        }} onClick={() => setSettingsOpen(false)}>
          <div style={{
            background: color.surface, borderRadius: radius.lg,
            boxShadow: shadow.xl, maxWidth: 720, width: "100%",
            maxHeight: "90vh", overflowY: "auto",
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: `${space(4)} ${space(5)} ${space(3)}`,
              borderBottom: `1px solid ${color.borderDefault}`,
            }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, fontFamily }}>⚙ הגדרות</h3>
              <button onClick={() => setSettingsOpen(false)} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 20, color: color.fgMuted, fontFamily, lineHeight: 1,
              }}>×</button>
            </div>
            <div style={{ padding: space(5) }}>
              <SettingsPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

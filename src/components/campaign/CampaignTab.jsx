/**
 * CampaignTab.jsx — orchestrator לטאב "🎯 פעילות שיווקית".
 *
 * Layout:
 *   • Section header (clear: this is the Marketing Activity area of Campaign Management)
 *   • Underline-style sub-tabs (visually subordinate to the 3 main tabs above)
 *   • NotificationBell aligned to the side
 *   • Section content
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

const SUB_TABS = [
  { id: "board",     label: "לוח קמפיינים",     icon: "🗂", desc: "כל תיקיות הקמפיין לפי סטטוס" },
  { id: "intake",    label: "בריף חדש",         icon: "📝", desc: "שליחת בריף בית-ספרי או לקורס" },
  { id: "approvals", label: "תוצרים לאישור",    icon: "✋", desc: "כל מה שמחלקות הסוכנים הכינו ומחכה לאישור שלך — קופי, קריאייטיב, פריסות מדיה ותקציבים" },
  { id: "tasks",     label: "דורש פעולה",       icon: "✅", desc: "אישורים מהירים, תיקונים והחלטות שמחכות לך" },
  { id: "budget",    label: "תקציב בית-ספרי",   icon: "💰", desc: "תכנית התקציב הכוללת" },
  { id: "settings",  label: "הגדרות מערכת",     icon: "⚙",  desc: "חוקי המלצה, ערוצי התראה, פלטפורמות" },
];

export default function CampaignTab() {
  const [sub, setSub] = useState("board");
  const [folderId, setFolderId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const current = SUB_TABS.find(t => t.id === sub) || SUB_TABS[0];

  return (
    <div style={{ direction: "rtl" }}>
      {/* Section banner — clearly distinct from the main tabs above */}
      <div style={{
        background: "linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)",
        border: "1px solid #fde68a",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 14,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 11, color: "#a16207", fontWeight: 700, letterSpacing: 0.5 }}>
            ניהול קמפיינים · פעילות שיווקית
          </div>
          <h2 style={{ margin: "4px 0 0", fontSize: 20, color: "#0f172a" }}>
            🎯 {current.icon} {current.label}
          </h2>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{current.desc}</div>
        </div>
        <NotificationBell />
      </div>

      {/* Sub-tabs — underline style (clearly subordinate) */}
      <div style={{
        display: "flex", gap: 4, borderBottom: "2px solid #e2e8f0",
        marginBottom: 18, overflowX: "auto",
      }}>
        {SUB_TABS.map(t => {
          const active = sub === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setSub(t.id); setFolderId(null); }}
              style={{
                padding: "10px 16px", border: "none", background: "transparent",
                cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? "#1e3a5f" : "#64748b",
                borderBottom: `3px solid ${active ? "#1e3a5f" : "transparent"}`,
                marginBottom: -2,
                whiteSpace: "nowrap", transition: "all 0.15s",
              }}
            >
              <span style={{ marginInlineEnd: 6 }}>{t.icon}</span>
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

      {sub === "approvals" && <ArtifactsApprovalPanel />}
      {sub === "tasks"     && <BlockersInbox />}
      {sub === "budget"    && <SchoolBudgetPanel />}
      {sub === "settings"  && <SettingsPanel />}
    </div>
  );
}

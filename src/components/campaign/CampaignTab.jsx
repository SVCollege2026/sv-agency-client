/**
 * CampaignTab.jsx — orchestrator לטאב "🎯 פעילות שיווקית".
 * Sub-tabs: לוח קמפיינים / בריף חדש / הגדרות / חסמים פתוחים.
 */
import React, { useState } from "react";
import FolderBoard from "./FolderBoard.jsx";
import FolderDetail from "./FolderDetail.jsx";
import BriefIntakeForm from "./BriefIntakeForm.jsx";
import SettingsPanel from "./SettingsPanel.jsx";
import SchoolBudgetPanel from "./SchoolBudgetPanel.jsx";
import NotificationBell from "./NotificationBell.jsx";
import BlockersInbox from "./BlockersInbox.jsx";

const SUB_TABS = [
  { id: "board",     label: "🗂 לוח קמפיינים" },
  { id: "intake",    label: "📝 בריף חדש" },
  { id: "blockers",  label: "⛔ חסמים פתוחים" },
  { id: "budget",    label: "💰 תקציב בית-ספרי" },
  { id: "settings",  label: "⚙ הגדרות" },
];

export default function CampaignTab() {
  const [sub, setSub] = useState("board");
  const [folderId, setFolderId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div style={{ direction: "rtl" }}>
      {/* Sub-tabs + bell */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 16, flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SUB_TABS.map(t => (
            <button key={t.id} onClick={() => { setSub(t.id); setFolderId(null); }} style={{
              padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700,
              background: sub === t.id ? "#1e3a5f" : "#fff",
              color:      sub === t.id ? "#fff" : "#475569",
              border: `1px solid ${sub === t.id ? "#1e3a5f" : "#cbd5e1"}`,
            }}>{t.label}</button>
          ))}
        </div>
        <NotificationBell />
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

      {sub === "blockers" && <BlockersInbox />}

      {sub === "budget"   && <SchoolBudgetPanel />}

      {sub === "settings" && <SettingsPanel />}
    </div>
  );
}

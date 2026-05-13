/**
 * RecommendationsBadge — shows 💡 N (pending) and 🔄 M (in-production).
 * Click opens RecommendationsDrawer.
 */
import React, { useState } from "react";
import { fontFamily } from "./_tokens.js";
import RecommendationsDrawer from "./RecommendationsDrawer.jsx";

export default function RecommendationsBadge({ recommendations, folder, platform, onRefresh }) {
  const [open, setOpen] = useState(false);

  const filtered = recommendations.filter(r => {
    if (folder && r.folder_id !== folder.id) return false;
    if (platform && r.platform !== platform) return false;
    return true;
  });

  const pending = filtered.filter(r => r.decision_status === "pending" && r.requires_approval);
  const inProd  = filtered.filter(r => r.decision_status === "approved");

  if (pending.length === 0 && inProd.length === 0) {
    return <span style={{ color: "#9ca3af", fontSize: 13, fontFamily }}>—</span>;
  }

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 0",
        }}
      >
        {pending.length > 0 && (
          <span style={{
            background: "#dbeafe", color: "#1d4ed8",
            borderRadius: 999, padding: "3px 10px",
            fontSize: 12, fontWeight: 700, fontFamily,
            display: "inline-flex", alignItems: "center", gap: 3,
          }}>💡 {pending.length}</span>
        )}
        {inProd.length > 0 && (
          <span style={{
            background: "#fef3c7", color: "#92400e",
            borderRadius: 999, padding: "3px 10px",
            fontSize: 12, fontWeight: 700, fontFamily,
            display: "inline-flex", alignItems: "center", gap: 3,
          }}>🔄 {inProd.length}</span>
        )}
      </button>

      {open && (
        <RecommendationsDrawer
          recommendations={filtered}
          folder={folder}
          platform={platform}
          onClose={() => setOpen(false)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}

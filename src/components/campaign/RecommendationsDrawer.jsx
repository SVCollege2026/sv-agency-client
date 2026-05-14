/**
 * RecommendationsDrawer — slide-in drawer (440px, right side).
 * Tabs: ממתינות / בייצור / הושלמו / נדחו / הסטוריה
 */
import React, { useState } from "react";
import { color, radius, shadow, space, fontFamily, transition } from "./_tokens.js";
import RecommendationCard from "./RecommendationCard.jsx";

const TABS = [
  { id: "pending",    label: "💡 ממתינות" },
  { id: "approved",   label: "🔄 בייצור" },
  { id: "completed",  label: "✓ הושלמו" },
  { id: "rejected",   label: "✗ נדחו" },
  { id: "all",        label: "🕐 הסטוריה" },
];

export default function RecommendationsDrawer({ recommendations, folders = [], folder, platform, onClose, onRefresh }) {
  const [tab, setTab] = useState("pending");

  // Build folder lookup for global mode
  const folderMap = Object.fromEntries((folders || []).map(f => [f.id, f.course_name || f.id]));

  const filtered = (() => {
    switch (tab) {
      case "pending":   return recommendations.filter(r => r.decision_status === "pending"  && r.requires_approval);
      case "approved":  return recommendations.filter(r => r.decision_status === "approved");
      case "completed": return recommendations.filter(r => r.decision_status === "completed");
      case "rejected":  return recommendations.filter(r => r.decision_status === "rejected");
      case "all":       return recommendations;
      default:          return recommendations;
    }
  })();

  const isGlobal = !folder;
  const title = folder
    ? `המלצות — ${folder.course_name || folder.id}`
    : "💡 כל ההמלצות";

  const subtitle = platform ? `ערוץ: ${platform}` : isGlobal ? `${filtered.length} ממתינות לאישורך` : null;

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 9997,
      }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 440,
        background: color.surface, boxShadow: shadow.xl, zIndex: 9998,
        display: "flex", flexDirection: "column", direction: "rtl",
      }}>
        {/* Header */}
        <div style={{
          padding: `${space(4)} ${space(5)}`,
          borderBottom: `1px solid ${color.borderDefault}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: color.fgDefault, fontFamily }}>{title}</div>
              {subtitle && <div style={{ fontSize: 12, color: color.fgSubtle, fontFamily, marginTop: 2 }}>{subtitle}</div>}
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 20, color: color.fgMuted, padding: 4 }}>×</button>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: space(0.5), marginTop: space(3), flexWrap: "wrap" }}>
            {TABS.map(t => {
              const count = (() => {
                if (t.id === "pending")   return recommendations.filter(r => r.decision_status === "pending" && r.requires_approval).length;
                if (t.id === "approved")  return recommendations.filter(r => r.decision_status === "approved").length;
                if (t.id === "completed") return recommendations.filter(r => r.decision_status === "completed").length;
                if (t.id === "rejected")  return recommendations.filter(r => r.decision_status === "rejected").length;
                return recommendations.length;
              })();
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding: `${space(1.5)} ${space(2.5)}`,
                  background: active ? color.primarySoftBg : "transparent",
                  border: "none", borderRadius: radius.sm,
                  fontSize: 12, fontWeight: active ? 700 : 500,
                  color: active ? color.primary : color.fgMuted,
                  cursor: "pointer", fontFamily,
                  transition: transition.fast,
                }}>
                  {t.label}{count > 0 && ` (${count})`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: space(4) }}>
          {filtered.length === 0 ? (
            <div style={{
              textAlign: "center", paddingTop: space(10),
              fontSize: 14, color: color.fgSubtle, fontFamily,
            }}>
              {tab === "pending" ? "אין המלצות שממתינות לאישורך כרגע 🎉" : "אין פריטים בקטגוריה זו"}
            </div>
          ) : (
            filtered.map(rec => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                folderName={isGlobal ? (folderMap[rec.folder_id] || null) : null}
                onDecided={onRefresh}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

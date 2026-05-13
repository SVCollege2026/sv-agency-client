/**
 * FolderBoard.jsx — Monday-style campaign board.
 *
 * Marketing manager is a DIRECTOR, not a rubber stamp.
 * 4 interaction modes:
 *  1. Artifact approval (ApprovalDropdown per cell)
 *  2. Manager-initiated change requests (ActionMenu → mini forms)
 *  3. Dept recommendation cycle (RecommendationsBadge → RecommendationsDrawer → approve/reject/modify)
 *  4. Account manager Q&A (AccountManagerChat — floating drawer)
 *
 * Top-row columns (plan §A.1):
 *   ▾ | שם | סטטוס | תאריך עלייה | תקציב | קהל יעד | מדיות חשובות |
 *   מה לספר | מה עובד | פריסת מדיה | תקציב מומלץ | 💡 המלצות |
 *   מה קורה עכשיו | + פעולה
 *
 * Subitems (plan §A.2): open only after media_plan approved.
 *   ערוץ | תקציב | מחקר ביטויי | קופי | קריאייטיב | מודעות | 💡 | + פעולה
 *
 * Design tokens: _tokens.js. Status pill colors: monday.* (Monday-exact).
 * No internal jargon. No navigation arrows to sub-pages.
 */
import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import {
  listCampaignFolders, createCampaignFolder, updateCampaignFolder,
  listArtifacts, listBudgetAllocations,
  listRecommendations, listWorkflowBlockers,
  listFolderBriefs,
  approveArtifact, requestArtifactRevision,
  submitChangeRequest,
} from "../../api.js";
import {
  color, radius, shadow, space, type, transition, button,
  input as inputStyle, fontFamily, monday,
} from "./_tokens.js";
import { useToast } from "./Toast.jsx";
import { SkeletonBoard } from "./Skeleton.jsx";
import ApprovalDropdown from "./ApprovalDropdown.jsx";
import ArtifactPayloadModal from "./ArtifactPayloadModal.jsx";
import ActionMenu from "./ActionMenu.jsx";
import ActivityIndicator from "./ActivityIndicator.jsx";
import LongTextCell from "./LongTextCell.jsx";
import RecommendationsBadge from "./RecommendationsBadge.jsx";
import AccountManagerChat from "./AccountManagerChat.jsx";
import ColumnVisibilityMenu from "./ColumnVisibilityMenu.jsx";
import { useColumnPrefs } from "./useColumnPrefs.js";

// ─── Status palette ──────────────────────────────────────────────────────────
const STATUS_DEFS = {
  draft:           { label: "טיוטה",       bg: monday.grey,   fg: monday.ink },
  in_progress:     { label: "בעבודה",      bg: monday.orange, fg: monday.white },
  ready_to_launch: { label: "מוכן לעלייה", bg: monday.purple, fg: monday.white },
  live:            { label: "באוויר",      bg: monday.green,  fg: monday.white },
  closing:         { label: "בסגירה",      bg: monday.orange, fg: monday.white },
  closed:          { label: "סגור",        bg: monday.red,    fg: monday.white },
};
const ALL_STATUSES = Object.keys(STATUS_DEFS);

// ─── Groups ──────────────────────────────────────────────────────────────────
const GROUPS = [
  { id: "planned",   label: "קמפיינים מתוכננים לעלייה", statuses: ["draft", "in_progress", "ready_to_launch"], strip: monday.blue },
  { id: "live",      label: "קמפיינים באוויר",          statuses: ["live"],                                    strip: monday.green },
  { id: "completed", label: "קמפיינים שהסתיימו",        statuses: ["closing", "closed"],                       strip: monday.red },
];

// ─── Platform display map ────────────────────────────────────────────────────
const PLATFORM_DISPLAY = {
  meta:           { icon: "📘", label: "Meta" },
  facebook:       { icon: "📘", label: "Facebook" },
  instagram:      { icon: "📷", label: "Instagram" },
  google:         { icon: "🔎", label: "Google" },
  google_search:  { icon: "🔎", label: "Google Search" },
  google_pmax:    { icon: "⚡", label: "Google PMax" },
  google_display: { icon: "🖼",  label: "Google Display" },
  youtube:        { icon: "▶",  label: "YouTube" },
  tiktok:         { icon: "🎵", label: "TikTok" },
  linkedin:       { icon: "💼", label: "LinkedIn" },
  twitter:        { icon: "🐦", label: "X/Twitter" },
  taboola:        { icon: "📰", label: "Taboola" },
  outbrain:       { icon: "📰", label: "Outbrain" },
};
function platformDisplayFor(id) {
  if (!id) return { icon: "📡", label: "?" };
  const known = PLATFORM_DISPLAY[String(id).toLowerCase()];
  if (known) return known;
  const label = String(id).split("_").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
  return { icon: "📡", label };
}
function platformUsesKeywords(id) {
  return String(id || "").toLowerCase().startsWith("google");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "2-digit" }); }
  catch { return iso; }
}
function fmtMoney(num) {
  if (num == null || num === 0 || num === "") return "";
  const n = Number(num);
  if (isNaN(n)) return "";
  if (n >= 1_000_000) return `₪${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000)      return `₪${Math.round(n / 1000)}K`;
  return `₪${n.toLocaleString("he-IL")}`;
}

// ─── Artifact helpers ────────────────────────────────────────────────────────
function currentArtifactOfType(artifacts, folderId, artifactType, platformFilter = null) {
  const matching = artifacts.filter(a => {
    if (a.folder_id !== folderId) return false;
    if (a.artifact_type !== artifactType) return false;
    if (a.is_current_version === false) return false;
    if (platformFilter) {
      const meta = a.metadata || {};
      const payload = a.payload || {};
      const p = (meta.platform || payload.platform || "").toLowerCase();
      if (p && p !== platformFilter) return false;
    }
    return true;
  });
  return matching.sort((a, b) => (b.version_number || 1) - (a.version_number || 1))[0] || null;
}

function budgetForPlatform(artifacts, folderId, platform) {
  const plan = currentArtifactOfType(artifacts, folderId, "media_plan");
  const rec  = currentArtifactOfType(artifacts, folderId, "budget_recommendation");
  const breakdown1 = ((plan?.payload || {}).platform_breakdown) || {};
  if (breakdown1[platform]?.budget) return Number(breakdown1[platform].budget);
  const budgets = ((plan?.payload || {}).budgets) || {};
  if (budgets[platform]) return Number(budgets[platform]);
  const breakdown2 = ((rec?.payload || {}).breakdown) || {};
  if (breakdown2[platform]) return Number(breakdown2[platform]);
  return null;
}

function approvedMediaPlanFor(artifacts, folderId) {
  const matching = artifacts.filter(a =>
    a.folder_id === folderId
    && a.artifact_type === "media_plan"
    && a.is_current_version !== false
    && a.status === "approved"
  );
  return matching.sort((a, b) => (b.version_number || 1) - (a.version_number || 1))[0] || null;
}

function channelsFromApprovedPlan(plan) {
  if (!plan) return [];
  const list = (plan.payload || {}).platforms || [];
  return list.map(p => typeof p === "string" ? p : (p?.id || p?.platform || null)).filter(Boolean);
}

// Brief-derived fallback for metadata fields
function briefField(briefs, key) {
  if (!briefs?.length) return null;
  const latest = briefs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
  if (!latest) return null;
  const payload = latest.brief_payload || latest.payload || {};
  return payload[key] || null;
}

// ─── Column defaults ──────────────────────────────────────────────────────────
const TOP_COL_DEFS = [
  { id: "chev",        label: "",              defaultW: 32 },
  { id: "name",        label: "שם הקמפיין",    defaultW: 220 },
  { id: "status",      label: "סטטוס",         defaultW: 140 },
  { id: "due",         label: "תאריך עלייה",   defaultW: 120 },
  { id: "budget",      label: "תקציב כולל",    defaultW: 110 },
  { id: "audience",    label: "קהל יעד",        defaultW: 160 },
  { id: "media",       label: "מדיות חשובות",  defaultW: 150 },
  { id: "field_notes", label: "מה לספר",        defaultW: 170 },
  { id: "what_works",  label: "מה עובד/לא",    defaultW: 150 },
  { id: "media_plan",  label: "פריסת מדיה",    defaultW: 130 },
  { id: "budget_rec",  label: "תקציב מומלץ",   defaultW: 130 },
  { id: "recs",        label: "💡 המלצות",      defaultW: 120 },
  { id: "activity",    label: "מה קורה עכשיו", defaultW: 150 },
  { id: "action",      label: "",              defaultW: 80 },
];

const SUB_COL_DEFS = [
  { id: "spc",      label: "",              defaultW: 32 },
  { id: "channel",  label: "ערוץ",          defaultW: 160 },
  { id: "budget",   label: "תקציב מוקצה",  defaultW: 120 },
  { id: "kw",       label: "מחקר ביטויי",  defaultW: 140 },
  { id: "copy",     label: "קופי",          defaultW: 140 },
  { id: "creative", label: "קריאייטיב",    defaultW: 140 },
  { id: "ads",      label: "מודעות",        defaultW: 90 },
  { id: "recs",     label: "💡",            defaultW: 90 },
  { id: "action",   label: "",              defaultW: 80 },
];

const DEFAULT_TOP_WIDTHS = Object.fromEntries(TOP_COL_DEFS.map(c => [c.id, c.defaultW]));
const DEFAULT_HIDDEN     = {};

// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════
export default function FolderBoard({ refreshKey = 0 }) {
  const toast = useToast();
  const [folders, setFolders]         = useState([]);
  const [artifacts, setArtifacts]     = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [recommendations, setRecs]    = useState([]);
  const [blockers, setBlockers]       = useState([]);
  const [workflowItems, setWorkflowItems] = useState([]);
  const [briefsByFolder, setBriefsByFolder] = useState({});
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [query, setQuery]             = useState("");
  const [collapsed, setCollapsed]     = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [addingTo, setAddingTo]       = useState(null);
  const [addingName, setAddingName]   = useState("");
  const [payloadModal, setPayloadModal] = useState(null); // artifact to show

  const { prefs, setWidth, toggleHidden } = useColumnPrefs({ widths: DEFAULT_TOP_WIDTHS, hidden: DEFAULT_HIDDEN });

  async function refresh() {
    setLoading(true); setError(null);
    try {
      const [f, a, b, r, bl] = await Promise.all([
        listCampaignFolders(),
        listArtifacts({ limit: 500 }).catch(() => []),
        listBudgetAllocations().catch(() => []),
        listRecommendations({ limit: 300 }).catch(() => []),
        listWorkflowBlockers({ onlyOpen: true }).catch(() => []),
      ]);
      setFolders(Array.isArray(f) ? f : []);
      setArtifacts(Array.isArray(a) ? a : []);
      setAllocations(Array.isArray(b) ? b : []);
      setRecs(Array.isArray(r) ? r : []);
      setBlockers(Array.isArray(bl) ? bl : []);
      // workflow items — not critical, ignore errors
      setWorkflowItems([]);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [refreshKey]);

  async function ensureBriefs(folderId) {
    if (briefsByFolder[folderId]) return;
    try {
      const list = await listFolderBriefs(folderId);
      setBriefsByFolder(prev => ({ ...prev, [folderId]: Array.isArray(list) ? list : [] }));
    } catch { /* ignore */ }
  }

  async function patchFolder(folder, patch) {
    try {
      const body = { ...patch };
      if (patch.metadata) body.metadata = { ...(folder.metadata || {}), ...patch.metadata };
      await updateCampaignFolder(folder.id, body);
      setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, ...body } : f));
    } catch (e) {
      toast.error(`שגיאה בשמירה: ${e.message}`);
      await refresh();
    }
  }

  async function commitNewCampaign() {
    const name = addingName.trim();
    if (!name) { setAddingTo(null); setAddingName(""); return; }
    try {
      const folder = await createCampaignFolder({ course_name: name, created_by: "marketing_manager" });
      toast.success(`✓ ${folder.course_name}`);
      setAddingName("");
      await refresh();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
  }

  function toggleGroup(id)  { setCollapsed(c => ({ ...c, [id]: !c[id] })); }
  function toggleRow(id)    { setExpandedRows(r => ({ ...r, [id]: !r[id] })); }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? folders.filter(f =>
        (f.course_name || "").toLowerCase().includes(q) ||
        (f.activity_label || "").toLowerCase().includes(q))
    : folders;
  const groupedFolders = GROUPS.map(g => ({
    ...g, folders: filtered.filter(f => g.statuses.includes(f.status)),
  }));

  // Total pending recommendations count (for global badge)
  const totalPending = recommendations.filter(r => r.decision_status === "pending" && r.requires_approval).length;

  // Visible top columns
  const visibleTopCols = TOP_COL_DEFS.filter(c => !prefs.hidden[c.id]);
  const topColsTemplate = visibleTopCols.map(c => {
    if (c.id === "chev" || c.id === "action") return `${prefs.widths[c.id] || c.defaultW}px`;
    if (c.id === "name") return `${prefs.widths[c.id] || c.defaultW}px`;
    return `${prefs.widths[c.id] || c.defaultW}px`;
  }).join(" ");

  return (
    <div style={{ direction: "rtl", fontFamily, width: "100%" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: space(3), flexWrap: "wrap", gap: space(2),
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: space(3) }}>
          <h3 style={{ ...type.h2, margin: 0, fontSize: 20 }}>📋 לוח קמפיינים</h3>
          <span style={{ ...type.bodySmall, color: color.fgSubtle }}>
            {q ? `${filtered.length} / ${folders.length}` : `${folders.length} קמפיינים`}
          </span>
        </div>
        <div style={{ display: "flex", gap: space(2), alignItems: "center", flexWrap: "wrap" }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
                 placeholder="🔍 חיפוש..."
                 style={{ ...inputStyle, fontSize: 14, minWidth: 200, padding: "8px 12px" }} />
          <ColumnVisibilityMenu
            columns={TOP_COL_DEFS.filter(c => c.id !== "chev" && c.id !== "action")}
            hidden={prefs.hidden}
            onToggle={toggleHidden}
          />
          {totalPending > 0 && (
            <span style={{
              background: "#dbeafe", color: "#1d4ed8",
              borderRadius: 999, padding: "5px 14px",
              fontSize: 13, fontWeight: 700, fontFamily,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>💡 {totalPending} המלצות</span>
          )}
          <button onClick={() => { setAddingTo("planned"); setAddingName(""); }} style={{
            ...button.primary, fontSize: 13, padding: "8px 16px",
          }}>➕ קמפיין חדש</button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: space(3), background: color.dangerSoftBg, color: color.dangerSoftFg,
          borderRadius: radius.md, marginBottom: space(3), fontSize: 14,
        }}>שגיאה: {error}</div>
      )}

      {loading && <SkeletonBoard />}

      {!loading && folders.length === 0 && (
        <EmptyState onAdd={() => { setAddingTo("planned"); setAddingName(""); }} />
      )}

      {!loading && (
        <div style={{
          background: color.surface, borderRadius: radius.lg,
          border: `1px solid ${color.borderDefault}`, boxShadow: shadow.sm,
          overflow: "auto", width: "100%",
        }}>
          {groupedFolders.map(group => (
            <Group key={group.id}
                   group={group}
                   collapsed={!!collapsed[group.id]}
                   onToggle={() => toggleGroup(group.id)}
                   expandedRows={expandedRows}
                   onToggleRow={id => { toggleRow(id); ensureBriefs(id); }}
                   artifacts={artifacts}
                   allocations={allocations}
                   recommendations={recommendations}
                   blockers={blockers}
                   workflowItems={workflowItems}
                   briefsByFolder={briefsByFolder}
                   onPatchFolder={(folder, patch) => patchFolder(folder, patch)}
                   onOpenPayload={setPayloadModal}
                   onRefresh={refresh}
                   addingHere={addingTo === group.id}
                   addingName={addingName}
                   onStartAdd={() => { setAddingTo(group.id); setAddingName(""); }}
                   onAddNameChange={setAddingName}
                   onCommitAdd={commitNewCampaign}
                   onCancelAdd={() => { setAddingTo(null); setAddingName(""); }}
                   visibleCols={visibleTopCols}
                   colWidths={prefs.widths}
                   onResizeCol={setWidth}
            />
          ))}
        </div>
      )}

      {/* Artifact payload modal */}
      {payloadModal && (
        <ArtifactPayloadModal artifact={payloadModal} onClose={() => setPayloadModal(null)} />
      )}

      {/* Floating account-manager chat */}
      <AccountManagerChat />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Empty state
// ═══════════════════════════════════════════════════════════════════════════
function EmptyState({ onAdd }) {
  return (
    <div style={{
      textAlign: "center", padding: space(12),
      background: color.surface, borderRadius: radius.lg,
      border: `1px solid ${color.borderDefault}`,
    }}>
      <div style={{ fontSize: 64, marginBottom: space(3) }}>🌱</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color.fgDefault, marginBottom: space(2) }}>אין עדיין קמפיינים</div>
      <div style={{ fontSize: 14, color: color.fgSubtle, marginBottom: space(4) }}>צרי את הקמפיין הראשון שלך כדי להתחיל</div>
      <button onClick={onAdd} style={{ ...button.primary, fontSize: 14 }}>➕ צרי קמפיין ראשון</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Group
// ═══════════════════════════════════════════════════════════════════════════
function Group({
  group, collapsed, onToggle,
  expandedRows, onToggleRow,
  artifacts, allocations, recommendations, blockers, workflowItems,
  briefsByFolder, onPatchFolder, onOpenPayload, onRefresh,
  addingHere, addingName, onStartAdd, onAddNameChange, onCommitAdd, onCancelAdd,
  visibleCols, colWidths, onResizeCol,
}) {
  const templateCols = visibleCols.map(c => `${colWidths[c.id] || c.defaultW}px`).join(" ");

  return (
    <div style={{ borderBottom: `1px solid ${color.borderDefault}` }}>
      {/* Group header strip */}
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: space(2),
        padding: `${space(2.5)} ${space(3)}`,
        cursor: "pointer", background: color.surface, userSelect: "none",
        borderInlineStart: `4px solid ${group.strip}`,
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
      onMouseLeave={e => e.currentTarget.style.background = color.surface}>
        <span style={{
          display: "inline-block",
          transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
          transition: "transform 120ms",
          color: color.fgMuted, fontSize: 14, width: 14,
        }}>▾</span>
        <span style={{ color: group.strip, fontSize: 15, fontWeight: 700, fontFamily }}>{group.label}</span>
        <span style={{
          background: color.surfaceMuted, color: color.fgMuted,
          padding: "2px 10px", borderRadius: 999,
          fontSize: 12, fontWeight: 700, fontFamily,
        }}>{group.folders?.length ?? 0}</span>
      </div>

      {!collapsed && (
        <>
          {/* Column headers with drag-resize */}
          <div style={{ display: "grid", gridTemplateColumns: templateCols, background: "#f8fafc", borderBottom: `1px solid ${color.borderSubtle}` }}>
            {visibleCols.map(col => (
              <ColHeader key={col.id} col={col} width={colWidths[col.id] || col.defaultW} onResize={onResizeCol} />
            ))}
          </div>

          {group.folders?.length === 0 && !addingHere && (
            <div style={{ padding: space(4), textAlign: "center", color: color.fgSubtle, fontSize: 14, fontFamily }}>
              {group.id === "planned" ? "אין קמפיינים בתכנון. הוסיפי חדש למטה."
               : group.id === "live" ? "אין קמפיינים פעילים."
               : "אין קמפיינים שהסתיימו עדיין."}
            </div>
          )}

          {(group.folders || []).map(f => (
            <React.Fragment key={f.id}>
              <Row
                folder={f}
                group={group}
                isExpanded={!!expandedRows[f.id]}
                onToggle={() => onToggleRow(f.id)}
                artifacts={artifacts}
                recommendations={recommendations}
                blockers={blockers}
                workflowItems={workflowItems}
                briefs={briefsByFolder[f.id] || []}
                allocations={allocations}
                onPatch={patch => onPatchFolder(f, patch)}
                onOpenPayload={onOpenPayload}
                onRefresh={onRefresh}
                visibleCols={visibleCols}
                colWidths={colWidths}
              />
              {expandedRows[f.id] && (
                <SubitemsBlock
                  folder={f}
                  artifacts={artifacts}
                  recommendations={recommendations}
                  group={group}
                  onOpenPayload={onOpenPayload}
                  onRefresh={onRefresh}
                />
              )}
            </React.Fragment>
          ))}

          {group.id === "planned" && (
            <InlineAddRow
              addingHere={addingHere}
              addingName={addingName}
              onStartAdd={onStartAdd}
              onAddNameChange={onAddNameChange}
              onCommitAdd={onCommitAdd}
              onCancelAdd={onCancelAdd}
              colCount={visibleCols.length}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Column header with drag-resize ─────────────────────────────────────────
function ColHeader({ col, width, onResize }) {
  const startX = useRef(null);
  const startW = useRef(null);

  function onMouseDown(e) {
    e.preventDefault();
    startX.current = e.clientX;
    startW.current = width;
    function onMove(ev) {
      const delta = startX.current - ev.clientX; // RTL: drag left = wider
      const newW = Math.max(60, startW.current + delta);
      onResize(col.id, newW);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <div style={{
      padding: `${space(2)} ${space(2.5)}`,
      fontSize: 12, fontWeight: 700, color: color.fgMuted,
      letterSpacing: 0.3, textTransform: "uppercase",
      borderInlineEnd: `1px solid ${color.borderSubtle}`,
      fontFamily, position: "relative", userSelect: "none",
      textAlign: col.id === "name" ? "right" : "center",
      overflow: "hidden", whiteSpace: "nowrap",
    }}>
      {col.label}
      {col.id !== "chev" && col.id !== "action" && (
        <div onMouseDown={onMouseDown} style={{
          position: "absolute", top: 0, left: 0, bottom: 0,
          width: 4, cursor: "col-resize",
          background: "transparent",
        }}
        onMouseEnter={e => e.currentTarget.style.background = color.primary}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Top Row
// ═══════════════════════════════════════════════════════════════════════════
function Row({
  folder, group, isExpanded, onToggle,
  artifacts, recommendations, blockers, workflowItems, briefs, allocations,
  onPatch, onOpenPayload, onRefresh, visibleCols, colWidths,
}) {
  const templateCols = visibleCols.map(c => `${colWidths[c.id] || c.defaultW}px`).join(" ");

  // Derived values
  const totalBudget = (() => {
    if (folder.metadata?.budget_ils) return Number(folder.metadata.budget_ils);
    const sum = allocations.filter(a => a.folder_id === folder.id)
      .reduce((s, a) => s + Number(a.amount_ils || a.amount || 0), 0);
    return sum > 0 ? sum : null;
  })();

  const myBlockers = blockers.filter(b => {
    const meta = b.metadata || {};
    return (b.folder_id === folder.id || meta.folder_id === folder.id)
      && (b.owner_role === "marketing_manager" || !b.owner_role);
  }).length;

  // Metadata fields with brief fallback
  const meta = folder.metadata || {};
  const audience    = meta.audience    ?? briefField(briefs, "audience");
  const impMedia    = meta.important_media ?? briefField(briefs, "important_media");
  const fieldNotes  = meta.field_notes  ?? briefField(briefs, "message") ?? briefField(briefs, "syllabi_text");
  const whatWorks   = meta.what_works   ?? briefField(briefs, "notes");

  // Artifacts
  const mediaPlanArtifact = currentArtifactOfType(artifacts, folder.id, "media_plan");
  const budgetRecArtifact  = currentArtifactOfType(artifacts, folder.id, "budget_recommendation");

  // Name row: show blocker warning inline
  const hasBlocker = myBlockers > 0;

  function renderCell(col) {
    switch (col.id) {
      case "chev":
        return (
          <button onClick={e => { e.stopPropagation(); onToggle(); }}
                  title={isExpanded ? "הסתר ערוצים" : "הצג ערוצים"}
                  style={{
                    background: "transparent", border: "none", cursor: "pointer",
                    color: color.fgMuted, fontSize: 14, padding: 4,
                    transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 120ms",
                  }}>▾</button>
        );
      case "name":
        return (
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <InlineText value={folder.course_name} placeholder="שם הקמפיין"
                          fontSize={14} fontWeight={600}
                          onSave={v => onPatch({ course_name: v })} />
              {hasBlocker && (
                <span title={`${myBlockers} חוסמים פתוחים`} style={{ fontSize: 13, cursor: "default" }}>⚠</span>
              )}
            </div>
            {folder.activity_label && (
              <div style={{ fontSize: 12, color: color.fgSubtle, marginTop: 1, fontFamily }}>{folder.activity_label}</div>
            )}
          </div>
        );
      case "status":
        return <StatusPicker value={folder.status} onChange={s => onPatch({ status: s })} />;
      case "due":
        return <InlineDate value={folder.planned_go_live_date} onSave={v => onPatch({ planned_go_live_date: v })} />;
      case "budget":
        return <InlineNumber value={totalBudget} formatter={fmtMoney}
                             onSave={v => onPatch({ metadata: { budget_ils: v == null ? null : Number(v) } })} />;
      case "audience":
        return <LongTextCell value={audience} placeholder="—" fieldLabel="קהל יעד"
                             onSave={v => onPatch({ metadata: { audience: v } })} />;
      case "media":
        return <LongTextCell value={impMedia} placeholder="—" fieldLabel="מדיות חשובות"
                             onSave={v => onPatch({ metadata: { important_media: v } })} />;
      case "field_notes":
        return <LongTextCell value={fieldNotes} placeholder="—" fieldLabel="מה לספר על התחום"
                             onSave={v => onPatch({ metadata: { field_notes: v } })} />;
      case "what_works":
        return <LongTextCell value={whatWorks} placeholder="—" fieldLabel="מה עובד / לא עובד"
                             onSave={v => onPatch({ metadata: { what_works: v } })} />;
      case "media_plan":
        return (
          <ApprovalDropdown
            artifact={mediaPlanArtifact}
            onApproved={onRefresh}
            onRevised={onRefresh}
            onOpenPayload={() => mediaPlanArtifact && onOpenPayload(mediaPlanArtifact)}
          />
        );
      case "budget_rec":
        return (
          <ApprovalDropdown
            artifact={budgetRecArtifact}
            onApproved={onRefresh}
            onRevised={onRefresh}
            onOpenPayload={() => budgetRecArtifact && onOpenPayload(budgetRecArtifact)}
          />
        );
      case "recs":
        return (
          <RecommendationsBadge
            recommendations={recommendations}
            folder={folder}
            onRefresh={onRefresh}
          />
        );
      case "activity":
        return (
          <ActivityIndicator
            workflowItems={workflowItems}
            folder={folder}
          />
        );
      case "action":
        return <ActionMenu folder={folder} onRefresh={onRefresh} />;
      default:
        return null;
    }
  }

  return (
    <div style={{
      display: "grid", gridTemplateColumns: templateCols,
      background: color.surface,
      borderTop: `1px solid ${color.borderSubtle}`,
      borderInlineStart: `4px solid ${group.strip}`,
      transition: transition.fast,
      minHeight: 56,
    }}
    onMouseEnter={e => e.currentTarget.style.background = "#fafbfc"}
    onMouseLeave={e => e.currentTarget.style.background = color.surface}>
      {visibleCols.map(col => (
        <Cell key={col.id} center={col.id !== "name" && col.id !== "audience" && col.id !== "media" && col.id !== "field_notes" && col.id !== "what_works"}>
          {renderCell(col)}
        </Cell>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Subitems
// ═══════════════════════════════════════════════════════════════════════════
const SUB_TEMPLATE = SUB_COL_DEFS.map(c => `${c.defaultW}px`).join(" ");

function SubitemsBlock({ folder, artifacts, recommendations, group, onOpenPayload, onRefresh }) {
  const approvedPlan = approvedMediaPlanFor(artifacts, folder.id);
  const channels     = channelsFromApprovedPlan(approvedPlan);

  if (!approvedPlan) {
    const draftPlan = currentArtifactOfType(artifacts, folder.id, "media_plan");
    return (
      <div style={{ background: "#f8fafc", borderInlineStart: `4px solid ${group.strip}`, borderTop: `1px dashed ${color.borderSubtle}`, paddingInlineStart: 32 }}>
        <div style={{ padding: `${space(3)} ${space(4)}`, display: "flex", alignItems: "center", gap: space(3), fontSize: 13, color: color.fgMuted, fontFamily }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: color.fgDefault, marginBottom: 2 }}>פריסת מדיה לא אושרה עדיין</div>
            <div style={{ fontSize: 12, color: color.fgSubtle }}>ערוצי המדיה יקבעו לפי הפריסה שתאשרי. עד אז אין subitems.</div>
          </div>
          {draftPlan && (
            <ApprovalDropdown
              artifact={draftPlan}
              onApproved={onRefresh}
              onRevised={onRefresh}
              onOpenPayload={() => onOpenPayload(draftPlan)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f8fafc", borderInlineStart: `4px solid ${group.strip}`, borderTop: `1px dashed ${color.borderSubtle}`, paddingInlineStart: 32 }}>
      {/* Sub-headers */}
      <div style={{ display: "grid", gridTemplateColumns: SUB_TEMPLATE, background: "#eef2f7", borderBottom: `1px solid ${color.borderSubtle}` }}>
        {SUB_COL_DEFS.map(h => (
          <div key={h.id} style={{
            padding: `${space(1.5)} ${space(2.5)}`,
            fontSize: 11, fontWeight: 700, color: color.fgMuted, letterSpacing: 0.3,
            textAlign: h.id === "channel" ? "right" : "center",
            borderInlineEnd: `1px solid ${color.borderSubtle}`, fontFamily,
          }}>{h.label}</div>
        ))}
      </div>
      {channels.map(channel => (
        <SubitemRow key={channel}
          folder={folder}
          channel={channel}
          planArtifact={approvedPlan}
          artifacts={artifacts}
          recommendations={recommendations}
          onOpenPayload={onOpenPayload}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}

function SubitemRow({ folder, channel, planArtifact, artifacts, recommendations, onOpenPayload, onRefresh }) {
  const display = platformDisplayFor(channel);
  const kwArtifact  = platformUsesKeywords(channel)
    ? (currentArtifactOfType(artifacts, folder.id, "keyword_research", channel)
        || currentArtifactOfType(artifacts, folder.id, "keyword_research"))
    : null;
  const copyArtifact     = currentArtifactOfType(artifacts, folder.id, `ad_copy_${channel}`);
  const creativeArtifact = currentArtifactOfType(artifacts, folder.id, "creative_rendered", channel);
  const budget           = budgetForPlatform(artifacts, folder.id, channel);
  const adsCount = artifacts.filter(a =>
    a.folder_id === folder.id
    && a.artifact_type === "creative_rendered"
    && a.status === "approved"
    && ((a.metadata || {}).platform || "").toLowerCase() === channel.toLowerCase()
  ).length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: SUB_TEMPLATE, background: color.surface, borderTop: `1px solid ${color.borderSubtle}`, minHeight: 44 }}>
      <Cell center compact />
      <Cell compact>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: color.fgDefault, fontFamily }}>
          <span style={{ fontSize: 16 }}>{display.icon}</span>
          {display.label}
        </span>
      </Cell>
      <Cell center compact>
        <span style={{ fontSize: 13, fontWeight: 600, color: budget ? color.fgDefault : color.fgSubtle, fontFamily }}>
          {budget ? fmtMoney(budget) : "—"}
        </span>
      </Cell>
      <Cell center compact>
        {platformUsesKeywords(channel)
          ? <ApprovalDropdown artifact={kwArtifact} onApproved={onRefresh} onRevised={onRefresh}
                              onOpenPayload={() => kwArtifact && onOpenPayload(kwArtifact)} />
          : <Dash />}
      </Cell>
      <Cell center compact>
        <ApprovalDropdown artifact={copyArtifact} onApproved={onRefresh} onRevised={onRefresh}
                          onOpenPayload={() => copyArtifact && onOpenPayload(copyArtifact)} />
      </Cell>
      <Cell center compact>
        <ApprovalDropdown artifact={creativeArtifact} onApproved={onRefresh} onRevised={onRefresh}
                          onOpenPayload={() => creativeArtifact && onOpenPayload(creativeArtifact)} />
      </Cell>
      <Cell center compact>
        {adsCount > 0 ? <span style={{ fontSize: 13, fontWeight: 700, color: color.fgDefault, fontFamily }}>{adsCount}</span> : <Dash />}
      </Cell>
      <Cell center compact>
        <RecommendationsBadge
          recommendations={recommendations}
          folder={folder}
          platform={channel}
          onRefresh={onRefresh}
        />
      </Cell>
      <Cell center compact>
        <ActionMenu folder={folder} prefilledChannel={channel} onRefresh={onRefresh} />
      </Cell>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared atoms
// ═══════════════════════════════════════════════════════════════════════════
function Cell({ children, center, compact }) {
  return (
    <div style={{
      padding: compact ? `${space(1.5)} ${space(2)}` : `${space(2)} ${space(2.5)}`,
      borderInlineEnd: `1px solid ${color.borderSubtle}`,
      display: "flex", alignItems: "center",
      justifyContent: center ? "center" : "flex-start",
      overflow: "hidden", minHeight: compact ? 44 : 56,
    }}>{children}</div>
  );
}

function Dash() {
  return <span style={{ color: color.fgSubtle, fontSize: 13, fontFamily }}>—</span>;
}

// ─── Inline editors ──────────────────────────────────────────────────────────
function InlineText({ value, placeholder, onSave, fontSize = 14, fontWeight = 400 }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value || "");
  const ref = useRef(null);
  useEffect(() => { setVal(value || ""); }, [value]);
  useLayoutEffect(() => {
    if (editing && ref.current) { ref.current.focus(); ref.current.select(); }
  }, [editing]);

  async function commit() {
    setEditing(false);
    if (val.trim() === (value || "").trim()) return;
    await onSave(val.trim() || null);
  }

  if (editing) {
    return (
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
             onBlur={commit}
             onKeyDown={e => {
               if (e.key === "Enter") { e.preventDefault(); commit(); }
               if (e.key === "Escape") { e.preventDefault(); setVal(value || ""); setEditing(false); }
             }}
             onClick={e => e.stopPropagation()}
             style={{
               width: "100%", padding: "6px 8px",
               border: `2px solid ${color.primary}`, borderRadius: 4,
               fontSize, fontFamily, background: "#fff",
               outline: "none", textAlign: "right", direction: "rtl", fontWeight,
             }} />
    );
  }
  return (
    <div onClick={e => { e.stopPropagation(); setEditing(true); }}
         title="לחיצה לעריכה"
         style={{
           cursor: "text", padding: "4px 8px", borderRadius: 4,
           minHeight: 26, width: "100%", textAlign: "right",
           color: value ? color.fgDefault : color.fgSubtle,
           fontSize, fontFamily, fontWeight,
           transition: transition.fast,
           whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
         }}
         onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
         onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      {value || placeholder || "—"}
    </div>
  );
}

function InlineNumber({ value, onSave, formatter = v => v }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value == null ? "" : String(value));
  const ref = useRef(null);
  useEffect(() => { setVal(value == null ? "" : String(value)); }, [value]);
  useLayoutEffect(() => {
    if (editing && ref.current) { ref.current.focus(); ref.current.select(); }
  }, [editing]);

  async function commit() {
    setEditing(false);
    const original = value == null ? "" : String(value);
    if (val.trim() === original.trim()) return;
    await onSave(val.trim() === "" ? null : val.trim());
  }

  if (editing) {
    return (
      <input ref={ref} type="number" value={val} onChange={e => setVal(e.target.value)}
             onBlur={commit}
             onKeyDown={e => {
               if (e.key === "Enter") { e.preventDefault(); commit(); }
               if (e.key === "Escape") { e.preventDefault(); setVal(value == null ? "" : String(value)); setEditing(false); }
             }}
             onClick={e => e.stopPropagation()}
             style={{
               width: "100%", padding: "6px 8px",
               border: `2px solid ${color.primary}`, borderRadius: 4,
               fontSize: 14, fontFamily, background: "#fff",
               outline: "none", textAlign: "center", direction: "rtl", fontWeight: 600,
             }} />
    );
  }
  const display = value == null || value === "" ? "" : formatter(value);
  return (
    <div onClick={e => { e.stopPropagation(); setEditing(true); }}
         title="לחיצה לעריכה"
         style={{
           cursor: "text", padding: "4px 8px", borderRadius: 4,
           minHeight: 26, width: "100%", textAlign: "center",
           color: display ? color.fgDefault : color.fgSubtle,
           fontSize: 14, fontFamily, fontWeight: display ? 700 : 400,
           transition: transition.fast,
         }}
         onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
         onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      {display || "+"}
    </div>
  );
}

function InlineDate({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      try { ref.current.showPicker?.(); } catch {}
    }
  }, [editing]);

  async function commit(newVal) {
    setEditing(false);
    if ((newVal || null) === (value || null)) return;
    await onSave(newVal || null);
  }

  if (editing) {
    return (
      <input ref={ref} type="date" defaultValue={value || ""}
             onBlur={e => commit(e.target.value)}
             onChange={e => commit(e.target.value)}
             onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); setEditing(false); } }}
             onClick={e => e.stopPropagation()}
             style={{
               width: "100%", padding: "6px 8px",
               border: `2px solid ${color.primary}`, borderRadius: 4,
               fontSize: 14, fontFamily, background: "#fff",
               outline: "none", textAlign: "center", direction: "rtl",
             }} />
    );
  }
  return (
    <div onClick={e => { e.stopPropagation(); setEditing(true); }}
         title="לחיצה לעריכת תאריך"
         style={{
           cursor: "text", padding: "4px 8px", borderRadius: 4,
           minHeight: 26, width: "100%", textAlign: "center",
           color: value ? color.fgDefault : color.fgSubtle,
           fontSize: 14, fontFamily, fontWeight: value ? 600 : 400,
           transition: transition.fast,
         }}
         onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
         onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      {value ? fmtDate(value) : "+"}
    </div>
  );
}

// ─── StatusPicker ─────────────────────────────────────────────────────────────
function StatusPicker({ value, onChange }) {
  const btnRef = useRef(null);
  const [open, setOpen]     = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const def = STATUS_DEFS[value] || { label: value || "—", bg: monday.grey, fg: monday.ink };

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (!btnRef.current?.contains(e.target)
          && !document.getElementById("status-picker-menu")?.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function openMenu() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const top  = r.bottom + 4;
    const left = Math.max(8, Math.min(window.innerWidth - 170, r.left));
    setMenuPos({ top, left });
    setOpen(true);
  }

  return (
    <>
      <button ref={btnRef} onClick={e => { e.stopPropagation(); openMenu(); }}
              style={{
                width: "100%", background: def.bg, color: def.fg, border: "none",
                padding: "6px 12px", borderRadius: 4,
                fontSize: 13, fontWeight: 700, fontFamily,
                cursor: "pointer", textAlign: "center", transition: transition.fast,
              }}>{def.label}</button>
      {open && menuPos && (
        <div id="status-picker-menu" style={{
          position: "fixed", top: menuPos.top, left: menuPos.left,
          background: color.surface, border: `1px solid ${color.borderDefault}`,
          borderRadius: radius.md, boxShadow: shadow.lg,
          zIndex: 9999, padding: 4, minWidth: 160,
        }} onClick={e => e.stopPropagation()}>
          {ALL_STATUSES.map(s => {
            const sd = STATUS_DEFS[s];
            const active = s === value;
            return (
              <div key={s} onClick={() => { onChange(s); setOpen(false); }}
                   style={{ padding: "5px 6px", cursor: "pointer", borderRadius: 4, background: active ? "#eef2f7" : "transparent", transition: transition.fast }}
                   onMouseEnter={e => e.currentTarget.style.background = "#eef2f7"}
                   onMouseLeave={e => e.currentTarget.style.background = active ? "#eef2f7" : "transparent"}>
                <span style={{
                  background: sd.bg, color: sd.fg, padding: "5px 12px", borderRadius: 4,
                  fontSize: 12, fontWeight: 700, fontFamily, display: "block", textAlign: "center",
                }}>{sd.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Inline add row ────────────────────────────────────────────────────────────
function InlineAddRow({ addingHere, addingName, onStartAdd, onAddNameChange, onCommitAdd, onCancelAdd, colCount }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (addingHere && ref.current) ref.current.focus();
  }, [addingHere]);

  if (addingHere) {
    return (
      <div style={{
        display: "flex", background: "#f0f9ff",
        borderTop: `1px solid ${color.borderSubtle}`,
        borderInlineStart: `4px solid ${color.primary}`,
        padding: `${space(2)} ${space(3)}`, gap: space(2), alignItems: "center",
      }}>
        <span style={{ color: color.fgSubtle, fontSize: 14 }}>+</span>
        <input ref={ref} value={addingName} onChange={e => onAddNameChange(e.target.value)}
               placeholder="שם הקמפיין (Enter לשמירה, Esc לביטול)"
               onKeyDown={e => {
                 if (e.key === "Enter")  { e.preventDefault(); onCommitAdd(); }
                 if (e.key === "Escape") { e.preventDefault(); onCancelAdd(); }
               }}
               style={{
                 flex: 1, padding: "8px 10px",
                 border: `2px solid ${color.primary}`, borderRadius: 4,
                 fontSize: 14, fontFamily, background: "#fff",
                 outline: "none", textAlign: "right", direction: "rtl", fontWeight: 600,
               }} />
        <button onClick={onCancelAdd} style={{ background: "transparent", border: "none", cursor: "pointer", color: color.fgSubtle, fontSize: 18, padding: 4 }}>×</button>
      </div>
    );
  }

  return (
    <div onClick={onStartAdd} style={{
      display: "flex", alignItems: "center", gap: space(2),
      padding: `${space(2)} ${space(3)}`,
      cursor: "pointer", background: color.surface,
      borderTop: `1px dashed ${color.borderSubtle}`,
      transition: transition.fast, fontSize: 13, color: color.fgMuted, fontFamily,
    }}
    onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
    onMouseLeave={e => e.currentTarget.style.background = color.surface}>
      <span style={{ fontSize: 16 }}>+</span>
      <span>הוסיפי קמפיין</span>
    </div>
  );
}

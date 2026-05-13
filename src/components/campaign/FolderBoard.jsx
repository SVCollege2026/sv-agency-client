/**
 * FolderBoard.jsx — Monday-style campaign board.
 *
 * Design tokens taken directly from the manager's reference Monday board
 * (5096218586, queried 13/5/26):
 *   • Group colors: planned #579bfc · live #00c875 · completed #df2f4a
 *   • Status pills: orange #fdab3d · green #00c875 · red #df2f4a · grey #c4c4c4
 *   • Column widths: Name 331 · Status 167 · Due 159 · Owner 101
 *
 * Structure (Monday-pattern):
 *   • Top row per campaign — general info only, edits inline
 *   • ▾ expand → subitems = 1 row PER MEDIA PLATFORM (Meta/Google/TikTok)
 *     with its own budget + media-plan + copy + creative + ads
 *   • + הוסיפי קמפיין = inline new row at bottom of group, no dialog
 *
 * No internal jargon (no Limann / OAuth / connection IDs / etc.) — this is
 * the marketing manager's only workspace (ספק 01 §3.3).
 */
import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import {
  listCampaignFolders, createCampaignFolder, updateCampaignFolder,
  listArtifacts, listBudgetAllocations,
  listRecommendations, listWorkflowBlockers, listAllFoldersFiles,
  listFolderBriefs, approveArtifact, requestArtifactRevision,
} from "../../api.js";
import { color, radius, shadow, space, type, transition, button, input as inputStyle, fontFamily } from "./_tokens.js";
import { useToast } from "./Toast.jsx";
import { SkeletonBoard } from "./Skeleton.jsx";

// ─── Status palette — Monday-exact ──────────────────────────────────────────
const STATUS_DEFS = {
  draft:           { label: "טיוטה",         bg: "#c4c4c4", fg: "#1e293b" },
  in_progress:     { label: "בעבודה",        bg: "#fdab3d", fg: "#ffffff" },
  ready_to_launch: { label: "מוכן לעלייה",   bg: "#a25ddc", fg: "#ffffff" },
  live:            { label: "באוויר",        bg: "#00c875", fg: "#ffffff" },
  closing:         { label: "בסגירה",        bg: "#fdab3d", fg: "#ffffff" },
  closed:          { label: "סגור",          bg: "#df2f4a", fg: "#ffffff" },
};
const ALL_STATUSES = Object.keys(STATUS_DEFS);

// ─── Groups (Monday colors) ────────────────────────────────────────────────
const GROUPS = [
  { id: "planned",   label: "קמפיינים מתוכננים לעלייה", statuses: ["draft", "in_progress", "ready_to_launch"], strip: "#579bfc" },
  { id: "live",      label: "קמפיינים באוויר",          statuses: ["live"],                                    strip: "#00c875" },
  { id: "completed", label: "קמפיינים שהסתיימו",        statuses: ["closing", "closed"],                       strip: "#df2f4a" },
];

// ─── Platforms always shown as subitems (per manager: Google + Meta + TikTok) ─
const PLATFORMS = [
  { id: "meta",   label: "Meta",          icon: "📘", color: "#1877f2" },
  { id: "google", label: "Google PMax",   icon: "🔎", color: "#4285f4" },
  { id: "tiktok", label: "TikTok",        icon: "🎵", color: "#000000" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
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

// ─── Artifact status → Monday-style pill ───────────────────────────────────
function artifactPillFor(currentArtifact) {
  if (!currentArtifact) return { state: "missing", bg: "transparent", fg: "#9ca3af", text: "—" };
  const status = currentArtifact.status;
  const v      = currentArtifact.version_number || 1;
  if (status === "approved")          return { state: "approved", bg: "#00c875", fg: "#fff", text: "✓ אושר" };
  if (status === "revision_required") return { state: "has_notes", bg: "#a25ddc", fg: "#fff", text: "💬 הערות" };
  if (status === "rejected")          return { state: "rejected", bg: "#df2f4a", fg: "#fff", text: "✗ נדחה" };
  if (v > 1)                          return { state: "new_version", bg: "#fdab3d", fg: "#fff", text: `⚠ גרסה ${v}` };
  return { state: "pending", bg: "#fdab3d", fg: "#fff", text: "⏳ ממתין" };
}

// ─── Find current version of artifact_type for a folder ────────────────────
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

// ─── Per-platform budget from media_plan or budget_recommendation artifact ──
function budgetForPlatform(artifacts, folderId, platform) {
  const plan = currentArtifactOfType(artifacts, folderId, "media_plan");
  const rec  = currentArtifactOfType(artifacts, folderId, "budget_recommendation");
  // Try media_plan.payload.platforms.<platform>.budget
  const plPlatforms = ((plan?.payload || {}).platforms) || {};
  if (plPlatforms[platform]?.budget) return Number(plPlatforms[platform].budget);
  // Try budget_recommendation.payload.breakdown.<platform>
  const breakdown = ((rec?.payload || {}).breakdown) || {};
  if (breakdown[platform]) return Number(breakdown[platform]);
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════════════
export default function FolderBoard({ onSelectFolder, refreshKey = 0 }) {
  const toast = useToast();
  const [folders, setFolders]         = useState([]);
  const [artifacts, setArtifacts]     = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [recommendations, setRecs]    = useState([]);
  const [blockers, setBlockers]       = useState([]);
  const [filesByFolder, setFiles]     = useState({});
  const [briefsByFolder, setBriefsByFolder] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [query, setQuery]       = useState("");
  const [collapsed, setCollapsed]       = useState({});
  const [expandedRows, setExpandedRows] = useState({});

  // Inline-add state per group: { groupId: "name being typed" } | undefined
  const [addingTo, setAddingTo] = useState(null);
  const [addingName, setAddingName] = useState("");

  async function refresh() {
    setLoading(true); setError(null);
    try {
      const [f, a, b, r, bl, files] = await Promise.all([
        listCampaignFolders(),
        listArtifacts({ limit: 500 }).catch(() => []),
        listBudgetAllocations().catch(() => []),
        listRecommendations({ limit: 200 }).catch(() => []),
        listWorkflowBlockers({ onlyOpen: true }).catch(() => []),
        listAllFoldersFiles().catch(() => ({})),
      ]);
      setFolders(Array.isArray(f) ? f : []);
      setArtifacts(Array.isArray(a) ? a : []);
      setAllocations(Array.isArray(b) ? b : []);
      setRecs(Array.isArray(r) ? r : []);
      setBlockers(Array.isArray(bl) ? bl : []);
      setFiles(typeof files === "object" && files ? files : {});
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [refreshKey]);

  // Briefs per folder fetched lazily on row mount (cached client-side)
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

  async function commitNewCampaign(groupId) {
    const name = addingName.trim();
    if (!name) { setAddingTo(null); setAddingName(""); return; }
    try {
      // For "live" / "completed" group adds — start as draft (manager moves status)
      const folder = await createCampaignFolder({
        course_name: name, created_by: "marketing_manager",
      });
      toast.success(`✓ ${folder.course_name}`);
      setAddingName("");
      // Keep the inline-add open so manager can quickly add another (Monday-style)
      await refresh();
    } catch (e) {
      toast.error(`שגיאה: ${e.message}`);
    }
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

  return (
    <div style={{ direction: "rtl", fontFamily, width: "100%" }}>
      {/* Top toolbar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: space(3), flexWrap: "wrap", gap: space(2),
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: space(3) }}>
          <h3 style={{ ...type.h2, margin: 0, fontSize: 22 }}>📋 לוח קמפיינים</h3>
          <span style={{ ...type.bodySmall, color: color.fgSubtle, fontSize: 14 }}>
            {q ? `${filtered.length} מתוך ${folders.length}` : `${folders.length} ${folders.length === 1 ? "קמפיין" : "קמפיינים"}`}
          </span>
        </div>
        <div style={{ display: "flex", gap: space(2), alignItems: "center", flexWrap: "wrap" }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
                 placeholder="חיפוש..."
                 style={{ ...inputStyle, fontSize: 14, minWidth: 240, padding: "8px 12px" }} />
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

      {!loading && filtered.length > 0 && (
        <div style={{
          background: color.surface, borderRadius: radius.lg,
          border: `1px solid ${color.borderDefault}`, boxShadow: shadow.sm,
          overflow: "hidden", width: "100%",
        }}>
          {groupedFolders.map(group => (
            <Group key={group.id}
                   group={group}
                   folders={group.folders}
                   collapsed={!!collapsed[group.id]}
                   onToggle={() => toggleGroup(group.id)}
                   expandedRows={expandedRows}
                   onToggleRow={toggleRow}
                   artifacts={artifacts}
                   allocations={allocations}
                   recommendations={recommendations}
                   blockers={blockers}
                   filesByFolder={filesByFolder}
                   briefsByFolder={briefsByFolder}
                   ensureBriefs={ensureBriefs}
                   onPatchFolder={patchFolder}
                   onOpenFolder={onSelectFolder}
                   addingHere={addingTo === group.id}
                   addingName={addingName}
                   onStartAdd={() => { setAddingTo(group.id); setAddingName(""); }}
                   onAddNameChange={setAddingName}
                   onCommitAdd={() => commitNewCampaign(group.id)}
                   onCancelAdd={() => { setAddingTo(null); setAddingName(""); }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Empty state
// ════════════════════════════════════════════════════════════════════════════
function EmptyState({ onAdd }) {
  return (
    <div style={{
      textAlign: "center", padding: space(12),
      background: color.surface, borderRadius: radius.lg,
      border: `1px solid ${color.borderDefault}`,
    }}>
      <div style={{ fontSize: 64, marginBottom: space(3) }}>🌱</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color.fgDefault, marginBottom: space(2) }}>
        אין עדיין קמפיינים
      </div>
      <div style={{ fontSize: 14, color: color.fgSubtle, marginBottom: space(4) }}>
        צרי את הקמפיין הראשון שלך כדי להתחיל
      </div>
      <button onClick={onAdd} style={{ ...button.primary, fontSize: 14 }}>
        ➕ צרי קמפיין ראשון
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Group section
// ════════════════════════════════════════════════════════════════════════════

// Top-row column template: chevron, name(flex), status, due, budget, briefs, approval, blockers, detail
const TOP_COLS = "32px 1fr 160px 140px 110px 90px 110px 110px 56px";

const TOP_HEADERS = [
  { id: "chev",   label: "" },
  { id: "name",   label: "שם הקמפיין" },
  { id: "status", label: "סטטוס" },
  { id: "due",    label: "תאריך עלייה" },
  { id: "budget", label: "תקציב כולל" },
  { id: "briefs", label: "בריפים" },
  { id: "appr",   label: "🔔 דורש אישור" },
  { id: "block",  label: "⚠ חוסמים" },
  { id: "open",   label: "" },
];

function Group({ group, folders, collapsed, onToggle, expandedRows, onToggleRow,
                 artifacts, allocations, recommendations, blockers,
                 filesByFolder, briefsByFolder, ensureBriefs,
                 onPatchFolder, onOpenFolder,
                 addingHere, addingName, onStartAdd, onAddNameChange, onCommitAdd, onCancelAdd }) {
  return (
    <div style={{ borderBottom: `1px solid ${color.borderDefault}` }}>
      {/* Group header — Monday-style: color strip on the left + chevron + name + count */}
      <div onClick={onToggle}
           style={{
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
        <span style={{
          color: group.strip, fontSize: 15, fontWeight: 700, fontFamily,
        }}>{group.label}</span>
        <span style={{
          background: color.surfaceMuted, color: color.fgMuted,
          padding: "2px 10px", borderRadius: 999,
          fontSize: 12, fontWeight: 700, fontFamily,
        }}>{folders.length}</span>
      </div>

      {!collapsed && (
        <>
          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: TOP_COLS,
            background: "#f8fafc",
            borderBottom: `1px solid ${color.borderSubtle}`,
          }}>
            {TOP_HEADERS.map(h => (
              <div key={h.id} style={{
                padding: `${space(2)} ${space(3)}`,
                fontSize: 12, fontWeight: 700, color: color.fgMuted,
                letterSpacing: 0.3, textTransform: "uppercase",
                textAlign: h.id === "name" ? "right" : "center",
                borderInlineEnd: `1px solid ${color.borderSubtle}`,
                fontFamily,
              }}>{h.label}</div>
            ))}
          </div>

          {folders.length === 0 && !addingHere && (
            <div style={{ padding: space(4), textAlign: "center",
                          color: color.fgSubtle, fontSize: 14, fontFamily }}>
              {group.id === "planned"
                ? "אין קמפיינים בתכנון. הוסיפי חדש למטה."
                : group.id === "live"
                  ? "אין קמפיינים פעילים. קמפיינים יזרמו לכאן כשתעדכני סטטוס ל\"באוויר\"."
                  : "אין קמפיינים שהסתיימו עדיין."}
            </div>
          )}

          {folders.map(f => (
            <React.Fragment key={f.id}>
              <Row folder={f}
                   group={group}
                   isExpanded={!!expandedRows[f.id]}
                   onToggle={() => { onToggleRow(f.id); ensureBriefs(f.id); }}
                   artifacts={artifacts}
                   recommendations={recommendations}
                   blockers={blockers}
                   briefs={briefsByFolder[f.id] || []}
                   allocations={allocations}
                   onPatch={(patch) => onPatchFolder(f, patch)}
                   onOpen={() => onOpenFolder && onOpenFolder(f.id)} />
              {expandedRows[f.id] && (
                <SubitemsBlock folder={f}
                               artifacts={artifacts}
                               group={group} />
              )}
            </React.Fragment>
          ))}

          {/* Inline add row (Monday-style) */}
          {group.id === "planned" && (
            <InlineAddRow
              addingHere={addingHere}
              addingName={addingName}
              onStartAdd={onStartAdd}
              onAddNameChange={onAddNameChange}
              onCommitAdd={onCommitAdd}
              onCancelAdd={onCancelAdd} />
          )}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Top row (one campaign)
// ════════════════════════════════════════════════════════════════════════════
function Row({ folder, group, isExpanded, onToggle,
                artifacts, recommendations, blockers, briefs, allocations,
                onPatch, onOpen }) {
  // Aggregate counts
  const myBlockers = blockers.filter(b => {
    const meta = b.metadata || {};
    const matchesFolder = b.folder_id === folder.id || meta.folder_id === folder.id;
    const ownedByMe = b.owner_role === "marketing_manager" || !b.owner_role;
    return matchesFolder && ownedByMe;
  }).length;

  // "Needs your approval" = pending artifacts + pending recs requiring approval
  const pendingArtifacts = artifacts.filter(a =>
    a.folder_id === folder.id
    && a.is_current_version !== false
    && (a.status === "waiting_for_marketing_approval" || a.status === "qa_passed")
  ).length;
  const pendingRecs = recommendations.filter(r =>
    r.folder_id === folder.id && r.decision_status === "pending" && r.requires_approval
  ).length;
  const needsApproval = pendingArtifacts + pendingRecs;

  const briefCount = briefs.filter(b => b.is_current_version).length || briefs.length;

  // Total budget: prefer metadata.budget_ils; else sum of allocations
  const totalBudget = (() => {
    if (folder.metadata?.budget_ils) return Number(folder.metadata.budget_ils);
    const sum = allocations.filter(a => a.folder_id === folder.id)
      .reduce((s, a) => s + Number(a.amount_ils || a.amount || 0), 0);
    return sum > 0 ? sum : null;
  })();

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: TOP_COLS,
      background: color.surface,
      borderTop: `1px solid ${color.borderSubtle}`,
      borderInlineStart: `4px solid ${group.strip}`,
      transition: transition.fast,
    }}
    onMouseEnter={e => e.currentTarget.style.background = "#fafbfc"}
    onMouseLeave={e => e.currentTarget.style.background = color.surface}>
      {/* Expand chevron */}
      <Cell center>
        <button onClick={onToggle}
                title={isExpanded ? "הסתר פירוט מדיה" : "הצג פירוט מדיה"}
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  color: color.fgMuted, fontSize: 14, padding: 4,
                  transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 120ms",
                }}>▾</button>
      </Cell>

      {/* Name + activity_label */}
      <Cell>
        <InlineText value={folder.course_name} placeholder="שם הקמפיין"
                    fontSize={14} fontWeight={600}
                    onSave={v => onPatch({ course_name: v })} />
        {folder.activity_label && (
          <div style={{ fontSize: 12, color: color.fgSubtle, marginTop: 2, fontFamily }}>
            {folder.activity_label}
          </div>
        )}
      </Cell>

      {/* Status — Monday-style pill */}
      <Cell center>
        <StatusPicker value={folder.status} onChange={s => onPatch({ status: s })} />
      </Cell>

      {/* Due date */}
      <Cell center>
        <InlineDate value={folder.planned_go_live_date}
                    onSave={v => onPatch({ planned_go_live_date: v })} />
      </Cell>

      {/* Total budget */}
      <Cell center>
        <InlineNumber value={totalBudget}
                       formatter={v => fmtMoney(v)}
                       onSave={v => onPatch({ metadata: { budget_ils: v == null ? null : Number(v) } })} />
      </Cell>

      {/* Briefs count */}
      <Cell center>
        {briefCount > 0 ? (
          <span style={{
            background: "#e0e7ff", color: "#4338ca",
            padding: "4px 12px", borderRadius: 999,
            fontSize: 13, fontWeight: 700, fontFamily,
          }}>📋 {briefCount}</span>
        ) : (
          <span style={{ color: color.fgSubtle, fontSize: 13, fontFamily }}>—</span>
        )}
      </Cell>

      {/* Needs approval (count) */}
      <Cell center>
        {needsApproval > 0 ? (
          <span title={`${needsApproval} פריטים מחכים לאישורך`} style={{
            background: "#fef3c7", color: "#a16207",
            padding: "4px 12px", borderRadius: 999,
            fontSize: 13, fontWeight: 700, fontFamily,
          }}>{needsApproval}</span>
        ) : (
          <span style={{ color: color.fgSubtle, fontSize: 13, fontFamily }}>—</span>
        )}
      </Cell>

      {/* Blockers (count) */}
      <Cell center>
        {myBlockers > 0 ? (
          <span style={{
            background: "#fee2e2", color: "#b91c1c",
            padding: "4px 12px", borderRadius: 999,
            fontSize: 13, fontWeight: 700, fontFamily,
          }}>{myBlockers}</span>
        ) : (
          <span style={{ color: color.fgSubtle, fontSize: 13, fontFamily }}>—</span>
        )}
      </Cell>

      {/* Open detail */}
      <Cell center>
        <button onClick={e => { e.stopPropagation(); onOpen && onOpen(); }}
                title="פתחי תצוגת פירוט מלאה"
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  color: color.primary, fontSize: 22, fontWeight: 700,
                  padding: "2px 8px", borderRadius: 4, lineHeight: 1,
                }}
                onMouseEnter={e => e.currentTarget.style.background = color.surfaceMuted}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>›</button>
      </Cell>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Subitems = per-platform media breakdown
// ════════════════════════════════════════════════════════════════════════════
const SUB_COLS = "32px 180px 130px 150px 150px 150px 150px 100px 56px";
const SUB_HEADERS = [
  { id: "spc",     label: "" },
  { id: "channel", label: "ערוץ" },
  { id: "budget",  label: "תקציב מוקצה" },
  { id: "plan",    label: "פריסת מדיה" },
  { id: "kw",      label: "מחקר ביטויי" },
  { id: "copy",    label: "קופי" },
  { id: "creative",label: "קריאייטיב" },
  { id: "ads",     label: "מודעות" },
  { id: "act",     label: "" },
];

function SubitemsBlock({ folder, artifacts, group }) {
  return (
    <div style={{
      background: "#f8fafc",
      borderInlineStart: `4px solid ${group.strip}`,
      borderTop: `1px dashed ${color.borderSubtle}`,
      paddingInlineStart: 32,  // indent like Monday subitems
    }}>
      {/* Sub-column headers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: SUB_COLS,
        background: "#eef2f7",
        borderBottom: `1px solid ${color.borderSubtle}`,
      }}>
        {SUB_HEADERS.map(h => (
          <div key={h.id} style={{
            padding: `${space(1.5)} ${space(3)}`,
            fontSize: 11, fontWeight: 700, color: color.fgMuted,
            letterSpacing: 0.3,
            textAlign: h.id === "channel" ? "right" : "center",
            borderInlineEnd: `1px solid ${color.borderSubtle}`,
            fontFamily,
          }}>{h.label}</div>
        ))}
      </div>

      {PLATFORMS.map(p => (
        <SubitemRow key={p.id} folder={folder} platform={p} artifacts={artifacts} />
      ))}
    </div>
  );
}

function SubitemRow({ folder, platform, artifacts }) {
  // Per-platform artifacts
  const planArtifact     = currentArtifactOfType(artifacts, folder.id, "media_plan");  // shared per folder
  const kwArtifact       = currentArtifactOfType(artifacts, folder.id, "keyword_research");
  const copyArtifact     = currentArtifactOfType(artifacts, folder.id, `ad_copy_${platform.id}`);
  const creativeArtifact = currentArtifactOfType(artifacts, folder.id, "creative_rendered", platform.id);

  const budget = budgetForPlatform(artifacts, folder.id, platform.id);

  // Count approved ads for this platform (creative_rendered with status=approved)
  const adsCount = artifacts.filter(a =>
    a.folder_id === folder.id
    && a.artifact_type === "creative_rendered"
    && a.status === "approved"
    && (((a.metadata || {}).platform || "").toLowerCase() === platform.id || true)  // for now show all approved creatives
  ).length;

  // Keywords only meaningful for Google (Meta/TikTok don't use keywords the same way)
  const showKw = platform.id === "google";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: SUB_COLS,
      background: color.surface,
      borderTop: `1px solid ${color.borderSubtle}`,
    }}>
      <Cell center compact>{/* spacer for chevron alignment */}</Cell>
      {/* Channel */}
      <Cell compact>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: color.fgDefault, fontFamily }}>
          <span style={{ fontSize: 16 }}>{platform.icon}</span>
          {platform.label}
        </span>
      </Cell>
      {/* Budget */}
      <Cell center compact>
        <span style={{ fontSize: 13, fontWeight: 600, color: budget ? color.fgDefault : color.fgSubtle, fontFamily }}>
          {budget ? fmtMoney(budget) : "—"}
        </span>
      </Cell>
      {/* Media plan status (read-only — the media dept produces it) */}
      <Cell center compact><ArtifactPill artifact={planArtifact} /></Cell>
      {/* Keyword research (only Google) */}
      <Cell center compact>
        {showKw ? <ArtifactPill artifact={kwArtifact} /> : <Dash />}
      </Cell>
      {/* Copy */}
      <Cell center compact><ArtifactPill artifact={copyArtifact} /></Cell>
      {/* Creative */}
      <Cell center compact><ArtifactPill artifact={creativeArtifact} /></Cell>
      {/* Ads count */}
      <Cell center compact>
        {adsCount > 0 ? (
          <span style={{ fontSize: 13, fontWeight: 700, color: color.fgDefault, fontFamily }}>{adsCount}</span>
        ) : <Dash />}
      </Cell>
      <Cell center compact>{/* action spacer */}</Cell>
    </div>
  );
}

// ─── Reusable ───────────────────────────────────────────────────────────────
function Cell({ children, center, compact }) {
  return (
    <div style={{
      padding: compact ? `${space(1.5)} ${space(2.5)}` : `${space(2)} ${space(3)}`,
      borderInlineEnd: `1px solid ${color.borderSubtle}`,
      display: "flex", alignItems: "center",
      justifyContent: center ? "center" : "flex-start",
      overflow: "hidden", minHeight: compact ? 44 : 60,
    }}>{children}</div>
  );
}

function ArtifactPill({ artifact }) {
  const p = artifactPillFor(artifact);
  if (p.state === "missing") {
    return <span style={{ color: color.fgSubtle, fontSize: 13, fontFamily }}>—</span>;
  }
  return (
    <span style={{
      background: p.bg, color: p.fg,
      padding: "4px 12px", borderRadius: 4,
      fontSize: 12, fontWeight: 700, fontFamily,
      whiteSpace: "nowrap",
    }}>{p.text}</span>
  );
}

function Dash() {
  return <span style={{ color: color.fgSubtle, fontSize: 13, fontFamily }}>—</span>;
}

// ─── Inline editors ─────────────────────────────────────────────────────────
function InlineText({ value, placeholder, onSave, fontSize = 14, fontWeight = 400 }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
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
               outline: "none", textAlign: "right", direction: "rtl",
               fontWeight,
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

function InlineNumber({ value, onSave, formatter = (v) => v }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value == null ? "" : String(value));
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
               outline: "none", textAlign: "center", direction: "rtl",
               fontWeight: 600,
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
      try { ref.current.showPicker?.(); } catch { /* not all browsers */ }
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

// ─── StatusPicker — Monday-style pill, dropdown via fixed positioning ──────
function StatusPicker({ value, onChange }) {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const def = STATUS_DEFS[value] || { label: value || "—", bg: "#c4c4c4", fg: "#1e293b" };

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
    // Position so dropdown stays in viewport
    const top  = r.bottom + 4;
    const left = Math.max(8, Math.min(window.innerWidth - 170, r.left));
    setMenuPos({ top, left });
    setOpen(true);
  }

  return (
    <>
      <button ref={btnRef}
              onClick={(e) => { e.stopPropagation(); openMenu(); }}
              title="לחיצה לשינוי סטטוס"
              style={{
                width: "100%",
                background: def.bg, color: def.fg, border: "none",
                padding: "6px 12px", borderRadius: 4,
                fontSize: 13, fontWeight: 700, fontFamily,
                cursor: "pointer", textAlign: "center",
                transition: transition.fast,
              }}>{def.label}</button>
      {open && menuPos && (
        <div id="status-picker-menu"
             style={{
               position: "fixed", top: menuPos.top, left: menuPos.left,
               background: color.surface,
               border: `1px solid ${color.borderDefault}`,
               borderRadius: radius.md, boxShadow: shadow.lg,
               zIndex: 9999, padding: 4, minWidth: 160,
             }}
             onClick={e => e.stopPropagation()}>
          {ALL_STATUSES.map(s => {
            const sd = STATUS_DEFS[s];
            const active = s === value;
            return (
              <div key={s} onClick={() => { onChange(s); setOpen(false); }}
                   style={{
                     padding: "5px 6px", cursor: "pointer", borderRadius: 4,
                     background: active ? "#eef2f7" : "transparent",
                     transition: transition.fast,
                   }}
                   onMouseEnter={e => e.currentTarget.style.background = "#eef2f7"}
                   onMouseLeave={e => e.currentTarget.style.background = active ? "#eef2f7" : "transparent"}>
                <span style={{
                  background: sd.bg, color: sd.fg, padding: "5px 12px", borderRadius: 4,
                  fontSize: 12, fontWeight: 700, fontFamily,
                  display: "block", textAlign: "center",
                }}>{sd.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Inline add row (Monday-style: name only, Enter saves, opens new "+") ──
function InlineAddRow({ addingHere, addingName, onStartAdd, onAddNameChange,
                         onCommitAdd, onCancelAdd }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (addingHere && ref.current) { ref.current.focus(); }
  }, [addingHere]);

  if (addingHere) {
    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: TOP_COLS,
        background: "#f0f9ff",
        borderTop: `1px solid ${color.borderSubtle}`,
        borderInlineStart: `4px solid ${color.primary}`,
      }}>
        <Cell center>
          <span style={{ color: color.fgSubtle, fontSize: 14 }}>+</span>
        </Cell>
        <Cell>
          <input ref={ref} value={addingName} onChange={e => onAddNameChange(e.target.value)}
                 placeholder="שם הקמפיין החדש (Enter לשמירה, Esc לביטול)"
                 onKeyDown={e => {
                   if (e.key === "Enter")  { e.preventDefault(); onCommitAdd(); }
                   if (e.key === "Escape") { e.preventDefault(); onCancelAdd(); }
                 }}
                 style={{
                   width: "100%", padding: "8px 10px",
                   border: `2px solid ${color.primary}`, borderRadius: 4,
                   fontSize: 14, fontFamily, background: "#fff",
                   outline: "none", textAlign: "right", direction: "rtl",
                   fontWeight: 600,
                 }} />
        </Cell>
        {/* Empty cells matching the column template */}
        <Cell center>—</Cell>
        <Cell center>—</Cell>
        <Cell center>—</Cell>
        <Cell center>—</Cell>
        <Cell center>—</Cell>
        <Cell center>—</Cell>
        <Cell center>
          <button onClick={onCancelAdd} title="ביטול"
                  style={{
                    background: "transparent", border: "none", cursor: "pointer",
                    color: color.fgSubtle, fontSize: 18, padding: 4,
                  }}>×</button>
        </Cell>
      </div>
    );
  }
  return (
    <div onClick={onStartAdd}
         style={{
           display: "grid",
           gridTemplateColumns: "32px 1fr",
           cursor: "pointer", background: color.surface,
           borderTop: `1px dashed ${color.borderSubtle}`,
           transition: transition.fast,
         }}
         onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
         onMouseLeave={e => e.currentTarget.style.background = color.surface}>
      <Cell center>
        <span style={{ color: color.fgSubtle, fontSize: 16 }}>+</span>
      </Cell>
      <Cell>
        <span style={{ color: color.fgSubtle, fontSize: 14, fontWeight: 600, fontFamily }}>
          הוסיפי קמפיין
        </span>
      </Cell>
    </div>
  );
}

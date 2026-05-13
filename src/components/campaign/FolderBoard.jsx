/**
 * FolderBoard.jsx — Monday-style board for campaign folders.
 *
 * Visual: 3 collapsible groups (planned / live / completed) with color strips,
 * each group rendered as a multi-column table with rows = campaigns.
 *
 * Columns per row:
 *   שם הקמפיין | בעלים | סטטוס (clickable) | תאריך עלייה | תקציב |
 *   פריסת מדיה | מחקר שוק | קופי Meta | קופי Google | קריאייטיב | פעולות
 *
 * Status pill is clickable → dropdown to inline-edit folder.status.
 * Row click navigates to FolderDetail.
 */
import React, { useState, useEffect, useRef } from "react";
import {
  listCampaignFolders, createCampaignFolder, updateCampaignFolder,
  listArtifacts, listBudgetAllocations,
} from "../../api.js";
import {
  color, radius, shadow, space, type, transition,
  button, input as inputStyle, fontFamily,
} from "./_tokens.js";
import { useToast } from "./Toast.jsx";
import { SkeletonBoard } from "./Skeleton.jsx";

// ─── Status definitions (Monday-style colors) ───────────────────────────────
const STATUS_DEFS = {
  draft:           { label: "טיוטה",         bg: "#cbd5e1", fg: "#1e293b" },
  in_progress:     { label: "בעבודה",        bg: "#fdba74", fg: "#7c2d12" },
  ready_to_launch: { label: "מוכן לעלייה",   bg: "#86efac", fg: "#14532d" },
  live:            { label: "באוויר",        bg: "#22c55e", fg: "#ffffff" },
  closing:         { label: "בסגירה",        bg: "#fbbf24", fg: "#78350f" },
  closed:          { label: "סגור",          bg: "#f87171", fg: "#7f1d1d" },
};
const ALL_STATUSES = Object.keys(STATUS_DEFS);

// ─── Group definitions (Monday-style: 3 buckets, color strips) ─────────────
const GROUPS = [
  {
    id:       "planned",
    label:    "קמפיינים מתוכננים לעלייה",
    statuses: ["draft", "in_progress", "ready_to_launch"],
    strip:    "#3b82f6",   // blue
  },
  {
    id:       "live",
    label:    "קמפיינים באוויר",
    statuses: ["live"],
    strip:    "#16a34a",   // green
  },
  {
    id:       "completed",
    label:    "קמפיינים שהסתיימו",
    statuses: ["closing", "closed"],
    strip:    "#dc2626",   // red
  },
];

// ─── Column definitions (data + width) ──────────────────────────────────────
const COLUMNS = [
  { id: "task",        label: "שם הקמפיין",  width: 280 },
  { id: "owner",       label: "בעלים",        width: 80,  center: true },
  { id: "status",      label: "סטטוס",        width: 140, center: true },
  { id: "due",         label: "תאריך עלייה",  width: 110, center: true },
  { id: "budget",      label: "תקציב",        width: 110, center: true },
  { id: "media_plan",  label: "פריסת מדיה",   width: 110, center: true },
  { id: "research",    label: "מחקר שוק",     width: 110, center: true },
  { id: "copy_meta",   label: "קופי Meta",    width: 110, center: true },
  { id: "copy_google", label: "קופי Google",  width: 110, center: true },
  { id: "creative",    label: "קריאייטיב",    width: 110, center: true },
  { id: "actions",     label: "",             width: 60,  center: true },
];

const ROW_TEMPLATE = COLUMNS.map(c => `${c.width}px`).join(" ");

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
  } catch { return iso; }
}

function fmtMoney(num) {
  if (num == null || num === 0) return "—";
  if (num >= 1000) return `₪${Math.round(num / 1000)}K`;
  return `₪${Number(num).toLocaleString("he-IL")}`;
}

function ownerInitial(name) {
  if (!name) return "?";
  const trimmed = String(name).trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

// ─── OwnerAvatar — circle with first letter ────────────────────────────────
function OwnerAvatar({ name }) {
  const initial = ownerInitial(name);
  if (initial === "?") {
    return (
      <div title="ללא בעלים" style={{
        width: 28, height: 28, borderRadius: "50%",
        background: color.surfaceMuted, border: `1px dashed ${color.borderDefault}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: color.fgSubtle, fontSize: 13, fontFamily,
      }}>?</div>
    );
  }
  // Deterministic color from initial code point
  const palette = ["#0369a1", "#16a34a", "#a16207", "#b91c1c", "#7c3aed", "#0891b2", "#be185d", "#475569"];
  const code = initial.charCodeAt(0);
  const bg = palette[code % palette.length];
  return (
    <div title={name} style={{
      width: 28, height: 28, borderRadius: "50%",
      background: bg, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 700, fontFamily,
    }}>{initial}</div>
  );
}

// ─── StatusPicker — clickable pill that opens dropdown to change status ────
function StatusPicker({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const def = STATUS_DEFS[value] || { label: value || "—", bg: "#e2e8f0", fg: "#475569" };

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref}
         style={{ position: "relative", display: "inline-block" }}
         onClick={e => e.stopPropagation()}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        style={{
          background: def.bg, color: def.fg, border: "none",
          padding: "5px 14px", borderRadius: 4,
          fontSize: 12, fontWeight: 700, fontFamily,
          cursor: disabled ? "not-allowed" : "pointer",
          minWidth: 110, textAlign: "center",
          opacity: disabled ? 0.6 : 1,
          transition: transition.fast,
          boxShadow: "0 1px 2px rgba(15,23,42,0.08)",
        }}
        title="לחיצה לשינוי סטטוס"
      >{def.label}</button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)",
          insetInlineStart: 0,
          background: color.surface,
          border: `1px solid ${color.borderDefault}`,
          borderRadius: radius.md,
          boxShadow: shadow.lg,
          zIndex: 20,
          padding: 4, minWidth: 150,
        }}>
          {ALL_STATUSES.map(s => {
            const sd = STATUS_DEFS[s];
            const active = s === value;
            return (
              <div key={s}
                   onClick={() => { onChange(s); setOpen(false); }}
                   style={{
                     padding: "5px 6px", cursor: "pointer", borderRadius: 4,
                     display: "flex", alignItems: "center",
                     background: active ? color.surfaceMuted : "transparent",
                     transition: transition.fast,
                   }}
                   onMouseEnter={e => e.currentTarget.style.background = color.surfaceMuted}
                   onMouseLeave={e => e.currentTarget.style.background = active ? color.surfaceMuted : "transparent"}>
                <span style={{
                  background: sd.bg, color: sd.fg,
                  padding: "3px 10px", borderRadius: 4,
                  fontSize: 11, fontWeight: 700, fontFamily,
                  width: "100%", textAlign: "center",
                }}>{sd.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ArtifactCell — pill showing approved / pending / missing per type ─────
function ArtifactCell({ stats }) {
  if (!stats || stats.total === 0) {
    return <span style={{ color: color.fgSubtle, fontSize: 14 }}>—</span>;
  }
  if (stats.approved > 0) {
    return (
      <span title={`${stats.approved} מאושרים`} style={{
        background: "#dcfce7", color: "#166534",
        padding: "3px 9px", borderRadius: 999,
        fontSize: 11, fontWeight: 700, fontFamily,
        display: "inline-flex", alignItems: "center", gap: 3,
      }}>✓ {stats.approved > 1 ? stats.approved : "אושר"}</span>
    );
  }
  if (stats.revision > 0) {
    return (
      <span title="דרוש תיקון" style={{
        background: "#fee2e2", color: "#b91c1c",
        padding: "3px 9px", borderRadius: 999,
        fontSize: 11, fontWeight: 700, fontFamily,
      }}>↻ תיקון</span>
    );
  }
  return (
    <span title="ממתין לאישור" style={{
      background: "#fef3c7", color: "#a16207",
      padding: "3px 9px", borderRadius: 999,
      fontSize: 11, fontWeight: 700, fontFamily,
    }}>⏳ ממתין</span>
  );
}

// ─── Group artifacts by type for a given folder ────────────────────────────
function summarizeArtifacts(artifacts, folderId) {
  const filtered = artifacts.filter(a => a.folder_id === folderId);
  const byType = {};
  for (const a of filtered) {
    const t = a.artifact_type || "other";
    if (!byType[t]) byType[t] = { approved: 0, pending: 0, revision: 0, total: 0 };
    byType[t].total += 1;
    if (a.status === "approved") byType[t].approved += 1;
    else if (a.status === "revision_required" || a.status === "rejected") byType[t].revision += 1;
    else byType[t].pending += 1;
  }
  return byType;
}

// Combine multiple type stats (e.g. creative_concept + creative_rendered)
function mergeStats(...statsList) {
  const merged = { approved: 0, pending: 0, revision: 0, total: 0 };
  for (const s of statsList) {
    if (!s) continue;
    merged.approved += s.approved;
    merged.pending  += s.pending;
    merged.revision += s.revision;
    merged.total    += s.total;
  }
  return merged.total === 0 ? null : merged;
}

// ─── Sum approved budget allocations for folder ────────────────────────────
function budgetForFolder(allocations, folderId) {
  const list = allocations.filter(a => a.folder_id === folderId);
  if (list.length === 0) return null;
  const total = list.reduce((sum, a) => {
    const status = a.decision_status || "approved";
    if (status === "approved" || status === "pending") {
      return sum + Number(a.amount_ils || a.amount || 0);
    }
    return sum;
  }, 0);
  return total > 0 ? total : null;
}

// ════════════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════════════
export default function FolderBoard({ onSelectFolder, refreshKey = 0 }) {
  const toast = useToast();
  const [folders, setFolders]         = useState([]);
  const [artifacts, setArtifacts]     = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [showNew, setShowNew]   = useState(false);
  const [newName, setNewName]   = useState("");
  const [creating, setCreating] = useState(false);
  const [query, setQuery]       = useState("");
  const [collapsed, setCollapsed] = useState({});

  async function refresh() {
    setLoading(true); setError(null);
    try {
      const [f, a, b] = await Promise.all([
        listCampaignFolders(),
        listArtifacts({ limit: 500 }).catch(() => []),
        listBudgetAllocations().catch(() => []),
      ]);
      setFolders(Array.isArray(f) ? f : []);
      setArtifacts(Array.isArray(a) ? a : []);
      setAllocations(Array.isArray(b) ? b : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [refreshKey]);

  async function createFolder() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const folder = await createCampaignFolder({
        course_name: newName.trim(),
        created_by: "marketing_manager",
      });
      setNewName(""); setShowNew(false);
      toast.success(`✓ נוצר קמפיין: ${folder.course_name}`);
      await refresh();
      onSelectFolder && onSelectFolder(folder.id);
    } catch (e) {
      toast.error(`שגיאה ביצירת קמפיין: ${e.message}`);
    } finally {
      setCreating(false);
    }
  }

  async function changeStatus(folder, newStatus) {
    if (folder.status === newStatus) return;
    try {
      await updateCampaignFolder(folder.id, { status: newStatus });
      toast.success(`✓ סטטוס עודכן: ${STATUS_DEFS[newStatus]?.label || newStatus}`);
      await refresh();
    } catch (e) {
      toast.error(`שגיאה בעדכון סטטוס: ${e.message}`);
    }
  }

  function toggleGroup(groupId) {
    setCollapsed(c => ({ ...c, [groupId]: !c[groupId] }));
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? folders.filter(f =>
        (f.course_name || "").toLowerCase().includes(q) ||
        (f.activity_label || "").toLowerCase().includes(q)
      )
    : folders;

  const groupedFolders = GROUPS.map(g => ({
    ...g,
    folders: filtered.filter(f => g.statuses.includes(f.status)),
  }));

  return (
    <div style={{ direction: "rtl", fontFamily }}>
      {/* ─── Top toolbar ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: space(3), flexWrap: "wrap", gap: space(2),
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: space(3) }}>
          <h3 style={{ ...type.h2, margin: 0 }}>📋 לוח קמפיינים</h3>
          <span style={{ ...type.bodySmall, color: color.fgSubtle }}>
            {q
              ? `${filtered.length} מתוך ${folders.length}`
              : `${folders.length} ${folders.length === 1 ? "קמפיין" : "קמפיינים"}`}
          </span>
        </div>
        <div style={{ display: "flex", gap: space(2), alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", insetInlineStart: space(2.5),
              top: "50%", transform: "translateY(-50%)",
              color: color.fgSubtle, fontSize: 14, pointerEvents: "none",
            }}>🔎</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="חיפוש..."
              style={{ ...inputStyle, paddingInlineStart: space(7), minWidth: 200 }}
            />
            {q && (
              <button onClick={() => setQuery("")} aria-label="נקי חיפוש"
                style={{
                  position: "absolute", insetInlineEnd: space(1.5),
                  top: "50%", transform: "translateY(-50%)",
                  background: "transparent", border: "none", cursor: "pointer",
                  color: color.fgMuted, fontSize: 16, padding: 4, lineHeight: 1,
                }}>×</button>
            )}
          </div>
          <button
            onClick={() => setShowNew(s => !s)}
            style={button.primary}
            onMouseEnter={e => e.currentTarget.style.background = color.primaryHover}
            onMouseLeave={e => e.currentTarget.style.background = color.primary}
          >➕ קמפיין חדש</button>
        </div>
      </div>

      {/* ─── New campaign inline form ───────────────────────────────────── */}
      {showNew && (
        <div style={{
          background: color.surface, border: `1px solid ${color.borderDefault}`,
          borderRadius: radius.card, padding: space(4), marginBottom: space(4),
          boxShadow: shadow.sm,
        }}>
          <div style={{ ...type.label, marginBottom: space(2) }}>קמפיין חדש</div>
          <div style={{ display: "flex", gap: space(2) }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="שם הקורס / הפעילות"
              autoFocus
              onKeyDown={e => e.key === "Enter" && createFolder()}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={createFolder} disabled={creating || !newName.trim()}
              style={{ ...button.success, opacity: creating || !newName.trim() ? 0.5 : 1 }}>
              {creating ? "..." : "צור"}
            </button>
            <button onClick={() => { setShowNew(false); setNewName(""); }} style={button.secondary}>
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* ─── Error banner ────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: space(3), background: color.dangerSoftBg, color: color.dangerSoftFg,
          borderRadius: radius.md, marginBottom: space(3), ...type.bodySmall,
        }}>שגיאה: {error}</div>
      )}

      {/* ─── Loading ─────────────────────────────────────────────────────── */}
      {loading && <SkeletonBoard />}

      {/* ─── Empty state ─────────────────────────────────────────────────── */}
      {!loading && folders.length === 0 && (
        <div style={{
          textAlign: "center", padding: space(12),
          background: color.surface, borderRadius: radius.card,
          border: `1px solid ${color.borderDefault}`,
        }}>
          <div style={{ fontSize: 56, marginBottom: space(3) }}>🌱</div>
          <div style={{ ...type.h3, marginBottom: space(2) }}>אין עדיין קמפיינים</div>
          <div style={{ ...type.bodySmall, color: color.fgSubtle, marginBottom: space(4) }}>
            צרי את הקמפיין הראשון שלך כדי להתחיל
          </div>
          <button onClick={() => setShowNew(true)} style={button.primary}>
            ➕ צרי קמפיין ראשון
          </button>
        </div>
      )}

      {/* ─── No results for current search ──────────────────────────────── */}
      {!loading && folders.length > 0 && filtered.length === 0 && (
        <div style={{
          textAlign: "center", padding: space(10),
          background: color.surface, borderRadius: radius.card,
          border: `1px solid ${color.borderDefault}`,
        }}>
          <div style={{ fontSize: 44, marginBottom: space(2) }}>🔍</div>
          <div style={{ ...type.h3, marginBottom: space(2) }}>לא נמצאו קמפיינים לחיפוש זה</div>
          <button onClick={() => setQuery("")} style={button.secondary}>נקי חיפוש</button>
        </div>
      )}

      {/* ─── Monday-style table ─────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div style={{
          background: color.surface, borderRadius: radius.lg,
          border: `1px solid ${color.borderDefault}`, boxShadow: shadow.sm,
          overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 1340 }}>
              {groupedFolders.map(group => (
                <Group key={group.id}
                       group={group}
                       folders={group.folders}
                       collapsed={!!collapsed[group.id]}
                       onToggle={() => toggleGroup(group.id)}
                       artifacts={artifacts}
                       allocations={allocations}
                       onSelectFolder={onSelectFolder}
                       onChangeStatus={changeStatus}
                       onAddCampaign={() => setShowNew(true)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Group section (header + column headers + rows + footer)
// ════════════════════════════════════════════════════════════════════════════
function Group({ group, folders, collapsed, onToggle, artifacts, allocations,
                 onSelectFolder, onChangeStatus, onAddCampaign }) {
  // Status distribution for footer summary bar
  const statusCounts = {};
  for (const f of folders) statusCounts[f.status] = (statusCounts[f.status] || 0) + 1;

  return (
    <div style={{ borderBottom: `1px solid ${color.borderDefault}` }}>
      {/* ─── Group header (collapsible) ─────────────────────────────────── */}
      <div onClick={onToggle}
           style={{
             display: "flex", alignItems: "center", gap: space(2),
             padding: `${space(2.5)} ${space(3)}`,
             cursor: "pointer",
             background: color.surface,
             userSelect: "none",
           }}
           onMouseEnter={e => e.currentTarget.style.background = color.surfaceMuted}
           onMouseLeave={e => e.currentTarget.style.background = color.surface}>
        <span style={{
          display: "inline-block",
          transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
          transition: "transform 120ms",
          color: color.fgMuted, fontSize: 12, width: 14,
        }}>▾</span>
        <span style={{
          color: group.strip,
          ...type.bodyStrong, fontSize: 14, fontFamily,
        }}>{group.label}</span>
        <span style={{
          background: color.surfaceMuted, color: color.fgMuted,
          padding: "1px 9px", borderRadius: 999,
          fontSize: 11, fontWeight: 700, fontFamily,
        }}>{folders.length}</span>
      </div>

      {!collapsed && (
        <>
          {/* ─── Column headers ─────────────────────────────────────────── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: `8px 28px ${ROW_TEMPLATE}`,
            background: color.surfaceMuted,
            borderTop: `1px solid ${color.borderSubtle}`,
            borderBottom: `1px solid ${color.borderSubtle}`,
          }}>
            <div /> {/* color strip column spacer */}
            <div /> {/* checkbox column spacer */}
            {COLUMNS.map(c => (
              <div key={c.id} style={{
                padding: `${space(2)} ${space(3)}`,
                ...type.caption, color: color.fgSubtle,
                fontWeight: 700, letterSpacing: 0.3,
                textAlign: c.center ? "center" : "right",
                borderInlineEnd: `1px solid ${color.borderSubtle}`,
                fontFamily, textTransform: "uppercase",
              }}>{c.label}</div>
            ))}
          </div>

          {/* ─── Rows ──────────────────────────────────────────────────── */}
          {folders.length === 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: `8px 1fr`,
            }}>
              <div style={{ background: group.strip, opacity: 0.7 }} />
              <div style={{
                padding: space(4), textAlign: "center",
                color: color.fgSubtle, ...type.bodySmall, fontFamily,
              }}>אין קמפיינים בקטגוריה זו עדיין</div>
            </div>
          )}

          {folders.map(f => (
            <Row key={f.id}
                 folder={f}
                 group={group}
                 artifactsByType={summarizeArtifacts(artifacts, f.id)}
                 budgetIls={budgetForFolder(allocations, f.id)}
                 onSelect={() => onSelectFolder && onSelectFolder(f.id)}
                 onChangeStatus={s => onChangeStatus(f, s)} />
          ))}

          {/* ─── + Add campaign row ───────────────────────────────────── */}
          <div onClick={onAddCampaign}
               style={{
                 display: "grid",
                 gridTemplateColumns: `8px 1fr`,
                 cursor: "pointer",
                 borderTop: `1px dashed ${color.borderSubtle}`,
                 background: color.surface,
                 transition: transition.fast,
               }}
               onMouseEnter={e => {
                 e.currentTarget.style.background = color.surfaceMuted;
                 const span = e.currentTarget.querySelector("span");
                 if (span) span.style.color = color.primary;
               }}
               onMouseLeave={e => {
                 e.currentTarget.style.background = color.surface;
                 const span = e.currentTarget.querySelector("span");
                 if (span) span.style.color = color.fgSubtle;
               }}>
            <div style={{ background: group.strip, opacity: 0.4 }} />
            <span style={{
              padding: `${space(2)} ${space(3)}`,
              color: color.fgSubtle, ...type.bodySmall,
              fontWeight: 600, fontFamily,
              transition: transition.fast,
            }}>➕ הוסיפי קמפיין</span>
          </div>

          {/* ─── Footer: status distribution mini-bar ──────────────────── */}
          {folders.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: `8px 1fr`,
              background: color.surfaceMuted,
              borderTop: `1px solid ${color.borderSubtle}`,
            }}>
              <div style={{ background: group.strip, opacity: 0.6 }} />
              <div style={{
                display: "flex", alignItems: "center", gap: space(3),
                padding: `${space(2)} ${space(3)}`,
                flexWrap: "wrap",
              }}>
                <span style={{ ...type.caption, color: color.fgSubtle, fontFamily }}>
                  התפלגות סטטוס:
                </span>
                <div style={{
                  display: "flex", height: 16, borderRadius: 4, overflow: "hidden",
                  width: 280, border: `1px solid ${color.borderSubtle}`,
                }}>
                  {group.statuses.map(s => {
                    const cnt = statusCounts[s] || 0;
                    if (!cnt) return null;
                    const sd = STATUS_DEFS[s];
                    const w = (cnt / folders.length) * 100;
                    return (
                      <div key={s} title={`${sd.label}: ${cnt}`}
                           style={{
                             background: sd.bg, width: `${w}%`, color: sd.fg,
                             fontSize: 10, fontWeight: 700, fontFamily,
                             display: "flex", alignItems: "center", justifyContent: "center",
                           }}>{cnt > 1 ? cnt : ""}</div>
                    );
                  })}
                </div>
                <span style={{
                  ...type.caption, color: color.fgSubtle, fontFamily,
                  marginInlineStart: "auto",
                }}>סה"כ {folders.length} בקטגוריה</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Row (one campaign)
// ════════════════════════════════════════════════════════════════════════════
function Row({ folder, group, artifactsByType, budgetIls, onSelect, onChangeStatus }) {
  const mediaPlanStats = artifactsByType.media_plan || null;
  const researchStats  = artifactsByType.market_research || null;
  const copyMetaStats   = artifactsByType.ad_copy_meta || null;
  const copyGoogleStats = artifactsByType.ad_copy_google || null;
  const creativeStats  = mergeStats(
    artifactsByType.creative_concept,
    artifactsByType.creative_rendered,
  );

  return (
    <div onClick={onSelect}
         style={{
           display: "grid",
           gridTemplateColumns: `8px 28px ${ROW_TEMPLATE}`,
           cursor: "pointer",
           background: color.surface,
           borderTop: `1px solid ${color.borderSubtle}`,
           transition: transition.fast,
         }}
         onMouseEnter={e => e.currentTarget.style.background = "#fafbfc"}
         onMouseLeave={e => e.currentTarget.style.background = color.surface}>
      {/* Color strip */}
      <div style={{ background: group.strip, opacity: 0.85 }} />
      {/* Checkbox spacer (visual only — selection not implemented in V1) */}
      <Cell center>
        <input type="checkbox" disabled
               onClick={e => e.stopPropagation()}
               style={{ width: 14, height: 14, cursor: "not-allowed", opacity: 0.5 }} />
      </Cell>

      {/* Task: name + activity_label */}
      <Cell>
        <div>
          <div style={{ ...type.bodyStrong, color: color.fgDefault, fontFamily, lineHeight: "20px" }}>
            {folder.course_name}
          </div>
          {folder.activity_label && (
            <div style={{ ...type.caption, color: color.fgSubtle, marginTop: 2, fontFamily }}>
              {folder.activity_label}
            </div>
          )}
        </div>
      </Cell>

      {/* Owner avatar */}
      <Cell center><OwnerAvatar name={folder.created_by} /></Cell>

      {/* Status pill (clickable) */}
      <Cell center><StatusPicker value={folder.status} onChange={onChangeStatus} /></Cell>

      {/* Due date */}
      <Cell center>
        <span style={{ ...type.bodySmall, color: color.fgDefault, fontFamily }}>
          {fmtDate(folder.planned_go_live_date)}
        </span>
      </Cell>

      {/* Budget */}
      <Cell center>
        <span style={{
          ...type.bodySmall, color: budgetIls ? color.fgDefault : color.fgSubtle,
          fontWeight: budgetIls ? 700 : 400, fontFamily,
        }}>{fmtMoney(budgetIls)}</span>
      </Cell>

      {/* Artifact cells */}
      <Cell center><ArtifactCell stats={mediaPlanStats}  /></Cell>
      <Cell center><ArtifactCell stats={researchStats}   /></Cell>
      <Cell center><ArtifactCell stats={copyMetaStats}   /></Cell>
      <Cell center><ArtifactCell stats={copyGoogleStats} /></Cell>
      <Cell center><ArtifactCell stats={creativeStats}   /></Cell>

      {/* Open detail */}
      <Cell center>
        <span style={{ color: color.primary, fontSize: 18, fontWeight: 700 }}>›</span>
      </Cell>
    </div>
  );
}

// ─── Generic cell wrapper ───────────────────────────────────────────────────
function Cell({ children, center }) {
  return (
    <div style={{
      padding: `${space(2.5)} ${space(3)}`,
      borderInlineEnd: `1px solid ${color.borderSubtle}`,
      display: "flex", alignItems: "center",
      justifyContent: center ? "center" : "flex-start",
      overflow: "hidden", minHeight: 52,
    }}>{children}</div>
  );
}

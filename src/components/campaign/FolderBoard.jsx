/**
 * FolderBoard.jsx — Monday-style board, מותאם לתחום ניהול הקמפיינים.
 *
 * עיקרון אינליין: כל תא נערך במקום, אין ניווט לעמודים פנימיים כדי לכתוב
 * משהו פשוט. רק החצן "›" בקצה השורה פותח את תצוגת הפירוט המלאה.
 *
 * 3 קבוצות מתקפלות (מתוכננים / באוויר / הסתיימו) — קמפיינים זורמים
 * אוטומטית בין הקבוצות לפי שינוי הסטטוס. "+הוסיפי" מופיע רק במתוכננים.
 *
 * עמודות (25+):
 *   ─ כללי ─ שם · פעילות · בעלים · סטטוס · עדיפות
 *   ─ זמנים ─ עלייה · סגירת רישום · methodology
 *   ─ יעדים ─ תקציב · לידים יעד · CPL יעד
 *   ─ מסמכים ─ פריסת מדיה · מחקר ביטויי · בריף
 *   ─ קריאייטיב ─ קונספט · קריאייטיב מוכן
 *   ─ קופי ─ Meta · PMax · TikTok · טופס Lead
 *   ─ אופרציה ─ MAKE · המלצות פתוחות · חוסמים
 *   ─ הקשר ─ קורס Fireberry · הערות
 *   ─ פתח ─ ›
 */
import React, { useState, useEffect, useRef } from "react";
import {
  listCampaignFolders, createCampaignFolder, updateCampaignFolder,
  listArtifacts, listBudgetAllocations, uploadCampaignFile,
  listRecommendations, listWorkflowBlockers,
} from "../../api.js";
import {
  color, radius, shadow, space, type, transition,
  button, input as inputStyle, fontFamily,
} from "./_tokens.js";
import { useToast } from "./Toast.jsx";
import { SkeletonBoard } from "./Skeleton.jsx";

// ─── Status definitions (lifecycle של תיקייה) ───────────────────────────────
const STATUS_DEFS = {
  draft:           { label: "טיוטה",         bg: "#cbd5e1", fg: "#1e293b" },
  in_progress:     { label: "בעבודה",        bg: "#fdba74", fg: "#7c2d12" },
  ready_to_launch: { label: "מוכן לעלייה",   bg: "#86efac", fg: "#14532d" },
  live:            { label: "באוויר",        bg: "#22c55e", fg: "#ffffff" },
  closing:         { label: "בסגירה",        bg: "#fbbf24", fg: "#78350f" },
  closed:          { label: "סגור",          bg: "#f87171", fg: "#7f1d1d" },
};
const ALL_STATUSES = Object.keys(STATUS_DEFS);

// ─── Priority pill (metadata.priority) ──────────────────────────────────────
const PRIORITY_DEFS = {
  low:      { label: "נמוכה",  bg: "#e0e7ff", fg: "#4338ca" },
  normal:   { label: "רגילה",  bg: "#dbeafe", fg: "#1e40af" },
  high:     { label: "גבוהה",  bg: "#fef3c7", fg: "#a16207" },
  critical: { label: "קריטית", bg: "#fee2e2", fg: "#b91c1c" },
};
const ALL_PRIORITIES = Object.keys(PRIORITY_DEFS);

// ─── Group definitions (auto-flow לפי סטטוס) ─────────────────────────────
const GROUPS = [
  { id: "planned",   label: "קמפיינים מתוכננים לעלייה", statuses: ["draft", "in_progress", "ready_to_launch"], strip: "#3b82f6" },
  { id: "live",      label: "קמפיינים באוויר",          statuses: ["live"],                                    strip: "#16a34a" },
  { id: "completed", label: "קמפיינים שהסתיימו",        statuses: ["closing", "closed"],                       strip: "#dc2626" },
];

// ─── Column definitions ─────────────────────────────────────────────────────
// section: לתיוג ויזואלי בעתיד. center: מרכז את התוכן בתא.
const COLUMNS = [
  // — General —
  { id: "task",        label: "שם הקמפיין",   width: 220, section: "כללי" },
  { id: "activity",    label: "פעילות",        width: 130, section: "כללי" },
  { id: "owner",       label: "בעלים",         width: 110, section: "כללי", center: true },
  { id: "status",      label: "סטטוס",         width: 140, section: "כללי", center: true },
  { id: "priority",    label: "עדיפות",        width: 110, section: "כללי", center: true },
  // — Timing —
  { id: "due",         label: "תאריך עלייה",   width: 130, section: "זמנים", center: true },
  { id: "reg_close",   label: "סגירת רישום",   width: 130, section: "זמנים", center: true },
  { id: "methodology", label: "methodology",   width: 170, section: "זמנים", center: true },
  // — Goals —
  { id: "budget",      label: "תקציב",         width: 100, section: "יעדים", center: true },
  { id: "target_leads",label: "לידים יעד",     width: 100, section: "יעדים", center: true },
  { id: "target_cpl",  label: "CPL יעד",       width: 100, section: "יעדים", center: true },
  // — Documents —
  { id: "media_plan",  label: "פריסת מדיה",    width: 130, section: "מסמכים", center: true },
  { id: "keywords",    label: "מחקר ביטויי",   width: 130, section: "מסמכים", center: true },
  { id: "brief",       label: "בריף",          width: 110, section: "מסמכים", center: true },
  // — Creative —
  { id: "concept",     label: "קונספט קריאייטיב", width: 130, section: "קריאייטיב", center: true },
  { id: "rendered",    label: "קריאייטיב מוכן",   width: 130, section: "קריאייטיב", center: true },
  // — Copy per platform —
  { id: "meta",        label: "מודעות Meta",   width: 120, section: "קופי", center: true },
  { id: "pmax",        label: "מודעות PMax",   width: 120, section: "קופי", center: true },
  { id: "tiktok",      label: "מודעות TikTok", width: 120, section: "קופי", center: true },
  { id: "lead_form",   label: "קופי טופס",     width: 110, section: "קופי", center: true },
  // — Operations —
  { id: "make",        label: "תרחישי MAKE",   width: 120, section: "אופרציה", center: true },
  { id: "recs",        label: "המלצות פתוחות", width: 120, section: "אופרציה", center: true },
  { id: "blockers",    label: "חוסמים פתוחים", width: 120, section: "אופרציה", center: true },
  // — Reference —
  { id: "fireberry",   label: "קורס Fireberry", width: 130, section: "הקשר", center: true },
  { id: "notes",       label: "הערות",          width: 200, section: "הקשר" },
  // — Open detail —
  { id: "actions",     label: "",               width: 50,  section: "",      center: true },
];

const ROW_TEMPLATE = COLUMNS.map(c => `${c.width}px`).join(" ");
const TOTAL_WIDTH  = COLUMNS.reduce((s, c) => s + c.width, 0) + 8 + 28;

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

function fmtNum(num) {
  if (num == null || num === 0 || num === "") return "";
  const n = Number(num);
  if (isNaN(n)) return "";
  return n.toLocaleString("he-IL");
}

function ownerInitial(name) {
  const t = String(name || "").trim();
  return t ? t.charAt(0).toUpperCase() : "?";
}

function addDays(iso, days) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  } catch { return null; }
}

// ─── Owner avatar ───────────────────────────────────────────────────────────
function OwnerAvatar({ name }) {
  const initial = ownerInitial(name);
  if (initial === "?") {
    return (
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        background: color.surfaceMuted, border: `1px dashed ${color.borderDefault}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: color.fgSubtle, fontSize: 12, fontFamily, flexShrink: 0,
      }}>?</div>
    );
  }
  const palette = ["#0369a1", "#16a34a", "#a16207", "#b91c1c", "#7c3aed", "#0891b2", "#be185d", "#475569"];
  const code = initial.charCodeAt(0);
  const bg = palette[code % palette.length];
  return (
    <div title={name} style={{
      width: 26, height: 26, borderRadius: "50%",
      background: bg, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700, fontFamily, flexShrink: 0,
    }}>{initial}</div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Inline cell editors
// ════════════════════════════════════════════════════════════════════════════

function InlineInput({
  value, type: inputType = "text", placeholder = "",
  formatter = (v) => v, prefix = "",
  onSave,
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value == null ? "" : String(value));
  const inputRef = useRef(null);

  useEffect(() => { setVal(value == null ? "" : String(value)); }, [value]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function commit() {
    setEditing(false);
    const original = value == null ? "" : String(value);
    if (val.trim() === original.trim()) return;
    await onSave(val.trim() === "" ? null : val.trim());
  }

  function cancel() {
    setVal(value == null ? "" : String(value));
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={inputType}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter")  { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", padding: "4px 6px",
          border: `2px solid ${color.primary}`, borderRadius: 4,
          fontSize: 12, fontFamily, background: "#fff",
          outline: "none", textAlign: inputType === "number" ? "center" : "right",
          direction: "rtl",
        }}
      />
    );
  }

  const display = value == null || value === "" ? "" : `${prefix}${formatter(value)}`;
  return (
    <div
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      title="לחיצה לעריכה"
      style={{
        cursor: "text",
        padding: "3px 6px",
        borderRadius: 4,
        minHeight: 24,
        width: "100%",
        textAlign: inputType === "number" ? "center" : "right",
        color: display ? color.fgDefault : color.fgSubtle,
        fontSize: 12, fontFamily, fontWeight: display ? 500 : 400,
        background: "transparent",
        transition: transition.fast,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {display || placeholder || <span style={{ color: "#cbd5e1" }}>+</span>}
    </div>
  );
}

function InlineDate({ value, onSave, placeholder = "+ תאריך" }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      try { inputRef.current.showPicker?.(); } catch { /* not all browsers */ }
    }
  }, [editing]);

  async function commit(newVal) {
    setEditing(false);
    if ((newVal || null) === (value || null)) return;
    await onSave(newVal || null);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        defaultValue={value || ""}
        onBlur={e => commit(e.target.value)}
        onChange={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
        }}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", padding: "4px 6px",
          border: `2px solid ${color.primary}`, borderRadius: 4,
          fontSize: 12, fontFamily, background: "#fff",
          outline: "none", textAlign: "center", direction: "rtl",
        }}
      />
    );
  }

  return (
    <div
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      title="לחיצה לעריכת תאריך"
      style={{
        cursor: "text", padding: "3px 6px", borderRadius: 4,
        minHeight: 24, width: "100%", textAlign: "center",
        color: value ? color.fgDefault : color.fgSubtle,
        fontSize: 12, fontFamily, fontWeight: value ? 500 : 400,
        transition: transition.fast,
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {value ? fmtDate(value) : <span style={{ color: "#cbd5e1" }}>{placeholder}</span>}
    </div>
  );
}

// Generic pill-with-dropdown (used for Status + Priority)
function PillPicker({ value, defs, onChange, allKeys, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const def = defs[value] || { label: value || "—", bg: "#e2e8f0", fg: "#475569" };

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref}
         style={{ position: "relative", display: "block", width: "100%" }}
         onClick={e => e.stopPropagation()}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        title="לחיצה לשינוי"
        style={{
          width: "100%",
          background: def.bg, color: def.fg, border: "none",
          padding: "6px 10px", borderRadius: 4,
          fontSize: 11, fontWeight: 700, fontFamily,
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "center", opacity: disabled ? 0.6 : 1,
          transition: transition.fast,
        }}
      >{def.label}</button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)",
          insetInlineStart: 0,
          background: color.surface,
          border: `1px solid ${color.borderDefault}`,
          borderRadius: radius.md, boxShadow: shadow.lg,
          zIndex: 30, padding: 4, minWidth: 130,
        }}>
          {allKeys.map(k => {
            const sd = defs[k];
            const active = k === value;
            return (
              <div key={k}
                   onClick={() => { onChange(k); setOpen(false); }}
                   style={{
                     padding: "4px 6px", cursor: "pointer", borderRadius: 4,
                     background: active ? color.surfaceMuted : "transparent",
                     transition: transition.fast,
                   }}
                   onMouseEnter={e => e.currentTarget.style.background = color.surfaceMuted}
                   onMouseLeave={e => e.currentTarget.style.background = active ? color.surfaceMuted : "transparent"}>
                <span style={{
                  background: sd.bg, color: sd.fg,
                  padding: "3px 10px", borderRadius: 4,
                  fontSize: 11, fontWeight: 700, fontFamily,
                  display: "block", textAlign: "center",
                }}>{sd.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// File-upload cell — shows count + paperclip
function InlineFileUpload({ files, busy, onUpload, accept }) {
  const inputRef = useRef(null);
  function pick(e) {
    e.stopPropagation();
    if (!busy) inputRef.current?.click();
  }
  function onChange(e) {
    const f = e.target.files?.[0];
    if (f) onUpload(f);
    e.target.value = "";
  }

  return (
    <div onClick={pick}
         title={files.length > 0 ? `${files.length} קבצים — להוספה נוספת` : "העלאת Excel/PDF/PPT/Word/תמונה"}
         style={{
           cursor: busy ? "wait" : "pointer",
           padding: "3px 6px", borderRadius: 4,
           minHeight: 24, width: "100%",
           display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
           transition: transition.fast,
         }}
         onMouseEnter={e => !busy && (e.currentTarget.style.background = "#f3f4f6")}
         onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <input ref={inputRef} type="file" accept={accept}
             onChange={onChange} onClick={e => e.stopPropagation()}
             style={{ display: "none" }} />
      {busy ? (
        <span style={{ fontSize: 11, color: color.fgMuted, fontFamily }}>מעלה...</span>
      ) : files.length > 0 ? (
        <span style={{
          background: "#dcfce7", color: "#166534",
          padding: "2px 8px", borderRadius: 999,
          fontSize: 11, fontWeight: 700, fontFamily,
          display: "inline-flex", alignItems: "center", gap: 3,
        }}>📎 {files.length}</span>
      ) : (
        <span style={{ color: "#cbd5e1", fontSize: 12, fontFamily }}>+ קובץ</span>
      )}
    </div>
  );
}

// Read-only artifact status
function ArtifactStatusCell({ stats }) {
  if (!stats || stats.total === 0) {
    return <span style={{ color: "#cbd5e1", fontSize: 12, fontFamily }}>—</span>;
  }
  if (stats.approved > 0) {
    return (
      <span title={`${stats.approved} מאושרים`} style={{
        background: "#dcfce7", color: "#166534",
        padding: "2px 8px", borderRadius: 999,
        fontSize: 11, fontWeight: 700, fontFamily,
      }}>✓{stats.approved > 1 ? ` ${stats.approved}` : ""}</span>
    );
  }
  if (stats.revision > 0) {
    return (
      <span title="דרוש תיקון" style={{
        background: "#fee2e2", color: "#b91c1c",
        padding: "2px 8px", borderRadius: 999,
        fontSize: 11, fontWeight: 700, fontFamily,
      }}>↻ תיקון</span>
    );
  }
  return (
    <span title="ממתין לאישור" style={{
      background: "#fef3c7", color: "#a16207",
      padding: "2px 8px", borderRadius: 999,
      fontSize: 11, fontWeight: 700, fontFamily,
    }}>⏳</span>
  );
}

// Methodology display: shows current state + planned switch
function MethodologyCell({ folder }) {
  const switchDate = folder.methodology_switch_date;
  const switchTo   = folder.methodology_switch_to;
  if (!switchDate || !switchTo) {
    return <span style={{ color: "#cbd5e1", fontSize: 12, fontFamily }}>—</span>;
  }
  const targetLabel = switchTo === "conversion" ? "Conversion" : "Clicks";
  return (
    <span style={{
      background: "#e0e7ff", color: "#4338ca",
      padding: "2px 8px", borderRadius: 4,
      fontSize: 11, fontWeight: 600, fontFamily,
      display: "inline-flex", alignItems: "center", gap: 4,
    }} title={`מעבר ל-${targetLabel} בתאריך ${fmtDate(switchDate)}`}>
      🎯 {fmtDate(switchDate)} → {targetLabel}
    </span>
  );
}

// Count cell (for recommendations / blockers)
function CountCell({ count, color: tone = "warning", title }) {
  if (!count || count === 0) {
    return <span style={{ color: "#cbd5e1", fontSize: 12, fontFamily }}>—</span>;
  }
  const tones = {
    warning: { bg: "#fef3c7", fg: "#a16207" },
    danger:  { bg: "#fee2e2", fg: "#b91c1c" },
    info:    { bg: "#dbeafe", fg: "#1e40af" },
  };
  const t = tones[tone] || tones.warning;
  return (
    <span title={title || `${count}`} style={{
      background: t.bg, color: t.fg,
      padding: "2px 9px", borderRadius: 999,
      fontSize: 11, fontWeight: 700, fontFamily,
    }}>{count}</span>
  );
}

// Fireberry course link cell (read-only display)
function FireberryCell({ courseId }) {
  if (!courseId) {
    return <span style={{ color: "#cbd5e1", fontSize: 12, fontFamily }}>—</span>;
  }
  const display = String(courseId).length > 8
    ? `${String(courseId).slice(0, 8)}…`
    : String(courseId);
  return (
    <span title={`Fireberry: ${courseId}`} style={{
      background: "#fff7ed", color: "#9a3412",
      padding: "2px 8px", borderRadius: 4,
      fontSize: 11, fontWeight: 700, fontFamily,
    }}>🔥 {display}</span>
  );
}

// ─── Data summarizers ──────────────────────────────────────────────────────
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

function countPendingRecs(recs, folderId) {
  return recs.filter(r => r.folder_id === folderId && r.decision_status === "pending").length;
}

function countOpenBlockers(blockers, folderId) {
  return blockers.filter(b => {
    const meta = b.metadata || {};
    return (b.folder_id === folderId || meta.folder_id === folderId)
        && (b.status === "open" || !b.status);
  }).length;
}

function budgetForFolder(allocations, folderId, metadataBudget) {
  // Prefer metadata.budget_ils (manager-set), fall back to allocations sum
  if (metadataBudget != null && metadataBudget !== "") return Number(metadataBudget);
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
  const [recommendations, setRecs]    = useState([]);
  const [blockers, setBlockers]       = useState([]);
  const [filesByFolder, setFilesByFolder] = useState({});
  const [uploadBusy, setUploadBusy] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [query, setQuery]       = useState("");
  const [collapsed, setCollapsed] = useState({});

  async function refresh() {
    setLoading(true); setError(null);
    try {
      const [f, a, b, r, bl] = await Promise.all([
        listCampaignFolders(),
        listArtifacts({ limit: 500 }).catch(() => []),
        listBudgetAllocations().catch(() => []),
        listRecommendations({ limit: 200 }).catch(() => []),
        listWorkflowBlockers({ onlyOpen: true }).catch(() => []),
      ]);
      setFolders(Array.isArray(f) ? f : []);
      setArtifacts(Array.isArray(a) ? a : []);
      setAllocations(Array.isArray(b) ? b : []);
      setRecs(Array.isArray(r) ? r : []);
      setBlockers(Array.isArray(bl) ? bl : []);
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
    } catch (e) {
      toast.error(`שגיאה ביצירת קמפיין: ${e.message}`);
    } finally {
      setCreating(false);
    }
  }

  async function patchFolder(folder, patch) {
    try {
      const body = { ...patch };
      if (patch.metadata) {
        body.metadata = { ...(folder.metadata || {}), ...patch.metadata };
      }
      await updateCampaignFolder(folder.id, body);
      setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, ...body } : f));
    } catch (e) {
      toast.error(`שגיאה בשמירה: ${e.message}`);
      await refresh();
    }
  }

  async function uploadFile(folder, purpose, file) {
    const key = `${folder.id}-${purpose}`;
    setUploadBusy(b => ({ ...b, [key]: true }));
    try {
      const res = await uploadCampaignFile(file, { folderId: folder.id, purpose });
      toast.success(`✓ הועלה: ${res.name || file.name}`);
      setFilesByFolder(prev => {
        const folderFiles = prev[folder.id] || {};
        const purposeFiles = folderFiles[purpose] || [];
        return {
          ...prev,
          [folder.id]: {
            ...folderFiles,
            [purpose]: [...purposeFiles, res],
          },
        };
      });
    } catch (e) {
      toast.error(`שגיאה בהעלאה: ${e.message}`);
    } finally {
      setUploadBusy(b => { const next = { ...b }; delete next[key]; return next; });
    }
  }

  function toggleGroup(groupId) {
    setCollapsed(c => ({ ...c, [groupId]: !c[groupId] }));
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? folders.filter(f =>
        (f.course_name || "").toLowerCase().includes(q) ||
        (f.activity_label || "").toLowerCase().includes(q) ||
        (f.created_by || "").toLowerCase().includes(q)
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
              placeholder="חיפוש לפי שם / פעילות / בעלים..."
              style={{ ...inputStyle, paddingInlineStart: space(7), minWidth: 240 }}
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
          <div style={{ ...type.caption, color: color.fgSubtle, marginTop: space(2) }}>
            רק שם הקמפיין נדרש כדי להתחיל. כל שאר העמודות (תאריך, תקציב, מסמכים, יעדים...) ניתנים לעריכה ישירות בלוח אחרי שיצרת.
          </div>
        </div>
      )}

      {error && (
        <div style={{
          padding: space(3), background: color.dangerSoftBg, color: color.dangerSoftFg,
          borderRadius: radius.md, marginBottom: space(3), ...type.bodySmall,
        }}>שגיאה: {error}</div>
      )}

      {loading && <SkeletonBoard />}

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

      {!loading && filtered.length > 0 && (
        <div style={{
          background: color.surface, borderRadius: radius.lg,
          border: `1px solid ${color.borderDefault}`, boxShadow: shadow.sm,
          overflow: "hidden",
        }}>
          {/* Hint about horizontal scroll */}
          <div style={{
            padding: `${space(2)} ${space(3)}`,
            background: "#fffbeb", borderBottom: `1px solid #fef3c7`,
            ...type.caption, color: "#92400e", fontFamily,
          }}>
            ↔ הלוח רחב — גוללי הצידה כדי לראות את כל העמודות (יעדים, מסמכים, קופי, אופרציה ועוד)
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: TOTAL_WIDTH }}>
              {groupedFolders.map(group => (
                <Group key={group.id}
                       group={group}
                       folders={group.folders}
                       collapsed={!!collapsed[group.id]}
                       onToggle={() => toggleGroup(group.id)}
                       artifacts={artifacts}
                       allocations={allocations}
                       recommendations={recommendations}
                       blockers={blockers}
                       filesByFolder={filesByFolder}
                       uploadBusy={uploadBusy}
                       onPatchFolder={patchFolder}
                       onUploadFile={uploadFile}
                       onOpenFolder={onSelectFolder}
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
// Group section
// ════════════════════════════════════════════════════════════════════════════
function Group({ group, folders, collapsed, onToggle, artifacts, allocations,
                 recommendations, blockers, filesByFolder, uploadBusy,
                 onPatchFolder, onUploadFile, onOpenFolder, onAddCampaign }) {
  const statusCounts = {};
  for (const f of folders) statusCounts[f.status] = (statusCounts[f.status] || 0) + 1;

  return (
    <div style={{ borderBottom: `1px solid ${color.borderDefault}` }}>
      {/* Group header */}
      <div onClick={onToggle}
           style={{
             display: "flex", alignItems: "center", gap: space(2),
             padding: `${space(2.5)} ${space(3)}`,
             cursor: "pointer", background: color.surface,
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
          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: `8px 28px ${ROW_TEMPLATE}`,
            background: color.surfaceMuted,
            borderTop: `1px solid ${color.borderSubtle}`,
            borderBottom: `1px solid ${color.borderSubtle}`,
          }}>
            <div /> <div />
            {COLUMNS.map(c => (
              <div key={c.id} title={c.section} style={{
                padding: `${space(2)} ${space(2)}`,
                ...type.caption, color: color.fgSubtle,
                fontWeight: 700, letterSpacing: 0.3,
                textAlign: c.center ? "center" : "right",
                borderInlineEnd: `1px solid ${color.borderSubtle}`,
                fontFamily, textTransform: "uppercase",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{c.label}</div>
            ))}
          </div>

          {/* Empty state */}
          {folders.length === 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `8px 1fr` }}>
              <div style={{ background: group.strip, opacity: 0.7 }} />
              <div style={{
                padding: space(4), textAlign: "center",
                color: color.fgSubtle, ...type.bodySmall, fontFamily,
              }}>
                {group.id === "planned"
                  ? "אין קמפיינים בתכנון. הוסיפי חדש למטה."
                  : group.id === "live"
                    ? "אין קמפיינים פעילים כרגע. קמפיין יזרום לכאן ברגע שתעדכני אותו לסטטוס \"באוויר\"."
                    : "אין קמפיינים שהסתיימו עדיין. קמפיין יזרום לכאן ברגע שתעדכני אותו ל\"בסגירה\" או \"סגור\"."}
              </div>
            </div>
          )}

          {/* Rows */}
          {folders.map(f => (
            <Row key={f.id}
                 folder={f}
                 group={group}
                 artifactsByType={summarizeArtifacts(artifacts, f.id)}
                 budgetIls={budgetForFolder(allocations, f.id, f.metadata?.budget_ils)}
                 pendingRecs={countPendingRecs(recommendations, f.id)}
                 openBlockers={countOpenBlockers(blockers, f.id)}
                 mediaPlanFiles={(filesByFolder[f.id] || {}).media_plan || []}
                 keywordFiles={(filesByFolder[f.id] || {}).keyword_research || []}
                 briefFiles={(filesByFolder[f.id] || {}).brief || []}
                 mediaPlanBusy={!!uploadBusy[`${f.id}-media_plan`]}
                 keywordBusy={!!uploadBusy[`${f.id}-keyword_research`]}
                 briefBusy={!!uploadBusy[`${f.id}-brief`]}
                 onPatch={(patch) => onPatchFolder(f, patch)}
                 onUploadMediaPlan={(file) => onUploadFile(f, "media_plan", file)}
                 onUploadKeywords={(file) => onUploadFile(f, "keyword_research", file)}
                 onUploadBrief={(file) => onUploadFile(f, "brief", file)}
                 onOpen={() => onOpenFolder && onOpenFolder(f.id)} />
          ))}

          {/* + Add campaign — only in planned (auto-flow for others) */}
          {group.id === "planned" && (
            <div onClick={onAddCampaign}
                 style={{
                   display: "grid",
                   gridTemplateColumns: `8px 1fr`,
                   cursor: "pointer",
                   borderTop: `1px dashed ${color.borderSubtle}`,
                   background: color.surface,
                   transition: transition.fast,
                 }}
                 onMouseEnter={e => e.currentTarget.style.background = color.surfaceMuted}
                 onMouseLeave={e => e.currentTarget.style.background = color.surface}>
              <div style={{ background: group.strip, opacity: 0.4 }} />
              <span style={{
                padding: `${space(2)} ${space(3)}`,
                color: color.fgSubtle, ...type.bodySmall,
                fontWeight: 600, fontFamily,
              }}>➕ הוסיפי קמפיין</span>
            </div>
          )}

          {/* Auto-flow hint for live/completed */}
          {group.id !== "planned" && folders.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `8px 1fr`,
                          background: color.surface,
                          borderTop: `1px dashed ${color.borderSubtle}` }}>
              <div style={{ background: group.strip, opacity: 0.4 }} />
              <span style={{
                padding: `${space(2)} ${space(3)}`,
                color: color.fgSubtle, ...type.caption, fontFamily,
                fontStyle: "italic",
              }}>
                ⚙ אוטומציה — קמפיינים נכנסים לכאן אוטומטית לפי שינוי סטטוס בלוח "מתוכננים".
              </span>
            </div>
          )}

          {/* Status distribution mini-bar */}
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
                padding: `${space(2)} ${space(3)}`, flexWrap: "wrap",
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
// Row — one campaign with all 25+ columns inline-editable
// ════════════════════════════════════════════════════════════════════════════
function Row({ folder, group, artifactsByType, budgetIls, pendingRecs, openBlockers,
                mediaPlanFiles, keywordFiles, briefFiles,
                mediaPlanBusy, keywordBusy, briefBusy,
                onPatch, onUploadMediaPlan, onUploadKeywords, onUploadBrief, onOpen }) {
  const meta = folder.metadata || {};
  const ACCEPT = ".xlsx,.xls,.csv,.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif";

  // Auto registration close = go-live + 14 days, unless overridden
  const autoRegClose = addDays(folder.planned_go_live_date, 14);
  const regCloseValue = meta.registration_close_date || autoRegClose;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `8px 28px ${ROW_TEMPLATE}`,
      background: color.surface,
      borderTop: `1px solid ${color.borderSubtle}`,
    }}>
      <div style={{ background: group.strip, opacity: 0.85 }} />
      <Cell center>
        <input type="checkbox" disabled
               onClick={e => e.stopPropagation()}
               style={{ width: 14, height: 14, cursor: "not-allowed", opacity: 0.5 }} />
      </Cell>

      {/* — General — */}
      <Cell>
        <InlineInput
          value={folder.course_name}
          placeholder="שם הקמפיין"
          onSave={v => onPatch({ course_name: v })}
        />
      </Cell>
      <Cell>
        <InlineInput
          value={folder.activity_label}
          placeholder="+ פעילות"
          onSave={v => onPatch({ activity_label: v })}
        />
      </Cell>
      <Cell center>
        <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
          <OwnerAvatar name={folder.created_by} />
          <InlineInput
            value={folder.created_by}
            placeholder="+ בעלים"
            onSave={v => onPatch({ created_by: v })}
          />
        </div>
      </Cell>
      <Cell center>
        <PillPicker
          value={folder.status}
          defs={STATUS_DEFS}
          allKeys={ALL_STATUSES}
          onChange={s => onPatch({ status: s })}
        />
      </Cell>
      <Cell center>
        <PillPicker
          value={meta.priority || "normal"}
          defs={PRIORITY_DEFS}
          allKeys={ALL_PRIORITIES}
          onChange={p => onPatch({ metadata: { priority: p } })}
        />
      </Cell>

      {/* — Timing — */}
      <Cell center>
        <InlineDate
          value={folder.planned_go_live_date}
          onSave={v => onPatch({ planned_go_live_date: v })}
          placeholder="+ עלייה"
        />
      </Cell>
      <Cell center>
        <InlineDate
          value={regCloseValue}
          onSave={v => onPatch({ metadata: { registration_close_date: v } })}
          placeholder={autoRegClose ? `אוטומטי: ${fmtDate(autoRegClose)}` : "+ סגירה"}
        />
      </Cell>
      <Cell center>
        <MethodologyCell folder={folder} />
      </Cell>

      {/* — Goals — */}
      <Cell center>
        <InlineInput
          value={budgetIls}
          inputType="number"
          formatter={v => fmtMoney(v)}
          onSave={v => onPatch({ metadata: { budget_ils: v == null ? null : Number(v) } })}
        />
      </Cell>
      <Cell center>
        <InlineInput
          value={meta.target_leads}
          inputType="number"
          formatter={v => fmtNum(v)}
          onSave={v => onPatch({ metadata: { target_leads: v == null ? null : Number(v) } })}
        />
      </Cell>
      <Cell center>
        <InlineInput
          value={meta.target_cpl}
          inputType="number"
          formatter={v => fmtMoney(v)}
          onSave={v => onPatch({ metadata: { target_cpl: v == null ? null : Number(v) } })}
        />
      </Cell>

      {/* — Documents — */}
      <Cell center>
        <InlineFileUpload
          files={mediaPlanFiles}
          busy={mediaPlanBusy}
          accept={ACCEPT}
          onUpload={onUploadMediaPlan}
        />
      </Cell>
      <Cell center>
        <InlineFileUpload
          files={keywordFiles}
          busy={keywordBusy}
          accept={ACCEPT}
          onUpload={onUploadKeywords}
        />
      </Cell>
      <Cell center>
        <InlineFileUpload
          files={briefFiles}
          busy={briefBusy}
          accept={ACCEPT}
          onUpload={onUploadBrief}
        />
      </Cell>

      {/* — Creative — */}
      <Cell center><ArtifactStatusCell stats={artifactsByType.creative_concept   || null} /></Cell>
      <Cell center><ArtifactStatusCell stats={artifactsByType.creative_rendered  || null} /></Cell>

      {/* — Copy — */}
      <Cell center><ArtifactStatusCell stats={artifactsByType.ad_copy_meta    || null} /></Cell>
      <Cell center><ArtifactStatusCell stats={artifactsByType.ad_copy_google  || null} /></Cell>
      <Cell center><ArtifactStatusCell stats={artifactsByType.ad_copy_tiktok  || null} /></Cell>
      <Cell center><ArtifactStatusCell stats={artifactsByType.lead_form_copy  || null} /></Cell>

      {/* — Operations — */}
      <Cell center><ArtifactStatusCell stats={artifactsByType.make_scenario || null} /></Cell>
      <Cell center>
        <CountCell
          count={pendingRecs}
          color="warning"
          title={`${pendingRecs} המלצות ממתינות`} />
      </Cell>
      <Cell center>
        <CountCell
          count={openBlockers}
          color="danger"
          title={`${openBlockers} חוסמים פתוחים`} />
      </Cell>

      {/* — Reference — */}
      <Cell center><FireberryCell courseId={folder.fireberry_course_id} /></Cell>
      <Cell>
        <InlineInput
          value={meta.notes}
          placeholder="+ הערה"
          onSave={v => onPatch({ metadata: { notes: v } })}
        />
      </Cell>

      {/* Open detail */}
      <Cell center>
        <button
          onClick={e => { e.stopPropagation(); onOpen && onOpen(); }}
          title="פתחי תצוגת פירוט מלאה"
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: color.primary, fontSize: 22, fontWeight: 700,
            padding: "2px 8px", borderRadius: 4, lineHeight: 1,
          }}
          onMouseEnter={e => e.currentTarget.style.background = color.surfaceMuted}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >›</button>
      </Cell>
    </div>
  );
}

function Cell({ children, center }) {
  return (
    <div style={{
      padding: `${space(1)} ${space(1.5)}`,
      borderInlineEnd: `1px solid ${color.borderSubtle}`,
      display: "flex", alignItems: "center",
      justifyContent: center ? "center" : "flex-start",
      overflow: "hidden", minHeight: 50,
    }}>{children}</div>
  );
}

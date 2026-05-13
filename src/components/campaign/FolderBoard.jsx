/**
 * FolderBoard.jsx — Monday-style board for campaign folders.
 *
 * Inline-edit philosophy (כמו ב-monday): כשרוצים לשנות ערך בעמודה — פשוט
 * כותבים בתוך התא. אין ניווט החוצה לעמוד פנימי כדי לערוך משהו פשוט.
 *
 * 3 קבוצות מתקפלות (מתוכננים / באוויר / הסתיימו) עם פס צבע, וכל שורה
 * = קמפיין יחיד עם עמודות גמישות:
 *   שם הקמפיין   — text inline edit
 *   בעלים         — text inline edit (avatar)
 *   סטטוס         — clickable pill (dropdown לבחירה)
 *   תאריך עלייה   — date picker inline
 *   תקציב         — number inline (₪) — נשמר ב-folder.metadata.budget_ils
 *   פריסת מדיה    — Excel/PDF upload inline (purpose=media_plan)
 *   מחקר ביטויי   — Excel/PDF upload inline (purpose=keyword_research)
 *   מודעות Meta   — סטטוס מאגר ad_copy_meta (קריאה בלבד; נוצר ע"י סוכן הקופי)
 *   מודעות PMax   — סטטוס מאגר ad_copy_google
 *   ›             — פתיחת תצוגת פירוט (היחיד שמנווט)
 */
import React, { useState, useEffect, useRef } from "react";
import {
  listCampaignFolders, createCampaignFolder, updateCampaignFolder,
  listArtifacts, listBudgetAllocations, uploadCampaignFile,
} from "../../api.js";
import {
  color, radius, shadow, space, type, transition,
  button, input as inputStyle, fontFamily,
} from "./_tokens.js";
import { useToast } from "./Toast.jsx";
import { SkeletonBoard } from "./Skeleton.jsx";

// ─── Status definitions ─────────────────────────────────────────────────────
const STATUS_DEFS = {
  draft:           { label: "טיוטה",         bg: "#cbd5e1", fg: "#1e293b" },
  in_progress:     { label: "בעבודה",        bg: "#fdba74", fg: "#7c2d12" },
  ready_to_launch: { label: "מוכן לעלייה",   bg: "#86efac", fg: "#14532d" },
  live:            { label: "באוויר",        bg: "#22c55e", fg: "#ffffff" },
  closing:         { label: "בסגירה",        bg: "#fbbf24", fg: "#78350f" },
  closed:          { label: "סגור",          bg: "#f87171", fg: "#7f1d1d" },
};
const ALL_STATUSES = Object.keys(STATUS_DEFS);

// ─── Group definitions ──────────────────────────────────────────────────────
const GROUPS = [
  { id: "planned",   label: "קמפיינים מתוכננים לעלייה", statuses: ["draft", "in_progress", "ready_to_launch"], strip: "#3b82f6" },
  { id: "live",      label: "קמפיינים באוויר",          statuses: ["live"],                                    strip: "#16a34a" },
  { id: "completed", label: "קמפיינים שהסתיימו",        statuses: ["closing", "closed"],                       strip: "#dc2626" },
];

// ─── Column definitions (data + width) ──────────────────────────────────────
const COLUMNS = [
  { id: "task",        label: "שם הקמפיין",    width: 260 },
  { id: "owner",       label: "בעלים",          width: 100, center: true },
  { id: "status",      label: "סטטוס",          width: 140, center: true },
  { id: "due",         label: "תאריך עלייה",    width: 130, center: true },
  { id: "budget",      label: "תקציב",          width: 110, center: true },
  { id: "media_plan",  label: "פריסת מדיה",     width: 130, center: true },
  { id: "keywords",    label: "מחקר ביטויי",    width: 130, center: true },
  { id: "meta",        label: "מודעות Meta",    width: 120, center: true },
  { id: "pmax",        label: "מודעות PMax",    width: 120, center: true },
  { id: "actions",     label: "",               width: 50,  center: true },
];

const ROW_TEMPLATE = COLUMNS.map(c => `${c.width}px`).join(" ");
const TOTAL_WIDTH  = COLUMNS.reduce((s, c) => s + c.width, 0) + 8 + 28;

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" }); }
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

function ownerInitial(name) {
  const t = String(name || "").trim();
  return t ? t.charAt(0).toUpperCase() : "?";
}

// ─── Owner avatar ───────────────────────────────────────────────────────────
function OwnerAvatar({ name }) {
  const initial = ownerInitial(name);
  if (initial === "?") {
    return (
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: color.surfaceMuted, border: `1px dashed ${color.borderDefault}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: color.fgSubtle, fontSize: 13, fontFamily,
      }}>?</div>
    );
  }
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

// ════════════════════════════════════════════════════════════════════════════
// Inline cell editors
// ════════════════════════════════════════════════════════════════════════════

// Generic inline-edit text/number cell
function InlineInput({
  value, type: inputType = "text", placeholder = "", suffix = "",
  formatter = (v) => v,
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
          width: "100%", padding: "4px 8px",
          border: `2px solid ${color.primary}`, borderRadius: 4,
          fontSize: 13, fontFamily, background: "#fff",
          outline: "none", textAlign: inputType === "number" ? "center" : "right",
          direction: "rtl",
        }}
      />
    );
  }

  const display = value == null || value === "" ? "" : formatter(value);
  return (
    <div
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      title="לחיצה לעריכה"
      style={{
        cursor: "text",
        padding: "4px 8px",
        borderRadius: 4,
        minHeight: 26,
        width: "100%",
        textAlign: inputType === "number" ? "center" : "right",
        color: display ? color.fgDefault : color.fgSubtle,
        fontSize: 13, fontFamily, fontWeight: display ? 500 : 400,
        background: "transparent",
        transition: transition.fast,
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {display ? `${display}${suffix}` : (placeholder || <span style={{ color: "#cbd5e1" }}>+ הוסיפי</span>)}
    </div>
  );
}

// Date cell — opens native date picker
function InlineDate({ value, onSave }) {
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
          width: "100%", padding: "4px 8px",
          border: `2px solid ${color.primary}`, borderRadius: 4,
          fontSize: 13, fontFamily, background: "#fff",
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
        cursor: "text", padding: "4px 8px", borderRadius: 4,
        minHeight: 26, width: "100%", textAlign: "center",
        color: value ? color.fgDefault : color.fgSubtle,
        fontSize: 13, fontFamily, fontWeight: value ? 500 : 400,
        transition: transition.fast,
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {value ? fmtDate(value) : <span style={{ color: "#cbd5e1" }}>+ תאריך</span>}
    </div>
  );
}

// Status pill with dropdown
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
         style={{ position: "relative", display: "block", width: "100%" }}
         onClick={e => e.stopPropagation()}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        title="לחיצה לשינוי סטטוס"
        style={{
          width: "100%",
          background: def.bg, color: def.fg, border: "none",
          padding: "8px 14px", borderRadius: 4,
          fontSize: 12, fontWeight: 700, fontFamily,
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
          zIndex: 30, padding: 4, minWidth: 150,
        }}>
          {ALL_STATUSES.map(s => {
            const sd = STATUS_DEFS[s];
            const active = s === value;
            return (
              <div key={s}
                   onClick={() => { onChange(s); setOpen(false); }}
                   style={{
                     padding: "5px 6px", cursor: "pointer", borderRadius: 4,
                     background: active ? color.surfaceMuted : "transparent",
                     transition: transition.fast,
                   }}
                   onMouseEnter={e => e.currentTarget.style.background = color.surfaceMuted}
                   onMouseLeave={e => e.currentTarget.style.background = active ? color.surfaceMuted : "transparent"}>
                <span style={{
                  background: sd.bg, color: sd.fg,
                  padding: "4px 10px", borderRadius: 4,
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

// File-upload cell
function InlineFileUpload({ files, busy, onUpload, accept }) {
  const inputRef = useRef(null);
  function pick(e) {
    e.stopPropagation();
    inputRef.current?.click();
  }
  function onChange(e) {
    const f = e.target.files?.[0];
    if (f) onUpload(f);
    e.target.value = "";
  }

  return (
    <div onClick={pick}
         title={files.length > 0 ? `${files.length} קבצים — לחיצה להוספת קובץ נוסף` : "העלאת Excel/PDF"}
         style={{
           cursor: busy ? "wait" : "pointer",
           padding: "4px 8px", borderRadius: 4,
           minHeight: 26, width: "100%",
           display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
           transition: transition.fast,
         }}
         onMouseEnter={e => !busy && (e.currentTarget.style.background = "#f3f4f6")}
         onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <input ref={inputRef} type="file" accept={accept}
             onChange={onChange} onClick={e => e.stopPropagation()}
             style={{ display: "none" }} />
      {busy ? (
        <span style={{ fontSize: 12, color: color.fgMuted, fontFamily }}>מעלה...</span>
      ) : files.length > 0 ? (
        <span style={{
          background: "#dcfce7", color: "#166534",
          padding: "3px 9px", borderRadius: 999,
          fontSize: 11, fontWeight: 700, fontFamily,
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>📎 {files.length}</span>
      ) : (
        <span style={{ color: "#cbd5e1", fontSize: 13, fontFamily }}>+ קובץ</span>
      )}
    </div>
  );
}

// Read-only artifact status pill (for Meta / PMax)
function ArtifactStatusCell({ stats }) {
  if (!stats || stats.total === 0) {
    return <span style={{ color: "#cbd5e1", fontSize: 13, fontFamily }}>—</span>;
  }
  if (stats.approved > 0) {
    return (
      <span title={`${stats.approved} מאושרים`} style={{
        background: "#dcfce7", color: "#166534",
        padding: "3px 9px", borderRadius: 999,
        fontSize: 11, fontWeight: 700, fontFamily,
      }}>✓ אושר{stats.approved > 1 ? ` (${stats.approved})` : ""}</span>
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

// ════════════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════════════
export default function FolderBoard({ onSelectFolder, refreshKey = 0 }) {
  const toast = useToast();
  const [folders, setFolders]         = useState([]);
  const [artifacts, setArtifacts]     = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [filesByFolder, setFilesByFolder] = useState({}); // {folderId: {purpose: [files]}}
  const [uploadBusy, setUploadBusy] = useState({}); // {folderId-purpose: bool}
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
    } catch (e) {
      toast.error(`שגיאה ביצירת קמפיין: ${e.message}`);
    } finally {
      setCreating(false);
    }
  }

  // Generic patch — handles regular fields + merges metadata correctly
  async function patchFolder(folder, patch) {
    try {
      const body = { ...patch };
      if (patch.metadata) {
        body.metadata = { ...(folder.metadata || {}), ...patch.metadata };
      }
      await updateCampaignFolder(folder.id, body);
      // Optimistic local update so user sees instant feedback
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
      // Track locally
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
          <div style={{ ...type.caption, color: color.fgSubtle, marginTop: space(2) }}>
            רק שם הקמפיין נדרש כדי להתחיל. כל שאר השדות (תאריך, תקציב, פריסת מדיה...) ניתנים לעריכה ישירות בלוח אחרי שיצרת.
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

      {/* ─── Monday-style table ─────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div style={{
          background: color.surface, borderRadius: radius.lg,
          border: `1px solid ${color.borderDefault}`, boxShadow: shadow.sm,
          overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: TOTAL_WIDTH }}>
              {groupedFolders.map(group => (
                <Group key={group.id}
                       group={group}
                       folders={group.folders}
                       collapsed={!!collapsed[group.id]}
                       onToggle={() => toggleGroup(group.id)}
                       artifacts={artifacts}
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
function Group({ group, folders, collapsed, onToggle, artifacts, filesByFolder,
                 uploadBusy, onPatchFolder, onUploadFile, onOpenFolder, onAddCampaign }) {
  const statusCounts = {};
  for (const f of folders) statusCounts[f.status] = (statusCounts[f.status] || 0) + 1;

  return (
    <div style={{ borderBottom: `1px solid ${color.borderDefault}` }}>
      {/* Group header (collapsible) */}
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

          {/* Empty state for group */}
          {folders.length === 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `8px 1fr` }}>
              <div style={{ background: group.strip, opacity: 0.7 }} />
              <div style={{
                padding: space(4), textAlign: "center",
                color: color.fgSubtle, ...type.bodySmall, fontFamily,
              }}>אין קמפיינים בקטגוריה זו עדיין</div>
            </div>
          )}

          {/* Rows */}
          {folders.map(f => (
            <Row key={f.id}
                 folder={f}
                 group={group}
                 artifactsByType={summarizeArtifacts(artifacts, f.id)}
                 mediaPlanFiles={(filesByFolder[f.id] || {}).media_plan || []}
                 keywordFiles={(filesByFolder[f.id] || {}).keyword_research || []}
                 mediaPlanBusy={!!uploadBusy[`${f.id}-media_plan`]}
                 keywordBusy={!!uploadBusy[`${f.id}-keyword_research`]}
                 onPatch={(patch) => onPatchFolder(f, patch)}
                 onUploadMediaPlan={(file) => onUploadFile(f, "media_plan", file)}
                 onUploadKeywords={(file) => onUploadFile(f, "keyword_research", file)}
                 onOpen={() => onOpenFolder && onOpenFolder(f.id)} />
          ))}

          {/* + Add campaign row */}
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

          {/* Footer: status distribution mini-bar */}
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
// Row (one campaign) — every cell is editable inline
// ════════════════════════════════════════════════════════════════════════════
function Row({ folder, group, artifactsByType,
                mediaPlanFiles, keywordFiles, mediaPlanBusy, keywordBusy,
                onPatch, onUploadMediaPlan, onUploadKeywords, onOpen }) {
  const metaStats  = artifactsByType.ad_copy_meta   || null;
  const pmaxStats  = artifactsByType.ad_copy_google || null;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `8px 28px ${ROW_TEMPLATE}`,
      background: color.surface,
      borderTop: `1px solid ${color.borderSubtle}`,
    }}>
      {/* Color strip */}
      <div style={{ background: group.strip, opacity: 0.85 }} />
      {/* Checkbox spacer */}
      <Cell center>
        <input type="checkbox" disabled
               onClick={e => e.stopPropagation()}
               style={{ width: 14, height: 14, cursor: "not-allowed", opacity: 0.5 }} />
      </Cell>

      {/* Task: name (editable) + activity_label (editable) */}
      <Cell>
        <div style={{ width: "100%" }}>
          <InlineInput
            value={folder.course_name}
            placeholder="שם הקמפיין"
            onSave={v => onPatch({ course_name: v })}
          />
          <InlineInput
            value={folder.activity_label}
            placeholder="+ הוסיפי תווית"
            onSave={v => onPatch({ activity_label: v })}
          />
        </div>
      </Cell>

      {/* Owner (editable text + avatar) */}
      <Cell center>
        <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
          <OwnerAvatar name={folder.created_by} />
          <InlineInput
            value={folder.created_by}
            placeholder=""
            onSave={v => onPatch({ created_by: v })}
          />
        </div>
      </Cell>

      {/* Status (clickable pill) */}
      <Cell center>
        <StatusPicker
          value={folder.status}
          onChange={s => onPatch({ status: s })}
        />
      </Cell>

      {/* Due date (date picker) */}
      <Cell center>
        <InlineDate
          value={folder.planned_go_live_date}
          onSave={v => onPatch({ planned_go_live_date: v })}
        />
      </Cell>

      {/* Budget (number, stored in metadata.budget_ils) */}
      <Cell center>
        <InlineInput
          value={folder.metadata?.budget_ils}
          inputType="number"
          placeholder=""
          formatter={v => fmtMoney(v)}
          onSave={v => onPatch({ metadata: { budget_ils: v == null ? null : Number(v) } })}
        />
      </Cell>

      {/* Media plan (file upload) */}
      <Cell center>
        <InlineFileUpload
          files={mediaPlanFiles}
          busy={mediaPlanBusy}
          accept=".xlsx,.xls,.csv,.pdf,.docx"
          onUpload={onUploadMediaPlan}
        />
      </Cell>

      {/* Keyword research (file upload) */}
      <Cell center>
        <InlineFileUpload
          files={keywordFiles}
          busy={keywordBusy}
          accept=".xlsx,.xls,.csv,.pdf,.docx"
          onUpload={onUploadKeywords}
        />
      </Cell>

      {/* Meta ads status (read-only — derived from artifacts) */}
      <Cell center><ArtifactStatusCell stats={metaStats} /></Cell>

      {/* PMax ads status (read-only) */}
      <Cell center><ArtifactStatusCell stats={pmaxStats} /></Cell>

      {/* Open detail (the ONLY thing that navigates) */}
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

// Cell wrapper
function Cell({ children, center }) {
  return (
    <div style={{
      padding: `${space(1.5)} ${space(2)}`,
      borderInlineEnd: `1px solid ${color.borderSubtle}`,
      display: "flex", alignItems: "center",
      justifyContent: center ? "center" : "flex-start",
      overflow: "hidden", minHeight: 56,
    }}>{children}</div>
  );
}

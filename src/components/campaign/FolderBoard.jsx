/**
 * FolderBoard.jsx — לוח קמפיינים בסגנון Monday/Slack (ספק 03 §3).
 *
 * עיקרון: יחסי לקוח ↔ משרד פרסום. לולאת הערות:
 *   מחלקה מכינה  →  ⏳ ממתין לאישור
 *   מנהלת מוסיפה הערות (textarea) →  💬 יש הערות (revision_required)
 *   מחלקה מתקנת → גרסה חדשה לצד הקודמת → ⚠️ גרסה N
 *   לולאה עד  →  ✓ אושר
 *
 * הכל אינליין — אין ניווט החוצה כדי לשנות תא. רק "›" פותח פירוט מלא.
 *
 * ארכיטקטורה (ספק 01 §5):
 *   - בקשה לתקציבאית → POST /api/workflow/requests עם intent='change' →
 *     account_manager_agent מסווג → workflow_controller פותח workflow_item →
 *     traffic_router מנתב → notification_agent שולח התראות.
 *   - הוספת הערות → requestArtifactRevision (קיים) → המחלקה רואה ופותחת תיקון.
 *   - אישור artifact → approveArtifact (קיים).
 *   - מנהלת יוצרת artifact משלה (העלי גרסה משלי) → createArtifactByManager
 *     → internal_review → media_dept QA → approved (לא דילוג על QA — ספק 01 §13).
 */
import React, { useState, useEffect, useRef } from "react";
import {
  listCampaignFolders, createCampaignFolder, updateCampaignFolder,
  listArtifacts, listBudgetAllocations, uploadCampaignFile,
  listRecommendations, listWorkflowBlockers, listAllFoldersFiles,
  approveArtifact, requestArtifactRevision, createArtifactByManager,
  decideRecommendation, submitCampaignRequest,
} from "../../api.js";
import {
  color, radius, shadow, space, type, transition,
  button, input as inputStyle, fontFamily,
} from "./_tokens.js";
import { useToast } from "./Toast.jsx";
import { SkeletonBoard } from "./Skeleton.jsx";

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

// Lifecycle status (ספק 01 §13)
const STATUS_DEFS = {
  draft:           { label: "טיוטה",         bg: "#cbd5e1", fg: "#1e293b" },
  in_progress:     { label: "בעבודה",        bg: "#fdba74", fg: "#7c2d12" },
  ready_to_launch: { label: "מוכן לעלייה",   bg: "#86efac", fg: "#14532d" },
  live:            { label: "באוויר",        bg: "#22c55e", fg: "#ffffff" },
  closing:         { label: "בסגירה",        bg: "#fbbf24", fg: "#78350f" },
  closed:          { label: "סגור",          bg: "#f87171", fg: "#7f1d1d" },
};
const ALL_STATUSES = Object.keys(STATUS_DEFS);

// Auto-flow groups
const GROUPS = [
  { id: "planned",   label: "קמפיינים מתוכננים לעלייה", statuses: ["draft", "in_progress", "ready_to_launch"], strip: "#3b82f6" },
  { id: "live",      label: "קמפיינים באוויר",          statuses: ["live"],                                    strip: "#16a34a" },
  { id: "completed", label: "קמפיינים שהסתיימו",        statuses: ["closing", "closed"],                       strip: "#dc2626" },
];

// Per-artifact-type column definitions
const ARTIFACT_COLS = [
  { id: "media_plan",       label: "פריסת מדיה",    icon: "📊", purpose: "media_plan" },
  { id: "keyword_research", label: "מחקר ביטויים",  icon: "🔍", purpose: "keyword_research" },
  { id: "ad_copy_meta",     label: "קופי Meta",     icon: "📘" },
  { id: "ad_copy_google",   label: "קופי Google",   icon: "🔎" },
  { id: "ad_copy_tiktok",   label: "קופי TikTok",   icon: "🎵" },
  { id: "lead_form_copy",   label: "טופס Lead",     icon: "📝" },
  { id: "creative_rendered",label: "קריאייטיב",     icon: "🖼" },
  { id: "budget_recommendation", label: "תקציב מומלץ", icon: "💰" },
  { id: "make_scenario",    label: "MAKE",          icon: "🔌" },
];

const FILE_ACCEPT = ".xlsx,.xls,.csv,.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif";

// Change request kinds (for "בקשה לתקציבאית" dialog)
const CHANGE_KINDS = [
  { id: "video_upload",      label: "העלאת וידיאו לקמפיין" },
  { id: "creative_change",   label: "שינוי קריאייטיב נקודתי" },
  { id: "remarketing",       label: "הוספת רימרקטינג" },
  { id: "budget_change",     label: "שינוי תקציב" },
  { id: "audience_change",   label: "שינוי קהל" },
  { id: "general",           label: "אחר (תיאור חופשי)" },
];

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "2-digit" }); }
  catch { return iso; }
}
function fmtDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" })
         + " · "
         + d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}
function fmtMoney(num) {
  if (num == null || num === 0 || num === "") return "";
  const n = Number(num);
  if (isNaN(n)) return "";
  if (n >= 1_000_000) return `₪${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000)      return `₪${Math.round(n / 1000)}K`;
  return `₪${n.toLocaleString("he-IL")}`;
}

// Build version chains: for a given folder + artifact_type, return the chain
// of artifacts ordered oldest → newest (using parent_artifact_id pointers).
function buildVersionChain(artifacts, folderId, artifactType) {
  const all = artifacts.filter(a => a.folder_id === folderId && a.artifact_type === artifactType);
  if (all.length === 0) return [];
  // Sort by version_number ascending (DB stores it natively)
  return all.slice().sort((a, b) => (a.version_number || 1) - (b.version_number || 1));
}

// Determine the pill state for a chain
function pillStateForChain(chain) {
  if (!chain || chain.length === 0) return { state: "missing" };
  const current = chain[chain.length - 1];
  const status  = current.status;
  const v       = current.version_number || 1;
  if (status === "approved")          return { state: "approved", current, version: v };
  if (status === "revision_required") return { state: "has_notes", current, version: v };
  if (status === "rejected")          return { state: "rejected", current, version: v };
  // anything else (draft, internal_review, qa_passed, waiting_for_marketing_approval)
  if (v > 1) return { state: "new_version", current, version: v };
  return { state: "pending", current, version: v };
}

// ═══════════════════════════════════════════════════════════════════════════
// Artifact pill (5 states)
// ═══════════════════════════════════════════════════════════════════════════

function ArtifactPill({ chain, onClick }) {
  const { state, version } = pillStateForChain(chain);
  const map = {
    missing:     { bg: "transparent", fg: "#cbd5e1",  text: "—",            border: false },
    pending:     { bg: "#fef3c7",     fg: "#a16207",  text: "⏳ ממתין",      border: true  },
    has_notes:   { bg: "#ede9fe",     fg: "#6d28d9",  text: "💬 יש הערות",  border: true  },
    new_version: { bg: "#fed7aa",     fg: "#9a3412",  text: `⚠️ גרסה ${version}`, border: true },
    approved:    { bg: "#dcfce7",     fg: "#166534",  text: "✓ אושר",       border: true  },
    rejected:    { bg: "#fee2e2",     fg: "#b91c1c",  text: "✗ נדחה",       border: true  },
  };
  const s = map[state] || map.missing;
  if (state === "missing") {
    return (
      <button onClick={e => { e.stopPropagation(); onClick && onClick(); }}
              title="אין תוצר עדיין — לחיצה לפתיחה"
              style={{
                background: "transparent", color: "#cbd5e1",
                border: `1px dashed #e5e7eb`, padding: "3px 10px",
                borderRadius: 4, fontSize: 11, fontFamily, cursor: "pointer",
                width: "100%", textAlign: "center",
              }}>+ העלי</button>
    );
  }
  return (
    <button onClick={e => { e.stopPropagation(); onClick && onClick(); }}
            title="לחיצה לפתיחת היסטוריית גרסאות + אישור/הערות"
            style={{
              background: s.bg, color: s.fg, border: "none",
              padding: "4px 10px", borderRadius: 4,
              fontSize: 11, fontWeight: 700, fontFamily,
              cursor: "pointer", width: "100%", textAlign: "center",
              transition: transition.fast,
            }}>{s.text}</button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Inline editors (text / number / date / status)
// ═══════════════════════════════════════════════════════════════════════════

function InlineInput({ value, type: inputType = "text", placeholder = "",
                       formatter = (v) => v, onSave }) {
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
  function cancel() { setVal(value == null ? "" : String(value)); setEditing(false); }

  if (editing) {
    return (
      <input
        ref={inputRef} type={inputType} value={val}
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
  const display = value == null || value === "" ? "" : formatter(value);
  return (
    <div onClick={e => { e.stopPropagation(); setEditing(true); }}
         title="לחיצה לעריכה"
         style={{
           cursor: "text", padding: "3px 6px", borderRadius: 4, minHeight: 24,
           width: "100%", textAlign: inputType === "number" ? "center" : "right",
           color: display ? color.fgDefault : color.fgSubtle,
           fontSize: 12, fontFamily, fontWeight: display ? 500 : 400,
           background: "transparent", transition: transition.fast,
           whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
         }}
         onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
         onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
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
      try { inputRef.current.showPicker?.(); } catch { /* unsupported */ }
    }
  }, [editing]);
  async function commit(newVal) {
    setEditing(false);
    if ((newVal || null) === (value || null)) return;
    await onSave(newVal || null);
  }
  if (editing) {
    return (
      <input ref={inputRef} type="date" defaultValue={value || ""}
             onBlur={e => commit(e.target.value)}
             onChange={e => commit(e.target.value)}
             onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); setEditing(false); } }}
             onClick={e => e.stopPropagation()}
             style={{
               width: "100%", padding: "4px 6px",
               border: `2px solid ${color.primary}`, borderRadius: 4,
               fontSize: 12, fontFamily, background: "#fff",
               outline: "none", textAlign: "center", direction: "rtl",
             }} />
    );
  }
  return (
    <div onClick={e => { e.stopPropagation(); setEditing(true); }}
         title="לחיצה לעריכת תאריך"
         style={{
           cursor: "text", padding: "3px 6px", borderRadius: 4,
           minHeight: 24, width: "100%", textAlign: "center",
           color: value ? color.fgDefault : color.fgSubtle,
           fontSize: 12, fontFamily, fontWeight: value ? 500 : 400,
           transition: transition.fast,
         }}
         onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
         onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      {value ? fmtDate(value) : <span style={{ color: "#cbd5e1" }}>{placeholder}</span>}
    </div>
  );
}

function StatusPicker({ value, onChange }) {
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
    <div ref={ref} style={{ position: "relative", width: "100%" }}
         onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(o => !o)} title="לחיצה לשינוי סטטוס"
              style={{
                width: "100%", background: def.bg, color: def.fg, border: "none",
                padding: "6px 10px", borderRadius: 4,
                fontSize: 11, fontWeight: 700, fontFamily,
                cursor: "pointer", textAlign: "center", transition: transition.fast,
              }}>{def.label}</button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", insetInlineStart: 0,
          background: color.surface, border: `1px solid ${color.borderDefault}`,
          borderRadius: radius.md, boxShadow: shadow.lg,
          zIndex: 30, padding: 4, minWidth: 130,
        }}>
          {ALL_STATUSES.map(s => {
            const sd = STATUS_DEFS[s];
            const active = s === value;
            return (
              <div key={s} onClick={() => { onChange(s); setOpen(false); }}
                   style={{
                     padding: "4px 6px", cursor: "pointer", borderRadius: 4,
                     background: active ? color.surfaceMuted : "transparent",
                     transition: transition.fast,
                   }}
                   onMouseEnter={e => e.currentTarget.style.background = color.surfaceMuted}
                   onMouseLeave={e => e.currentTarget.style.background = active ? color.surfaceMuted : "transparent"}>
                <span style={{
                  background: sd.bg, color: sd.fg, padding: "3px 10px", borderRadius: 4,
                  fontSize: 11, fontWeight: 700, fontFamily, display: "block", textAlign: "center",
                }}>{sd.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Modal — version history popover for an artifact column
// ═══════════════════════════════════════════════════════════════════════════

function VersionHistoryModal({ folder, col, chain, onClose, onChanged, toast }) {
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const fileRef = useRef(null);

  const current = chain[chain.length - 1];

  async function approveCurrent() {
    if (!current) return;
    setBusy(true);
    try {
      await approveArtifact(current.id);
      toast.success(`✓ ${col.label} אושר`);
      onChanged();
      onClose();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }
  async function sendNotes() {
    if (!current) return;
    if (!noteText.trim()) { toast.warning("יש לכתוב הערות"); return; }
    setBusy(true);
    try {
      await requestArtifactRevision(current.id, { revision_note: noteText.trim() });
      toast.success(`💬 הערות נשלחו ל${col.label} — המחלקה מתחילה תיקון`);
      setNoteText("");
      onChanged();
      onClose();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }
  async function uploadMyVersion() {
    if (!uploadFile) { toast.warning("בחרי קובץ קודם"); return; }
    setBusy(true);
    try {
      // Step 1: upload file to storage
      const purpose = col.purpose || col.id;
      const fileRes = await uploadCampaignFile(uploadFile, { folderId: folder.id, purpose });
      // Step 2: create artifact-by-manager pointing to the uploaded file
      await createArtifactByManager({
        folder_id: folder.id,
        artifact_type: col.id,
        title: `${col.label} — גרסה ידנית של מנהלת השיווק`,
        attached_file_path: fileRes.path,
        notes: noteText.trim() || null,
      });
      toast.success(`📤 הועלתה גרסה משלך — נכנסה ל-QA פנימי`);
      setUploadFile(null);
      setNoteText("");
      onChanged();
      onClose();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
      padding: space(4), direction: "rtl",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: color.surface, borderRadius: radius.lg,
        maxWidth: 640, width: "100%", maxHeight: "85vh", overflow: "auto",
        boxShadow: shadow.xl, padding: space(5), fontFamily,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: space(2), marginBottom: space(2) }}>
          <span style={{ fontSize: 26 }}>{col.icon}</span>
          <div style={{ flex: 1 }}>
            <h3 style={{ ...type.h3, margin: 0 }}>{col.label} — {folder.course_name}</h3>
            <div style={{ ...type.caption, color: color.fgSubtle }}>
              {chain.length} גרסאות · אחרונה: {current ? fmtDateTime(current.updated_at || current.created_at) : "—"}
            </div>
          </div>
          <button onClick={onClose} aria-label="סגירה" style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 24, color: color.fgMuted, padding: 4,
          }}>×</button>
        </div>

        {/* Version chain */}
        {chain.length === 0 && (
          <div style={{
            textAlign: "center", padding: space(4), color: color.fgSubtle,
            background: color.surfaceMuted, borderRadius: radius.md,
            ...type.bodySmall, marginBottom: space(3),
          }}>
            עדיין לא קיים תוצר {col.label} בתיקייה. את יכולה להעלות גרסה משלך למטה.
          </div>
        )}

        {chain.length > 0 && (
          <div style={{ marginBottom: space(3) }}>
            {chain.slice().reverse().map((art, idx) => {
              const isLatest = idx === 0;
              const ps = pillStateForChain([art]);
              return (
                <div key={art.id} style={{
                  border: `1px solid ${isLatest ? color.primary : color.borderSubtle}`,
                  borderRadius: radius.md, padding: space(3), marginBottom: space(2),
                  background: isLatest ? "#eff6ff" : color.surfaceMuted,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: space(2), marginBottom: space(1) }}>
                    <span style={{ ...type.bodyStrong, color: color.fgDefault }}>
                      גרסה {art.version_number || 1} {isLatest && <span style={{ color: color.primary }}>(אחרונה)</span>}
                    </span>
                    <ArtifactPill chain={[art]} onClick={() => {}} />
                    <span style={{ ...type.caption, color: color.fgSubtle, marginInlineStart: "auto" }}>
                      {fmtDateTime(art.updated_at || art.created_at)}
                    </span>
                  </div>
                  {art.title && (
                    <div style={{ ...type.bodySmall, color: color.fgMuted, marginBottom: space(1) }}>
                      {art.title}
                    </div>
                  )}
                  {/* Producer info */}
                  <div style={{ ...type.caption, color: color.fgSubtle }}>
                    מקור: {art.producing_department === "manager"
                      ? "📤 הועלה ע\"י מנהלת השיווק"
                      : `${art.producing_department}/${art.producing_agent || "agent"}`}
                  </div>
                  {/* Attached file (if manager-created) */}
                  {art.payload?.attached_file?.access_url && (
                    <div style={{ marginTop: space(1) }}>
                      <a href={art.payload.attached_file.access_url} target="_blank" rel="noreferrer"
                         style={{ color: color.primary, fontSize: 12, textDecoration: "none" }}>
                        📎 הורדת קובץ מצורף
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Action area */}
        {current && (
          <div style={{
            borderTop: `2px solid ${color.borderDefault}`,
            paddingTop: space(3), marginTop: space(2),
          }}>
            <div style={{ ...type.label, marginBottom: space(2) }}>
              📝 פעולה על גרסה {current.version_number || 1}
            </div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="הוסיפי הערות לגרסה זו (חופשי — מה לשנות, מה לתקן)..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical", marginBottom: space(2), fontFamily }}
            />
            <div style={{ display: "flex", gap: space(2), flexWrap: "wrap" }}>
              <button onClick={sendNotes} disabled={busy || !noteText.trim()} style={{
                ...button.primary, background: "#7c3aed", opacity: (busy || !noteText.trim()) ? 0.5 : 1,
              }}>💬 שלחי הערות</button>
              <button onClick={approveCurrent} disabled={busy} style={{
                ...button.success, opacity: busy ? 0.5 : 1,
              }}>✓ אישור סופי</button>
            </div>
          </div>
        )}

        {/* Upload-my-version */}
        <div style={{
          borderTop: `1px dashed ${color.borderDefault}`,
          paddingTop: space(3), marginTop: space(3),
        }}>
          <div style={{ ...type.label, marginBottom: space(2) }}>
            📤 או — העלי גרסה משלך (יוצרת artifact חדש בשרשרת)
          </div>
          <input ref={fileRef} type="file" accept={FILE_ACCEPT}
                 onChange={e => setUploadFile(e.target.files?.[0] || null)}
                 style={{ display: "block", marginBottom: space(2), fontFamily, fontSize: 13 }} />
          {uploadFile && (
            <div style={{ ...type.bodySmall, color: color.fgMuted, marginBottom: space(2) }}>
              📎 {uploadFile.name} ({Math.round(uploadFile.size / 1024)} KB)
            </div>
          )}
          <button onClick={uploadMyVersion} disabled={busy || !uploadFile} style={{
            ...button.secondary,
            opacity: (busy || !uploadFile) ? 0.5 : 1,
          }}>{busy ? "מעלה..." : "📤 העלי כגרסה חדשה"}</button>
          <div style={{ ...type.caption, color: color.fgSubtle, marginTop: space(2) }}>
            הקובץ יהפוך לגרסה {(current?.version_number || 0) + 1}, יעבור QA פנימי, ויסומן כ-approved (את ה-source-of-truth).
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Modal — "בקשה לתקציבאית" — submits to /api/workflow/requests
// ═══════════════════════════════════════════════════════════════════════════

function RequestToAccountManagerModal({ folder, onClose, onSent, toast }) {
  const [kind, setKind]       = useState("video_upload");
  const [subject, setSubject] = useState("");
  const [body, setBody]       = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function submit() {
    if (!subject.trim()) { toast.warning("יש לכתוב נושא"); return; }
    setBusy(true);
    try {
      let attachmentPath = null;
      if (attachedFile) {
        const res = await uploadCampaignFile(attachedFile, {
          folderId: folder.id, purpose: "manager_request",
        });
        attachmentPath = res.path;
      }
      await submitCampaignRequest({
        folder_id:   folder.id,
        request_type: "change_request",
        brief_type:  "structured_form",
        brief_payload: {
          intent:     "change",
          change_kind: kind,
          subject:    subject.trim(),
          body:       body.trim(),
          attachment_path: attachmentPath,
        },
        submitter: "marketing_manager",
      });
      toast.success("✉ הבקשה נשלחה לתקציבאית — תקבלי התראה כשתחזור עם תוצרים");
      onSent && onSent();
      onClose();
    } catch (e) { toast.error(`שגיאה בשליחה: ${e.message}`); }
    finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
      padding: space(4), direction: "rtl",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: color.surface, borderRadius: radius.lg,
        maxWidth: 540, width: "100%", boxShadow: shadow.xl,
        padding: space(5), fontFamily,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: space(2), marginBottom: space(3) }}>
          <span style={{ fontSize: 28 }}>✉</span>
          <h3 style={{ ...type.h3, margin: 0, flex: 1 }}>
            בקשה לתקציבאית — {folder.course_name}
          </h3>
          <button onClick={onClose} aria-label="סגירה" style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 24, color: color.fgMuted, padding: 4,
          }}>×</button>
        </div>
        <div style={{ ...type.bodySmall, color: color.fgMuted, marginBottom: space(3) }}>
          הבקשה תועבר לסוכן <strong>account_manager</strong>, שמסווג ומפזר אותה למחלקה הרלוונטית.
          תקבלי התראה כשהמחלקה מסיימת.
        </div>

        <div style={{ marginBottom: space(3) }}>
          <label style={{ ...type.label, display: "block", marginBottom: space(1) }}>סוג בקשה</label>
          <select value={kind} onChange={e => setKind(e.target.value)}
                  style={{ ...inputStyle, fontFamily }}>
            {CHANGE_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: space(3) }}>
          <label style={{ ...type.label, display: "block", marginBottom: space(1) }}>נושא</label>
          <input value={subject} onChange={e => setSubject(e.target.value)}
                 placeholder='לדוגמה: "להחליף וידיאו ב-Meta לקריאייטיב חדש"'
                 style={{ ...inputStyle, fontFamily }} />
        </div>

        <div style={{ marginBottom: space(3) }}>
          <label style={{ ...type.label, display: "block", marginBottom: space(1) }}>פירוט (אופציונלי)</label>
          <textarea value={body} onChange={e => setBody(e.target.value)}
                    placeholder="הסבר מפורט יותר, הקשר עסקי, דדליין..."
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical", fontFamily }} />
        </div>

        <div style={{ marginBottom: space(4) }}>
          <label style={{ ...type.label, display: "block", marginBottom: space(1) }}>צירוף קובץ (אופציונלי)</label>
          <input ref={fileRef} type="file" accept={FILE_ACCEPT}
                 onChange={e => setAttachedFile(e.target.files?.[0] || null)}
                 style={{ display: "block", fontFamily, fontSize: 13 }} />
          {attachedFile && (
            <div style={{ ...type.caption, color: color.fgMuted, marginTop: space(1) }}>
              📎 {attachedFile.name}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: space(2), justifyContent: "flex-end" }}>
          <button onClick={onClose} style={button.secondary}>ביטול</button>
          <button onClick={submit} disabled={busy || !subject.trim()}
                  style={{ ...button.primary, opacity: (busy || !subject.trim()) ? 0.5 : 1 }}>
            {busy ? "שולחת..." : "✉ שלחי לתקציבאית"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Live-group subitems (recommendations + change requests, per spec 02 §6)
// ═══════════════════════════════════════════════════════════════════════════

function LiveSubitems({ folder, recommendations, onChanged, toast }) {
  const recs = recommendations.filter(r => r.folder_id === folder.id);
  if (recs.length === 0) {
    return (
      <div style={{ padding: space(3), color: color.fgSubtle, ...type.bodySmall, fontStyle: "italic" }}>
        אין המלצות פתוחות מהמערכת לקמפיין זה — הכל זורם תקין. בקשה לתקציבאית? לחצי "💬 בקשה" בשורה הראשית.
      </div>
    );
  }
  return (
    <div style={{ padding: `${space(2)} ${space(3)}`, background: "#fafbfc" }}>
      {recs.map(r => <SubitemRow key={r.id} rec={r} onChanged={onChanged} toast={toast} />)}
    </div>
  );
}

function SubitemRow({ rec, onChanged, toast }) {
  const [busy, setBusy] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [reason, setReason] = useState("");

  async function decide(decision) {
    if (decision === "reject" && !reason.trim()) {
      toast.warning("דחייה דורשת סיבה");
      return;
    }
    setBusy(true);
    try {
      await decideRecommendation(rec.id, {
        decided_by: "marketing_manager",
        decision,
        reason: reason.trim() || null,
        qa_feedback_dimensions: [],
      });
      toast.success(`המלצה ${decision === "approve" ? "אושרה" : decision === "reject" ? "נדחתה" : "נדחתה לעת עתה"}`);
      onChanged();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  const noteRaw = rec.qa_feedback_note || "";
  const policyChanged = noteRaw.includes("policy_changed_on:");
  const repeated      = (rec.times_seen || 1) > 1;

  return (
    <div style={{
      border: `1px solid ${color.borderSubtle}`, borderRadius: radius.md,
      padding: space(3), marginBottom: space(2), background: color.surface,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: space(2), marginBottom: space(1.5) }}>
        <span style={{ ...type.caption, color: color.fgSubtle, fontWeight: 700 }}>
          📅 {fmtDate(rec.created_at)}
        </span>
        <span style={{
          background: rec.platform === "meta" ? "#dbeafe" : rec.platform === "google" ? "#fef3c7" : "#f1f5f9",
          color: "#1e3a8a", padding: "2px 8px", borderRadius: 999,
          fontSize: 10, fontWeight: 700, fontFamily,
        }}>{rec.platform}</span>
        {rec.requires_approval && (
          <span style={{
            background: "#fef3c7", color: "#a16207",
            padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, fontFamily,
          }}>⚠ דורש אישור</span>
        )}
        {/* ספק 02 §8 — chips */}
        {repeated && (
          <span title="ההמלצה חוזרת בריצות עוקבות" style={{
            background: "#e0e7ff", color: "#4338ca",
            padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, fontFamily,
          }}>🔁 חוזרת ({rec.times_seen})</span>
        )}
        {policyChanged && (
          <span title="ה-policy שונה מאז ההמלצה הקודמת" style={{
            background: "#fef9c3", color: "#854d0e",
            padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, fontFamily,
          }}>🔄 policy שונה</span>
        )}
      </div>
      <div style={{ ...type.bodyStrong, color: color.fgDefault, marginBottom: space(1) }}>
        💡 {rec.chosen_action} — {rec.recommendation_text || "המלצה"}
      </div>
      {rec.human_explanation && (
        <div style={{ ...type.bodySmall, color: color.fgMuted, marginBottom: space(2),
                       whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          {rec.human_explanation}
        </div>
      )}
      {rec.decision_status === "pending" && (
        <>
          {showNotes && (
            <input value={reason} onChange={e => setReason(e.target.value)}
                   placeholder="סיבה (חובה לדחייה)"
                   style={{ ...inputStyle, marginBottom: space(2) }} />
          )}
          <div style={{ display: "flex", gap: space(1.5), flexWrap: "wrap" }}>
            <button onClick={() => decide("approve")} disabled={busy} style={{
              ...button.success, padding: `${space(1.5)} ${space(3)}`, fontSize: 12,
              opacity: busy ? 0.5 : 1,
            }}>✓ אשרי</button>
            <button onClick={() => { setShowNotes(true); decide("reject"); }} disabled={busy} style={{
              ...button.danger, padding: `${space(1.5)} ${space(3)}`, fontSize: 12,
              opacity: busy ? 0.5 : 1,
            }}>✗ דחי</button>
            <button onClick={() => decide("snooze")} disabled={busy} style={{
              ...button.secondary, padding: `${space(1.5)} ${space(3)}`, fontSize: 12,
              opacity: busy ? 0.5 : 1,
            }}>⏸ דחי לעת עתה</button>
          </div>
        </>
      )}
      {rec.decision_status !== "pending" && (
        <div style={{ ...type.caption, color: color.fgSubtle }}>
          הוחלט: {rec.decision_status}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main FolderBoard
// ═══════════════════════════════════════════════════════════════════════════

export default function FolderBoard({ onSelectFolder, refreshKey = 0 }) {
  const toast = useToast();
  const [folders, setFolders]         = useState([]);
  const [artifacts, setArtifacts]     = useState([]);
  const [recommendations, setRecs]    = useState([]);
  const [blockers, setBlockers]       = useState([]);
  const [filesByFolder, setFiles]     = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [query, setQuery]       = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [expandedRows, setExpandedRows] = useState({});  // for live group subitems
  const [versionModal, setVersionModal] = useState(null);  // { folder, col, chain }
  const [requestModal, setRequestModal] = useState(null);  // { folder }

  async function refresh() {
    setLoading(true); setError(null);
    try {
      const [f, a, r, bl, files] = await Promise.all([
        listCampaignFolders(),
        // NB: include ALL versions, not only is_current_version, so popover shows full chain
        listArtifacts({ limit: 500 }).catch(() => []),
        listRecommendations({ limit: 200 }).catch(() => []),
        listWorkflowBlockers({ onlyOpen: true }).catch(() => []),
        listAllFoldersFiles().catch(() => ({})),
      ]);
      setFolders(Array.isArray(f) ? f : []);
      setArtifacts(Array.isArray(a) ? a : []);
      setRecs(Array.isArray(r) ? r : []);
      setBlockers(Array.isArray(bl) ? bl : []);
      setFiles(typeof files === "object" && files ? files : {});
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
    } catch (e) { toast.error(`שגיאה ביצירה: ${e.message}`); }
    finally { setCreating(false); }
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

  function toggleGroup(id) { setCollapsed(c => ({ ...c, [id]: !c[id] })); }
  function toggleRow(id)   { setExpandedRows(r => ({ ...r, [id]: !r[id] })); }

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
    <div style={{ direction: "rtl", fontFamily }}>
      {/* Top toolbar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: space(3), flexWrap: "wrap", gap: space(2),
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: space(3) }}>
          <h3 style={{ ...type.h2, margin: 0 }}>📋 לוח קמפיינים</h3>
          <span style={{ ...type.bodySmall, color: color.fgSubtle }}>
            {q ? `${filtered.length} מתוך ${folders.length}` : `${folders.length} ${folders.length === 1 ? "קמפיין" : "קמפיינים"}`}
          </span>
        </div>
        <div style={{ display: "flex", gap: space(2), alignItems: "center", flexWrap: "wrap" }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
                 placeholder="חיפוש לפי שם / פעילות..."
                 style={{ ...inputStyle, minWidth: 240 }} />
          <button onClick={() => setShowNew(s => !s)} style={button.primary}>
            ➕ קמפיין חדש
          </button>
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
            <input value={newName} onChange={e => setNewName(e.target.value)}
                   placeholder="שם הקורס / הפעילות" autoFocus
                   onKeyDown={e => e.key === "Enter" && createFolder()}
                   style={{ ...inputStyle, flex: 1 }} />
            <button onClick={createFolder} disabled={creating || !newName.trim()}
                    style={{ ...button.success, opacity: (creating || !newName.trim()) ? 0.5 : 1 }}>
              {creating ? "..." : "צור"}
            </button>
            <button onClick={() => { setShowNew(false); setNewName(""); }} style={button.secondary}>
              ביטול
            </button>
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
          <button onClick={() => setShowNew(true)} style={button.primary}>
            ➕ צרי קמפיין ראשון
          </button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{
          background: color.surface, borderRadius: radius.lg,
          border: `1px solid ${color.borderDefault}`, boxShadow: shadow.sm,
          overflow: "hidden",
        }}>
          <div style={{
            padding: `${space(2)} ${space(3)}`,
            background: "#fffbeb", borderBottom: `1px solid #fef3c7`,
            ...type.caption, color: "#92400e", fontFamily,
          }}>
            ↔ הלוח רחב — גוללי הצידה לראיית כל הסוגים. ▾ ליד קמפיין באוויר חושף המלצות. קליק על pill פותח גרסאות + הוספת הערות.
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 1500 }}>
              {groupedFolders.map(group => (
                <Group key={group.id}
                       group={group}
                       folders={group.folders}
                       collapsed={!!collapsed[group.id]}
                       onToggle={() => toggleGroup(group.id)}
                       expandedRows={expandedRows}
                       onToggleRow={toggleRow}
                       artifacts={artifacts}
                       recommendations={recommendations}
                       blockers={blockers}
                       filesByFolder={filesByFolder}
                       onPatchFolder={patchFolder}
                       onOpenFolder={onSelectFolder}
                       onAddCampaign={() => setShowNew(true)}
                       onOpenVersionModal={(folder, col, chain) => setVersionModal({ folder, col, chain })}
                       onOpenRequestModal={(folder) => setRequestModal({ folder })}
                       toast={toast} />
              ))}
            </div>
          </div>
        </div>
      )}

      {versionModal && (
        <VersionHistoryModal
          folder={versionModal.folder}
          col={versionModal.col}
          chain={versionModal.chain}
          onClose={() => setVersionModal(null)}
          onChanged={refresh}
          toast={toast} />
      )}

      {requestModal && (
        <RequestToAccountManagerModal
          folder={requestModal.folder}
          onClose={() => setRequestModal(null)}
          onSent={refresh}
          toast={toast} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Group section
// ═══════════════════════════════════════════════════════════════════════════

const COLUMNS_CORE = [
  { id: "expand",   label: "",            width: 28,  center: true },
  { id: "task",     label: "שם הקמפיין",  width: 220 },
  { id: "status",   label: "סטטוס",       width: 130, center: true },
  { id: "due",      label: "תאריך עלייה", width: 110, center: true },
  { id: "method",   label: "methodology", width: 130, center: true },
  { id: "budget",   label: "תקציב",       width: 90,  center: true },
];
const COLUMNS_TAIL = [
  { id: "blockers",  label: "⚠ חוסמים",     width: 90,  center: true },
  { id: "request",   label: "💬 בקשה",      width: 90,  center: true },
  { id: "actions",   label: "",             width: 50,  center: true },
];
const ALL_COLUMNS = [...COLUMNS_CORE, ...ARTIFACT_COLS.map(c => ({ ...c, width: 110, center: true })), ...COLUMNS_TAIL];
const ROW_TEMPLATE = ALL_COLUMNS.map(c => `${c.width}px`).join(" ");

function Group({ group, folders, collapsed, onToggle, expandedRows, onToggleRow,
                 artifacts, recommendations, blockers, filesByFolder,
                 onPatchFolder, onOpenFolder, onAddCampaign,
                 onOpenVersionModal, onOpenRequestModal, toast }) {
  return (
    <div style={{ borderBottom: `1px solid ${color.borderDefault}` }}>
      {/* Group header */}
      <div onClick={onToggle}
           style={{
             display: "flex", alignItems: "center", gap: space(2),
             padding: `${space(2.5)} ${space(3)}`,
             cursor: "pointer", background: color.surface, userSelect: "none",
           }}
           onMouseEnter={e => e.currentTarget.style.background = color.surfaceMuted}
           onMouseLeave={e => e.currentTarget.style.background = color.surface}>
        <span style={{
          display: "inline-block",
          transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
          transition: "transform 120ms", color: color.fgMuted, fontSize: 12, width: 14,
        }}>▾</span>
        <span style={{ color: group.strip, ...type.bodyStrong, fontSize: 14, fontFamily }}>
          {group.label}
        </span>
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
            gridTemplateColumns: `8px ${ROW_TEMPLATE}`,
            background: color.surfaceMuted,
            borderTop: `1px solid ${color.borderSubtle}`,
            borderBottom: `1px solid ${color.borderSubtle}`,
          }}>
            <div />
            {ALL_COLUMNS.map(c => (
              <div key={c.id} style={{
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

          {/* Empty group */}
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
                    ? "אין קמפיינים פעילים. קמפיין יזרום לכאן ברגע שתעדכני אותו לסטטוס \"באוויר\"."
                    : "אין קמפיינים שהסתיימו עדיין."}
              </div>
            </div>
          )}

          {/* Rows */}
          {folders.map(f => (
            <React.Fragment key={f.id}>
              <Row folder={f} group={group}
                   isExpandable={group.id === "live"}
                   isExpanded={!!expandedRows[f.id]}
                   onToggle={() => onToggleRow(f.id)}
                   artifacts={artifacts}
                   blockers={blockers}
                   onPatch={(patch) => onPatchFolder(f, patch)}
                   onOpen={() => onOpenFolder && onOpenFolder(f.id)}
                   onOpenVersionModal={(col, chain) => onOpenVersionModal(f, col, chain)}
                   onOpenRequestModal={() => onOpenRequestModal(f)} />
              {group.id === "live" && expandedRows[f.id] && (
                <div style={{ display: "grid", gridTemplateColumns: `8px 1fr` }}>
                  <div style={{ background: group.strip, opacity: 0.5 }} />
                  <LiveSubitems folder={f}
                                recommendations={recommendations}
                                onChanged={() => onPatchFolder(f, {})}
                                toast={toast} />
                </div>
              )}
            </React.Fragment>
          ))}

          {/* + Add (planned only) */}
          {group.id === "planned" && (
            <div onClick={onAddCampaign}
                 style={{
                   display: "grid", gridTemplateColumns: `8px 1fr`,
                   cursor: "pointer", borderTop: `1px dashed ${color.borderSubtle}`,
                   background: color.surface, transition: transition.fast,
                 }}
                 onMouseEnter={e => e.currentTarget.style.background = color.surfaceMuted}
                 onMouseLeave={e => e.currentTarget.style.background = color.surface}>
              <div style={{ background: group.strip, opacity: 0.4 }} />
              <span style={{
                padding: `${space(2)} ${space(3)}`, color: color.fgSubtle,
                ...type.bodySmall, fontWeight: 600, fontFamily,
              }}>➕ הוסיפי קמפיין</span>
            </div>
          )}

          {/* Auto-flow hint */}
          {group.id !== "planned" && folders.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `8px 1fr`,
                          background: color.surface, borderTop: `1px dashed ${color.borderSubtle}` }}>
              <div style={{ background: group.strip, opacity: 0.4 }} />
              <span style={{
                padding: `${space(2)} ${space(3)}`, color: color.fgSubtle,
                ...type.caption, fontFamily, fontStyle: "italic",
              }}>
                ⚙ אוטומציה — קמפיינים נכנסים אוטומטית לפי שינוי סטטוס בקבוצת "מתוכננים".
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Row
// ═══════════════════════════════════════════════════════════════════════════

function Row({ folder, group, isExpandable, isExpanded, onToggle,
                artifacts, blockers, onPatch, onOpen,
                onOpenVersionModal, onOpenRequestModal }) {
  // Count blockers belonging to this folder + assigned to manager
  const myBlockers = blockers.filter(b => {
    const meta = b.metadata || {};
    const matchesFolder = b.folder_id === folder.id || meta.folder_id === folder.id;
    const ownedByMe = b.owner_role === "marketing_manager" || !b.owner_role;
    return matchesFolder && ownedByMe;
  }).length;

  const methodLabel = (folder.methodology_switch_date && folder.methodology_switch_to)
    ? `${fmtDate(folder.methodology_switch_date)} → ${folder.methodology_switch_to === "conversion" ? "Conv" : "Clicks"}`
    : "—";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `8px ${ROW_TEMPLATE}`,
      background: color.surface,
      borderTop: `1px solid ${color.borderSubtle}`,
    }}>
      <div style={{ background: group.strip, opacity: 0.85 }} />

      {/* Expand chevron (only for live group) */}
      <Cell center>
        {isExpandable ? (
          <button onClick={e => { e.stopPropagation(); onToggle(); }}
                  title={isExpanded ? "הסתר המלצות" : "הצג המלצות"}
                  style={{
                    background: "transparent", border: "none", cursor: "pointer",
                    color: color.fgMuted, fontSize: 12, padding: 4,
                    transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 120ms",
                  }}>▾</button>
        ) : null}
      </Cell>

      {/* Task name */}
      <Cell>
        <InlineInput value={folder.course_name} placeholder="שם הקמפיין"
                     onSave={v => onPatch({ course_name: v })} />
      </Cell>

      {/* Status */}
      <Cell center>
        <StatusPicker value={folder.status} onChange={s => onPatch({ status: s })} />
      </Cell>

      {/* Go-live date */}
      <Cell center>
        <InlineDate value={folder.planned_go_live_date}
                    onSave={v => onPatch({ planned_go_live_date: v })} />
      </Cell>

      {/* Methodology */}
      <Cell center>
        <span style={{ ...type.caption, color: methodLabel === "—" ? "#cbd5e1" : color.fgDefault, fontFamily }}>
          {methodLabel}
        </span>
      </Cell>

      {/* Budget */}
      <Cell center>
        <InlineInput value={folder.metadata?.budget_ils} inputType="number"
                     formatter={v => fmtMoney(v)}
                     onSave={v => onPatch({ metadata: { budget_ils: v == null ? null : Number(v) } })} />
      </Cell>

      {/* Artifact pills */}
      {ARTIFACT_COLS.map(col => {
        const chain = buildVersionChain(artifacts, folder.id, col.id);
        return (
          <Cell key={col.id} center>
            <ArtifactPill chain={chain}
                          onClick={() => onOpenVersionModal(col, chain)} />
          </Cell>
        );
      })}

      {/* Blockers count */}
      <Cell center>
        {myBlockers > 0 ? (
          <span style={{
            background: "#fee2e2", color: "#b91c1c",
            padding: "2px 9px", borderRadius: 999,
            fontSize: 11, fontWeight: 700, fontFamily,
          }}>{myBlockers}</span>
        ) : (
          <span style={{ color: "#cbd5e1", fontSize: 12, fontFamily }}>—</span>
        )}
      </Cell>

      {/* Request to account_manager (live only) */}
      <Cell center>
        {folder.status === "live" ? (
          <button onClick={e => { e.stopPropagation(); onOpenRequestModal(); }}
                  title="שליחת בקשה לתקציבאית — וידיאו / רימרקטינג / שינוי קריאייטיב..."
                  style={{
                    background: "#7c3aed", color: "#fff", border: "none",
                    padding: "4px 10px", borderRadius: 4,
                    fontSize: 11, fontWeight: 700, fontFamily, cursor: "pointer",
                  }}>✉ בקשה</button>
        ) : (
          <span style={{ color: "#cbd5e1", fontSize: 12, fontFamily }}>—</span>
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

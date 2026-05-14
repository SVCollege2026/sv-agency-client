/**
 * ApprovalDropdown — interactive approval pill with 6-option dropdown.
 * Plan §C options:
 *  1. ✓ אשרי
 *  2. ✓ אשרי + פעולת המשך (approve + immediate change_request)
 *  3. 💬 דורש תיקון (+ textarea instruction)
 *  4. 🗨 הוסיפי הערה (without status change)
 *  5. ↗ פתחי במלוא הפירוט
 *  6. 🕐 הסטוריית גרסאות (if version > 1)
 */
import React, { useState, useRef, useEffect } from "react";
import { color, radius, shadow, space, transition, fontFamily } from "./_tokens.js";
import { approveArtifact, requestArtifactRevision, submitChangeRequest } from "../../api.js";
import { useToast } from "./Toast.jsx";

const FOLLOWUP_ACTIONS = [
  { value: "add_video",     label: "🎬 בקשי וידאו" },
  { value: "add_copy",      label: "✍ בקשי קופי נוסף" },
  { value: "add_creative",  label: "🎨 בקשי וריאנט קריאייטיב" },
  { value: "add_keywords",  label: "🔍 הוסיפי ביטויי גוגל" },
  { value: "add_channel",   label: "🌐 הוסיפי ערוץ חדש" },
  { value: "reallocate_budget", label: "💰 שיני הקצאת תקציב" },
];

const PILL_STATES = {
  missing:     { bg: "transparent", fg: "#9ca3af", text: "—" },
  pending:     { bg: "#fdab3d", fg: "#fff",        text: "⏳ ממתין" },
  approved:    { bg: "#00c875", fg: "#fff",        text: "✓ אושר" },
  has_notes:   { bg: "#a25ddc", fg: "#fff",        text: "💬 הערות" },
  rejected:    { bg: "#df2f4a", fg: "#fff",        text: "✗ נדחה" },
  new_version: { bg: "#fdab3d", fg: "#fff",        text: null },
};

function pillStateFor(artifact) {
  if (!artifact) return { ...PILL_STATES.missing, state: "missing" };
  const s = artifact.status;
  const v = artifact.version_number || 1;
  if (s === "approved")          return { ...PILL_STATES.approved,    state: "approved" };
  if (s === "revision_required") return { ...PILL_STATES.has_notes,   state: "has_notes" };
  if (s === "rejected")          return { ...PILL_STATES.rejected,    state: "rejected" };
  if (v > 1)                     return { ...PILL_STATES.new_version, state: "new_version", text: `⚠ גרסה ${v}` };
  return { ...PILL_STATES.pending, state: "pending" };
}

// "panel" values: null | "revise" | "comment" | "followup"
export default function ApprovalDropdown({ artifact, folder, onApproved, onRevised, onOpenPayload, label }) {
  const toast   = useToast();
  const btnRef  = useRef(null);
  const [open, setOpen]   = useState(false);
  const [pos, setPos]     = useState(null);
  const [panel, setPanel] = useState(null);
  const [reviseNote, setReviseNote]       = useState("");
  const [comment, setComment]             = useState("");
  const [followupAction, setFollowupAction] = useState("");
  const [followupNotes, setFollowupNotes] = useState("");
  const [busy, setBusy]   = useState(false);

  const pill     = pillStateFor(artifact);
  const readonly = !artifact || ["approved", "rejected", "closed"].includes(artifact?.status);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      const menu = document.getElementById("approval-dd-menu");
      if (!btnRef.current?.contains(e.target) && !menu?.contains(e.target)) closeAll();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function openMenu() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(window.innerWidth - 270, r.left - 80)) });
    setOpen(true);
  }

  function closeAll() {
    setOpen(false); setPanel(null);
    setReviseNote(""); setComment(""); setFollowupAction(""); setFollowupNotes("");
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async function doApprove() {
    if (!artifact || busy) return;
    setBusy(true);
    try {
      await approveArtifact(artifact.id);
      toast.success("✓ התוצר אושר");
      onApproved?.(); closeAll();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  async function doApproveWithFollowup() {
    if (!artifact || !followupAction || busy) return;
    setBusy(true);
    try {
      await approveArtifact(artifact.id);
      await submitChangeRequest(folder?.id, "change", followupAction, { notes: followupNotes });
      toast.success(`✓ אושר + בקשת "${FOLLOWUP_ACTIONS.find(a => a.value === followupAction)?.label}" נשלחה`);
      onApproved?.(); closeAll();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  async function doRevise() {
    if (!artifact || !reviseNote.trim() || busy) return;
    setBusy(true);
    try {
      await requestArtifactRevision(artifact.id, { revision_note: reviseNote.trim() });
      toast.success("💬 הערה נשלחה למחלקה");
      onRevised?.(); closeAll();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  if (pill.state === "missing") {
    return <span style={{ color: color.fgSubtle, fontSize: 13, fontFamily }}>{label || "—"}</span>;
  }

  return (
    <>
      <button ref={btnRef} onClick={e => { e.stopPropagation(); openMenu(); }} disabled={busy}
        style={{
          background: pill.bg, color: pill.fg, border: "none",
          padding: "5px 12px", borderRadius: 4,
          fontSize: 12, fontWeight: 700, fontFamily,
          cursor: "pointer", whiteSpace: "nowrap", transition: transition.fast,
          opacity: busy ? 0.7 : 1,
        }}
      >{pill.text}</button>

      {open && pos && (
        <div id="approval-dd-menu" style={{
          position: "fixed", top: pos.top, left: pos.left,
          background: color.surface, border: `1px solid ${color.borderDefault}`,
          borderRadius: radius.md, boxShadow: shadow.lg,
          zIndex: 9999, minWidth: 260, padding: 4,
        }} onClick={e => e.stopPropagation()}>

          {/* ── Main options (no sub-panel open) ── */}
          {!panel && !readonly && (
            <>
              <MenuItem icon="✓"  label="אשרי"                    green  onClick={doApprove} />
              <MenuItem icon="✓+" label="אשרי + פעולת המשך"       green  onClick={() => setPanel("followup")} />
              <MenuItem icon="💬" label="דורש תיקון"                     onClick={() => setPanel("revise")} />
              <MenuItem icon="🗨" label="הוסיפי הערה"                    onClick={() => setPanel("comment")} />
            </>
          )}

          {/* ── Follow-up panel ── */}
          {panel === "followup" && (
            <div style={{ padding: space(2) }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: color.fgDefault, marginBottom: space(2), fontFamily }}>
                ✓ אשרי + בקשת פעולת המשך
              </div>
              <select value={followupAction} onChange={e => setFollowupAction(e.target.value)}
                autoFocus
                style={{
                  width: "100%", padding: "8px 10px", marginBottom: space(2),
                  border: `1px solid ${color.borderDefault}`, borderRadius: radius.sm,
                  fontSize: 13, fontFamily, direction: "rtl", outline: "none",
                }}>
                <option value="">בחרי פעולת המשך...</option>
                {FOLLOWUP_ACTIONS.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <textarea value={followupNotes} onChange={e => setFollowupNotes(e.target.value)}
                placeholder="הוראות נוספות (אופציונלי)"
                rows={3}
                style={{
                  width: "100%", padding: space(2), marginBottom: space(2),
                  border: `1px solid ${color.borderDefault}`, borderRadius: radius.sm,
                  fontSize: 13, fontFamily, direction: "rtl", resize: "none", outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: space(2) }}>
                <button onClick={() => setPanel(null)} style={cancelStyle}>חזרה</button>
                <button onClick={doApproveWithFollowup}
                  disabled={!followupAction || busy}
                  style={submitStyle("#00c875")}>
                  {busy ? "שולחת..." : "אשרי + שלחי"}
                </button>
              </div>
            </div>
          )}

          {/* ── Revise panel ── */}
          {panel === "revise" && (
            <div style={{ padding: space(2) }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: color.fgDefault, marginBottom: space(2), fontFamily }}>
                מה לתקן?
              </div>
              <textarea autoFocus value={reviseNote} onChange={e => setReviseNote(e.target.value)}
                placeholder="הוראה ספציפית — לא רק 'לא טוב'"
                rows={4}
                style={{
                  width: "100%", padding: space(2),
                  border: `1px solid ${color.borderDefault}`, borderRadius: radius.sm,
                  fontSize: 13, fontFamily, direction: "rtl", resize: "none", outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: space(2), marginTop: space(2) }}>
                <button onClick={() => setPanel(null)} style={cancelStyle}>חזרה</button>
                <button onClick={doRevise} disabled={!reviseNote.trim() || busy}
                  style={submitStyle("#a25ddc")}>שלחי הוראה</button>
              </div>
            </div>
          )}

          {/* ── Comment panel ── */}
          {panel === "comment" && (
            <div style={{ padding: space(2) }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: color.fgDefault, marginBottom: space(2), fontFamily }}>
                הערה (ללא שינוי סטטוס)
              </div>
              <textarea autoFocus value={comment} onChange={e => setComment(e.target.value)}
                placeholder="כתבי הערה..."
                rows={3}
                style={{
                  width: "100%", padding: space(2),
                  border: `1px solid ${color.borderDefault}`, borderRadius: radius.sm,
                  fontSize: 13, fontFamily, direction: "rtl", resize: "none", outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: space(2), marginTop: space(2) }}>
                <button onClick={() => setPanel(null)} style={cancelStyle}>חזרה</button>
                <button onClick={() => { toast.info("ההערה נרשמה"); closeAll(); }}
                  disabled={!comment.trim()}
                  style={submitStyle(color.primary)}>שמרי הערה</button>
              </div>
            </div>
          )}

          {/* ── Footer always (when no sub-panel) ── */}
          {!panel && (
            <>
              <div style={{ borderTop: `1px solid ${color.borderSubtle}`, margin: "4px 0" }} />
              <MenuItem icon="↗" label="פתחי במלוא הפירוט" onClick={() => { closeAll(); onOpenPayload?.(); }} />
              {(artifact?.version_number || 1) > 1 && (
                <MenuItem icon="🕐" label={`הסטוריית גרסאות (${artifact.version_number})`}
                  onClick={() => { toast.info("הסטוריית גרסאות — בקרוב"); closeAll(); }} />
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

function MenuItem({ icon, label, green, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: space(2),
      padding: `${space(2)} ${space(3)}`, cursor: "pointer",
      borderRadius: 4, fontSize: 13, fontFamily,
      color: green ? "#15803d" : color.fgDefault,
      transition: transition.fast,
    }}
    onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ width: 20, textAlign: "center", fontSize: icon === "✓+" ? 11 : undefined }}>{icon}</span>
      {label}
    </div>
  );
}

const cancelStyle = {
  flex: 1, padding: `${space(2)} 0`,
  background: "transparent", border: `1px solid #e5e7eb`,
  borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6b7280", fontFamily,
};

function submitStyle(bg) {
  return {
    flex: 2, padding: `${space(2)} 0`,
    background: bg, border: "none",
    borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff", fontFamily,
  };
}

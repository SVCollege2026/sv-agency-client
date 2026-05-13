/**
 * ApprovalDropdown — interactive approval pill with 6-option dropdown.
 * Replaces the static ArtifactPill for all manager-facing artifact cells.
 *
 * Options:
 *  1. ✓ אשרי
 *  2. 💬 דורש תיקון (+ textarea)
 *  3. 🗨 הוסיפי הערה
 *  4. ↗ פתחי במלוא הפירוט
 *  5. 🕐 הסטוריית גרסאות (if version > 1)
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { color, radius, shadow, space, transition, fontFamily } from "./_tokens.js";
import { approveArtifact, requestArtifactRevision } from "../../api.js";
import { useToast } from "./Toast.jsx";

const PILL_STATES = {
  missing:     { bg: "transparent", fg: "#9ca3af", text: "—" },
  pending:     { bg: "#fdab3d", fg: "#fff",        text: "⏳ ממתין" },
  approved:    { bg: "#00c875", fg: "#fff",        text: "✓ אושר" },
  has_notes:   { bg: "#a25ddc", fg: "#fff",        text: "💬 הערות" },
  rejected:    { bg: "#df2f4a", fg: "#fff",        text: "✗ נדחה" },
  new_version: { bg: "#fdab3d", fg: "#fff",        text: null }, // text set dynamically
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

export default function ApprovalDropdown({ artifact, onApproved, onRevised, onOpenPayload, label }) {
  const toast = useToast();
  const btnRef = useRef(null);
  const [open, setOpen]           = useState(false);
  const [pos, setPos]             = useState(null);
  const [showReviseForm, setShowReviseForm] = useState(false);
  const [reviseNote, setReviseNote]         = useState("");
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [comment, setComment]     = useState("");
  const [busy, setBusy]           = useState(false);

  const pill = pillStateFor(artifact);
  const readonly = !artifact || ["approved", "rejected", "closed"].includes(artifact?.status);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      const menu = document.getElementById("approval-dd-menu");
      if (!btnRef.current?.contains(e.target) && !menu?.contains(e.target)) {
        closeAll();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function openMenu() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const top = r.bottom + 4;
    const left = Math.max(8, Math.min(window.innerWidth - 260, r.left - 80));
    setPos({ top, left });
    setOpen(true);
  }

  function closeAll() {
    setOpen(false);
    setShowReviseForm(false);
    setShowCommentForm(false);
    setReviseNote("");
    setComment("");
  }

  async function doApprove() {
    if (!artifact || busy) return;
    setBusy(true);
    try {
      await approveArtifact(artifact.id);
      toast.success("✓ התוצר אושר");
      onApproved?.();
      closeAll();
    } catch (e) {
      toast.error(`שגיאה: ${e.message}`);
    } finally { setBusy(false); }
  }

  async function doRevise() {
    if (!artifact || busy || !reviseNote.trim()) return;
    setBusy(true);
    try {
      await requestArtifactRevision(artifact.id, { revision_note: reviseNote.trim() });
      toast.success("💬 הערה נשלחה למחלקה");
      onRevised?.();
      closeAll();
    } catch (e) {
      toast.error(`שגיאה: ${e.message}`);
    } finally { setBusy(false); }
  }

  if (pill.state === "missing") {
    return (
      <span style={{ color: color.fgSubtle, fontSize: 13, fontFamily }}>
        {label || "—"}
      </span>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={e => { e.stopPropagation(); openMenu(); }}
        disabled={busy}
        style={{
          background: pill.bg, color: pill.fg, border: "none",
          padding: "5px 12px", borderRadius: 4,
          fontSize: 12, fontWeight: 700, fontFamily,
          cursor: "pointer", textAlign: "center",
          whiteSpace: "nowrap", transition: transition.fast,
          opacity: busy ? 0.7 : 1,
        }}
      >{pill.text}</button>

      {open && pos && (
        <div id="approval-dd-menu" style={{
          position: "fixed", top: pos.top, left: pos.left,
          background: color.surface, border: `1px solid ${color.borderDefault}`,
          borderRadius: radius.md, boxShadow: shadow.lg,
          zIndex: 9999, minWidth: 240, padding: 4,
        }} onClick={e => e.stopPropagation()}>

          {!readonly && !showReviseForm && !showCommentForm && (
            <>
              <MenuItem icon="✓" label="אשרי"         green  onClick={doApprove} />
              <MenuItem icon="💬" label="דורש תיקון"  onClick={() => setShowReviseForm(true)} />
              <MenuItem icon="🗨" label="הוסיפי הערה" onClick={() => setShowCommentForm(true)} />
            </>
          )}

          {showReviseForm && (
            <div style={{ padding: space(2) }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: color.fgDefault, marginBottom: space(2), fontFamily }}>
                מה לתקן?
              </div>
              <textarea
                autoFocus
                value={reviseNote}
                onChange={e => setReviseNote(e.target.value)}
                placeholder="הוראה ספציפית — לא רק 'לא טוב'"
                rows={4}
                style={{
                  width: "100%", padding: space(2),
                  border: `1px solid ${color.borderDefault}`, borderRadius: radius.sm,
                  fontSize: 13, fontFamily, direction: "rtl", resize: "none",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: space(2), marginTop: space(2) }}>
                <button onClick={closeAll} style={{ flex: 1, padding: space(2), background: "transparent", border: `1px solid ${color.borderDefault}`, borderRadius: radius.sm, fontSize: 13, cursor: "pointer", fontFamily }}>ביטול</button>
                <button onClick={doRevise} disabled={!reviseNote.trim() || busy} style={{ flex: 2, padding: space(2), background: "#a25ddc", color: "#fff", border: "none", borderRadius: radius.sm, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily }}>שלחי הוראה</button>
              </div>
            </div>
          )}

          {showCommentForm && (
            <div style={{ padding: space(2) }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: color.fgDefault, marginBottom: space(2), fontFamily }}>
                הערה (ללא שינוי סטטוס)
              </div>
              <textarea
                autoFocus
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="כתבי הערה..."
                rows={3}
                style={{
                  width: "100%", padding: space(2),
                  border: `1px solid ${color.borderDefault}`, borderRadius: radius.sm,
                  fontSize: 13, fontFamily, direction: "rtl", resize: "none",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: space(2), marginTop: space(2) }}>
                <button onClick={closeAll} style={{ flex: 1, padding: space(2), background: "transparent", border: `1px solid ${color.borderDefault}`, borderRadius: radius.sm, fontSize: 13, cursor: "pointer", fontFamily }}>ביטול</button>
                <button onClick={() => { toast.info("ההערה נרשמה (בפיתוח)"); closeAll(); }} disabled={!comment.trim()} style={{ flex: 2, padding: space(2), background: color.primary, color: "#fff", border: "none", borderRadius: radius.sm, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily }}>שמרי הערה</button>
              </div>
            </div>
          )}

          {!showReviseForm && !showCommentForm && (
            <>
              <div style={{ borderTop: `1px solid ${color.borderSubtle}`, margin: "4px 0" }} />
              <MenuItem icon="↗" label="פתחי במלוא הפירוט" onClick={() => { closeAll(); onOpenPayload?.(); }} />
              {(artifact?.version_number || 1) > 1 && (
                <MenuItem icon="🕐" label={`הסטוריית גרסאות (${artifact.version_number})`} onClick={() => { toast.info("הסטוריית גרסאות — בקרוב"); closeAll(); }} />
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
      <span style={{ width: 18, textAlign: "center" }}>{icon}</span>
      {label}
    </div>
  );
}

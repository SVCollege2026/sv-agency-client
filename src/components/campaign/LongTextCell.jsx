/**
 * LongTextCell — Monday "Long Text" pattern.
 * 3 modes: collapsed (truncated + tooltip) → inline edit → fullscreen modal.
 */
import React, { useState, useRef, useLayoutEffect, useEffect } from "react";
import { color, radius, shadow, space, transition, fontFamily } from "./_tokens.js";

export default function LongTextCell({ value, placeholder = "—", onSave, fieldLabel = "" }) {
  const [mode, setMode] = useState("view"); // "view" | "inline" | "modal"
  const [draft, setDraft] = useState(value || "");
  const inlineRef = useRef(null);
  const modalRef  = useRef(null);

  useEffect(() => { setDraft(value || ""); }, [value]);

  useLayoutEffect(() => {
    if (mode === "inline" && inlineRef.current) {
      inlineRef.current.focus();
      inlineRef.current.setSelectionRange(inlineRef.current.value.length, inlineRef.current.value.length);
    }
    if (mode === "modal" && modalRef.current) {
      modalRef.current.focus();
    }
  }, [mode]);

  function saveInline() {
    setMode("view");
    if (draft.trim() !== (value || "").trim()) onSave(draft.trim() || null);
  }

  function saveModal() {
    setMode("view");
    if (draft.trim() !== (value || "").trim()) onSave(draft.trim() || null);
  }

  function cancelInline() { setDraft(value || ""); setMode("view"); }
  function cancelModal()  { setDraft(value || ""); setMode("view"); }

  const truncated = (value || "").length > 60 ? value.slice(0, 60) + "…" : (value || "");

  if (mode === "modal") {
    return (
      <ModalOverlay onClose={cancelModal}>
        <div style={{
          background: color.surface, borderRadius: radius.lg, boxShadow: shadow.xl,
          width: 620, maxWidth: "95vw",
          padding: space(5), display: "flex", flexDirection: "column", gap: space(3),
        }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 15, fontWeight: 700, color: color.fgDefault, fontFamily }}>
            {fieldLabel || "עריכת טקסט"}
          </div>
          <textarea
            ref={modalRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={10}
            style={{
              width: "100%", padding: space(3),
              border: `2px solid ${color.primary}`, borderRadius: radius.md,
              fontSize: 14, fontFamily, direction: "rtl", resize: "vertical",
              outline: "none", color: color.fgDefault, background: "#fff",
              lineHeight: 1.6,
            }}
          />
          <div style={{ fontSize: 12, color: color.fgSubtle, fontFamily }}>
            {draft.length} תווים
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: space(2) }}>
            <button onClick={cancelModal} style={{
              padding: `${space(2)} ${space(4)}`, background: "transparent",
              border: `1px solid ${color.borderDefault}`, borderRadius: radius.button,
              fontSize: 14, cursor: "pointer", color: color.fgMuted, fontFamily,
            }}>ביטול</button>
            <button onClick={saveModal} style={{
              padding: `${space(2)} ${space(4)}`, background: color.primary,
              border: "none", borderRadius: radius.button,
              fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#fff", fontFamily,
            }}>שמירה</button>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  if (mode === "inline") {
    return (
      <div style={{ width: "100%", position: "relative" }}>
        <textarea
          ref={inlineRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={4}
          onBlur={saveInline}
          onKeyDown={e => {
            if (e.key === "Escape") { e.preventDefault(); cancelInline(); }
            if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); saveInline(); }
          }}
          style={{
            width: "100%", padding: "6px 8px",
            border: `2px solid ${color.primary}`, borderRadius: 4,
            fontSize: 13, fontFamily, direction: "rtl", resize: "none",
            outline: "none", color: color.fgDefault, background: "#fff",
          }}
        />
        <button
          onMouseDown={e => { e.preventDefault(); setMode("modal"); }}
          title="פתחי בחלון מלא"
          style={{
            position: "absolute", top: 4, left: 4,
            background: color.surfaceMuted, border: `1px solid ${color.borderDefault}`,
            borderRadius: 4, padding: "1px 6px", fontSize: 11, cursor: "pointer",
            color: color.fgMuted, fontFamily,
          }}>↗</button>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", position: "relative", display: "flex", alignItems: "center", gap: 4 }}>
      <div
        onClick={e => { e.stopPropagation(); setMode("inline"); }}
        title={value || placeholder}
        style={{
          flex: 1, cursor: "text", padding: "4px 8px", borderRadius: 4,
          fontSize: 13, fontFamily, color: value ? color.fgDefault : color.fgSubtle,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          transition: transition.fast, minHeight: 26,
        }}
        onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        {truncated || placeholder}
      </div>
      {value && (
        <button
          onClick={e => { e.stopPropagation(); setDraft(value || ""); setMode("modal"); }}
          title="פתחי בחלון מלא"
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 12, color: color.fgSubtle, padding: "2px 4px",
            flexShrink: 0,
          }}>↗</button>
      )}
    </div>
  );
}

function ModalOverlay({ children, onClose }) {
  useEffect(() => {
    function handler(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15,23,42,0.5)", zIndex: 10000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

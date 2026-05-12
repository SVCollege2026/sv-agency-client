/**
 * settings/_shared.jsx — שכבת פרימיטיבים משותפת לכל טאבי ההגדרות.
 * מטרה: אחידות UX, אפס שכפול סטיילים, וברירת מחדל נכונה ב-RTL + Heebo.
 */
import React from "react";
import { color, radius, shadow, space, type, transition, fontFamily, button as btnPreset, input as inputBase } from "../_tokens.js";

export const card = {
  background:  color.surface,
  borderRadius: radius.card,
  border: `1px solid ${color.borderDefault}`,
  padding:     space(5),
  marginBottom: space(4),
  boxShadow:   shadow.sm,
  direction:   "rtl",
  fontFamily,
};

export const fieldLabel = {
  display: "block",
  ...type.label,
  marginBottom: space(1.5),
  color: color.fgDefault,
};

export const fieldHint = {
  ...type.small,
  color: color.fgMuted,
  marginTop: space(1),
  lineHeight: 1.5,
};

export const input = {
  ...inputBase,
  fontFamily,
};

export const select = {
  ...inputBase,
  fontFamily,
  background: color.surfaceMuted,
  cursor: "pointer",
};

export const textarea = {
  ...inputBase,
  fontFamily,
  resize: "vertical",
  minHeight: 80,
};

export const sectionHeader = {
  ...type.h3,
  margin: 0,
  marginBottom: space(1),
  color: color.fgDefault,
};

export const subsectionHeader = {
  ...type.bodyStrong,
  color: color.primary,
  margin: 0,
  marginBottom: space(1),
};

export const saveBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: space(4),
  paddingTop: space(4),
  borderTop: `1px solid ${color.borderDefault}`,
  flexWrap: "wrap",
  gap: space(2),
};

export const primaryBtn = { ...btnPreset.primary, fontFamily };
export const secondaryBtn = { ...btnPreset.secondary, fontFamily };
export const successBtn = { ...btnPreset.success, fontFamily };
export const dangerBtn = { ...btnPreset.danger, fontFamily };
export const ghostBtn = { ...btnPreset.ghost, fontFamily };

/* ---------- primitives ---------- */

export function Section({ title, hint, children }) {
  return (
    <div style={{ marginBottom: space(6) }}>
      <h4 style={subsectionHeader}>{title}</h4>
      {hint && <div style={fieldHint}>{hint}</div>}
      <div style={{ marginTop: space(3) }}>{children}</div>
    </div>
  );
}

export function Row({ children, minCol = 220 }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(auto-fit, minmax(${minCol}px, 1fr))`,
      gap: space(3),
    }}>{children}</div>
  );
}

export function FieldBox({ label, hint, children }) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      {children}
      {hint && <div style={fieldHint}>{hint}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, disabled = false }) {
  return (
    <label style={{
      position: "relative", display: "inline-block", width: 48, height: 26,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
    }}>
      <input type="checkbox" checked={checked} disabled={disabled}
             onChange={e => onChange(e.target.checked)} style={{ display: "none" }} />
      <span style={{
        position: "absolute", inset: 0, borderRadius: 13,
        background: checked ? color.success : "#cbd5e1",
        transition: transition.fast,
      }} />
      <span style={{
        position: "absolute", top: 3,
        insetInlineStart: checked ? 25 : 3,
        width: 20, height: 20, borderRadius: "50%", background: color.surface,
        transition: transition.fast, boxShadow: shadow.sm,
      }} />
    </label>
  );
}

export function Chip({ children, onRemove, tone = "neutral" }) {
  const tones = {
    neutral: { bg: "#e5e7eb", fg: "#374151" },
    primary: { bg: "#e0e7ff", fg: "#3730a3" },
    success: { bg: color.successSoftBg, fg: color.successSoftFg },
    warning: { bg: "#fef3c7", fg: "#854d0e" },
    danger:  { bg: color.dangerSoftBg,  fg: color.dangerSoftFg },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: space(1),
      background: t.bg, color: t.fg,
      padding: `${space(1)} ${space(2.5)}`,
      borderRadius: radius.pill,
      fontSize: 12, fontWeight: 600, fontFamily,
    }}>
      {children}
      {onRemove && (
        <button onClick={onRemove} style={{
          background: "none", border: "none", padding: 0, marginInlineStart: space(0.5),
          color: t.fg, opacity: 0.7, cursor: "pointer", fontSize: 14, lineHeight: 1,
        }} aria-label="הסר">×</button>
      )}
    </span>
  );
}

/** TagList — input + chip cluster for string lists. */
export function TagList({ items = [], onChange, placeholder = "הוסיפי ולחצי Enter...", tone = "primary" }) {
  const [val, setVal] = React.useState("");
  const add = () => {
    const v = val.trim();
    if (!v) return;
    if (items.includes(v)) { setVal(""); return; }
    onChange([...items, v]);
    setVal("");
  };
  return (
    <div>
      <div style={{ display: "flex", gap: space(2), marginBottom: space(2) }}>
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          style={{ ...input, flex: 1 }}
        />
        <button onClick={add} disabled={!val.trim()} style={{
          ...primaryBtn, opacity: val.trim() ? 1 : 0.5,
        }}>הוספה</button>
      </div>
      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: space(1.5) }}>
          {items.map((it, i) => (
            <Chip key={i} tone={tone} onRemove={() => onChange(items.filter((_, j) => j !== i))}>
              {it}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

/** SaveBar — sticky save row at the bottom of any tab. */
export function SaveBar({ onSave, busy, dirty, msg }) {
  return (
    <div style={saveBarStyle}>
      <span style={{
        ...type.bodySmall,
        color: msg?.tone === "success" ? color.successSoftFg : msg?.tone === "error" ? color.dangerSoftFg : color.fgMuted,
        fontWeight: 700,
      }}>
        {msg?.text || (dirty ? "● שינויים לא שמורים" : "")}
      </span>
      <button onClick={onSave} disabled={busy || !dirty} style={{
        ...primaryBtn,
        opacity: (busy || !dirty) ? 0.5 : 1,
        cursor: (busy || !dirty) ? "not-allowed" : "pointer",
      }}>
        {busy ? "שומר..." : "💾 שמירת שינויים"}
      </button>
    </div>
  );
}

/** Coalesce a payload value with a default. Useful for reading nested keys safely. */
export function readPayload(payload, path, defaultValue) {
  const parts = path.split(".");
  let cur = payload;
  for (const p of parts) {
    if (cur == null) return defaultValue;
    cur = cur[p];
  }
  return cur === undefined || cur === null ? defaultValue : cur;
}

/** ErrorBanner — friendly error display. */
export function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div style={{
      padding: `${space(2.5)} ${space(3)}`,
      background: color.dangerSoftBg,
      color: color.dangerSoftFg,
      borderRadius: radius.md,
      marginBottom: space(3),
      ...type.bodySmall,
    }}>שגיאה: {error}</div>
  );
}

/** LoadingBlock — placeholder during initial fetch. */
export function LoadingBlock() {
  return (
    <div style={{
      padding: space(8), textAlign: "center",
      color: color.fgMuted, ...type.bodySmall,
    }}>טוען הגדרות...</div>
  );
}

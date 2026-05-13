/**
 * ActionMiniForm — generic mini-form modal for manager-initiated actions.
 * Each action defines its own fields schema; this renders them uniformly.
 */
import React, { useState, useEffect } from "react";
import { color, radius, shadow, space, fontFamily } from "./_tokens.js";

const CHANNELS = ["meta", "google_search", "google_pmax", "youtube", "tiktok", "linkedin", "instagram", "taboola"];

export default function ActionMiniForm({ action, folderId, onSubmit, onClose, busy }) {
  const [vals, setVals] = useState({});

  useEffect(() => {
    setVals({});
  }, [action?.id]);

  function set(k, v) { setVals(p => ({ ...p, [k]: v })); }

  if (!action) return null;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "rgba(15,23,42,0.45)", zIndex: 10000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: color.surface, borderRadius: radius.lg, boxShadow: shadow.xl,
        width: 440, maxWidth: "95vw", padding: space(5),
        direction: "rtl", fontFamily,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: color.fgDefault, marginBottom: space(4) }}>
          {action.icon} {action.label}
        </div>
        {action.desc && (
          <div style={{ fontSize: 13, color: color.fgMuted, marginBottom: space(3) }}>{action.desc}</div>
        )}

        {(action.fields || []).map(f => (
          <FormField key={f.key} field={f} value={vals[f.key] ?? ""} onChange={v => set(f.key, v)} />
        ))}

        <div style={{ display: "flex", gap: space(2), marginTop: space(4) }}>
          <button onClick={onClose} disabled={busy} style={{
            flex: 1, padding: `${space(2.5)} 0`,
            background: "transparent", border: `1px solid ${color.borderDefault}`,
            borderRadius: radius.button, fontSize: 14, cursor: "pointer",
            color: color.fgMuted, fontFamily,
          }}>ביטול</button>
          <button
            disabled={busy || !action.canSubmit?.(vals)}
            onClick={() => onSubmit(vals)}
            style={{
              flex: 2, padding: `${space(2.5)} 0`,
              background: busy ? color.primaryHover : color.primary,
              border: "none", borderRadius: radius.button,
              fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
              color: "#fff", fontFamily,
            }}
          >{busy ? "שולחת..." : "שלחי"}</button>
        </div>
      </div>
    </div>
  );
}

function FormField({ field, value, onChange }) {
  const style = {
    width: "100%", padding: "9px 12px",
    border: `1px solid ${color.borderDefault}`, borderRadius: 6,
    fontSize: 14, fontFamily, direction: "rtl",
    outline: "none", background: "#fff", color: color.fgDefault,
    marginBottom: space(3), display: "block",
    boxSizing: "border-box",
  };

  const label = (
    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.fgDefault, marginBottom: space(1), fontFamily }}>
      {field.label}{field.required && <span style={{ color: "#dc2626" }}> *</span>}
    </label>
  );

  if (field.type === "select" && field.options) {
    return (
      <div>
        {label}
        <select value={value} onChange={e => onChange(e.target.value)} style={style}>
          <option value="">בחרי...</option>
          {field.options.map(o => (
            <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>
              {typeof o === "string" ? o : o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "channel") {
    return (
      <div>
        {label}
        <select value={value} onChange={e => onChange(e.target.value)} style={style}>
          <option value="">בחרי ערוץ...</option>
          {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        {label}
        <input
          type="number" value={value} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || ""}
          style={style}
        />
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        {label}
        <textarea value={value} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || ""} rows={3}
          style={{ ...style, resize: "vertical" }}
        />
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder || ""}
        style={style}
      />
    </div>
  );
}

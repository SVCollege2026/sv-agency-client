/**
 * Toast.jsx — Toast notifications globally available via useToast() hook.
 *
 * Usage:
 *   import { ToastProvider, useToast } from "./Toast";
 *   wrap app: <ToastProvider><App /></ToastProvider>
 *   inside component:
 *     const toast = useToast();
 *     toast.success("נשמר!");
 *     toast.error("שגיאה: ...");
 *     toast.info("..");
 */
import React, { createContext, useContext, useState, useCallback } from "react";
import { color, radius, shadow, type, space, transition, fontFamily } from "./_tokens.js";

const ToastContext = createContext({ push: () => {} });

const TONE_STYLES = {
  success: { bg: "#15803d", icon: "✓",  ring: "#bbf7d0" },
  error:   { bg: "#b91c1c", icon: "✕",  ring: "#fecaca" },
  warning: { bg: "#a16207", icon: "⚠",  ring: "#fef3c7" },
  info:    { bg: "#1e3a5f", icon: "ℹ",  ring: "#dbeafe" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((tone, message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    const duration = opts.duration ?? (tone === "error" ? 6000 : 3500);
    setToasts(prev => [...prev, { id, tone, message, leaving: false }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 200);
      }, duration);
    }
  }, []);

  const api = {
    push,
    success: (m, o) => push("success", m, o),
    error:   (m, o) => push("error",   m, o),
    warning: (m, o) => push("warning", m, o),
    info:    (m, o) => push("info",    m, o),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div style={{
        position: "fixed", top: space(5), left: space(5), zIndex: 9999,
        display: "flex", flexDirection: "column", gap: space(2),
        pointerEvents: "none", direction: "rtl",
      }}>
        {toasts.map(t => {
          const s = TONE_STYLES[t.tone] || TONE_STYLES.info;
          return (
            <div key={t.id} style={{
              minWidth: 260,
              maxWidth: 420,
              padding: `${space(3)} ${space(4)}`,
              background: s.bg,
              color: color.fgOnDark,
              borderRadius: radius.lg,
              boxShadow: shadow.lg,
              display: "flex",
              alignItems: "flex-start",
              gap: space(3),
              animation: t.leaving
                ? "campaign-toast-out 180ms forwards cubic-bezier(0.4, 0, 1, 1)"
                : "campaign-toast-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              pointerEvents: "auto",
              fontFamily,
            }}>
              <span style={{
                fontSize: 16, fontWeight: 700,
                width: 24, height: 24, borderRadius: "50%",
                background: "rgba(255,255,255,0.25)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>{s.icon}</span>
              <div style={{ ...type.body, color: color.fgOnDark, lineHeight: "20px" }}>
                {t.message}
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

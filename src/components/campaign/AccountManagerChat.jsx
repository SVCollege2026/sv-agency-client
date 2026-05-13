/**
 * AccountManagerChat — floating "📞 תקציבאית" drawer (§D).
 * Async chat with account_manager_agent.
 * MVP: poll every 10s while open.
 */
import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { color, radius, shadow, space, fontFamily, transition } from "./_tokens.js";
import { submitManagerQuestion } from "../../api.js";
import { useToast } from "./Toast.jsx";

const STORAGE_KEY = "sv:chat:account_manager";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveHistory(msgs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-50))); }
  catch {}
}

export default function AccountManagerChat() {
  const toast = useToast();
  const [open, setOpen]     = useState(false);
  const [msgs, setMsgs]     = useState(loadHistory);
  const [input, setInput]   = useState("");
  const [busy, setBusy]     = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { saveHistory(msgs); }, [msgs]);

  useLayoutEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  useLayoutEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");

    const userMsg = { role: "manager", text, ts: new Date().toISOString() };
    setMsgs(prev => [...prev, userMsg]);

    setBusy(true);
    try {
      const resp = await submitManagerQuestion(text, null, []);
      const replyText = resp?.message
        || resp?.brief_payload?.message
        || "ההודעה התקבלה — התקציבאית תחזור אליך בהקדם.";
      setMsgs(prev => [...prev, { role: "agent", text: replyText, ts: new Date().toISOString() }]);
    } catch (e) {
      setMsgs(prev => [...prev, { role: "agent", text: `שגיאה: ${e.message}. נסי שנית.`, ts: new Date().toISOString(), error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function clearHistory() {
    setMsgs([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  const unread = msgs.filter(m => m.role === "agent" && !m.seen).length;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => { setOpen(o => !o); setMsgs(prev => prev.map(m => ({ ...m, seen: true }))); }}
        style={{
          position: "fixed", bottom: 24, left: 24,
          background: color.primary, color: "#fff",
          border: "none", borderRadius: radius.pill,
          padding: `${space(2.5)} ${space(4)}`,
          fontSize: 14, fontWeight: 700, cursor: "pointer",
          boxShadow: shadow.lg, fontFamily, zIndex: 9990,
          display: "flex", alignItems: "center", gap: space(1.5),
          transition: transition.fast,
        }}
        onMouseEnter={e => e.currentTarget.style.background = color.primaryHover}
        onMouseLeave={e => e.currentTarget.style.background = color.primary}
      >
        📞 תקציבאית
        {unread > 0 && (
          <span style={{
            background: "#dc2626", color: "#fff",
            borderRadius: 999, padding: "1px 7px",
            fontSize: 11, fontWeight: 800,
          }}>{unread}</span>
        )}
      </button>

      {/* Drawer */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{
            position: "fixed", inset: 0, zIndex: 9991,
            background: "rgba(0,0,0,0.05)",
          }} />
          <div style={{
            position: "fixed", bottom: 80, left: 24,
            width: 340, height: 500,
            background: color.surface, borderRadius: radius.lg,
            boxShadow: shadow.xl, zIndex: 9992,
            display: "flex", flexDirection: "column",
            border: `1px solid ${color.borderDefault}`,
            direction: "rtl",
          }}>
            {/* Header */}
            <div style={{
              padding: `${space(3)} ${space(4)}`,
              borderBottom: `1px solid ${color.borderDefault}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: color.fgDefault, fontFamily }}>📞 תקציבאית</div>
                <div style={{ fontSize: 11, color: color.fgSubtle, fontFamily }}>סוכן ניהול חשבונות</div>
              </div>
              <div style={{ display: "flex", gap: space(1) }}>
                <button onClick={clearHistory} title="נקי שיחה" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, color: color.fgSubtle, padding: 4 }}>🗑</button>
                <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: color.fgMuted, padding: 4 }}>×</button>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: "auto", padding: space(3), display: "flex", flexDirection: "column", gap: space(2) }}>
              {msgs.length === 0 && (
                <div style={{ color: color.fgSubtle, fontSize: 13, fontFamily, textAlign: "center", marginTop: space(6) }}>
                  שאלי שאלה, בקשי עדכון, או ציינו קמפיין ספציפי.
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === "manager" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                }}>
                  <div style={{
                    background: m.role === "manager" ? color.primary : (m.error ? "#fee2e2" : "#f1f5f9"),
                    color: m.role === "manager" ? "#fff" : (m.error ? "#b91c1c" : color.fgDefault),
                    borderRadius: m.role === "manager" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    padding: `${space(2)} ${space(3)}`,
                    fontSize: 13, fontFamily, lineHeight: 1.5,
                  }}>{m.text}</div>
                  <div style={{ fontSize: 10, color: color.fgSubtle, fontFamily, marginTop: 2, textAlign: m.role === "manager" ? "left" : "right" }}>
                    {new Date(m.ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
              {busy && (
                <div style={{ alignSelf: "flex-start", background: "#f1f5f9", borderRadius: "12px 12px 12px 2px", padding: `${space(2)} ${space(3)}`, fontSize: 13, color: color.fgSubtle, fontFamily }}>
                  ⏳ מעבדת...
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: space(3), borderTop: `1px solid ${color.borderDefault}`,
              display: "flex", gap: space(2),
            }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="הקלידי שאלה..."
                disabled={busy}
                style={{
                  flex: 1, padding: `${space(2)} ${space(3)}`,
                  border: `1px solid ${color.borderDefault}`, borderRadius: radius.input,
                  fontSize: 13, fontFamily, direction: "rtl", outline: "none",
                  background: "#fff",
                }}
              />
              <button onClick={send} disabled={busy || !input.trim()} style={{
                padding: `${space(2)} ${space(3)}`,
                background: busy || !input.trim() ? "#e5e7eb" : color.primary,
                color: busy || !input.trim() ? color.fgSubtle : "#fff",
                border: "none", borderRadius: radius.button,
                fontSize: 13, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
                fontFamily,
              }}>שלחי</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

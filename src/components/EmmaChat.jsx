/**
 * EmmaChat — floating "✨ אמה" drawer, available on every screen.
 * אמה: העוזרת התפעולית. בקשה בשפה חופשית → מפעילה יכולת קיימת → תשובה.
 * סינכרוני: POST /api/emma/ask מחזיר reply + actions ישירות.
 */
import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { color, radius, shadow, space, fontFamily, transition } from "./_tokens.js";
import { askEmma, askMedia, recordApproval, executeEmmaAction, uploadCampaignFile } from "../api.js";

const STORAGE_KEY = "sv:chat:emma";

// ערוצי-הצ'ט: אמה (מנהלת-לקוח) · מדיה (מומחה-פלטפורמה + QA) · רישום (מנציח אישורים)
const CHANNELS = [
  { id: "emma",     label: "✨ אמה",   placeholder: "בקשי מאמה, או כתבי 'מאושר...'",       tone: "#7c3aed", specialist: null },
  { id: "strategy", label: "📈 אסטרטג", placeholder: "התלבטי עם האסטרטג על מהלכים/פריסה...",  tone: "#0ea5e9", specialist: "strategy" },
  { id: "meta",     label: "ⓜ מטא",   placeholder: "שאלי את מנהל מטא (תקציב/CPL/קהלים)...",  tone: "#1877f2", specialist: "meta" },
  { id: "google",   label: "🔍 גוגל",  placeholder: "שאלי את מנהל גוגל (CPC/ביטויים)...",     tone: "#ea4335", specialist: "google" },
  { id: "record",   label: "✅ רישום", placeholder: "כתבי 'מאושר לעשות X' — וזה יירשם.",      tone: "#16a34a", specialist: null },
];
const SOURCE_META = {
  emma:     { label: "אמה",         bg: "#f1f5f9", fg: "#0f172a" },
  media:    { label: "מומחה-המדיה", bg: "#e0f2fe", fg: "#075985" },
  strategy: { label: "אסטרטג",      bg: "#e0f2fe", fg: "#075985" },
  meta:     { label: "מנהל מטא",    bg: "#e7f0ff", fg: "#1849a9" },
  google:   { label: "מנהל גוגל",   bg: "#fde8e6", fg: "#b42318" },
  record:   { label: "רישום",       bg: "#dcfce7", fg: "#166534" },
};

// תוויות ידידותיות לכלים שאמה מפעילה (מוצג כצ'יפ מתחת לתשובה)
const TOOL_LABELS = {
  investigate_media: "חקירת ביצועי מדיה",
  system_health:     "בדיקת בריאות מערכת",
  make_health:       "בדיקת בריאות Make",
};

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveHistory(msgs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-50))); }
  catch {}
}

export default function EmmaChat() {
  const [open, setOpen]   = useState(false);
  const [msgs, setMsgs]   = useState(loadHistory);
  const [input, setInput] = useState("");
  const [busy, setBusy]   = useState(false);
  const [channel, setChannel] = useState("emma"); // emma | media | record
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const fileRef   = useRef(null);

  useEffect(() => { saveHistory(msgs); }, [msgs]);
  useLayoutEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);
  useLayoutEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const ch = channel;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    const userMsg = { role: "manager", text, channel: ch, ts: new Date().toISOString() };
    setMsgs(prev => [...prev, userMsg]);

    // היסטוריה לפורמט Anthropic (user/assistant) — בלי ההודעה הנוכחית
    const history = msgs.map(m => ({
      role: m.role === "manager" ? "user" : "assistant",
      content: m.text,
    }));

    setBusy(true);
    try {
      const chan = CHANNELS.find(c => c.id === ch);
      if (chan && chan.specialist) {
        const resp = await askMedia(text, history, chan.specialist);
        setMsgs(prev => [...prev, {
          role: "agent", source: resp?.specialist || ch, specialist: resp?.specialist,
          text: resp?.reply || "המומחה לא החזיר תשובה.",
          qa_passed: resp?.qa_passed, qa_notes: resp?.qa_notes,
          ts: new Date().toISOString(), error: resp?.ok === false,
        }]);
      } else if (ch === "record") {
        const resp = await recordApproval(text);
        setMsgs(prev => [...prev, {
          role: "agent", source: "record", text: resp?.reply || "לא נרשם.",
          ts: new Date().toISOString(), error: resp?.ok === false,
        }]);
      } else {
        const resp = await askEmma(text, history);
        const actions = Array.isArray(resp?.actions) ? resp.actions : [];
        const pending = Array.isArray(resp?.pending_actions)
          ? resp.pending_actions.map(p => ({ ...p, status: "pending" })) : [];
        setMsgs(prev => [...prev, {
          role: "agent", source: "emma", text: resp?.reply || "לא הצלחתי להחזיר תשובה.",
          actions, pending, ts: new Date().toISOString(), error: resp?.ok === false,
        }]);
      }
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

  // צירוף מסמך: מעלה ל-Storage דרך /api/campaigns/upload, ומכניס קישור לתיבת ההודעה
  // כדי שתוסיפי הוראה ("תעבירי למדיה") — אמה תזהה את הקישור ותצרף אותו (attach_document).
  async function attachFile(e) {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file || busy) return;
    setBusy(true);
    try {
      const up = await uploadCampaignFile(file, { purpose: "attachment" });
      const url = up?.public_url || up?.path || "";
      const ref = `[מסמך מצורף: ${up?.name || file.name}${url ? " — " + url : ""}]`;
      setInput(prev => (prev ? prev + " " : "") + ref + " ");
      inputRef.current?.focus();
    } catch (err) {
      setMsgs(prev => [...prev, { role: "agent", text: `העלאת המסמך נכשלה: ${err.message}`, ts: new Date().toISOString(), error: true }]);
    } finally {
      setBusy(false);
    }
  }

  // אישור והפעלה של פעולה שאמה הציעה (HITL): שולח ל-/api/emma/execute
  async function approveAction(msgIdx, actIdx) {
    const act = msgs[msgIdx]?.pending?.[actIdx];
    if (!act || act.status !== "pending") return;
    const setStatus = (status, resultText) => setMsgs(prev => prev.map((m, i) => {
      if (i !== msgIdx) return m;
      const pending = (m.pending || []).map((p, j) => j === actIdx ? { ...p, status, resultText } : p);
      return { ...m, pending };
    }));
    setStatus("running");
    try {
      const res = await executeEmmaAction(act.action, act.params);
      const ok = res?.ok !== false && !res?.error;
      setStatus(ok ? "done" : "error", ok ? "בוצע ✓" : `נכשל: ${res?.error || "שגיאה"}`);
    } catch (e) {
      setStatus("error", `נכשל: ${e.message}`);
    }
  }

  return (
    <>
      {/* Floating button — bottom RIGHT (תקציבאית יושבת בצד שמאל) */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed", bottom: 24, right: 24,
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
        ✨ אמה
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9991, background: "rgba(0,0,0,0.05)" }} />
          <div style={{
            position: "fixed", bottom: 80, right: 24,
            width: "min(360px, calc(100vw - 32px))",
            height: "min(540px, calc(100dvh - 110px))",
            maxWidth: "calc(100vw - 32px)",
            background: color.surface, borderRadius: radius.lg,
            boxShadow: shadow.xl, zIndex: 9992,
            display: "flex", flexDirection: "column",
            border: `1px solid ${color.borderDefault}`,
            direction: "rtl",
          }}>
            {/* Header */}
            <div style={{ padding: `${space(3)} ${space(4)}`, borderBottom: `1px solid ${color.borderDefault}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: color.fgDefault, fontFamily }}>✨ אמה</div>
                <div style={{ fontSize: 11, color: color.fgSubtle, fontFamily }}>העוזרת התפעולית — מפעילה את המשרד</div>
              </div>
              <div style={{ display: "flex", gap: space(1) }}>
                <button onClick={clearHistory} title="שיחה חדשה — מנקה רק את התצוגה; המשימות שהעברת נשמרות במערכת"
                  style={{ background: "transparent", border: `1px solid ${color.borderDefault}`, borderRadius: radius.button, cursor: "pointer", fontSize: 11, fontWeight: 700, color: color.fgMuted, padding: "3px 8px", fontFamily }}>✏️ שיחה חדשה</button>
                <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: color.fgMuted, padding: 4 }}>×</button>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: "auto", padding: space(3), display: "flex", flexDirection: "column", gap: space(2) }}>
              {msgs.length === 0 && (
                <div style={{ color: color.fgSubtle, fontSize: 12.5, fontFamily, textAlign: "right", marginTop: space(5), lineHeight: 1.8, padding: `0 ${space(1)}` }}>
                  בחרי למטה אל מי לפנות:<br />
                  <b>✨ אמה</b> — מנהלת-הלקוח: בקשות, אישורים, שאלות.<br />
                  <b>📊 מדיה</b> — מומחה-הפלטפורמה + ה-QA שלו, ישירות.<br />
                  <b>✅ רישום</b> — "מאושר לעשות X" → נרשם במערכת.
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === "manager" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
                  {m.role !== "manager" && m.source && SOURCE_META[m.source] && (
                    <div style={{ fontSize: 10, fontWeight: 700, fontFamily, color: SOURCE_META[m.source].fg,
                                  background: SOURCE_META[m.source].bg, borderRadius: 999, padding: "1px 8px",
                                  display: "inline-block", marginBottom: 3 }}>
                      {SOURCE_META[m.source].label}{m.specialist ? ` · ${m.specialist}` : ""}
                    </div>
                  )}
                  <div style={{
                    background: m.role === "manager" ? color.primary : (m.error ? "#fee2e2" : "#f1f5f9"),
                    color: m.role === "manager" ? "#fff" : (m.error ? "#b91c1c" : color.fgDefault),
                    borderRadius: m.role === "manager" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    padding: `${space(2)} ${space(3)}`,
                    fontSize: 13, fontFamily, lineHeight: 1.6, whiteSpace: "pre-wrap",
                  }}>{m.text}</div>
                  {["media","strategy","meta","google"].includes(m.source) && (m.qa_passed === true || m.qa_passed === false) && (
                    <div style={{ marginTop: 4, fontSize: 10, fontFamily, display: "inline-block",
                                  borderRadius: 999, padding: "1px 8px",
                                  background: m.qa_passed ? "#ecfdf5" : "#fff7ed",
                                  color: m.qa_passed ? "#047857" : "#9a3412",
                                  border: `1px solid ${m.qa_passed ? "#a7f3d0" : "#fed7aa"}` }}>
                      {m.qa_passed ? "✓ עבר את ה-QA של המומחה" : "⚠ ה-QA סימן הערה"}{m.qa_notes ? ` — ${m.qa_notes}` : ""}
                    </div>
                  )}
                  {Array.isArray(m.actions) && m.actions.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {m.actions.map((a, j) => (
                        <span key={j} style={{
                          fontSize: 10, fontFamily,
                          background: a.status === "error" ? "#fef2f2" : "#ecfdf5",
                          color: a.status === "error" ? "#b91c1c" : "#047857",
                          border: `1px solid ${a.status === "error" ? "#fecaca" : "#a7f3d0"}`,
                          borderRadius: 999, padding: "1px 8px",
                        }}>
                          🔧 {TOOL_LABELS[a.tool] || a.tool}
                        </span>
                      ))}
                    </div>
                  )}
                  {Array.isArray(m.pending) && m.pending.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                      {m.pending.map((p, j) => (
                        <div key={j} style={{ border: `1px solid #fde68a`, borderRadius: 10, padding: space(2), background: "#fffbeb", fontFamily }}>
                          <div style={{ fontSize: 12, color: color.fgDefault, lineHeight: 1.5, marginBottom: 6 }}>⚡ {p.summary}</div>
                          {p.status === "pending" && (
                            <button onClick={() => approveAction(i, j)} style={{
                              padding: `${space(1.5)} ${space(3)}`, background: "#16a34a", color: "#fff",
                              border: "none", borderRadius: radius.button, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily,
                            }}>✓ אישור והפעלה</button>
                          )}
                          {p.status === "running" && <div style={{ fontSize: 12, color: color.fgSubtle }}>⏳ מפעילה...</div>}
                          {p.status === "done"    && <div style={{ fontSize: 12, color: "#047857", fontWeight: 700 }}>{p.resultText || "בוצע ✓"}</div>}
                          {p.status === "error"   && <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>{p.resultText || "נכשל"}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: color.fgSubtle, fontFamily, marginTop: 2, textAlign: m.role === "manager" ? "left" : "right" }}>
                    {new Date(m.ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
              {busy && (
                <div style={{ alignSelf: "flex-start", background: "#f1f5f9", borderRadius: "12px 12px 12px 2px", padding: `${space(2)} ${space(3)}`, fontSize: 13, color: color.fgSubtle, fontFamily }}>
                  ⏳ אמה עובדת...
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Recipient selector — אל מי את פונה: אמה / מדיה / רישום */}
            <div style={{ padding: `${space(2)} ${space(3)} 0`, display: "flex", gap: space(1) }}>
              {CHANNELS.map(c => (
                <button key={c.id} onClick={() => { setChannel(c.id); inputRef.current?.focus(); }}
                  style={{
                    flex: 1, padding: `${space(1.5)} 0`, fontSize: 11, fontWeight: 700, fontFamily,
                    cursor: "pointer", borderRadius: radius.button, transition: transition.fast,
                    border: `1px solid ${channel === c.id ? c.tone : color.borderDefault}`,
                    background: channel === c.id ? c.tone : "transparent",
                    color: channel === c.id ? "#fff" : color.fgMuted,
                  }}>{c.label}</button>
              ))}
            </div>

            {/* Input — תיבת-כתיבה שגדלה עם הטקסט */}
            <div style={{ padding: space(3), display: "flex", gap: space(2), alignItems: "flex-end" }}>
              <input ref={fileRef} type="file" onChange={attachFile} style={{ display: "none" }}
                     accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.svg" />
              <button onClick={() => fileRef.current?.click()} disabled={busy} title="צרף מסמך"
                style={{ padding: `${space(2)} ${space(2)}`, background: "transparent",
                         border: `1px solid ${color.borderDefault}`, borderRadius: radius.button, alignSelf: "flex-end",
                         fontSize: 16, cursor: busy ? "not-allowed" : "pointer", lineHeight: 1 }}>📎</button>
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                onChange={e => setInput(e.target.value)}
                onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"; }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={(CHANNELS.find(c => c.id === channel) || CHANNELS[0]).placeholder}
                disabled={busy}
                style={{ flex: 1, padding: `${space(2)} ${space(3)}`, border: `1px solid ${color.borderDefault}`,
                         borderRadius: radius.input, fontSize: 13, fontFamily, direction: "rtl", outline: "none",
                         background: "#fff", resize: "none", overflowY: "auto", maxHeight: 160, lineHeight: 1.5 }}
              />
              <button onClick={send} disabled={busy || !input.trim()} style={{
                padding: `${space(2)} ${space(3)}`, alignSelf: "flex-end",
                background: busy || !input.trim() ? "#e5e7eb" : color.primary,
                color: busy || !input.trim() ? color.fgSubtle : "#fff",
                border: "none", borderRadius: radius.button,
                fontSize: 13, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", fontFamily,
              }}>שלחי</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/**
 * MakeHub.jsx — slim, manager-focused version.
 *
 * Per manager feedback:
 *   "make מהממשק זה רק במידה וצריך להגדיר או לעדכן משהו חדש בסנריוס —
 *    אבל לא אמורים לראות את כל הרשימה הזו פה."
 *
 * What the manager sees here is INTENTIONALLY limited:
 *   • 🚦 Health status — green when all flowing, alerts when not
 *   • 🔬 Closed-loop verifier — proves Meta leads actually arrive in Fireberry
 *   • ➕ Request a NEW scenario (when she needs one) — opens a blocker
 *
 * What's hidden (lives in DB, used by agents internally):
 *   • The 55-row inventory list
 *   • Per-scenario mark-as-relevant flow
 *   • Scenario documentation (lives in an external Excel / docs table)
 */
import React, { useEffect, useState } from "react";
import {
  listMakeHealthEvents, runMakeHealth,
  verifyMetaToFireberry, requestNewMakeScenario,
} from "../../api.js";
import { color, radius, shadow, space, type, transition, fontFamily, button as btn, pill } from "./_tokens.js";
import { useToast } from "./Toast.jsx";
import { SkeletonCard } from "./Skeleton.jsx";
import { ApprovalGuardBanner } from "./ApprovalGuard.jsx";

const card = {
  background: color.surface, borderRadius: radius.card,
  border: `1px solid ${color.borderDefault}`, padding: space(5),
  marginBottom: space(4), boxShadow: shadow.sm,
};

const HEALTH_TONES = {
  ok:            { tone: "success", icon: "✓",  label: "תקין" },
  warning:       { tone: "warning", icon: "⚠",  label: "אזהרה" },
  critical:      { tone: "danger",  icon: "✗",  label: "קריטי" },
  billing_issue: { tone: "danger",  icon: "💳", label: "בעיית תשלום" },
  disconnected:  { tone: "danger",  icon: "🔌", label: "נותק" },
};

export default function MakeHub() {
  const toast = useToast();

  return (
    <div style={{ direction: "rtl", fontFamily }}>
      <ApprovalGuardBanner context="general" />

      <div style={{
        background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: radius.md,
        padding: `${space(3)} ${space(4)}`, marginBottom: space(4),
        ...type.bodySmall, color: "#1e3a8a", lineHeight: 1.6,
      }}>
        💡 <strong>MAKE זה לא מסך תפעולי שלך.</strong> 55 התרחישים שמחברים את Meta ל-Fireberry,
        מעבירים לידים, ומפעילים אוטומציות — כולם רצים ברקע בלי שתצטרכי להסתכל עליהם.
        כאן את רואה רק שלושה דברים: <strong>(1)</strong> אם משהו נשבר, <strong>(2)</strong>
        אם הלידים באמת מגיעים מ-Meta ל-Fireberry, <strong>(3)</strong> כפתור לבקש תרחיש חדש
        כשצריך משהו שלא קיים.
      </div>

      <ArrivalVerifierCard toast={toast} />
      <HealthCard toast={toast} />
      <RequestNewScenarioCard toast={toast} />
    </div>
  );
}

/* ─── Section 1 — closed-loop verifier ─────────────────────────────────── */

function ArrivalVerifierCard({ toast }) {
  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  async function run() {
    setRunning(true); setError(null);
    try {
      const r = await verifyMetaToFireberry({ hoursBack: 24 });
      setResult(r);
      if (r.severity === "critical") toast.error(`✗ ${r.missing} לידים לא הגיעו ל-Fireberry`);
      else if (r.severity === "warning") toast.warning(`⚠ ${r.missing} לידים לא הגיעו ל-Fireberry`);
      else toast.success(`✓ כל ${r.total_leads} הלידים הגיעו`);
    } catch (e) { setError(e.message); toast.error(`שגיאה: ${e.message}`); }
    finally { setRunning(false); }
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: space(3) }}>
        <div>
          <h3 style={{ ...type.h3, margin: 0 }}>🔬 בדיקה: לידים מ-Meta הגיעו ל-Fireberry?</h3>
          <div style={{ ...type.bodySmall, color: color.fgMuted, marginTop: space(1) }}>
            סוכן ייעודי שבודק לא רק "התרחיש לא קרס" — אלא שכל ליד שהושלם בטופס של Meta אכן יושב כ-Account ב-Fireberry.
          </div>
        </div>
        <button onClick={run} disabled={running} style={{
          ...btn.primary, opacity: running ? 0.6 : 1, cursor: running ? "not-allowed" : "pointer",
        }}>
          {running ? "בודקת..." : "🔬 הריצי בדיקה (24 שעות אחרונות)"}
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: space(3), padding: space(3),
          background: color.dangerSoftBg, color: color.dangerSoftFg,
          borderRadius: radius.md,
        }}>שגיאה: {error}</div>
      )}

      {result && (
        <ArrivalResultBox result={result} />
      )}
    </div>
  );
}

function ArrivalResultBox({ result }) {
  const isOk = result.severity === "ok" || result.severity === null;
  const tone = isOk ? "success" : (result.severity === "critical" ? "danger" : "warning");
  const bg = tone === "success" ? "#f0fdf4" : tone === "warning" ? "#fffbeb" : "#fef2f2";
  const border = tone === "success" ? "#bbf7d0" : tone === "warning" ? "#fbbf24" : "#fca5a5";
  const fg = tone === "success" ? "#15803d" : tone === "warning" ? "#854d0e" : "#991b1b";

  return (
    <div style={{
      marginTop: space(4), padding: space(4),
      background: bg, border: `1px solid ${border}`, borderRadius: radius.md,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: space(2), marginBottom: space(2) }}>
        <span style={{ fontSize: 28 }}>{isOk ? "✅" : (result.severity === "critical" ? "🔴" : "⚠")}</span>
        <span style={{ ...type.h3, color: fg, margin: 0 }}>
          {result.total_leads === 0
            ? "אין לידים מ-Meta ב-24 שעות אחרונות"
            : isOk
              ? `כל ${result.total_leads} הלידים הגיעו ל-Fireberry`
              : `${result.missing} מתוך ${result.total_leads} לידים חסרים ב-Fireberry`}
        </span>
      </div>
      {result.total_leads > 0 && (
        <div style={{ display: "flex", gap: space(4), flexWrap: "wrap", ...type.bodySmall, color: fg }}>
          <div>סה"כ: <strong>{result.total_leads}</strong></div>
          <div>נמצאו: <strong>{result.found}</strong></div>
          <div>חסרים: <strong>{result.missing}</strong></div>
        </div>
      )}
      {result.missing_phones && result.missing_phones.length > 0 && (
        <div style={{ marginTop: space(2.5), padding: space(2.5), background: "rgba(255,255,255,0.5)", borderRadius: radius.sm }}>
          <div style={{ ...type.label, color: fg, marginBottom: space(1) }}>טלפונים חסרים (עד 20 ראשונים)</div>
          <div style={{ ...type.small, color: fg, fontFamily: "monospace" }}>
            {result.missing_phones.join(" · ")}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Section 2 — health events (when something breaks) ─────────────────── */

function HealthCard({ toast }) {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError]     = useState(null);

  async function load() {
    setLoading(true); setError(null);
    try { setEvents(await listMakeHealthEvents({ status: "open", limit: 50 })); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function doRun() {
    setRunning(true);
    try {
      await runMakeHealth();
      toast.success("🚦 בדיקת בריאות הסתיימה");
      await load();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setRunning(false); }
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: space(3) }}>
        <div>
          <h3 style={{ ...type.h3, margin: 0 }}>🚦 בריאות התרחישים</h3>
          <div style={{ ...type.bodySmall, color: color.fgMuted, marginTop: space(1) }}>
            רק התראות פתוחות. כאשר הכל תקין — אין מה להציג.
          </div>
        </div>
        <button onClick={doRun} disabled={running} style={{
          ...btn.secondary, opacity: running ? 0.6 : 1,
        }}>
          {running ? "בודקת..." : "🚦 הריצי בדיקה"}
        </button>
      </div>

      {error && (
        <div style={{
          padding: space(3), background: color.dangerSoftBg, color: color.dangerSoftFg,
          borderRadius: radius.md, marginTop: space(3),
        }}>שגיאה: {error}</div>
      )}

      {loading && <div style={{ marginTop: space(3) }}><SkeletonCard /></div>}

      {!loading && events.length === 0 && (
        <div style={{ marginTop: space(3), padding: space(6), background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: radius.md, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: space(2) }}>✅</div>
          <div style={{ ...type.bodyStrong, color: "#15803d" }}>הכל תקין</div>
          <div style={{ ...type.bodySmall, color: "#166534", marginTop: space(1) }}>
            אין אירועי בריאות פתוחים. כל התרחישים פועלים כצפוי.
          </div>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div style={{ marginTop: space(3), display: "flex", flexDirection: "column", gap: space(2) }}>
          {events.map(e => {
            const sev = HEALTH_TONES[e.event_type] || HEALTH_TONES.warning;
            return (
              <div key={e.id} style={{
                padding: space(3), border: `1px solid ${color.borderDefault}`,
                borderRadius: radius.md, background: color.surfaceMuted,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: space(3), flexWrap: "wrap" }}>
                  <div style={{ fontSize: 24 }}>{sev.icon}</div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: space(2), flexWrap: "wrap", marginBottom: space(1) }}>
                      <span style={{ ...type.bodyStrong, color: color.fgDefault }}>
                        {e.scenario_name || "תרחיש לא ידוע"}
                      </span>
                      <span style={pill(sev.tone)}>{sev.label}</span>
                    </div>
                    {e.details && (
                      <div style={{ ...type.bodySmall, color: color.fgDefault, marginBottom: space(1.5) }}>
                        {e.details}
                      </div>
                    )}
                    {e.action_needed && (
                      <div style={{
                        padding: space(2), background: "#fff", borderRadius: radius.sm,
                        border: `1px dashed ${color.borderDefault}`,
                        ...type.small, color: color.fgDefault, marginTop: space(1),
                      }}>
                        <strong>פעולה נדרשת:</strong> {e.action_needed}
                      </div>
                    )}
                    <div style={{ ...type.small, color: color.fgSubtle, marginTop: space(1.5) }}>
                      {e.detected_at && new Date(e.detected_at).toLocaleString("he-IL")}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Section 3 — request a NEW scenario ────────────────────────────────── */

function RequestNewScenarioCard({ toast }) {
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose]     = useState("");
  const [platform, setPlatform]   = useState("meta");
  const [urgency, setUrgency]     = useState("normal");
  const [notes, setNotes]         = useState("");
  const [busy, setBusy]           = useState(false);

  async function submit() {
    if (!purpose.trim()) { toast.warning("נא לתאר את מטרת התרחיש"); return; }
    setBusy(true);
    try {
      const r = await requestNewMakeScenario({
        purpose: purpose.trim(),
        platform,
        urgency,
        notes: notes.trim() || null,
      });
      toast.success("✓ הבקשה נרשמה. תיווצר משימה לאדמין לבנייה ידנית.");
      setOpen(false); setPurpose(""); setNotes(""); setUrgency("normal");
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  if (!open) {
    return (
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: space(3) }}>
          <div>
            <h3 style={{ ...type.h3, margin: 0 }}>➕ בקשת תרחיש חדש</h3>
            <div style={{ ...type.bodySmall, color: color.fgMuted, marginTop: space(1) }}>
              כשאת צריכה משהו ש-make לא עושה כיום — תיאור חופשי בעברית של מה רוצים שיקרה.
              לא מבצע פעולה אוטומטית — נוצרת משימה לבנייה ידנית.
            </div>
          </div>
          <button onClick={() => setOpen(true)} style={btn.primary}>
            ➕ בקשי תרחיש חדש
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <h3 style={{ ...type.h3, margin: 0, marginBottom: space(3) }}>➕ בקשת תרחיש חדש</h3>

      <label style={{ display: "block", marginBottom: space(3) }}>
        <div style={{ ...type.label, marginBottom: space(1) }}>מה התרחיש צריך לעשות? *</div>
        <textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={3}
                  placeholder='לדוגמה: "כשליד מ-Google ממלא טופס לקורס X — לשלוח SMS אוטומטי תוך 5 דקות וגם להכניס אותו לרשימת תפוצה ב-Mailchimp"'
                  style={{
                    width: "100%", padding: space(3),
                    border: `1px solid ${color.borderDefault}`, borderRadius: radius.md,
                    fontSize: 14, fontFamily, resize: "vertical", direction: "rtl",
                  }} />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: space(2), marginBottom: space(3) }}>
        <label>
          <div style={{ ...type.label, marginBottom: space(1) }}>פלטפורמה</div>
          <select value={platform} onChange={e => setPlatform(e.target.value)}
                  style={{ width: "100%", padding: space(2), borderRadius: radius.md, border: `1px solid ${color.borderDefault}`, fontFamily }}>
            <option value="meta">Meta</option>
            <option value="google">Google</option>
            <option value="tiktok">TikTok</option>
            <option value="other">אחר</option>
          </select>
        </label>
        <label>
          <div style={{ ...type.label, marginBottom: space(1) }}>דחיפות</div>
          <select value={urgency} onChange={e => setUrgency(e.target.value)}
                  style={{ width: "100%", padding: space(2), borderRadius: radius.md, border: `1px solid ${color.borderDefault}`, fontFamily }}>
            <option value="low">נמוכה</option>
            <option value="normal">רגילה</option>
            <option value="high">גבוהה</option>
          </select>
        </label>
      </div>

      <label style={{ display: "block", marginBottom: space(3) }}>
        <div style={{ ...type.label, marginBottom: space(1) }}>הערות נוספות (אופציונלי)</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="לדוגמה: 'אם זה לוקח יותר משבוע — להגיד לי'"
                  style={{
                    width: "100%", padding: space(2.5),
                    border: `1px solid ${color.borderDefault}`, borderRadius: radius.md,
                    fontSize: 13, fontFamily, resize: "vertical", direction: "rtl",
                  }} />
      </label>

      <div style={{ display: "flex", gap: space(2), justifyContent: "flex-end" }}>
        <button onClick={() => { setOpen(false); setPurpose(""); setNotes(""); }}
                disabled={busy} style={btn.secondary}>ביטול</button>
        <button onClick={submit} disabled={busy || !purpose.trim()} style={{
          ...btn.primary, opacity: (busy || !purpose.trim()) ? 0.5 : 1,
        }}>{busy ? "שולחת..." : "✓ שלחי בקשה"}</button>
      </div>
    </div>
  );
}

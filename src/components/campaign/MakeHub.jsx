/**
 * MakeHub.jsx — חיבור ה-55 תרחישים של make.com לממשק הניהול.
 *
 * Three sections in one panel:
 *   1. Inventory — list of cataloged scenarios, mark-relevant + business label.
 *   2. Health    — recent events (errors, billing, disconnects).
 *   3. Actions   — sync inventory now, run health check now.
 *
 * Backend already provides: GET inventory, POST mark-relevant,
 * POST inventory/sync, POST health/run, GET health/events.
 * No new endpoints needed for PR 5; "request new scenario" is deferred
 * because backend builder/request requires a workflow_item_id link.
 */
import React, { useEffect, useState } from "react";
import {
  listMakeInventory, markMakeRelevant, syncMakeInventory,
  runMakeHealth, listMakeHealthEvents,
} from "../../api.js";
import { color, radius, shadow, space, type, transition, fontFamily, button as btn, pill } from "./_tokens.js";
import { useToast } from "./Toast.jsx";
import { SkeletonCard } from "./Skeleton.jsx";

const STATUS_TONES = {
  active:      { tone: "success", label: "פעיל" },
  inactive:    { tone: "neutral", label: "כבוי" },
  paused:      { tone: "warning", label: "מושהה" },
  error:       { tone: "danger",  label: "תקלה" },
  unknown:     { tone: "neutral", label: "לא ידוע" },
};

const HEALTH_TONES = {
  ok:             { tone: "success", icon: "✓",  label: "תקין" },
  warning:        { tone: "warning", icon: "⚠",  label: "אזהרה" },
  critical:       { tone: "danger",  icon: "✗",  label: "קריטי" },
  billing_issue:  { tone: "danger",  icon: "💳", label: "בעיית תשלום" },
  disconnected:   { tone: "danger",  icon: "🔌", label: "נותק" },
};

const card = {
  background: color.surface, borderRadius: radius.card,
  border: `1px solid ${color.borderDefault}`, padding: space(5),
  marginBottom: space(4), boxShadow: shadow.sm,
};

export default function MakeHub() {
  const toast = useToast();
  const [section, setSection] = useState("inventory");

  return (
    <div style={{ direction: "rtl", fontFamily }}>
      <div style={{
        background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: radius.md,
        padding: `${space(3)} ${space(4)}`, marginBottom: space(4),
        ...type.bodySmall, color: "#1e3a8a", lineHeight: 1.6,
      }}>
        💡 כאן את רואה את <strong>כל התרחישים של make.com</strong> ששייכים לחשבון, ובוחרת איזה מהם רלוונטיים למערכת הקמפיינים.
        תרחיש שמסומן כרלוונטי — המערכת תעקוב אחריו (בריאות, ביצועים, התראות אם הוא נופל).
        תרחישים לא מסומנים ממשיכים לעבוד כרגיל ב-Make, אבל המערכת לא נוגעת בהם.
      </div>

      <div style={{
        display: "flex", gap: space(1), borderBottom: `2px solid ${color.borderSubtle}`,
        marginBottom: space(4),
      }}>
        {[
          { id: "inventory", icon: "📋", label: "Inventory (תרחישים)" },
          { id: "health",    icon: "🚦", label: "בריאות" },
        ].map(s => {
          const active = section === s.id;
          return (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              padding: `${space(2.5)} ${space(4)}`, border: "none", background: "transparent",
              cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? color.primary : color.fgMuted,
              borderBottom: `3px solid ${active ? color.primary : "transparent"}`,
              marginBottom: -2, whiteSpace: "nowrap", fontFamily,
              transition: transition.fast,
            }}>
              <span style={{ marginInlineEnd: space(1.5) }}>{s.icon}</span>{s.label}
            </button>
          );
        })}
      </div>

      {section === "inventory" && <InventorySection toast={toast} />}
      {section === "health"    && <HealthSection toast={toast} />}
    </div>
  );
}

/* ─── Inventory ──────────────────────────────────────────────────────────── */

function InventorySection({ toast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState("all"); // "all" | "relevant" | "active"
  const [search, setSearch]   = useState("");
  const [markingDialog, setMarkingDialog] = useState(null);

  async function load() {
    setLoading(true); setError(null);
    try { setRows(await listMakeInventory({ activeOnly: false })); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function doSync() {
    setSyncing(true);
    try {
      const res = await syncMakeInventory();
      toast.success(`🔄 סינכרון הסתיים — ${res?.synced_count ?? "?"} תרחישים`);
      await load();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setSyncing(false); }
  }

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (filter === "relevant" && !r.is_relevant_for_campaigns) return false;
    if (filter === "active"   && !r.is_active) return false;
    if (q && !(r.name || "").toLowerCase().includes(q)) return false;
    return true;
  });

  const stats = {
    total:    rows.length,
    relevant: rows.filter(r => r.is_relevant_for_campaigns).length,
    active:   rows.filter(r => r.is_active).length,
  };

  return (
    <div>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: space(3) }}>
          <div>
            <h3 style={{ ...type.h3, margin: 0 }}>📋 כל התרחישים</h3>
            <div style={{ ...type.bodySmall, color: color.fgMuted, marginTop: space(1) }}>
              {stats.total} סה"כ · {stats.active} פעילים ב-Make · {stats.relevant} מסומנים כרלוונטיים
            </div>
          </div>
          <button onClick={doSync} disabled={syncing} style={{
            ...btn.primary, opacity: syncing ? 0.6 : 1, cursor: syncing ? "not-allowed" : "pointer",
          }}>
            {syncing ? "מסנכרן..." : "🔄 רענן Inventory"}
          </button>
        </div>

        <div style={{ display: "flex", gap: space(2), marginTop: space(4), flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: space(1) }}>
            {[
              { id: "all",      label: "הכל",          count: stats.total },
              { id: "relevant", label: "רלוונטיים",     count: stats.relevant },
              { id: "active",   label: "פעילים ב-Make", count: stats.active },
            ].map(f => {
              const on = filter === f.id;
              return (
                <button key={f.id} onClick={() => setFilter(f.id)} style={{
                  padding: `${space(1.5)} ${space(3)}`,
                  border: `1px solid ${on ? color.primary : color.borderDefault}`,
                  background: on ? color.primary : color.surface,
                  color: on ? "#fff" : color.fgMuted,
                  borderRadius: radius.pill, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily,
                }}>
                  {f.label} <span style={{
                    background: on ? "rgba(255,255,255,0.25)" : color.surfaceMuted,
                    padding: `0 ${space(1.5)}`, borderRadius: radius.pill, marginInlineStart: space(1),
                    fontSize: 11,
                  }}>{f.count}</span>
                </button>
              );
            })}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
                 placeholder="🔎 חיפוש לפי שם תרחיש..."
                 style={{
                   padding: `${space(2)} ${space(3)}`, border: `1px solid ${color.borderDefault}`,
                   borderRadius: radius.md, fontSize: 13, flex: 1, minWidth: 200, fontFamily,
                 }} />
        </div>
      </div>

      {error && (
        <div style={{
          padding: space(3), background: color.dangerSoftBg, color: color.dangerSoftFg,
          borderRadius: radius.md, marginBottom: space(3),
        }}>שגיאה: {error}</div>
      )}

      {loading && (
        <div style={card}><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: space(10) }}>
          <div style={{ fontSize: 56, marginBottom: space(3) }}>🔌</div>
          <div style={{ ...type.h3, marginBottom: space(2) }}>
            {rows.length === 0 ? "עוד לא רץ סינכרון" : "אין תוצאות לחיפוש"}
          </div>
          <div style={{ ...type.bodySmall, color: color.fgMuted }}>
            {rows.length === 0
              ? 'לחצי "🔄 רענן Inventory" למעלה כדי להוריד את התרחישים מ-make.com.'
              : "נסי מילת חיפוש אחרת או החליפי פילטר."}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={card}>
          <div style={{ display: "flex", flexDirection: "column", gap: space(2) }}>
            {filtered.map(s => (
              <ScenarioRow key={s.id} scenario={s} onMark={() => setMarkingDialog(s)} />
            ))}
          </div>
        </div>
      )}

      {markingDialog && (
        <MarkRelevantDialog
          scenario={markingDialog}
          onClose={() => setMarkingDialog(null)}
          onDone={() => { setMarkingDialog(null); load(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function ScenarioRow({ scenario, onMark }) {
  const statusInfo = STATUS_TONES[scenario.status?.toLowerCase()] || STATUS_TONES.unknown;
  return (
    <div style={{
      padding: space(3), border: `1px solid ${scenario.is_relevant_for_campaigns ? "#bbf7d0" : color.borderDefault}`,
      background: scenario.is_relevant_for_campaigns ? "#f0fdf4" : color.surfaceMuted,
      borderRadius: radius.md,
      display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: space(2),
    }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ display: "flex", alignItems: "center", gap: space(2), flexWrap: "wrap" }}>
          <span style={{ ...type.bodyStrong, color: color.fgDefault }}>{scenario.name || "ללא שם"}</span>
          <span style={pill(statusInfo.tone)}>{statusInfo.label}</span>
          {scenario.is_relevant_for_campaigns && (
            <span style={pill("success")}>✓ רלוונטי</span>
          )}
          {scenario.inferred_category && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: color.fgMuted,
              padding: `2px ${space(2)}`, background: color.surface,
              border: `1px solid ${color.borderSubtle}`, borderRadius: radius.pill,
            }}>{scenario.inferred_category}</span>
          )}
        </div>
        <div style={{ ...type.small, color: color.fgMuted, marginTop: space(1) }}>
          {scenario.team_name && <span style={{ marginInlineEnd: space(3) }}>צוות: <strong>{scenario.team_name}</strong></span>}
          {scenario.last_run_at && <span style={{ marginInlineEnd: space(3) }}>ריצה אחרונה: <strong>{new Date(scenario.last_run_at).toLocaleString("he-IL")}</strong></span>}
          {scenario.business_label && <span>תיוג: <strong>{scenario.business_label}</strong></span>}
        </div>
      </div>
      {!scenario.is_relevant_for_campaigns && (
        <button onClick={onMark} style={{ ...btn.secondary, fontSize: 12, padding: `${space(1.5)} ${space(3)}` }}>
          סמני כרלוונטי
        </button>
      )}
    </div>
  );
}

function MarkRelevantDialog({ scenario, onClose, onDone, toast }) {
  const [reason, setReason]   = useState("");
  const [label, setLabel]     = useState("");
  const [busy, setBusy]       = useState(false);

  async function submit() {
    if (!reason.trim()) { toast.warning("נא להסביר למה התרחיש רלוונטי"); return; }
    setBusy(true);
    try {
      await markMakeRelevant(scenario.id, {
        relevance_reason: reason.trim(),
        business_label: label.trim() || null,
        confirmed_by: "marketing_manager",
      });
      toast.success("✓ התרחיש סומן כרלוונטי");
      onDone();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: space(4),
      direction: "rtl", fontFamily,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: color.surface, borderRadius: radius.lg, padding: space(5),
        maxWidth: 540, width: "100%", boxShadow: shadow.xl,
      }}>
        <h3 style={{ ...type.h2, margin: `0 0 ${space(2)}` }}>סימון תרחיש כרלוונטי</h3>
        <div style={{ ...type.bodySmall, color: color.fgMuted, marginBottom: space(4) }}>
          תרחיש: <strong style={{ color: color.fgDefault }}>{scenario.name}</strong>
        </div>

        <div style={{ marginBottom: space(3) }}>
          <label style={{ ...type.label, display: "block", marginBottom: space(1) }}>למה התרחיש רלוונטי? *</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                    placeholder='לדוגמה: "מעביר לידים מ-Meta ל-Fireberry — קריטי לתהליך"'
                    style={{
                      width: "100%", padding: space(2.5),
                      border: `1px solid ${color.borderDefault}`, borderRadius: radius.md,
                      fontSize: 14, fontFamily, resize: "vertical", direction: "rtl",
                    }} />
        </div>

        <div style={{ marginBottom: space(4) }}>
          <label style={{ ...type.label, display: "block", marginBottom: space(1) }}>תיוג עסקי (אופציונלי)</label>
          <input value={label} onChange={e => setLabel(e.target.value)}
                 placeholder='לדוגמה: "lead_routing", "creative_pipeline"'
                 style={{
                   width: "100%", padding: space(2.5),
                   border: `1px solid ${color.borderDefault}`, borderRadius: radius.md,
                   fontSize: 14, fontFamily, direction: "rtl",
                 }} />
        </div>

        <div style={{ display: "flex", gap: space(2), justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={busy} style={btn.secondary}>ביטול</button>
          <button onClick={submit} disabled={busy || !reason.trim()} style={{
            ...btn.primary, opacity: (busy || !reason.trim()) ? 0.5 : 1,
          }}>{busy ? "שומר..." : "✓ סמני כרלוונטי"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Health ─────────────────────────────────────────────────────────────── */

function HealthSection({ toast }) {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError]     = useState(null);
  const [statusFilter, setStatusFilter] = useState("open");

  async function load() {
    setLoading(true); setError(null);
    try { setEvents(await listMakeHealthEvents({ status: statusFilter, limit: 100 })); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  async function doRun() {
    setRunning(true);
    try {
      const res = await runMakeHealth();
      toast.success(`🚦 בדיקת בריאות הסתיימה — ${res?.events_created ?? "0"} אירועים חדשים`);
      await load();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setRunning(false); }
  }

  return (
    <div>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: space(3) }}>
          <div>
            <h3 style={{ ...type.h3, margin: 0 }}>🚦 בריאות התרחישים</h3>
            <div style={{ ...type.bodySmall, color: color.fgMuted, marginTop: space(1) }}>
              {events.length} אירועים {statusFilter === "open" ? "פתוחים" : "סגורים"}
            </div>
          </div>
          <button onClick={doRun} disabled={running} style={{
            ...btn.primary, opacity: running ? 0.6 : 1, cursor: running ? "not-allowed" : "pointer",
          }}>
            {running ? "בודקת..." : "🚦 הריצי בדיקה עכשיו"}
          </button>
        </div>

        <div style={{ display: "flex", gap: space(1), marginTop: space(3) }}>
          {[
            { id: "open",   label: "פתוחים" },
            { id: "closed", label: "סגורים" },
          ].map(s => {
            const on = statusFilter === s.id;
            return (
              <button key={s.id} onClick={() => setStatusFilter(s.id)} style={{
                padding: `${space(1.5)} ${space(3)}`,
                border: `1px solid ${on ? color.primary : color.borderDefault}`,
                background: on ? color.primary : color.surface,
                color: on ? "#fff" : color.fgMuted,
                borderRadius: radius.pill, fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily,
              }}>{s.label}</button>
            );
          })}
        </div>
      </div>

      {error && (
        <div style={{
          padding: space(3), background: color.dangerSoftBg, color: color.dangerSoftFg,
          borderRadius: radius.md, marginBottom: space(3),
        }}>שגיאה: {error}</div>
      )}

      {loading && <div style={card}><SkeletonCard /><SkeletonCard /></div>}

      {!loading && events.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: space(10) }}>
          <div style={{ fontSize: 56, marginBottom: space(3) }}>✅</div>
          <div style={{ ...type.h3, marginBottom: space(2) }}>אין אירועי בריאות {statusFilter === "open" ? "פתוחים" : "סגורים"}</div>
          <div style={{ ...type.bodySmall, color: color.fgMuted }}>
            {statusFilter === "open"
              ? "כל התרחישים מסומנים כרלוונטיים פועלים תקין."
              : "עדיין לא נסגרו אירועים."}
          </div>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div style={card}>
          <div style={{ display: "flex", flexDirection: "column", gap: space(2) }}>
            {events.map(e => {
              const sev = HEALTH_TONES[e.event_type] || HEALTH_TONES.warning;
              return (
                <div key={e.id} style={{
                  padding: space(3), border: `1px solid ${color.borderDefault}`,
                  borderRadius: radius.md, background: color.surfaceMuted,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: space(3), flexWrap: "wrap" }}>
                    <div style={{ fontSize: 24, lineHeight: 1 }}>{sev.icon}</div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: space(2), flexWrap: "wrap", marginBottom: space(1) }}>
                        <span style={{ ...type.bodyStrong, color: color.fgDefault }}>
                          {e.scenario_name || "תרחיש לא ידוע"}
                        </span>
                        <span style={pill(sev.tone)}>{sev.label}</span>
                        {e.severity && <span style={{ ...type.small, color: color.fgSubtle }}>· {e.severity}</span>}
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
                        {e.status === "closed" && e.closed_at && <span> · נסגר: {new Date(e.closed_at).toLocaleString("he-IL")}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * NotificationsTab.jsx — Settings · התראות.
 *
 * Three sections:
 *   • Channels (in-app required, email optional) — existing rows in `notification_channels`.
 *   • Per-event-type preferences — `notification_preferences` upsert per (role, event, channel).
 *   • Quiet hours + severity routing — stored in media_settings.payload.notifications.
 */
import React, { useEffect, useState } from "react";
import {
  listNotificationChannels, toggleNotificationChannel,
  listNotificationPreferences, upsertNotificationPreference,
  getGeneralSettings, updateGeneralSettings,
} from "../../../api.js";
import { color, radius, space, type, fontFamily } from "../_tokens.js";
import { useToast } from "../Toast.jsx";
import {
  card, Section, Row, FieldBox, Toggle, SaveBar, ErrorBanner, LoadingBlock,
  input, select, fieldHint, fieldLabel, primaryBtn, readPayload,
} from "./_shared.jsx";

const EVENT_TYPES = [
  { id: "approval_required",      label: "תוצר ממתין לאישור",       severity: "warning" },
  { id: "approval_overdue",       label: "אישור באיחור",            severity: "warning" },
  { id: "recommendation_new",     label: "המלצה חדשה",              severity: "info" },
  { id: "recommendation_critical",label: "המלצה קריטית",            severity: "critical" },
  { id: "campaign_ready",         label: "קמפיין מוכן לעלייה",      severity: "info" },
  { id: "campaign_live",          label: "קמפיין באוויר",            severity: "info" },
  { id: "campaign_underperform",  label: "קמפיין מתחת ליעד",        severity: "warning" },
  { id: "budget_overrun",         label: "חריגה מתקציב",            severity: "critical" },
  { id: "platform_disconnect",    label: "ניתוק פלטפורמה",          severity: "critical" },
  { id: "make_scenario_failed",   label: "תרחיש Make נפל",          severity: "critical" },
  { id: "human_blocker",          label: "חוסם דורש פעולה אנושית",  severity: "warning" },
];

const SEVERITIES = [
  { id: "info",     label: "מידע" },
  { id: "warning",  label: "אזהרה" },
  { id: "critical", label: "קריטי" },
];

export default function NotificationsTab() {
  const toast = useToast();
  const [channels, setChannels]       = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [loaded, setLoaded]           = useState(null);
  const [draft, setDraft]             = useState({
    quiet_hours:      { enabled: false, start: "22:00", end: "08:00" },
    severity_routing: { info: ["in_app"], warning: ["in_app", "email"], critical: ["in_app", "email"] },
  });
  const [busy, setBusy]               = useState(false);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [ch, prefs, gs] = await Promise.all([
        listNotificationChannels({ activeOnly: false }),
        listNotificationPreferences("marketing_manager"),
        getGeneralSettings(),
      ]);
      setChannels(ch || []);
      setPreferences(prefs || []);
      setLoaded(gs);
      const p = gs.payload || {};
      setDraft({
        quiet_hours: readPayload(p, "notifications.quiet_hours", { enabled: false, start: "22:00", end: "08:00" }),
        severity_routing: readPayload(p, "notifications.severity_routing", {
          info:     ["in_app"],
          warning:  ["in_app", "email"],
          critical: ["in_app", "email"],
        }),
      });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function toggleChannel(channelId, active) {
    try {
      await toggleNotificationChannel(channelId, { is_active: active, changed_by: "marketing_manager" });
      toast.success(active ? "ערוץ הופעל" : "ערוץ הושבת");
      await load();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
  }

  async function togglePref(eventType, channelId, isEnabled) {
    try {
      await upsertNotificationPreference({
        recipient_role: "marketing_manager",
        channel_id:     channelId,
        event_type:     eventType,
        is_enabled:     isEnabled,
        min_severity:   "info",
      });
      await load();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
  }

  function patchQuietHours(key, val) {
    setDraft(prev => ({ ...prev, quiet_hours: { ...prev.quiet_hours, [key]: val } }));
  }

  function toggleSeverityChannel(severity, channelType) {
    setDraft(prev => {
      const cur = prev.severity_routing[severity] || [];
      const has = cur.includes(channelType);
      const next = has ? cur.filter(c => c !== channelType) : [...cur, channelType];
      return { ...prev, severity_routing: { ...prev.severity_routing, [severity]: next } };
    });
  }

  async function savePayload() {
    setBusy(true);
    try {
      const current = loaded || (await getGeneralSettings());
      const payload = {
        ...(current.payload || {}),
        notifications: {
          ...(current.payload?.notifications || {}),
          quiet_hours:      draft.quiet_hours,
          severity_routing: draft.severity_routing,
        },
      };
      await updateGeneralSettings({ payload, updated_by: "marketing_manager" });
      toast.success("🔔 הגדרות התראה נשמרו");
      await load();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  function isPrefEnabled(eventType, channelId) {
    const p = preferences.find(p => p.event_type === eventType && p.channel_id === channelId);
    if (!p) return channelDefaults(channels.find(c => c.id === channelId)?.channel_type, eventType);
    return p.is_enabled;
  }

  if (loading) return <div style={card}><LoadingBlock /></div>;

  return (
    <div>
      <div style={card}>
        <ErrorBanner error={error} />
        <h4 style={{ ...type.h2, margin: `0 0 ${space(1)}`, color: color.primary }}>🔔 ערוצי התראה</h4>
        <div style={fieldHint}>
          ערוץ הפעמון תמיד פעיל. דוא"ל אופציונלי — ניתן להפעיל / לכבות.
        </div>
        <div style={{ marginTop: space(3), display: "flex", flexDirection: "column", gap: space(2) }}>
          {channels.map(c => {
            const isInApp = c.channel_type === "in_app";
            return (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: `${space(3)} ${space(3.5)}`, borderRadius: radius.md,
                border: `1px solid ${color.borderDefault}`,
                background: c.is_active ? "#f0fdf4" : "#f9fafb",
              }}>
                <div>
                  <div style={{ ...type.bodyStrong, color: color.fgDefault }}>
                    {isInApp ? "🔔 פעמון באתר" :
                     c.channel_type === "email" ? '📧 דוא"ל' :
                     c.channel_name}
                  </div>
                  <div style={{ ...type.small, color: color.fgMuted, marginTop: 2 }}>
                    {isInApp ? "תמיד פעיל — לא ניתן לכבות" : (c.config?.from ? `נשלח אל: ${c.config.from}` : "")}
                  </div>
                </div>
                {isInApp
                  ? <span style={{ color: color.successSoftFg, fontWeight: 700, fontSize: 13 }}>✓ פעיל תמיד</span>
                  : <Toggle checked={!!c.is_active} onChange={v => toggleChannel(c.id, v)} />}
              </div>
            );
          })}
        </div>
      </div>

      <div style={card}>
        <h4 style={{ ...type.h2, margin: `0 0 ${space(1)}`, color: color.primary }}>🎯 התראות לפי סוג אירוע</h4>
        <div style={fieldHint}>בשבילך, מנהלת השיווק: איזה אירוע נשלח לאיזה ערוץ.</div>

        <div style={{ marginTop: space(3), overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: "right" }}>אירוע</th>
                <th style={thStyle}>חומרה</th>
                {channels.map(c => (
                  <th key={c.id} style={thStyle}>
                    {c.channel_type === "in_app" ? "🔔 פעמון" :
                     c.channel_type === "email" ? "📧 מייל" :
                     c.channel_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EVENT_TYPES.map(et => (
                <tr key={et.id}>
                  <td style={tdLabelStyle}>{et.label}</td>
                  <td style={tdStyle}>
                    <span style={severityBadge(et.severity)}>
                      {SEVERITIES.find(s => s.id === et.severity)?.label}
                    </span>
                  </td>
                  {channels.map(c => {
                    const enabled = isPrefEnabled(et.id, c.id);
                    const isInApp = c.channel_type === "in_app";
                    return (
                      <td key={c.id} style={tdCheckStyle}>
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={isInApp /* in-app always on */}
                          onChange={() => togglePref(et.id, c.id, !enabled)}
                          style={{
                            width: 18, height: 18,
                            accentColor: color.primary,
                            cursor: isInApp ? "not-allowed" : "pointer",
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <h4 style={{ ...type.h2, margin: `0 0 ${space(1)}`, color: color.primary }}>🌙 שעות שקט + ניתוב לפי חומרה</h4>

        <Section title="🌙 שעות שקט"
                 hint="בטווח הזמן הזה — לא יישלחו התראות במייל. פעמון ימשיך לעדכן אבל בלי הפרעה במייל.">
          <div style={{ display: "flex", alignItems: "center", gap: space(3), marginBottom: space(3) }}>
            <Toggle checked={draft.quiet_hours.enabled}
                    onChange={v => patchQuietHours("enabled", v)} />
            <span style={{ ...type.bodyStrong, color: color.fgDefault }}>
              {draft.quiet_hours.enabled ? "שעות שקט פעילות" : "ללא שעות שקט"}
            </span>
          </div>
          {draft.quiet_hours.enabled && (
            <Row>
              <FieldBox label="התחלת שקט">
                <input type="time" value={draft.quiet_hours.start}
                       onChange={e => patchQuietHours("start", e.target.value)} style={input} />
              </FieldBox>
              <FieldBox label="סיום שקט">
                <input type="time" value={draft.quiet_hours.end}
                       onChange={e => patchQuietHours("end", e.target.value)} style={input} />
              </FieldBox>
            </Row>
          )}
        </Section>

        <Section title="⚡ ניתוב לפי חומרה"
                 hint="ערוצי ברירת מחדל לפי רמת חומרה — מעל ההעדפות לפי אירוע. אירוע ללא העדפה מפורשת ינותב מכאן.">
          <div style={{ display: "flex", flexDirection: "column", gap: space(2.5) }}>
            {SEVERITIES.map(sev => (
              <div key={sev.id} style={{
                padding: space(3), background: color.surfaceMuted,
                borderRadius: radius.md, border: `1px solid ${color.borderDefault}`,
              }}>
                <div style={{ ...type.bodyStrong, marginBottom: space(2) }}>
                  <span style={severityBadge(sev.id)}>{sev.label}</span>
                </div>
                <div style={{ display: "flex", gap: space(2), flexWrap: "wrap" }}>
                  {["in_app", "email"].map(ch => {
                    const active = (draft.severity_routing[sev.id] || []).includes(ch);
                    const isInApp = ch === "in_app";
                    return (
                      <button key={ch} onClick={() => !isInApp && toggleSeverityChannel(sev.id, ch)}
                              disabled={isInApp}
                              style={{
                                padding: `${space(1.5)} ${space(2.5)}`,
                                border: `2px solid ${active ? color.primary : "#e5e7eb"}`,
                                background: active ? "#eff6ff" : "#fff",
                                color: active ? color.primary : color.fgMuted,
                                borderRadius: radius.pill,
                                fontSize: 12, fontWeight: 700,
                                cursor: isInApp ? "not-allowed" : "pointer",
                                fontFamily,
                                opacity: isInApp && !active ? 0.5 : 1,
                              }}>
                        {ch === "in_app" ? "🔔 פעמון" : "📧 מייל"}
                        {isInApp && " (תמיד)"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <SaveBar onSave={savePayload} busy={busy} dirty={true} />
      </div>
    </div>
  );
}

function channelDefaults(channelType, eventType) {
  // Sensible defaults when no preference row exists yet.
  if (channelType === "in_app") return true;  // in-app always on
  if (channelType === "email") {
    // Email defaults — on for critical/warning events, off for info
    const et = EVENT_TYPES.find(e => e.id === eventType);
    return et && et.severity !== "info";
  }
  return false;
}

function severityBadge(sev) {
  const tones = {
    info:     { bg: "#dbeafe", fg: "#1e40af" },
    warning:  { bg: "#fef3c7", fg: "#854d0e" },
    critical: { bg: "#fee2e2", fg: "#991b1b" },
  };
  const t = tones[sev] || tones.info;
  return {
    display: "inline-block",
    padding: `${space(0.5)} ${space(2)}`,
    background: t.bg, color: t.fg,
    borderRadius: radius.pill,
    fontSize: 11, fontWeight: 700,
  };
}

const tableStyle = {
  width: "100%", borderCollapse: "separate", borderSpacing: 0,
  background: color.surface,
  border: `1px solid ${color.borderDefault}`,
  borderRadius: radius.md,
  overflow: "hidden",
  minWidth: 480,
};
const thStyle = {
  padding: `${space(2.5)} ${space(3)}`, textAlign: "center",
  background: "#f9fafb", borderBottom: `1px solid ${color.borderDefault}`,
  ...type.label, color: color.fgMuted, whiteSpace: "nowrap",
};
const tdLabelStyle = {
  padding: `${space(2.5)} ${space(3)}`, ...type.bodySmall, fontWeight: 600,
  color: color.fgDefault, borderBottom: `1px solid ${color.borderSubtle}`, textAlign: "right",
};
const tdStyle = {
  padding: `${space(2)} ${space(3)}`, borderBottom: `1px solid ${color.borderSubtle}`,
  textAlign: "center",
};
const tdCheckStyle = {
  padding: space(2), borderBottom: `1px solid ${color.borderSubtle}`,
  textAlign: "center",
};

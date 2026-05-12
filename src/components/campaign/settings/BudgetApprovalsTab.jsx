/**
 * BudgetApprovalsTab.jsx — Settings · תקציב ואישורים.
 *
 * Payload-backed sections (saved to media_settings.payload):
 *   • budget_caps              — per-platform daily min/max (ILS)
 *   • budget_defaults          — defaults by course type
 *   • split_deviation_pct      — allowed deviation from media split
 *   • approval_rules           — per artifact-type auto-approve & routing
 *
 * Plus read-only view of existing budget_sources from sql/022.
 */
import React, { useEffect, useState } from "react";
import {
  getGeneralSettings, updateGeneralSettings, listBudgetSources,
} from "../../../api.js";
import { color, radius, space, type, fontFamily } from "../_tokens.js";
import { useToast } from "../Toast.jsx";
import {
  card, Section, Row, FieldBox, Toggle, Chip, SaveBar,
  ErrorBanner, LoadingBlock, input, select, fieldLabel, fieldHint,
  primaryBtn, readPayload,
} from "./_shared.jsx";

const PLATFORMS = [
  { id: "meta",   label: "📘 Meta" },
  { id: "google", label: "🔍 Google" },
  { id: "tiktok", label: "🎵 TikTok" },
];

const COURSE_TYPES = [
  { id: "premium",      label: "פרימיום (אלרוב, מובחר)" },
  { id: "standard",     label: "סטנדרטי" },
  { id: "intro",        label: "מבוא / קצר" },
  { id: "professional", label: "מקצועי / ארוך" },
];

const ARTIFACT_TYPES = [
  { id: "media_plan",            label: "פריסת מדיה" },
  { id: "budget_recommendation", label: "המלצת תקציב" },
  { id: "market_research",       label: "מחקר תחום" },
  { id: "ad_copy_meta",          label: "קופי Meta" },
  { id: "ad_copy_google",        label: "קופי Google" },
  { id: "ad_copy_tiktok",        label: "קופי TikTok" },
  { id: "lead_form_copy",        label: "קופי טופס" },
  { id: "creative_concept",      label: "כיוון קריאייטיב" },
  { id: "creative_rendered",     label: "קריאייטיב מוכן" },
  { id: "format_qa_report",      label: "בדיקת פורמטים" },
  { id: "make_scenario",         label: "תרחיש Make" },
];

const APPROVERS = [
  { id: "marketing_manager", label: "מנהלת שיווק (את)" },
  { id: "school_director",   label: 'מנכ"ל בית הספר' },
  { id: "agency_team",       label: "צוות הסוכנות" },
];

export default function BudgetApprovalsTab() {
  const toast = useToast();
  const [loaded, setLoaded]   = useState(null);
  const [draft, setDraft]     = useState({
    budget_caps:     { meta: { min: 0, max: 5000 }, google: { min: 0, max: 5000 }, tiktok: { min: 0, max: 3000 } },
    budget_defaults: {},
    approval_rules:  {},
  });
  const [busy, setBusy]       = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const [sources, setSources] = useState([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);

  useEffect(() => { load(); loadSources(); /* eslint-disable-next-line */ }, []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const gs = await getGeneralSettings();
      const p = gs.payload || {};
      setLoaded(gs);

      const defaultApprovals = {};
      ARTIFACT_TYPES.forEach(at => {
        defaultApprovals[at.id] = {
          required_approvers: ["marketing_manager"],
          auto_approve_under: null,
          notify_after_hours: 4,
        };
      });

      setDraft({
        budget_caps:     readPayload(p, "budget_caps", {
          meta:   { min: 0, max: 5000 },
          google: { min: 0, max: 5000 },
          tiktok: { min: 0, max: 3000 },
        }),
        budget_defaults: readPayload(p, "budget_defaults", {}),
        approval_rules:  readPayload(p, "approval_rules", defaultApprovals),
      });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadSources() {
    setSourcesLoading(true);
    try { setSources(await listBudgetSources()); }
    catch (e) { setError(e.message); }
    finally { setSourcesLoading(false); }
  }

  function patchCap(platform, kind, val) {
    setDraft(prev => ({
      ...prev,
      budget_caps: {
        ...prev.budget_caps,
        [platform]: { ...(prev.budget_caps[platform] || {}), [kind]: val === "" ? null : Number(val) },
      },
    }));
  }

  function patchDefault(courseType, val) {
    setDraft(prev => ({
      ...prev,
      budget_defaults: { ...prev.budget_defaults, [courseType]: val === "" ? null : Number(val) },
    }));
  }

  function patchApprovalRule(artifactType, key, val) {
    setDraft(prev => ({
      ...prev,
      approval_rules: {
        ...prev.approval_rules,
        [artifactType]: { ...(prev.approval_rules[artifactType] || {}), [key]: val },
      },
    }));
  }

  function toggleApprover(artifactType, approver) {
    const cur = draft.approval_rules[artifactType]?.required_approvers || [];
    const has = cur.includes(approver);
    const next = has ? cur.filter(a => a !== approver) : [...cur, approver];
    patchApprovalRule(artifactType, "required_approvers", next);
  }

  async function save() {
    setBusy(true);
    try {
      const current = loaded || (await getGeneralSettings());
      const payload = { ...(current.payload || {}), ...draft };
      await updateGeneralSettings({ payload, updated_by: "marketing_manager" });
      toast.success("💰 הגדרות תקציב ואישורים נשמרו");
      await load();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  if (loading) return <div style={card}><LoadingBlock /></div>;

  return (
    <div>
      <div style={card}>
        <ErrorBanner error={error} />

        <div style={{
          background: "#e0f2fe", border: "1px solid #7dd3fc", borderRadius: radius.md,
          padding: `${space(3)} ${space(4)}`, marginBottom: space(5),
          ...type.bodySmall, color: "#075985", lineHeight: 1.6,
        }}>
          💡 <strong>הבדל חשוב — guardrails ≠ חלוקה.</strong>
          <div style={{ marginTop: space(1.5) }}>
            התקרות שלמטה הן <strong>guardrails</strong> לסוכן המדיה: תקציב מקסימלי / מינימלי יומי שמותר לו להמליץ עליו לכל פלטפורמה.
          </div>
          <div style={{ marginTop: space(1) }}>
            ה<strong>חלוקה</strong> בין הפלטפורמות (Meta vs Google vs TikTok) <strong>אינה הגדרה</strong> — היא <strong>המלצה</strong>
            של סוכן ניהול התקציב, מבוססת על תוצאות היסטוריות וחיזוי. ראי <strong>"דורש פעולה" → "המלצת תקציב"</strong> כדי לאשר את החלוקה הנוכחית.
          </div>
        </div>

        <Section title="💵 תקרות תקציב יומיות לכל פלטפורמה"
                 hint="מינימום ומקסימום לפעילות יומית לכל פלטפורמה. המערכת לא תוציא המלצת חלוקה שחורגת מהטווח הזה.">
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>פלטפורמה</th>
                <th style={thStyle}>מינימום יומי (₪)</th>
                <th style={thStyle}>מקסימום יומי (₪)</th>
              </tr>
            </thead>
            <tbody>
              {PLATFORMS.map(p => (
                <tr key={p.id}>
                  <td style={tdLabelStyle}>{p.label}</td>
                  <td style={tdStyle}>
                    <input type="number" min="0" value={draft.budget_caps[p.id]?.min ?? ""}
                           onChange={e => patchCap(p.id, "min", e.target.value)}
                           style={{ ...input, padding: `${space(1.5)} ${space(2)}` }} />
                  </td>
                  <td style={tdStyle}>
                    <input type="number" min="0" value={draft.budget_caps[p.id]?.max ?? ""}
                           onChange={e => patchCap(p.id, "max", e.target.value)}
                           style={{ ...input, padding: `${space(1.5)} ${space(2)}` }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="🎯 תקציבי ברירת מחדל לפי סוג קורס"
                 hint="כשנפתח בריף קורס חדש, השדה 'תקציב מוצע' יתמלא לפי הסוג. את תמיד יכולה לשנות בבריף.">
          <Row>
            {COURSE_TYPES.map(ct => (
              <FieldBox key={ct.id} label={ct.label}>
                <div style={{ display: "flex", alignItems: "center", gap: space(2) }}>
                  <span style={{ ...type.bodySmall, color: color.fgMuted }}>₪</span>
                  <input type="number" min="0" step="1000"
                         value={draft.budget_defaults[ct.id] ?? ""}
                         placeholder="לא הוגדר"
                         onChange={e => patchDefault(ct.id, e.target.value)}
                         style={input} />
                </div>
              </FieldBox>
            ))}
          </Row>
        </Section>

        <Section title="✅ חוקי אישור לכל סוג תוצר"
                 hint="לכל סוג תוצר: מי צריך לאשר, האם יש סף לאישור אוטומטי, ותוך כמה זמן לשלוח תזכורת.">
          <div style={{ display: "flex", flexDirection: "column", gap: space(2.5) }}>
            {ARTIFACT_TYPES.map(at => {
              const rule = draft.approval_rules[at.id] || { required_approvers: ["marketing_manager"], auto_approve_under: null, notify_after_hours: 4 };
              return (
                <div key={at.id} style={{
                  padding: space(3), border: `1px solid ${color.borderDefault}`,
                  borderRadius: radius.md, background: color.surfaceMuted,
                }}>
                  <div style={{ ...type.bodyStrong, color: color.fgDefault, marginBottom: space(2) }}>{at.label}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: space(3) }}>
                    <div style={{ flex: 2, minWidth: 240 }}>
                      <label style={{ ...type.small, fontWeight: 700, color: color.fgMuted, display: "block", marginBottom: space(1) }}>
                        מי מאשר?
                      </label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: space(1) }}>
                        {APPROVERS.map(a => {
                          const active = rule.required_approvers?.includes(a.id);
                          return (
                            <button key={a.id} onClick={() => toggleApprover(at.id, a.id)} style={{
                              padding: `${space(1.5)} ${space(2.5)}`,
                              border: `2px solid ${active ? color.primary : "#e5e7eb"}`,
                              background: active ? "#eff6ff" : "#fff",
                              color: active ? color.primary : color.fgMuted,
                              borderRadius: radius.pill,
                              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily,
                            }}>{a.label}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label style={{ ...type.small, fontWeight: 700, color: color.fgMuted, display: "block", marginBottom: space(1) }}>
                        תזכורת אחרי (שעות)
                      </label>
                      <input type="number" min="1" max="72" value={rule.notify_after_hours}
                             onChange={e => patchApprovalRule(at.id, "notify_after_hours", Number(e.target.value))}
                             style={input} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <SaveBar onSave={save} busy={busy} dirty={true} />
      </div>

      <div style={card}>
        <h4 style={{ ...type.h3, margin: `0 0 ${space(1)}`, color: color.primary }}>📋 כל מקורות התקציב</h4>
        <div style={fieldHint}>תצוגה כללית של מקורות התקציב שהוגדרו לקורסים שונים. עריכה — מעמוד הקורס.</div>
        {sourcesLoading && <LoadingBlock />}
        {!sourcesLoading && sources.length === 0 && (
          <div style={{ marginTop: space(3), padding: space(6), textAlign: "center", background: "#f9fafb", borderRadius: radius.md, ...type.bodySmall, color: color.fgMuted }}>
            🪙 עוד לא הוגדרו מקורות תקציב לקורסים.
          </div>
        )}
        {!sourcesLoading && sources.length > 0 && (
          <div style={{ marginTop: space(3), display: "flex", flexDirection: "column", gap: space(1.5) }}>
            {sources.map(b => (
              <div key={b.id} style={{
                padding: space(3), border: `1px solid ${color.borderDefault}`,
                borderRadius: radius.md, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: space(2),
              }}>
                <div>
                  <div style={{ ...type.bodyStrong, color: color.fgDefault }}>{sourceLabels[b.source_type] || b.source_type}</div>
                  <div style={{ ...type.small, color: color.fgMuted, marginTop: 2 }}>
                    {b.period_start && b.period_end ? `${b.period_start} → ${b.period_end}` : "ללא הגבלת תאריכים"}
                  </div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ ...type.bodyStrong, color: color.primary }}>
                    {b.amount_ils ? `₪${Number(b.amount_ils).toLocaleString("he-IL")}` : "—"}
                  </div>
                  <div style={{ ...type.small, color: color.fgSubtle }}>{b.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const sourceLabels = {
  from_existing:       "מהתקציב הבית-ספרי",
  dedicated:           "ייעודי לקורס",
  one_time:            "חד פעמי",
  time_bound:          "לתקופה מוגדרת",
  launch_then_ongoing: "השקה + שוטף",
  undefined:           "טרם הוגדר",
};

const tableStyle = {
  width: "100%", borderCollapse: "separate", borderSpacing: 0,
  background: color.surface,
  border: `1px solid ${color.borderDefault}`,
  borderRadius: radius.md,
  overflow: "hidden",
};
const thStyle = {
  padding: `${space(2.5)} ${space(3)}`, textAlign: "right",
  background: "#f9fafb", borderBottom: `1px solid ${color.borderDefault}`,
  ...type.label, color: color.fgMuted,
};
const tdLabelStyle = {
  padding: `${space(2.5)} ${space(3)}`, ...type.bodySmall, fontWeight: 600,
  color: color.fgDefault, borderBottom: `1px solid ${color.borderSubtle}`,
};
const tdStyle = {
  padding: space(2), borderBottom: `1px solid ${color.borderSubtle}`,
};

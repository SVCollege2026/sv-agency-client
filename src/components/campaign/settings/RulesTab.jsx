/**
 * RulesTab.jsx — Settings · חוקים וספים.
 *
 * Four payload-backed sections (saved together to media_settings.payload):
 *   1. signal_thresholds        — per-platform metric thresholds
 *   2. context_windows          — grace/silence days etc.
 *   3. high_risk_policies       — allow_stop / heavy_cut / pause_creative + caps
 *   4. qa_dimensions            — list of feedback dimensions for recommendations
 *
 * Plus a fifth section with full CRUD on `media_rules` table.
 */
import React, { useEffect, useState } from "react";
import {
  getGeneralSettings, updateGeneralSettings,
  listMediaRules, createMediaRule, updateMediaRule,
} from "../../../api.js";
import { color, radius, space, type, fontFamily } from "../_tokens.js";
import { useToast } from "../Toast.jsx";
import {
  card, Section, Row, FieldBox, Toggle, Chip, SaveBar,
  ErrorBanner, LoadingBlock, input, select, primaryBtn, secondaryBtn,
  ghostBtn, dangerBtn, fieldLabel, fieldHint, readPayload,
} from "./_shared.jsx";

const PLATFORMS = [
  { id: "meta",   label: "📘 Meta" },
  { id: "google", label: "🔍 Google" },
  { id: "tiktok", label: "🎵 TikTok" },
];

const METRIC_DEFAULTS = {
  cpl_high_ils:           { label: "CPL גבוה מדי (₪)",        defaults: { meta: 120, google: 140, tiktok: 110 } },
  ctr_low_pct:            { label: "CTR נמוך מדי (%)",         defaults: { meta: 0.8, google: 1.0, tiktok: 1.2 } },
  frequency_cap:          { label: "תדירות מקס לאדם",          defaults: { meta: 5, google: 6, tiktok: 4 } },
  spend_velocity_pct:     { label: "מהירות שריפת תקציב (%)",    defaults: { meta: 35, google: 35, tiktok: 35 } },
};

const DEFAULT_QA_DIMENSIONS = [
  { id: "relevance",       label: "רלוונטיות להמלצה",  is_active: true },
  { id: "data_quality",    label: "איכות הדאטה",        is_active: true },
  { id: "context_fit",     label: "התאמה להקשר",       is_active: true },
  { id: "policy_fit",      label: "התאמה ל-policy",     is_active: true },
  { id: "explanation",     label: "בהירות ההסבר",      is_active: true },
  { id: "actionability",   label: "ניתנות לפעולה",     is_active: true },
  { id: "risk_assessment", label: "הערכת סיכון",        is_active: true },
  { id: "timing",          label: "תזמון",              is_active: true },
  { id: "alternatives",    label: "חלופות שנשקלו",      is_active: true },
];

const RULE_SEVERITIES = [
  { id: "info",     label: "מידע" },
  { id: "warning",  label: "אזהרה" },
  { id: "critical", label: "קריטי" },
];

const RULE_SCOPES = [
  { id: "global",   label: "גלובלי (כל הקורסים)" },
  { id: "platform", label: "פלטפורמה מסוימת" },
  { id: "course",   label: "קורס מסוים" },
];

const RULE_OPERATORS = [
  { id: ">",  label: "גדול מ-" },
  { id: ">=", label: "גדול/שווה" },
  { id: "<",  label: "קטן מ-" },
  { id: "<=", label: "קטן/שווה" },
  { id: "==", label: "שווה" },
];

export default function RulesTab() {
  const toast = useToast();
  const [loaded, setLoaded] = useState(null);
  const [draft, setDraft]   = useState({
    signal_thresholds: { meta: {}, google: {}, tiktok: {} },
    context_windows: { post_launch_grace_days: 3, pre_holiday_silence_days: 1 },
    high_risk_policies: {
      allow_stop:           { enabled: false, min_days_underperforming: 7,  min_loss_pct: 50 },
      allow_heavy_cut:      { enabled: true,  min_days_underperforming: 5,  min_loss_pct: 30, max_cut_pct: 50 },
      allow_pause_creative: { enabled: true,  min_days_underperforming: 3,  min_loss_pct: 25 },
    },
    qa_dimensions: DEFAULT_QA_DIMENSIONS,
  });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  /* Rules CRUD state */
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  useEffect(() => { load(); loadRules(); /* eslint-disable-next-line */ }, []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const gs = await getGeneralSettings();
      const p = gs.payload || {};
      setLoaded(gs);
      setDraft({
        signal_thresholds: readPayload(p, "signal_thresholds", { meta: {}, google: {}, tiktok: {} }),
        context_windows:   readPayload(p, "context_windows",   { post_launch_grace_days: 3, pre_holiday_silence_days: 1 }),
        high_risk_policies: readPayload(p, "high_risk_policies", {
          allow_stop:           { enabled: false, min_days_underperforming: 7,  min_loss_pct: 50 },
          allow_heavy_cut:      { enabled: true,  min_days_underperforming: 5,  min_loss_pct: 30, max_cut_pct: 50 },
          allow_pause_creative: { enabled: true,  min_days_underperforming: 3,  min_loss_pct: 25 },
        }),
        qa_dimensions:     readPayload(p, "qa_dimensions",     DEFAULT_QA_DIMENSIONS),
      });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadRules() {
    setRulesLoading(true);
    try { setRules(await listMediaRules({ activeOnly: false })); }
    catch (e) { setError(e.message); }
    finally { setRulesLoading(false); }
  }

  function patchThreshold(platform, metric, val) {
    setDraft(prev => ({
      ...prev,
      signal_thresholds: {
        ...prev.signal_thresholds,
        [platform]: { ...(prev.signal_thresholds[platform] || {}), [metric]: val === "" ? null : Number(val) },
      },
    }));
  }

  function patchContext(key, val) {
    setDraft(prev => ({ ...prev, context_windows: { ...prev.context_windows, [key]: Number(val) } }));
  }

  function patchHighRisk(policy, key, val) {
    setDraft(prev => ({
      ...prev,
      high_risk_policies: {
        ...prev.high_risk_policies,
        [policy]: { ...prev.high_risk_policies[policy], [key]: val },
      },
    }));
  }

  function toggleQaDim(id) {
    setDraft(prev => ({
      ...prev,
      qa_dimensions: prev.qa_dimensions.map(d => d.id === id ? { ...d, is_active: !d.is_active } : d),
    }));
  }

  function relabelQaDim(id, label) {
    setDraft(prev => ({
      ...prev,
      qa_dimensions: prev.qa_dimensions.map(d => d.id === id ? { ...d, label } : d),
    }));
  }

  function moveQaDim(idx, dir) {
    setDraft(prev => {
      const arr = [...prev.qa_dimensions];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...prev, qa_dimensions: arr };
    });
  }

  async function save() {
    setBusy(true);
    try {
      const current = loaded || (await getGeneralSettings());
      const payload = { ...(current.payload || {}), ...draft };
      await updateGeneralSettings({ payload, updated_by: "marketing_manager" });
      toast.success("📐 חוקים וספים נשמרו");
      await load();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  /* ---------- Rules CRUD handlers ---------- */
  function openNewRule() {
    setEditingRule({
      rule_key: "",
      title: "",
      description: "",
      scope: "global",
      signal: { metric: "cpl_high_ils", operator: ">", threshold: 100 },
      severity: "warning",
      is_active: true,
    });
    setShowRuleModal(true);
  }

  function openEditRule(rule) {
    setEditingRule({ ...rule });
    setShowRuleModal(true);
  }

  async function saveRule(rule) {
    try {
      if (rule.id) {
        await updateMediaRule(rule.id, { ...rule, updated_by: "marketing_manager" });
        toast.success("✓ חוק עודכן");
      } else {
        await createMediaRule({ ...rule, created_by: "marketing_manager" });
        toast.success("✓ חוק חדש נוצר");
      }
      setShowRuleModal(false); setEditingRule(null);
      await loadRules();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
  }

  async function toggleRuleActive(rule) {
    try {
      await updateMediaRule(rule.id, { is_active: !rule.is_active, updated_by: "marketing_manager" });
      toast.success(rule.is_active ? "חוק הושבת" : "חוק הופעל");
      await loadRules();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
  }

  if (loading) return <div style={card}><LoadingBlock /></div>;

  return (
    <div>
      <div style={card}>
        <ErrorBanner error={error} />

        <Section title="📊 ספי signal לכל פלטפורמה"
                 hint="כאשר המדד חוצה את הסף — המערכת תזהה signal ותפעיל בדיקה (לא בהכרח המלצה). השאירי ריק כדי לדלג על מדד.">
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>מדד</th>
                {PLATFORMS.map(p => <th key={p.id} style={thStyle}>{p.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {Object.entries(METRIC_DEFAULTS).map(([metric, def]) => (
                <tr key={metric}>
                  <td style={tdLabelStyle}>{def.label}</td>
                  {PLATFORMS.map(p => (
                    <td key={p.id} style={tdStyle}>
                      <input
                        type="number"
                        step="0.1"
                        value={draft.signal_thresholds[p.id]?.[metric] ?? ""}
                        onChange={e => patchThreshold(p.id, metric, e.target.value)}
                        placeholder={String(def.defaults[p.id])}
                        style={{ ...input, padding: `${space(1.5)} ${space(2)}` }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="⏳ חוקי הקשר"
                 hint="מצבים שבהם המערכת תשאיר signals חבויים ולא תהפוך אותם להמלצות.">
          <Row>
            <FieldBox label="חלון חסד אחרי עלייה לאוויר (ימים)"
                      hint="קמפיין חדש מקבל ימי חסד לפני שמחושבות לו המלצות. סטטוס learning של פלטפורמות.">
              <input type="number" min="0" max="14" value={draft.context_windows.post_launch_grace_days}
                     onChange={e => patchContext("post_launch_grace_days", e.target.value)} style={input} />
            </FieldBox>
            <FieldBox label="חלון שקט לפני חג (ימים)"
                      hint="כמה ימים לפני יום חג להפסיק לייצר המלצות שעלולות לדרוש פעולה.">
              <input type="number" min="0" max="7" value={draft.context_windows.pre_holiday_silence_days}
                     onChange={e => patchContext("pre_holiday_silence_days", e.target.value)} style={input} />
            </FieldBox>
          </Row>
        </Section>

        <Section title="⚠ מדיניות פעולות מסוכנות"
                 hint="פעולות שעלולות לפגוע בקמפיין — סגירה / קיצוץ תקציב כבד / עצירת קריאייטיב. כאן את מגדירה מתי בכלל מותר להמליץ עליהן.">
          <HighRiskPolicyEditor
            label="🛑 עצירת קמפיין (Stop)"
            policy={draft.high_risk_policies.allow_stop}
            onChange={(k, v) => patchHighRisk("allow_stop", k, v)}
            extraField={null}
          />
          <HighRiskPolicyEditor
            label="✂ קיצוץ תקציב כבד (>30%)"
            policy={draft.high_risk_policies.allow_heavy_cut}
            onChange={(k, v) => patchHighRisk("allow_heavy_cut", k, v)}
            extraField={{ key: "max_cut_pct", label: "אחוז קיצוץ מקסימלי", suffix: "%" }}
          />
          <HighRiskPolicyEditor
            label="⏸ עצירת קריאייטיב"
            policy={draft.high_risk_policies.allow_pause_creative}
            onChange={(k, v) => patchHighRisk("allow_pause_creative", k, v)}
            extraField={null}
          />
        </Section>

        <Section title="📋 מימדי QA Feedback להמלצות"
                 hint='מימדים שמופיעים בכל המלצה ב-Recommendations Panel. את יכולה להפעיל/לכבות, לערוך תווית, לסדר מחדש.'>
          <div style={{ display: "flex", flexDirection: "column", gap: space(2) }}>
            {draft.qa_dimensions.map((dim, i) => (
              <div key={dim.id} style={{
                display: "flex", alignItems: "center", gap: space(2),
                padding: space(2.5), background: dim.is_active ? "#f0fdf4" : "#f9fafb",
                border: `1px solid ${dim.is_active ? "#bbf7d0" : "#e5e7eb"}`,
                borderRadius: radius.md,
              }}>
                <span style={{ ...type.small, color: color.fgSubtle, minWidth: 22, textAlign: "center" }}>{i + 1}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button onClick={() => moveQaDim(i, -1)} disabled={i === 0} style={miniBtn(i === 0)}>▲</button>
                  <button onClick={() => moveQaDim(i,  1)} disabled={i === draft.qa_dimensions.length - 1} style={miniBtn(i === draft.qa_dimensions.length - 1)}>▼</button>
                </div>
                <input value={dim.label} onChange={e => relabelQaDim(dim.id, e.target.value)}
                       style={{ ...input, flex: 1, padding: `${space(1.5)} ${space(2)}` }} />
                <Toggle checked={dim.is_active} onChange={() => toggleQaDim(dim.id)} />
              </div>
            ))}
          </div>
        </Section>

        <SaveBar onSave={save} busy={busy} dirty={true} />
      </div>

      {/* Section 5: full CRUD on media_rules */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: space(2) }}>
          <h4 style={{ ...type.h3, margin: 0, color: color.primary }}>📐 חוקי המלצה מותאמים</h4>
          <button onClick={openNewRule} style={primaryBtn}>➕ חוק חדש</button>
        </div>
        <div style={fieldHint}>חוקים פרטניים מעבר לספים הכלליים — לדוגמה: "אם CPL ב-Meta גבוה מ-150 ויש פחות מ-3 לידים ב-7 ימים אחרונים — אזהרה".</div>

        {rulesLoading && <LoadingBlock />}
        {!rulesLoading && rules.length === 0 && (
          <div style={{ marginTop: space(3), padding: space(6), textAlign: "center", background: "#f9fafb", borderRadius: radius.md, color: color.fgMuted, ...type.bodySmall }}>
            עדיין לא הוגדרו חוקים מותאמים. השפים הכלליים למעלה מספיקים לרוב המקרים — חוקים מותאמים שימושיים למקרים ייחודיים.
          </div>
        )}
        {!rulesLoading && rules.length > 0 && (
          <div style={{ marginTop: space(3), display: "flex", flexDirection: "column", gap: space(2) }}>
            {rules.map(r => (
              <div key={r.id} style={{
                padding: space(3), border: `1px solid ${r.is_active ? "#bbf7d0" : "#e5e7eb"}`,
                background: r.is_active ? "#f0fdf4" : "#f9fafb",
                borderRadius: radius.md,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: space(2), flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ ...type.bodyStrong, color: color.fgDefault }}>{r.title || r.rule_key}</div>
                    <div style={{ ...type.small, color: color.fgMuted, marginTop: 4 }}>
                      מופעל כאשר: <strong>{r.signal?.metric}</strong> {r.signal?.operator} <strong>{r.signal?.threshold}</strong>
                      {" · "}חומרה: <strong>{r.severity}</strong>
                      {" · "}היקף: <strong>{r.scope || "global"}</strong>
                    </div>
                    {r.description && <div style={{ ...type.small, color: color.fgSubtle, marginTop: 4 }}>{r.description}</div>}
                  </div>
                  <div style={{ display: "flex", gap: space(1.5), alignItems: "center" }}>
                    <Toggle checked={r.is_active} onChange={() => toggleRuleActive(r)} />
                    <button onClick={() => openEditRule(r)} style={ghostBtn}>✎ עריכה</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showRuleModal && (
        <RuleEditorModal
          rule={editingRule}
          onChange={setEditingRule}
          onSave={() => saveRule(editingRule)}
          onClose={() => { setShowRuleModal(false); setEditingRule(null); }}
        />
      )}
    </div>
  );
}

function HighRiskPolicyEditor({ label, policy, onChange, extraField }) {
  return (
    <div style={{
      padding: space(3), marginBottom: space(3),
      border: `1px solid ${policy.enabled ? "#fbbf24" : "#e5e7eb"}`,
      background: policy.enabled ? "#fffbeb" : "#fafafa",
      borderRadius: radius.md,
    }}>
      <label style={{ display: "flex", alignItems: "center", gap: space(2), cursor: "pointer", marginBottom: policy.enabled ? space(3) : 0 }}>
        <input type="checkbox" checked={policy.enabled} onChange={e => onChange("enabled", e.target.checked)}
               style={{ width: 18, height: 18, accentColor: color.primary, cursor: "pointer" }} />
        <span style={{ ...type.bodyStrong, color: color.fgDefault }}>{label}</span>
      </label>
      {policy.enabled && (
        <Row>
          <FieldBox label="מינימום ימים של underperformance"
                    hint="כמה ימים רצופים חייבים להראות חולשה לפני שהמלצה כזו מותרת.">
            <input type="number" min="1" max="30" value={policy.min_days_underperforming}
                   onChange={e => onChange("min_days_underperforming", Number(e.target.value))} style={input} />
          </FieldBox>
          <FieldBox label="מינימום אחוז הפסד מהיעד"
                    hint="כמה רחוק מהיעד צריך להיות הקמפיין כדי להצדיק פעולה.">
            <input type="number" min="0" max="100" value={policy.min_loss_pct}
                   onChange={e => onChange("min_loss_pct", Number(e.target.value))} style={input} />
          </FieldBox>
          {extraField && (
            <FieldBox label={extraField.label}>
              <input type="number" min="0" max="100" value={policy[extraField.key] || 0}
                     onChange={e => onChange(extraField.key, Number(e.target.value))} style={input} />
            </FieldBox>
          )}
        </Row>
      )}
    </div>
  );
}

function RuleEditorModal({ rule, onChange, onSave, onClose }) {
  if (!rule) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: space(4),
      direction: "rtl",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: color.surface, borderRadius: radius.lg, padding: space(5),
        maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto",
      }}>
        <h3 style={{ ...type.h2, margin: `0 0 ${space(3)}` }}>
          {rule.id ? "✎ עריכת חוק" : "➕ חוק חדש"}
        </h3>
        <Row minCol={240}>
          <FieldBox label="מזהה ייחודי (rule_key)"
                    hint="מזהה באנגלית, ללא רווחים. לדוגמה: meta_cpl_high">
            <input value={rule.rule_key} onChange={e => onChange({ ...rule, rule_key: e.target.value })}
                   placeholder="meta_cpl_high" style={input} disabled={!!rule.id} />
          </FieldBox>
          <FieldBox label="שם בעברית">
            <input value={rule.title} onChange={e => onChange({ ...rule, title: e.target.value })}
                   placeholder='לדוגמה: "Meta — CPL חריג"' style={input} />
          </FieldBox>
        </Row>
        <div style={{ marginTop: space(3) }}>
          <FieldBox label="תיאור (אופציונלי)">
            <input value={rule.description || ""} onChange={e => onChange({ ...rule, description: e.target.value })}
                   placeholder="הסבר קצר על מתי החוק רלוונטי" style={input} />
          </FieldBox>
        </div>
        <div style={{ marginTop: space(4) }}>
          <h4 style={{ ...type.label, margin: 0, marginBottom: space(2) }}>תנאי הפעלה</h4>
          <Row minCol={150}>
            <FieldBox label="מדד">
              <select value={rule.signal.metric}
                      onChange={e => onChange({ ...rule, signal: { ...rule.signal, metric: e.target.value } })}
                      style={select}>
                {Object.entries(METRIC_DEFAULTS).map(([k, v]) =>
                  <option key={k} value={k}>{v.label}</option>)}
                <option value="custom">אחר (custom)</option>
              </select>
            </FieldBox>
            <FieldBox label="אופרטור">
              <select value={rule.signal.operator}
                      onChange={e => onChange({ ...rule, signal: { ...rule.signal, operator: e.target.value } })}
                      style={select}>
                {RULE_OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </FieldBox>
            <FieldBox label="ערך סף">
              <input type="number" step="0.1" value={rule.signal.threshold}
                     onChange={e => onChange({ ...rule, signal: { ...rule.signal, threshold: Number(e.target.value) } })}
                     style={input} />
            </FieldBox>
          </Row>
        </div>
        <div style={{ marginTop: space(3) }}>
          <Row minCol={150}>
            <FieldBox label="חומרה">
              <select value={rule.severity} onChange={e => onChange({ ...rule, severity: e.target.value })} style={select}>
                {RULE_SEVERITIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </FieldBox>
            <FieldBox label="היקף">
              <select value={rule.scope || "global"} onChange={e => onChange({ ...rule, scope: e.target.value })} style={select}>
                {RULE_SCOPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </FieldBox>
          </Row>
        </div>
        <div style={{ display: "flex", gap: space(2), justifyContent: "flex-end", marginTop: space(4) }}>
          <button onClick={onClose} style={secondaryBtn}>ביטול</button>
          <button onClick={onSave} disabled={!rule.rule_key || !rule.title} style={{
            ...primaryBtn, opacity: (!rule.rule_key || !rule.title) ? 0.5 : 1,
          }}>{rule.id ? "💾 שמירה" : "➕ יצירה"}</button>
        </div>
      </div>
    </div>
  );
}

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
  ...type.label, color: color.fgMuted, whiteSpace: "nowrap",
};
const tdLabelStyle = {
  padding: `${space(2.5)} ${space(3)}`, ...type.bodySmall, fontWeight: 600,
  color: color.fgDefault, borderBottom: `1px solid ${color.borderSubtle}`,
};
const tdStyle = {
  padding: space(2), borderBottom: `1px solid ${color.borderSubtle}`,
};
const miniBtn = (disabled) => ({
  width: 18, height: 14, padding: 0, fontSize: 9, lineHeight: "12px",
  border: "1px solid #e5e7eb", background: disabled ? "#f1f5f9" : "#fff",
  cursor: disabled ? "not-allowed" : "pointer", borderRadius: 3,
  color: disabled ? "#cbd5e1" : "#64748b",
});

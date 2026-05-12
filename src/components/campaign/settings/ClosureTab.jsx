/**
 * ClosureTab.jsx — Settings · סגירת קמפיינים.
 *
 * Payload keys (media_settings.payload.closure_rules):
 *   • reason_categories[]      — labeled bins for closure reasons (free-text always optional)
 *   • cool_down_days_before_reopen
 *   • pre_closure_alert_days   — days of grace before forced closure flag is raised
 *   • mandatory_questions[]    — extra questions in close dialog
 *   • auto_close_inactive_days — if a campaign hasn't run live N days → suggest close
 *   • require_director_signoff — requires school director approval beyond marketing
 */
import React, { useEffect, useState } from "react";
import { getGeneralSettings, updateGeneralSettings } from "../../../api.js";
import { color, radius, space, type, fontFamily } from "../_tokens.js";
import { useToast } from "../Toast.jsx";
import {
  card, Section, Row, FieldBox, Toggle, TagList, Chip, SaveBar,
  ErrorBanner, LoadingBlock, input, select, textarea, fieldLabel, fieldHint,
  readPayload, primaryBtn, dangerBtn,
} from "./_shared.jsx";

const DEFAULT_REASONS = [
  "הקמפיין הגיע ליעד הלידים",
  "תקציב נגמר",
  "תוצאות נמוכות מהיעד",
  "שינוי אסטרטגי",
  "קורס נדחה / בוטל",
  "סיום עונה",
];

const DEFAULT_QUESTIONS = [
  "מה לוקחים לקמפיין הבא?",
  "מה היה הצליח הכי טוב?",
  "מה לא עבד?",
];

export default function ClosureTab() {
  const toast = useToast();
  const [loaded, setLoaded] = useState(null);
  const [draft, setDraft]   = useState({
    reason_categories:           DEFAULT_REASONS,
    cool_down_days_before_reopen: 14,
    pre_closure_alert_days:       3,
    mandatory_questions:         DEFAULT_QUESTIONS,
    auto_close_inactive_days:    21,
    require_director_signoff:    false,
    require_data_export:         true,
    archive_after_days:          90,
  });
  const [busy, setBusy]       = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const gs = await getGeneralSettings();
      const p = gs.payload || {};
      setLoaded(gs);
      setDraft({
        reason_categories:           readPayload(p, "closure_rules.reason_categories",          DEFAULT_REASONS),
        cool_down_days_before_reopen: Number(readPayload(p, "closure_rules.cool_down_days_before_reopen", 14)),
        pre_closure_alert_days:       Number(readPayload(p, "closure_rules.pre_closure_alert_days",       3)),
        mandatory_questions:          readPayload(p, "closure_rules.mandatory_questions",      DEFAULT_QUESTIONS),
        auto_close_inactive_days:     Number(readPayload(p, "closure_rules.auto_close_inactive_days",    21)),
        require_director_signoff:     !!readPayload(p, "closure_rules.require_director_signoff", false),
        require_data_export:          readPayload(p, "closure_rules.require_data_export", true) !== false,
        archive_after_days:           Number(readPayload(p, "closure_rules.archive_after_days",         90)),
      });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function patch(key, val) {
    setDraft(prev => ({ ...prev, [key]: val }));
  }

  async function save() {
    setBusy(true);
    try {
      const current = loaded || (await getGeneralSettings());
      const payload = {
        ...(current.payload || {}),
        closure_rules: draft,
      };
      await updateGeneralSettings({ payload, updated_by: "marketing_manager" });
      toast.success("🛑 הגדרות סגירה נשמרו");
      await load();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  if (loading) return <div style={card}><LoadingBlock /></div>;

  return (
    <div style={card}>
      <ErrorBanner error={error} />

      <Section title="📋 קטגוריות לנימוק סגירה"
               hint="הקטגוריות שהמנהלת תוכל לבחור מהן כשהיא סוגרת קמפיין. שדה טקסט חופשי תמיד יישאר זמין בנוסף.">
        <TagList
          items={draft.reason_categories}
          onChange={v => patch("reason_categories", v)}
          placeholder='הוסיפי קטגוריה (לדוגמה: "הקמפיין הגיע ליעד הלידים")'
          tone="primary"
        />
      </Section>

      <Section title="❓ שאלות חובה ב-dialog הסגירה"
               hint="שאלות שיופיעו בנוסף לנימוק החופשי. שימושי ללמידה ארגונית — את אוספת תובנות בכל סגירה.">
        <TagList
          items={draft.mandatory_questions}
          onChange={v => patch("mandatory_questions", v)}
          placeholder='הוסיפי שאלה (לדוגמה: "מה לוקחים לקמפיין הבא?")'
          tone="primary"
        />
      </Section>

      <Section title="⏳ חלונות זמן"
               hint="מתי להתריע על סגירה, כמה זמן להמתין לפני פתיחה מחדש, וכמה זמן לשמור לפני ארכיון.">
        <Row>
          <FieldBox label="התראה מוקדמת לפני סגירה (ימים)"
                    hint="לפני שהמערכת מסמנת קמפיין כ-stalled ומציעה סגירה, היא תשלח התראה X ימים קודם.">
            <input type="number" min="0" max="14" value={draft.pre_closure_alert_days}
                   onChange={e => patch("pre_closure_alert_days", Number(e.target.value))} style={input} />
          </FieldBox>
          <FieldBox label='ימי חוסר פעילות עד "הצעת סגירה"'
                    hint="קמפיין שלא בוצעו בו פעולות חיות מספר ימים — המערכת תציע לסגור.">
            <input type="number" min="0" max="60" value={draft.auto_close_inactive_days}
                   onChange={e => patch("auto_close_inactive_days", Number(e.target.value))} style={input} />
          </FieldBox>
          <FieldBox label="cool-down לפני פתיחה מחדש (ימים)"
                    hint='לאחר סגירה — כמה ימים צריך להמתין כדי לפתוח מחדש את אותה תיקייה.'>
            <input type="number" min="0" max="90" value={draft.cool_down_days_before_reopen}
                   onChange={e => patch("cool_down_days_before_reopen", Number(e.target.value))} style={input} />
          </FieldBox>
          <FieldBox label="ארכיון אחרי (ימים)"
                    hint="כמה ימים אחרי סגירה התיקייה תועבר ל-archive (תיעלם מהלוח אבל תישאר ב-DB).">
            <input type="number" min="0" max="365" value={draft.archive_after_days}
                   onChange={e => patch("archive_after_days", Number(e.target.value))} style={input} />
          </FieldBox>
        </Row>
      </Section>

      <Section title="🔐 דרישות אישור נוספות">
        <div style={{ display: "flex", flexDirection: "column", gap: space(2.5) }}>
          <ToggleRow
            checked={draft.require_director_signoff}
            onChange={v => patch("require_director_signoff", v)}
            label='דרוש אישור מנכ"ל'
            hint='כל סגירה חייבת אישור של מנכ"ל בית הספר בנוסף לנימוק שלך.'
          />
          <ToggleRow
            checked={draft.require_data_export}
            onChange={v => patch("require_data_export", v)}
            label="דרוש export נתונים לפני ארכיון"
            hint="לפני שתיקייה עוברת ל-archive, המערכת תייצא קובץ CSV של כל הנתונים."
          />
        </div>
      </Section>

      <SaveBar onSave={save} busy={busy} dirty={true} />
    </div>
  );
}

function ToggleRow({ checked, onChange, label, hint }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: space(3),
      padding: space(3), background: checked ? "#fffbeb" : "#f9fafb",
      border: `1px solid ${checked ? "#fbbf24" : color.borderDefault}`,
      borderRadius: radius.md,
    }}>
      <Toggle checked={checked} onChange={onChange} />
      <div>
        <div style={{ ...type.bodyStrong, color: color.fgDefault }}>{label}</div>
        {hint && <div style={{ ...type.small, color: color.fgMuted, marginTop: 2 }}>{hint}</div>}
      </div>
    </div>
  );
}

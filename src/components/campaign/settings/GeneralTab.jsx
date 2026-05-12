/**
 * GeneralTab.jsx — Settings · כללי + מצב בטוח + שעות עבודה.
 *
 * Backing: `media_settings.payload` (JSONB).
 * Keys: dry_run · default_check_window_days · min_days_for_recommendation ·
 *       holidays_list[] · working_hours{start,end,days[],timezone} ·
 *       weekend_behavior · live_actions_blackout_dates[].
 */
import React, { useEffect, useState } from "react";
import { getGeneralSettings, updateGeneralSettings, getDryRunStatus } from "../../../api.js";
import { color, radius, space, type, fontFamily } from "../_tokens.js";
import { useToast } from "../Toast.jsx";
import {
  card, Section, Row, FieldBox, Toggle, Chip, SaveBar, ErrorBanner, LoadingBlock,
  input, select, fieldHint, fieldLabel, primaryBtn, readPayload,
} from "./_shared.jsx";

const WEEKDAYS = [
  { id: 0, label: "א" }, { id: 1, label: "ב" }, { id: 2, label: "ג" },
  { id: 3, label: "ד" }, { id: 4, label: "ה" }, { id: 5, label: "ו" }, { id: 6, label: "ש" },
];

const WEEKEND_BEHAVIORS = [
  { id: "pause",     label: "השהיה מלאה",  hint: "אין פעולות חיות בכלל בסופ\"ש" },
  { id: "reduced",   label: "פעילות מצומצמת", hint: "רק תקציב מופחת, בלי שינויים גדולים" },
  { id: "continue",  label: "כרגיל",            hint: "פעילות מלאה כל ימות השבוע" },
];

export default function GeneralTab() {
  const toast = useToast();
  const [dryRun, setDryRun] = useState(true);
  const [loaded, setLoaded] = useState(null);
  const [draft, setDraft]   = useState({
    default_check_window_days: 7,
    min_days_for_recommendation: 3,
    holidays_list: [],
    working_hours: { start: "09:00", end: "20:00", days: [0, 1, 2, 3, 4], timezone: "Asia/Jerusalem" },
    weekend_behavior: "reduced",
    live_actions_blackout_dates: [],
  });
  const [newHoliday, setNewHoliday] = useState("");
  const [newBlackout, setNewBlackout] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [gs, dr] = await Promise.all([getGeneralSettings(), getDryRunStatus()]);
      const p = gs.payload || {};
      setLoaded(gs);
      setDryRun(!!dr.dry_run);
      setDraft({
        default_check_window_days:   Number(readPayload(p, "default_check_window_days",   7)),
        min_days_for_recommendation: Number(readPayload(p, "min_days_for_recommendation", 3)),
        holidays_list:               readPayload(p, "holidays_list", []),
        working_hours: {
          start:    readPayload(p, "working_hours.start",    "09:00"),
          end:      readPayload(p, "working_hours.end",      "20:00"),
          days:     readPayload(p, "working_hours.days",     [0, 1, 2, 3, 4]),
          timezone: readPayload(p, "working_hours.timezone", "Asia/Jerusalem"),
        },
        weekend_behavior:            readPayload(p, "weekend_behavior", "reduced"),
        live_actions_blackout_dates: readPayload(p, "live_actions_blackout_dates", []),
      });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function patch(key, value) {
    setDraft(prev => ({ ...prev, [key]: value }));
  }

  function patchWH(key, value) {
    setDraft(prev => ({ ...prev, working_hours: { ...prev.working_hours, [key]: value } }));
  }

  function toggleDay(day) {
    const has = draft.working_hours.days.includes(day);
    const next = has
      ? draft.working_hours.days.filter(d => d !== day)
      : [...draft.working_hours.days, day].sort();
    patchWH("days", next);
  }

  function addHoliday() {
    if (newHoliday && !draft.holidays_list.includes(newHoliday)) {
      patch("holidays_list", [...draft.holidays_list, newHoliday].sort());
      setNewHoliday("");
    }
  }
  function addBlackout() {
    if (newBlackout && !draft.live_actions_blackout_dates.includes(newBlackout)) {
      patch("live_actions_blackout_dates", [...draft.live_actions_blackout_dates, newBlackout].sort());
      setNewBlackout("");
    }
  }

  async function save() {
    setBusy(true); setError(null);
    try {
      const current = loaded || (await getGeneralSettings());
      const payload = {
        ...(current.payload || {}),
        dry_run: dryRun,
        ...draft,
      };
      await updateGeneralSettings({ payload, updated_by: "marketing_manager" });
      toast.success("⚙ ההגדרות הכלליות נשמרו");
      await load();
    } catch (e) {
      toast.error(`שגיאה בשמירה: ${e.message}`);
      setError(e.message);
    }
    finally { setBusy(false); }
  }

  if (loading) return <div style={card}><LoadingBlock /></div>;

  return (
    <div style={card}>
      <ErrorBanner error={error} />

      {/* Dry-run banner */}
      <div style={{
        background: dryRun ? "#fef3c7" : "#fee2e2",
        border: `2px solid ${dryRun ? "#fbbf24" : "#fca5a5"}`,
        borderRadius: 12, padding: space(4), marginBottom: space(5),
      }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: space(3), cursor: "pointer" }}>
          <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)}
                 style={{ width: 20, height: 20, marginTop: 2, cursor: "pointer", accentColor: color.primary }} />
          <div>
            <div style={{ ...type.h3, color: dryRun ? "#854d0e" : "#991b1b" }}>
              {dryRun ? "🛡 מצב בטוח (Dry Run) — פעיל" : "⚠ מצב חי — פעולות מתבצעות בפועל!"}
            </div>
            <div style={{ ...type.bodySmall, color: dryRun ? "#a16207" : "#b91c1c", marginTop: space(1) }}>
              {dryRun
                ? "המערכת תכין הכל אבל לא תבצע שום פעולה חיה בפלטפורמות. שום קמפיין לא יעלה לאוויר, שום תקציב לא ישתנה. בטוח לבדיקות."
                : "המערכת תבצע פעולות אמיתיות בפלטפורמות (Meta, Google, וכו'). פרסום קמפיינים, שינוי תקציב והורדת מודעות יקרו בפועל."}
            </div>
          </div>
        </label>
      </div>

      <Section title="🔍 חלונות בדיקה לחישובי המלצות">
        <Row>
          <FieldBox label="חלון בדיקה ברירת מחדל (ימים)"
                    hint="כמה ימים אחורה ייבדקו הנתונים כשמחושבת המלצה חדשה. ככל שיותר ימים — תמונה רחבה יותר אבל פחות תגובה לאירועים אחרונים.">
            <input type="number" min="1" max="90" value={draft.default_check_window_days}
                   onChange={e => patch("default_check_window_days", Number(e.target.value))} style={input} />
          </FieldBox>
          <FieldBox label="מינימום ימי דאטה לפני המלצה ראשונה"
                    hint="המערכת לא תוציא המלצה לקמפיין שעדיין צעיר מהמספר הזה.">
            <input type="number" min="1" max="30" value={draft.min_days_for_recommendation}
                   onChange={e => patch("min_days_for_recommendation", Number(e.target.value))} style={input} />
          </FieldBox>
        </Row>
      </Section>

      <Section title="🕐 שעות עבודה של המערכת"
               hint="באילו שעות מותר למערכת לבצע פעולות חיות (פרסום, שינוי תקציב, הורדת מודעות). מחוץ לשעות האלה — רק תכנון ולוגים.">
        <Row>
          <FieldBox label="שעת התחלה">
            <input type="time" value={draft.working_hours.start}
                   onChange={e => patchWH("start", e.target.value)} style={input} />
          </FieldBox>
          <FieldBox label="שעת סיום">
            <input type="time" value={draft.working_hours.end}
                   onChange={e => patchWH("end", e.target.value)} style={input} />
          </FieldBox>
          <FieldBox label="אזור זמן">
            <select value={draft.working_hours.timezone}
                    onChange={e => patchWH("timezone", e.target.value)} style={select}>
              <option value="Asia/Jerusalem">ישראל (Asia/Jerusalem)</option>
              <option value="UTC">UTC</option>
            </select>
          </FieldBox>
        </Row>

        <div style={{ marginTop: space(4) }}>
          <label style={fieldLabel}>ימי פעילות</label>
          <div style={{ display: "flex", gap: space(1.5), flexWrap: "wrap" }}>
            {WEEKDAYS.map(d => {
              const active = draft.working_hours.days.includes(d.id);
              return (
                <button key={d.id} onClick={() => toggleDay(d.id)} style={{
                  width: 42, height: 42, borderRadius: "50%",
                  border: `2px solid ${active ? color.primary : "#cbd5e1"}`,
                  background: active ? color.primary : "#fff",
                  color: active ? "#fff" : "#64748b",
                  fontWeight: 700, cursor: "pointer", fontFamily, fontSize: 14,
                }}>{d.label}</button>
              );
            })}
          </div>
          <div style={fieldHint}>הקליקי כדי להפעיל/לכבות יום</div>
        </div>
      </Section>

      <Section title={'🌅 התנהגות בסופ"ש'}
               hint='מה המערכת רשאית לעשות בימי שישי-שבת. השפעה רק על פעולות חיות; ניתוח ותכנון רצים כרגיל.'>
        <div style={{ display: "flex", flexDirection: "column", gap: space(2) }}>
          {WEEKEND_BEHAVIORS.map(b => {
            const active = draft.weekend_behavior === b.id;
            return (
              <div key={b.id} onClick={() => patch("weekend_behavior", b.id)} style={{
                padding: space(3), borderRadius: radius.md, cursor: "pointer",
                background: active ? "#eff6ff" : "#fff",
                border: `2px solid ${active ? color.primary : "#e5e7eb"}`,
                display: "flex", alignItems: "center", gap: space(3),
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%",
                  border: `2px solid ${active ? color.primary : "#cbd5e1"}`,
                  background: active ? color.primary : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 11,
                }}>{active && "●"}</div>
                <div>
                  <div style={{ ...type.bodyStrong, color: active ? color.primary : color.fgDefault }}>{b.label}</div>
                  <div style={{ ...type.small, color: color.fgMuted, marginTop: 2 }}>{b.hint}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="📅 ימי חג ופגרה"
               hint="המערכת לא תייצר המלצות לסגירה או שינוי תקציב בתאריכים האלה.">
        <div style={{ display: "flex", gap: space(2), marginBottom: space(2) }}>
          <input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} style={{ ...input, flex: 1 }} />
          <button onClick={addHoliday} disabled={!newHoliday} style={{
            ...primaryBtn, opacity: newHoliday ? 1 : 0.5,
          }}>הוספה</button>
        </div>
        <ChipDateList items={draft.holidays_list} tone="primary"
                      onRemove={d => patch("holidays_list", draft.holidays_list.filter(x => x !== d))} />
      </Section>

      <Section title="🚫 תאריכי הקפאה לפעולות חיות"
               hint="תאריכים שבהם אסור בכלל לבצע פעולות חיות — מעבר לחגים. שימושי לפני אירועי שיווק גדולים או blackouts.">
        <div style={{ display: "flex", gap: space(2), marginBottom: space(2) }}>
          <input type="date" value={newBlackout} onChange={e => setNewBlackout(e.target.value)} style={{ ...input, flex: 1 }} />
          <button onClick={addBlackout} disabled={!newBlackout} style={{
            ...primaryBtn, opacity: newBlackout ? 1 : 0.5,
          }}>הוספה</button>
        </div>
        <ChipDateList items={draft.live_actions_blackout_dates} tone="danger"
                      onRemove={d => patch("live_actions_blackout_dates", draft.live_actions_blackout_dates.filter(x => x !== d))} />
      </Section>

      <SaveBar onSave={save} busy={busy} dirty={true} />
    </div>
  );
}

function ChipDateList({ items, tone = "primary", onRemove }) {
  if (items.length === 0) {
    return (
      <div style={{
        fontSize: 13, color: "#9ca3af", padding: space(4),
        background: "#f9fafb", borderRadius: 8, textAlign: "center",
      }}>
        עדיין לא הוגדרו תאריכים.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: space(2) }}>
      {items.map(d => (
        <Chip key={d} tone={tone} onRemove={() => onRemove(d)}>
          📅 {new Date(d).toLocaleDateString("he-IL")}
        </Chip>
      ))}
    </div>
  );
}

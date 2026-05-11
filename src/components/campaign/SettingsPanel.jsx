/**
 * SettingsPanel.jsx — הגדרות מערכת לכלל המערכת.
 * אין JSON גלוי. אין UUIDs. הכל שדות מתויגים בעברית עם הסברים.
 */
import React, { useState, useEffect } from "react";
import {
  getGeneralSettings, updateGeneralSettings,
  listPlatformSettings, updatePlatformSettings,
  listMediaRules, listBudgetSources,
  getDryRunStatus, listNotificationChannels, toggleNotificationChannel,
} from "../../api.js";

const card = {
  background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
  padding: 22, marginBottom: 16, boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
};
const fieldLabel = { display: "block", fontSize: 13, fontWeight: 700, color: "#1f2937", marginBottom: 6 };
const fieldHint  = { fontSize: 12, color: "#9ca3af", marginTop: 4, lineHeight: 1.5 };
const input = {
  width: "100%", padding: "10px 14px", fontSize: 14,
  border: "1px solid #e5e7eb", borderRadius: 8, direction: "rtl",
  background: "#f9fafb",
};

export default function SettingsPanel() {
  const [tab, setTab] = useState("general");

  const TABS = [
    { id: "general",   label: "כללי + מצב בטוח",  icon: "⚙" },
    { id: "platforms", label: "פלטפורמות מדיה",   icon: "📱" },
    { id: "channels",  label: "ערוצי התראה",      icon: "🔔" },
    { id: "rules",     label: "חוקי המלצה",       icon: "📐" },
    { id: "budgets",   label: "מקורות תקציב",     icon: "💰" },
  ];

  return (
    <div style={{ direction: "rtl" }}>
      <div style={{
        background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12,
        padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#1e3a8a",
      }}>
        💡 ההגדרות בעמוד הזה חלות על <strong>כלל המערכת</strong>. שינוי כאן ישפיע על כל הקורסים והפעילויות.
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", marginBottom: 20, overflowX: "auto" }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 18px", border: "none", background: "transparent", cursor: "pointer",
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? "#1e3a5f" : "#6b7280",
              borderBottom: `3px solid ${active ? "#1e3a5f" : "transparent"}`,
              marginBottom: -2, whiteSpace: "nowrap",
            }}>
              <span style={{ marginInlineEnd: 6 }}>{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>

      {tab === "general"   && <GeneralTab />}
      {tab === "platforms" && <PlatformsTab />}
      {tab === "channels"  && <ChannelsTab />}
      {tab === "rules"     && <RulesTab />}
      {tab === "budgets"   && <BudgetsTab />}
    </div>
  );
}

const Section = ({ title, hint, children }) => (
  <div style={{ marginBottom: 22 }}>
    <h4 style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", margin: "0 0 4px" }}>{title}</h4>
    {hint && <div style={fieldHint}>{hint}</div>}
    <div style={{ marginTop: 12 }}>{children}</div>
  </div>
);
const Row = ({ children }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>{children}</div>
);
const FieldBox = ({ label, hint, children }) => (
  <div>
    <label style={fieldLabel}>{label}</label>
    {children}
    {hint && <div style={fieldHint}>{hint}</div>}
  </div>
);

function GeneralTab() {
  const [dryRun, setDryRun] = useState(true);
  const [defaultCheckWindow, setDefaultCheckWindow] = useState(7);
  const [minDataDays, setMinDataDays] = useState(3);
  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function load() {
    try {
      const [gs, dr] = await Promise.all([getGeneralSettings(), getDryRunStatus()]);
      const p = gs.payload || {};
      setDryRun(!!dr.dry_run);
      setDefaultCheckWindow(Number(p.default_check_window_days ?? 7));
      setMinDataDays(Number(p.min_days_for_recommendation ?? 3));
      setHolidays(Array.isArray(p.holidays_list) ? p.holidays_list : []);
    } catch (e) { setMsg(`שגיאה: ${e.message}`); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const current = await getGeneralSettings();
      const payload = {
        ...(current.payload || {}),
        dry_run: dryRun,
        default_check_window_days: defaultCheckWindow,
        min_days_for_recommendation: minDataDays,
        holidays_list: holidays,
      };
      await updateGeneralSettings({ payload, updated_by: "marketing_manager" });
      setMsg("✓ נשמר בהצלחה");
      setTimeout(() => setMsg(null), 2500);
    } catch (e) { setMsg(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  function addHoliday() {
    if (newHoliday && !holidays.includes(newHoliday)) {
      setHolidays(prev => [...prev, newHoliday].sort());
      setNewHoliday("");
    }
  }

  return (
    <div style={card}>
      <div style={{
        background: dryRun ? "#fef3c7" : "#fee2e2",
        border: `2px solid ${dryRun ? "#fbbf24" : "#fca5a5"}`,
        borderRadius: 12, padding: 16, marginBottom: 22,
      }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)}
                 style={{ width: 20, height: 20, marginTop: 2, cursor: "pointer" }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: dryRun ? "#854d0e" : "#991b1b" }}>
              {dryRun ? "🛡 מצב בטוח (Dry Run) — פעיל" : "⚠ מצב חי — פעולות מתבצעות בפועל!"}
            </div>
            <div style={{ fontSize: 13, color: dryRun ? "#a16207" : "#b91c1c", marginTop: 4 }}>
              {dryRun
                ? "המערכת תכין הכל אבל לא תבצע שום פעולה חיה בפלטפורמות. שום קמפיין לא יעלה לאוויר, שום תקציב לא ישתנה. בטוח לבדיקות וניסויים."
                : "המערכת תבצע פעולות אמיתיות בפלטפורמות (Meta, Google, וכו'). פרסום קמפיינים, שינוי תקציב והורדת מודעות יקרו בפועל."}
            </div>
          </div>
        </label>
      </div>

      <Section title="🔍 חלונות בדיקה לחישובי המלצות">
        <Row>
          <FieldBox label="חלון בדיקה ברירת מחדל (ימים)"
                    hint="כמה ימים אחורה ייבדקו הנתונים כשמחושבת המלצה חדשה. ככל שיותר ימים — תמונה רחבה יותר אבל פחות תגובה לאירועים אחרונים.">
            <input type="number" min="1" max="90" value={defaultCheckWindow}
                   onChange={e => setDefaultCheckWindow(Number(e.target.value))} style={input} />
          </FieldBox>
          <FieldBox label="מינימום ימי דאטה לפני המלצה ראשונה"
                    hint="המערכת לא תוציא המלצה לקמפיין שעדיין צעיר מהמספר הזה. ערך נמוך מדי = המלצות עם דאטה לא מספיק.">
            <input type="number" min="1" max="30" value={minDataDays}
                   onChange={e => setMinDataDays(Number(e.target.value))} style={input} />
          </FieldBox>
        </Row>
      </Section>

      <Section title="📅 ימי חג ופגרה" hint="המערכת לא תייצר המלצות לסגירה או שינוי תקציב בתאריכים האלה ובימים שאחריהם.">
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} style={{ ...input, flex: 1 }} />
          <button onClick={addHoliday} disabled={!newHoliday} style={{
            padding: "10px 18px", background: "#1e3a5f", color: "#fff", border: "none",
            borderRadius: 8, fontWeight: 700, cursor: newHoliday ? "pointer" : "not-allowed",
          }}>הוספה</button>
        </div>
        {holidays.length === 0 && (
          <div style={{ fontSize: 13, color: "#9ca3af", padding: 16, background: "#f9fafb", borderRadius: 8, textAlign: "center" }}>
            עדיין לא הוגדרו ימי חג. הוסיפי תאריכים שבהם המערכת לא תייצר המלצות.
          </div>
        )}
        {holidays.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {holidays.map(d => (
              <span key={d} style={{
                background: "#e0e7ff", color: "#3730a3", padding: "6px 12px", borderRadius: 20,
                fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
              }}>
                📅 {new Date(d).toLocaleDateString("he-IL")}
                <button onClick={() => setHolidays(prev => prev.filter(x => x !== d))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 0, lineHeight: 1, fontSize: 16 }}>×</button>
              </span>
            ))}
          </div>
        )}
      </Section>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, paddingTop: 18, borderTop: "1px solid #e5e7eb" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: msg?.startsWith("✓") ? "#15803d" : "#b91c1c" }}>
          {msg || ""}
        </span>
        <button onClick={save} disabled={busy} style={{
          padding: "11px 24px", background: "#1e3a5f", color: "#fff", border: "none",
          borderRadius: 8, fontWeight: 700, fontSize: 14,
          cursor: busy ? "not-allowed" : "pointer", boxShadow: "0 2px 6px rgba(30,58,95,0.25)",
          opacity: busy ? 0.6 : 1,
        }}>{busy ? "שומר..." : "💾 שמירת שינויים"}</button>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <label style={{ position: "relative", display: "inline-block", width: 48, height: 26, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: "none" }} />
      <span style={{
        position: "absolute", inset: 0, borderRadius: 13,
        background: checked ? "#16a34a" : "#cbd5e1", transition: "0.2s",
      }} />
      <span style={{
        position: "absolute", top: 3, insetInlineStart: checked ? 25 : 3,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        transition: "0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </label>
  );
}

function PlatformsTab() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState(null);

  async function load() {
    try { setRows(await listPlatformSettings({ activeOnly: false })); }
    catch (e) { setMsg(`שגיאה: ${e.message}`); }
  }
  useEffect(() => { load(); }, []);

  async function toggleActive(platform, active) {
    try {
      await updatePlatformSettings(platform, {
        payload: rows.find(r => r.platform === platform)?.payload || {},
        is_active: active, updated_by: "marketing_manager",
      });
      await load();
    } catch (e) { setMsg(`שגיאה: ${e.message}`); }
  }

  return (
    <div style={card}>
      <h4 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>📱 פלטפורמות מדיה זמינות</h4>
      <div style={fieldHint}>הפעילי / השביתי פלטפורמות שהמערכת מנהלת. פלטפורמה שכבויה לא תופיע בלוחות ולא תקבל פעולות.</div>
      {msg && <div style={{ color: "#b91c1c", marginTop: 10 }}>{msg}</div>}
      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {rows.map(r => (
          <div key={r.platform} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderRadius: 10, border: "1px solid #e5e7eb",
            background: r.is_active ? "#f0fdf4" : "#f9fafb",
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                {r.platform === "meta" ? "📘 Meta (Facebook + Instagram)" :
                 r.platform === "google" ? "🔍 Google Ads" :
                 r.platform === "tiktok" ? "🎵 TikTok Ads" :
                 r.platform}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                פורמטים זמינים: {Object.keys(r.formats || {}).join(" · ") || "—"}
              </div>
            </div>
            <Toggle checked={!!r.is_active} onChange={v => toggleActive(r.platform, v)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChannelsTab() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg]   = useState(null);

  async function load() {
    try { setRows(await listNotificationChannels({ activeOnly: false })); }
    catch (e) { setMsg(`שגיאה: ${e.message}`); }
  }
  useEffect(() => { load(); }, []);

  async function toggle(id, active) {
    try { await toggleNotificationChannel(id, { is_active: active, changed_by: "marketing_manager" }); await load(); }
    catch (e) { setMsg(`שגיאה: ${e.message}`); }
  }

  return (
    <div style={card}>
      <h4 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>🔔 איפה לקבל התראות</h4>
      <div style={fieldHint}>
        התראות In-App מופיעות בפעמון בראש הדף — תמיד פעילות. אפשר להוסיף גם דוא"ל לקבלת עדכונים חשובים.
      </div>
      {msg && <div style={{ color: "#b91c1c", marginTop: 10 }}>{msg}</div>}
      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {rows.map(c => {
          const isInApp = c.channel_type === "in_app";
          return (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px", borderRadius: 10, border: "1px solid #e5e7eb",
              background: c.is_active ? "#f0fdf4" : "#f9fafb",
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                  {isInApp ? "🔔 התראות באתר (פעמון)" :
                   c.channel_type === "email" ? "📧 דוא\"ל" :
                   c.channel_name}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {isInApp ? "תמיד פעיל — לא ניתן לכבות" : (c.config?.from ? `נשלח אל: ${c.config.from}` : "")}
                </div>
              </div>
              {isInApp
                ? <span style={{ color: "#15803d", fontWeight: 700, fontSize: 13 }}>✓ פעיל תמיד</span>
                : <Toggle checked={!!c.is_active} onChange={v => toggle(c.id, v)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RulesTab() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg]   = useState(null);
  useEffect(() => {
    listMediaRules({ activeOnly: false })
      .then(setRows).catch(e => setMsg(`שגיאה: ${e.message}`));
  }, []);
  return (
    <div style={card}>
      <h4 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>📐 חוקי המלצה</h4>
      <div style={fieldHint}>
        חוקים שמפעילים המלצות אוטומטיות מהמערכת. ניתן לערוך / להוסיף בהמשך.
      </div>
      {msg && <div style={{ color: "#b91c1c", marginTop: 10 }}>{msg}</div>}
      {rows.length === 0 && (
        <div style={{ fontSize: 14, color: "#6b7280", padding: 30, textAlign: "center", marginTop: 14, background: "#f9fafb", borderRadius: 10 }}>
          🌱 עוד לא הוגדרו חוקים. ברגע שתתחילי לעבוד עם המערכת — היא תציע חוקים מתאימים.
        </div>
      )}
      {rows.map(r => (
        <div key={r.id} style={{ padding: 14, marginTop: 10, border: "1px solid #e5e7eb", borderRadius: 10 }}>
          <div style={{ fontWeight: 700, color: "#111827" }}>{r.title || r.rule_key}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            מופעל כאשר: {r.signal?.metric} {r.signal?.operator} {r.signal?.threshold} · רמת חומרה: {r.severity}
          </div>
        </div>
      ))}
    </div>
  );
}

function BudgetsTab() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg]   = useState(null);
  useEffect(() => {
    listBudgetSources()
      .then(setRows).catch(e => setMsg(`שגיאה: ${e.message}`));
  }, []);

  const labels = {
    from_existing:       "מהתקציב הבית-ספרי",
    dedicated:           "ייעודי לקורס",
    one_time:            "חד פעמי",
    time_bound:          "לתקופה מוגדרת",
    launch_then_ongoing: "השקה + שוטף",
    undefined:           "טרם הוגדר",
  };

  return (
    <div style={card}>
      <h4 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>💰 כל מקורות התקציב</h4>
      <div style={fieldHint}>תצוגה כללית של כל הקצאות התקציב בכל הקורסים. לעריכת תקציב לקורס — היכנסי לכרטיס של הקורס.</div>
      {msg && <div style={{ color: "#b91c1c", marginTop: 10 }}>{msg}</div>}
      {rows.length === 0 && (
        <div style={{ fontSize: 14, color: "#6b7280", padding: 30, textAlign: "center", marginTop: 14, background: "#f9fafb", borderRadius: 10 }}>
          🪙 עוד לא הוגדרו מקורות תקציב לקורסים.
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {rows.map(b => (
            <div key={b.id} style={{ padding: 14, marginBottom: 8, border: "1px solid #e5e7eb", borderRadius: 10, display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  {labels[b.source_type] || b.source_type}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {b.period_start && b.period_end ? `${b.period_start} → ${b.period_end}` : "ללא הגבלת תאריכים"}
                </div>
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f" }}>
                  {b.amount_ils ? `₪${Number(b.amount_ils).toLocaleString("he-IL")}` : "—"}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{b.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

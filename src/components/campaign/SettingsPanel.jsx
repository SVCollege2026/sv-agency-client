/**
 * SettingsPanel.jsx — General/Course/Platform settings + Dry Run toggle +
 * Budget sources + Media rules. All UI-driven (Plan §"All business values in UI").
 */
import React, { useState, useEffect } from "react";
import {
  getGeneralSettings, updateGeneralSettings,
  listPlatformSettings, updatePlatformSettings,
  listMediaRules, listBudgetSources,
  getDryRunStatus, listNotificationChannels, toggleNotificationChannel,
} from "../../api.js";

const section = {
  background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0",
  padding: 18, marginBottom: 16,
};

export default function SettingsPanel() {
  const [tab, setTab] = useState("general");

  return (
    <div style={{ direction: "rtl" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "general",   label: "⚙ כללי" },
          { id: "platforms", label: "📱 פלטפורמות" },
          { id: "rules",     label: "📋 חוקי המלצה" },
          { id: "budgets",   label: "💰 מקורות תקציב" },
          { id: "channels",  label: "🔔 ערוצי התראה" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 14px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: tab === t.id ? "#1e3a5f" : "#fff",
            color:      tab === t.id ? "#fff" : "#475569",
            border: `1px solid ${tab === t.id ? "#1e3a5f" : "#cbd5e1"}`,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "general"   && <GeneralTab />}
      {tab === "platforms" && <PlatformsTab />}
      {tab === "rules"     && <RulesTab />}
      {tab === "budgets"   && <BudgetsTab />}
      {tab === "channels"  && <ChannelsTab />}
    </div>
  );
}

function GeneralTab() {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState("{}");
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function load() {
    try {
      const [gs, dr] = await Promise.all([getGeneralSettings(), getDryRunStatus()]);
      setData(gs);
      setDraft(JSON.stringify(gs.payload || {}, null, 2));
      setDryRun(!!dr.dry_run);
    } catch (e) { setMsg(`שגיאה: ${e.message}`); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const parsed = JSON.parse(draft);
      const merged = { ...parsed, dry_run: dryRun };
      await updateGeneralSettings({ payload: merged, updated_by: "marketing_manager" });
      setMsg("✓ נשמר");
      await load();
    } catch (e) {
      setMsg(`שגיאה: ${e.message}`);
    } finally { setBusy(false); }
  }

  return (
    <div style={section}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f172a", fontWeight: 700 }}>הגדרות כלליות</h3>

      <div style={{ background: "#fef3c7", padding: 12, borderRadius: 8, marginBottom: 14, borderInlineStart: "4px solid #ca8a04" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
          <strong style={{ color: "#854d0e" }}>Dry Run mode</strong>
          <span style={{ fontSize: 12, color: "#a16207" }}>
            ({dryRun ? "פעולות חיות חסומות — log only" : "פעולות חיות יבוצעו!"})
          </span>
        </label>
      </div>

      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
        payload (JSON — thresholds, חוקי הקשר, חלונות זמן וכו'):
      </div>
      <textarea
        value={draft} onChange={e => setDraft(e.target.value)}
        style={{
          width: "100%", minHeight: 200, padding: 10, fontFamily: "monospace",
          fontSize: 13, border: "1px solid #cbd5e1", borderRadius: 6, direction: "ltr",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        <span style={{ fontSize: 12, color: msg?.startsWith("✓") ? "#15803d" : "#b91c1c" }}>{msg}</span>
        <button onClick={save} disabled={busy} style={{
          padding: "8px 16px", background: "#1e3a5f", color: "#fff", border: "none",
          borderRadius: 6, cursor: busy ? "not-allowed" : "pointer", fontWeight: 700,
        }}>{busy ? "שומר..." : "שמור"}</button>
      </div>
    </div>
  );
}

function PlatformsTab() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState(null);

  async function load() {
    try {
      const data = await listPlatformSettings({ activeOnly: false });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) { setMsg(`שגיאה: ${e.message}`); }
  }
  useEffect(() => { load(); }, []);

  async function toggleActive(platform, active) {
    try {
      await updatePlatformSettings(platform, { payload: rows.find(r => r.platform === platform)?.payload || {}, is_active: active, updated_by: "marketing_manager" });
      await load();
    } catch (e) { setMsg(`שגיאה: ${e.message}`); }
  }

  return (
    <div style={section}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f172a", fontWeight: 700 }}>פלטפורמות מדיה</h3>
      {msg && <div style={{ color: "#b91c1c", marginBottom: 10 }}>{msg}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: "#f8fafc" }}>
          <Th>פלטפורמה</Th><Th>פעיל</Th><Th>פורמטים</Th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.platform} style={{ borderTop: "1px solid #f1f5f9" }}>
              <Td><strong>{r.platform}</strong></Td>
              <Td>
                <input type="checkbox" checked={!!r.is_active} onChange={e => toggleActive(r.platform, e.target.checked)} />
              </Td>
              <Td>
                <code style={{ fontSize: 11 }}>{Object.keys(r.formats || {}).join(", ") || "—"}</code>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RulesTab() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    listMediaRules({ activeOnly: false })
      .then(setRows)
      .catch(e => setMsg(`שגיאה: ${e.message}`));
  }, []);
  return (
    <div style={section}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f172a", fontWeight: 700 }}>חוקי המלצה ({rows.length})</h3>
      {msg && <div style={{ color: "#b91c1c", marginBottom: 10 }}>{msg}</div>}
      {rows.length === 0 && <div style={{ color: "#64748b", fontSize: 13 }}>אין חוקים מוגדרים.</div>}
      {rows.map(r => (
        <div key={r.id} style={{ padding: 10, borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>{r.rule_key} — {r.title}</div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4, fontFamily: "monospace" }}>
            signal: {JSON.stringify(r.signal)} · severity: {r.severity} · scope: {r.scope}
          </div>
        </div>
      ))}
    </div>
  );
}

function BudgetsTab() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    listBudgetSources()
      .then(setRows)
      .catch(e => setMsg(`שגיאה: ${e.message}`));
  }, []);
  return (
    <div style={section}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f172a", fontWeight: 700 }}>מקורות תקציב ({rows.length})</h3>
      {msg && <div style={{ color: "#b91c1c", marginBottom: 10 }}>{msg}</div>}
      {rows.length === 0 && <div style={{ color: "#64748b", fontSize: 13 }}>אין מקורות תקציב מוגדרים.</div>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: "#f8fafc" }}>
          <Th>סוג</Th><Th>סכום</Th><Th>תקופה</Th><Th>סטטוס</Th><Th>תיקייה</Th>
        </tr></thead>
        <tbody>
          {rows.map(b => (
            <tr key={b.id} style={{ borderTop: "1px solid #f1f5f9" }}>
              <Td>{b.source_type}</Td>
              <Td>{b.amount_ils ? `₪${b.amount_ils}` : "—"}</Td>
              <Td>{b.period_start || "—"} → {b.period_end || "—"}</Td>
              <Td>{b.status}</Td>
              <Td><code style={{ fontSize: 11 }}>{b.folder_id?.slice(0, 8) || "—"}</code></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChannelsTab() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState(null);

  async function load() {
    try { setRows(await listNotificationChannels({ activeOnly: false })); }
    catch (e) { setMsg(`שגיאה: ${e.message}`); }
  }
  useEffect(() => { load(); }, []);

  async function toggle(id, active) {
    try {
      await toggleNotificationChannel(id, { is_active: active, changed_by: "marketing_manager" });
      await load();
    } catch (e) { setMsg(`שגיאה: ${e.message}`); }
  }

  return (
    <div style={section}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f172a", fontWeight: 700 }}>ערוצי התראה</h3>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
        In-App חובה (תמיד פעיל). Email אופציונלי. Slack/SMS — future.
      </div>
      {msg && <div style={{ color: "#b91c1c", marginBottom: 10 }}>{msg}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: "#f8fafc" }}>
          <Th>שם</Th><Th>סוג</Th><Th>פעיל</Th>
        </tr></thead>
        <tbody>
          {rows.map(c => (
            <tr key={c.id} style={{ borderTop: "1px solid #f1f5f9" }}>
              <Td><strong>{c.channel_name}</strong></Td>
              <Td>{c.channel_type}</Td>
              <Td>
                {c.channel_type === "in_app"
                  ? <span style={{ color: "#15803d", fontWeight: 700, fontSize: 12 }}>✓ תמיד</span>
                  : <input type="checkbox" checked={!!c.is_active} onChange={e => toggle(c.id, e.target.checked)} />}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Th = ({ children }) => (
  <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "#64748b", borderBottom: "2px solid #e2e8f0" }}>{children}</th>
);
const Td = ({ children }) => (
  <td style={{ padding: "10px 12px", fontSize: 13, color: "#334155" }}>{children}</td>
);

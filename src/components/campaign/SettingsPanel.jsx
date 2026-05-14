/**
 * SettingsPanel.jsx — הגדרות מערכת כרשימה שטוחה.
 * כל שורה: תווית | ערך נוכחי | כפתור ✎
 * לחיצה על ✎ → input inline → Enter / blur → שמירה.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  getSchoolBudget, updateSchoolBudget,
  getGeneralSettings, updateGeneralSettings,
  getSchoolActualSpend,
} from "../../api.js";
import { color, radius, space, fontFamily, transition } from "./_tokens.js";
import { useToast } from "./Toast.jsx";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(v) {
  if (v == null || v === "") return "—";
  return `₪${Number(v).toLocaleString("he-IL")}`;
}
function fmtPct(v) {
  if (v == null || v === "") return "—";
  return `${Number(v).toFixed(2)}%`;
}
function fmtNum(v) {
  if (v == null || v === "") return "—";
  return String(v);
}

// ─── single editable row ──────────────────────────────────────────────────────

function SettingRow({ label, value, hint, format = fmtNum, type = "text", onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (editing && ref.current) { ref.current.focus(); ref.current.select?.(); }
  }, [editing]);

  function startEdit() {
    setDraft(value == null ? "" : String(value));
    setEditing(true);
  }

  async function commit() {
    setEditing(false);
    const parsed = type === "number" ? (draft.trim() === "" ? null : Number(draft)) : draft.trim() || null;
    if (parsed === value) return;
    await onSave(parsed);
  }

  const displayed = format(value);

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto auto",
      alignItems: "center", gap: space(3),
      padding: `${space(2)} ${space(4)}`,
      borderBottom: `1px solid ${color.borderSubtle}`,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: color.fgDefault, fontFamily }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: color.fgSubtle, marginTop: 1, fontFamily }}>{hint}</div>}
      </div>

      {editing ? (
        <input
          ref={ref}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { setEditing(false); }
          }}
          style={{
            width: 160, padding: "6px 10px", fontSize: 14, fontFamily,
            border: `2px solid ${color.primary}`, borderRadius: radius.sm,
            outline: "none", textAlign: "left", direction: "ltr",
          }}
        />
      ) : (
        <span style={{ fontSize: 13, fontWeight: 600, color: value != null && value !== "" ? color.fgDefault : color.fgSubtle, fontFamily }}>
          {displayed}
        </span>
      )}

      <button
        onClick={editing ? commit : startEdit}
        style={{
          background: "transparent",
          border: `1px solid ${editing ? color.primary : "transparent"}`,
          borderRadius: radius.sm, padding: `${space(1)} ${space(2)}`,
          fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily,
          color: editing ? color.primary : color.fgSubtle,
          transition: transition.fast,
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => { if (!editing) e.currentTarget.style.color = color.fgDefault; }}
        onMouseLeave={e => { if (!editing) e.currentTarget.style.color = color.fgSubtle; }}
      >
        {editing ? "שמירה" : "✎ עריכה"}
      </button>
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{
      padding: `${space(4)} ${space(4)} ${space(1)}`,
      fontSize: 11, fontWeight: 600, color: color.fgSubtle,
      textTransform: "uppercase", letterSpacing: 0.5, fontFamily,
    }}>{title}</div>
  );
}

const STATUS_UTIL = {
  on_pace:    { color: "#16a34a", label: "בקצב" },
  over_pace:  { color: "#dc2626", label: "מעבר לקצב" },
  under_pace: { color: "#d97706", label: "מתחת לקצב" },
  unknown:    { color: "#6b7280", label: "אין נתונים" },
};

function BudgetUtilBlock({ actualSpend }) {
  const b = actualSpend?.budget;
  const isLoading = actualSpend === null;

  const statusDef = STATUS_UTIL[b?.status] || STATUS_UTIL.unknown;
  const byPlat = actualSpend?.by_platform || {};

  return (
    <div style={{
      margin: `0 ${space(4)} ${space(2)}`,
      background: "#f8fafc",
      border: `1px solid #e2e8f0`,
      borderRadius: 8,
      padding: `${space(3)} ${space(4)}`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: space(2), fontFamily }}>
        ניצול תקציב YTD
      </div>

      {isLoading ? (
        <div style={{ fontSize: 13, color: "#94a3b8", fontFamily }}>טוען...</div>
      ) : (
        <>
          {/* Progress bar */}
          <div style={{ position: "relative", height: 8, background: "#e2e8f0", borderRadius: 99, marginBottom: space(2) }}>
            {/* Year elapsed marker */}
            {b?.year_elapsed_pct != null && (
              <div style={{
                position: "absolute", top: -3, bottom: -3,
                left: `${Math.min(b.year_elapsed_pct, 100)}%`,
                width: 2, background: "#94a3b8", borderRadius: 1,
              }} title={`שנה עברה: ${b.year_elapsed_pct}%`} />
            )}
            {/* Spend fill */}
            <div style={{
              height: "100%", borderRadius: 99,
              background: statusDef.color,
              width: `${Math.min(b?.utilized_pct || 0, 100)}%`,
              transition: "width 0.5s ease",
            }} />
          </div>

          <div style={{ display: "flex", gap: space(4), flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontFamily }}>מנוצל בפועל</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", fontFamily }}>
                {actualSpend?.total_spend != null ? `₪${Number(actualSpend.total_spend).toLocaleString("he-IL")}` : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontFamily }}>% מהתקציב השנתי</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: statusDef.color, fontFamily }}>
                {b?.utilized_pct != null ? `${b.utilized_pct}%` : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontFamily }}>% שנה עברה</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#475569", fontFamily }}>
                {b?.year_elapsed_pct != null ? `${b.year_elapsed_pct}%` : "—"}
              </div>
            </div>
            <div style={{ marginInlineStart: "auto", textAlign: "center" }}>
              <div style={{
                display: "inline-block", padding: "4px 12px", borderRadius: 99,
                background: `${statusDef.color}18`,
                color: statusDef.color, fontWeight: 700, fontSize: 13, fontFamily,
              }}>{statusDef.label}</div>
            </div>
          </div>

          {/* Per-platform breakdown */}
          {Object.keys(byPlat).length > 0 && (
            <div style={{ display: "flex", gap: space(3), marginTop: space(2), flexWrap: "wrap" }}>
              {Object.entries(byPlat).map(([plat, data]) => (
                <div key={plat} style={{ fontSize: 12, color: "#475569", fontFamily }}>
                  <span style={{ fontWeight: 600 }}>{plat.charAt(0).toUpperCase() + plat.slice(1)}</span>
                  {": "}
                  <span>₪{Number(data.spend || 0).toLocaleString("he-IL")}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function SettingsPanel() {
  const toast    = useToast();
  const [budget,      setBudget]      = useState(null);
  const [settings,    setSettings]    = useState(null);
  const [actualSpend, setActualSpend] = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      getSchoolBudget().catch(() => ({})),
      getGeneralSettings().catch(() => ({ payload: {} })),
    ]).then(([b, s]) => {
      setBudget(b);
      setSettings(s);
    }).finally(() => setLoading(false));
    getSchoolActualSpend().then(s => setActualSpend(s)).catch(() => {});
  }, []);

  async function saveBudget(field, value) {
    try {
      const next = {
        annual_budget_ils:  budget?.annual_budget_ils  ?? null,
        monthly_budget_ils: budget?.monthly_budget_ils ?? null,
        media_split: {},
        notes: budget?.notes ?? null,
        updated_by: "marketing_manager",
        [field]: value,
      };
      await updateSchoolBudget(next);
      setBudget(prev => ({ ...prev, [field]: value }));
      toast.success("💰 נשמר");
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
  }

  async function savePayload(key, value) {
    try {
      const current = settings?.payload || {};
      const next = { ...current, [key]: value };
      await updateGeneralSettings({ payload: next, updated_by: "marketing_manager" });
      setSettings(prev => ({ ...prev, payload: next }));
      toast.success("⚙ נשמר");
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
  }

  async function saveWorkingHours(key, value) {
    const wh = settings?.payload?.working_hours || {};
    await savePayload("working_hours", { ...wh, [key]: value });
  }

  async function saveThreshold(platform, metric, field, value) {
    const thresholds = settings?.payload?.thresholds || {};
    const plat = thresholds[platform] || {};
    const met  = plat[metric] || {};
    await savePayload("thresholds", {
      ...thresholds,
      [platform]: { ...plat, [metric]: { ...met, [field]: value } },
    });
  }

  if (loading) {
    return (
      <div style={{ padding: space(8), textAlign: "center", color: color.fgSubtle, fontSize: 14, fontFamily }}>
        טוען הגדרות...
      </div>
    );
  }

  const p = settings?.payload || {};
  const wh = p.working_hours || {};
  const thr = p.thresholds || {};
  const metaT   = thr.meta   || {};
  const googleT = thr.google || {};

  return (
    <div style={{ direction: "rtl", fontFamily }}>

      {/* ── תקציב ─────────────────────────────────────────────────────────── */}
      <SectionHeader title="💰 תקציב בית-ספרי" />
      <SettingRow
        label="תקציב חודשי"
        value={budget?.monthly_budget_ils}
        format={fmtMoney}
        type="number"
        onSave={v => saveBudget("monthly_budget_ils", v)}
      />
      <SettingRow
        label="תקציב שנתי"
        value={budget?.annual_budget_ils}
        format={fmtMoney}
        type="number"
        onSave={v => saveBudget("annual_budget_ils", v)}
      />
      <SettingRow
        label="הערות תקציב"
        value={budget?.notes}
        format={v => v || "—"}
        type="text"
        onSave={v => saveBudget("notes", v)}
      />

      {/* ── ניצול תקציב YTD ─────────────────────────────────────────────── */}
      <BudgetUtilBlock actualSpend={actualSpend} />

      {/* ── מערכת ─────────────────────────────────────────────────────────── */}
      <SectionHeader title="⚙ הגדרות מערכת" />
      <SettingRow
        label="מינימום ימי דאטה לפני המלצה"
        value={p.min_days_for_recommendation}
        format={v => v == null ? "—" : `${v} ימים`}
        type="number"
        hint="כמה ימי דאטה נדרשים לפני שהמערכת מייצרת המלצה על ערוץ"
        onSave={v => savePayload("min_days_for_recommendation", v)}
      />

      {/* ── ספים — Meta ──────────────────────────────────────────────────── */}
      <SectionHeader title="📊 ספי ביצועים — Meta" />
      <SettingRow
        label="CPL — סף עליון (₪)"
        value={metaT.cpl_ils?.sv_avg}
        format={fmtMoney}
        type="number"
        hint="ממוצע SV ללא AI — אסור לחצות. יעד (Great): מתחת ל-₪85"
        onSave={v => saveThreshold("meta", "cpl_ils", "sv_avg", v)}
      />
      <SettingRow
        label="CTR — סף תחתון (%)"
        value={metaT.ctr_pct?.sv_avg}
        format={fmtPct}
        type="number"
        hint="ממוצע SV — אסור לרדת מתחתיו. יעד (Great): מעל 1.5%"
        onSave={v => saveThreshold("meta", "ctr_pct", "sv_avg", v)}
      />
      <SettingRow
        label="CPC — סף עליון (₪)"
        value={metaT.cpc_ils?.sv_avg}
        format={fmtMoney}
        type="number"
        hint="ממוצע SV — אסור לחצות"
        onSave={v => saveThreshold("meta", "cpc_ils", "sv_avg", v)}
      />
      <SettingRow
        label="CPM — סף עליון (₪)"
        value={metaT.cpm_ils?.sv_avg}
        format={fmtMoney}
        type="number"
        hint="ממוצע SV — אסור לחצות. יעד (Great): מתחת ל-₪50"
        onSave={v => saveThreshold("meta", "cpm_ils", "sv_avg", v)}
      />

      {/* ── ספים — Google ────────────────────────────────────────────────── */}
      <SectionHeader title="📊 ספי ביצועים — Google" />
      <SettingRow
        label="CPL — סף עליון (₪)"
        value={googleT.cpl_ils?.sv_avg}
        format={fmtMoney}
        type="number"
        hint="ממוצע SV — אסור לחצות. יעד (Great): מתחת ל-₪100"
        onSave={v => saveThreshold("google", "cpl_ils", "sv_avg", v)}
      />
      <SettingRow
        label="CTR — סף תחתון (%)"
        value={googleT.ctr_pct?.sv_avg}
        format={fmtPct}
        type="number"
        hint="ממוצע SV — אסור לרדת מתחתיו. יעד (Great): מעל 5%"
        onSave={v => saveThreshold("google", "ctr_pct", "sv_avg", v)}
      />
      <SettingRow
        label="CPC — סף עליון (₪)"
        value={googleT.cpc_ils?.sv_avg}
        format={fmtMoney}
        type="number"
        hint="ממוצע SV — אסור לחצות. יעד (Great): מתחת ל-₪3"
        onSave={v => saveThreshold("google", "cpc_ils", "sv_avg", v)}
      />
      <SettingRow
        label="CPM — סף עליון (₪)"
        value={googleT.cpm_ils?.sv_avg}
        format={fmtMoney}
        type="number"
        hint="ממוצע SV — אסור לחצות"
        onSave={v => saveThreshold("google", "cpm_ils", "sv_avg", v)}
      />

    </div>
  );
}

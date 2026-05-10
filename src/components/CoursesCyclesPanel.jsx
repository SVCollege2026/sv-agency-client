/**
 * CoursesCyclesPanel.jsx — "רישום לקורסים" — דשבורד מאוחד לקורסים+מחזורים
 * ========================================================================
 * תצוגה אחת מובנית, מסוננת לפי שנה (דיפולט = שנה נוכחית):
 *
 *   1. כפתורי שנה (top, prominent — כל לחיצה מסננת הכל)
 *   2. 3 פאי לפי קורס: סכום עסקאות / הנחות / נגבה בפועל
 *      - אם נבחר קורס: הפאי מציג חלוקה לפי מחזורים של אותו קורס
 *   3. טבלת קורסים — סכומים מחושבים מהמחזורים של השנה הנבחרת בלבד
 *   4. טבלת מחזורים — מסוננת לשנה + קורס, ממויינת תאריך יורד
 *   5. כל עריכה מקומית בלבד (לא חוזר ל-Fireberry — תוכנית A)
 */
import React, { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer } from "recharts";
import {
  getCourses,
  getCycles,
  updateCycle,
  triggerCoursesScan,
  getCoursesSyncRuns,
} from "../api.js";

// ─── Constants & Utils ───────────────────────────────────────────────────────

const MIN_YEAR = 2026;

// פלטה — 16 צבעים מתואמים לעיצוב כללי
const PALETTE = [
  "#1e3a5f", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#84cc16", "#f97316",
  "#6366f1", "#06b6d4", "#dc2626", "#eab308", "#a855f7", "#475569",
];

function fmtNum(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("he-IL");
}

function fmtMoney(v) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
}

function fmtMoneyShort(v) {
  // ₪1.2M / ₪450K ל-tooltip ולמספרים גדולים
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `₪${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `₪${(n / 1_000).toFixed(0)}K`;
  return `₪${n.toLocaleString("he-IL")}`;
}

function fmtDate(v) {
  if (!v) return "—";
  const s = String(v).slice(0, 10).split("-");
  if (s.length !== 3) return v;
  return `${s[2]}/${s[1]}/${s[0]}`;
}

function fmtDateTime(v) {
  if (!v) return "—";
  return new Date(v).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

function availableYears(cycles) {
  const currentYear = new Date().getFullYear();
  let maxYear = currentYear;
  for (const c of cycles) {
    if (!c.start_date) continue;
    const y = parseInt(String(c.start_date).slice(0, 4), 10);
    if (!Number.isNaN(y) && y > maxYear) maxYear = y;
  }
  const out = [];
  for (let y = MIN_YEAR; y <= maxYear; y += 1) out.push(y);
  return out;
}

// ─── Style tokens (consistent design language) ───────────────────────────────

const T = {
  // colors
  bgPage:        "#f8fafc",
  cardBg:        "#ffffff",
  cardBorder:    "#e2e8f0",
  navy:          "#1e3a5f",
  navyHover:     "#172d4a",
  navyLight:     "#dbeafe",
  textPrimary:   "#0f172a",
  textSecondary: "#475569",
  textMuted:     "#94a3b8",
  rowAltBg:      "#f8fafc",
  // accent for the 3 metrics
  cDeals:        "#1e3a5f",   // navy
  cDiscounts:    "#f59e0b",   // amber
  cCollected:    "#10b981",   // emerald
  // shadows
  shadowSm:      "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
  shadowMd:      "0 4px 12px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.04)",
  // radii
  rSm: 6, rMd: 10, rLg: 14,
};

const S = {
  card: {
    background:    T.cardBg,
    border:        `1px solid ${T.cardBorder}`,
    borderRadius:  T.rLg,
    padding:       20,
    marginBottom:  16,
    boxShadow:     T.shadowSm,
  },
  cardCompact: {
    background:    T.cardBg,
    border:        `1px solid ${T.cardBorder}`,
    borderRadius:  T.rMd,
    padding:       14,
    marginBottom:  12,
    boxShadow:     T.shadowSm,
  },
  sectionTitle: {
    margin: "0 0 6px", color: T.textPrimary, fontSize: 16, fontWeight: 700,
    display: "flex", alignItems: "center", gap: 8,
  },
  sectionHint: { fontSize: 12.5, color: T.textSecondary, marginBottom: 14 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: {
    background: "#f1f5f9", padding: "11px 14px", textAlign: "right",
    fontWeight: 600, color: T.textPrimary, borderBottom: `1px solid ${T.cardBorder}`,
    fontSize: 12.5, letterSpacing: 0.2, position: "sticky", top: 0, zIndex: 1,
  },
  td: { padding: "10px 14px", borderBottom: `1px solid #f1f5f9`, color: T.textPrimary, verticalAlign: "middle" },
  tdSecondary: { padding: "10px 14px", borderBottom: `1px solid #f1f5f9`, color: T.textSecondary, fontSize: 13 },
  badge: (bg, fg) => ({
    background: bg, color: fg, padding: "3px 10px", borderRadius: 999,
    fontSize: 11.5, fontWeight: 600, display: "inline-block", whiteSpace: "nowrap",
  }),
  btnPrimary: {
    background: T.navy, color: "#ffffff", border: "none", borderRadius: T.rMd,
    padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
    transition: "background 0.15s, transform 0.05s",
    boxShadow: T.shadowSm,
  },
  btnSecondary: {
    background: T.cardBg, color: T.navy, border: `1px solid ${T.cardBorder}`, borderRadius: T.rMd,
    padding: "7px 14px", fontSize: 12.5, fontWeight: 500, cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s",
  },
  btnGhost: {
    background: "transparent", color: T.textSecondary, border: "none",
    padding: "4px 8px", fontSize: 12.5, cursor: "pointer", borderRadius: T.rSm,
  },
  input: {
    border: `1px solid ${T.cardBorder}`, borderRadius: T.rSm, padding: "7px 10px",
    fontSize: 13, width: "100%", boxSizing: "border-box", color: T.textPrimary,
    background: T.cardBg,
  },
};

// ─── Status badge (open/closed/active) ──────────────────────────────────────

function StatusBadge({ status }) {
  if (!status) return <span style={S.badge("#e2e8f0", "#475569")}>—</span>;
  const txt = String(status);
  if (txt.includes("פתוח") || txt.includes("פעיל")) {
    return <span style={S.badge("#dcfce7", "#166534")}>{txt}</span>;
  }
  if (txt.includes("סגור") || txt.includes("הסתיים") || txt.includes("בוטל")) {
    return <span style={S.badge("#fee2e2", "#991b1b")}>{txt}</span>;
  }
  return <span style={S.badge("#e2e8f0", "#475569")}>{txt}</span>;
}

// ─── Pie chart card — donut style with center label ─────────────────────────

function PieTooltip({ active, payload, total }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0";
  return (
    <div style={{
      background: "#ffffff", border: `1px solid ${T.cardBorder}`, borderRadius: T.rSm,
      padding: "10px 14px", fontSize: 12.5, boxShadow: T.shadowMd,
    }}>
      <div style={{ fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>{p.payload.name}</div>
      <div style={{ color: T.textSecondary }}>{fmtMoney(p.value)} ({pct}%)</div>
    </div>
  );
}

function PieCard({ title, accent, data, total, emptyText }) {
  const filtered = (data || []).filter((d) => (d.value || 0) > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div style={{
      ...S.card,
      flex: "1 1 320px", minWidth: 320, marginBottom: 0, padding: 18,
      borderTop: `3px solid ${accent}`,
    }}>
      <div style={{ marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 13.5, color: T.textSecondary, fontWeight: 600 }}>{title}</h4>
        <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: T.textPrimary, letterSpacing: -0.3 }}>
          {fmtMoney(total)}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div style={{
          height: 240, display: "flex", alignItems: "center", justifyContent: "center",
          color: T.textMuted, fontSize: 13, flexDirection: "column", gap: 4,
        }}>
          <div style={{ fontSize: 28, opacity: 0.4 }}>○</div>
          {emptyText || "אין נתונים"}
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Pie
                data={filtered} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={88} innerRadius={55}
                paddingAngle={2} stroke="#ffffff" strokeWidth={2}
                isAnimationActive={false}
              >
                {filtered.map((entry, idx) => (
                  <Cell key={entry.name} fill={PALETTE[idx % PALETTE.length]} />
                ))}
              </Pie>
              <ReTooltip content={<PieTooltip total={total} />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center count */}
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", pointerEvents: "none",
          }}>
            <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>
              {filtered.length} פריטים
            </div>
          </div>
        </div>
      )}
      {/* Mini legend below — top 5 only, then "ועוד N" */}
      {filtered.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5 }}>
          {filtered.slice(0, 5).map((d, i) => {
            const pct = total > 0 ? ((d.value / total) * 100).toFixed(0) : "0";
            return (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, color: T.textSecondary }}>
                <span style={{
                  width: 9, height: 9, borderRadius: 2, background: PALETTE[i % PALETTE.length], flex: "0 0 9px",
                }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {d.name}
                </span>
                <span style={{ color: T.textPrimary, fontWeight: 600 }}>{pct}%</span>
              </div>
            );
          })}
          {filtered.length > 5 && (
            <div style={{ color: T.textMuted, fontSize: 11, paddingRight: 15 }}>
              +עוד {filtered.length - 5}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Edit modal ──────────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label style={{ fontSize: 12, color: T.textSecondary, display: "flex", flexDirection: "column", gap: 4 }}>
      {label}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={S.input} />
    </label>
  );
}

function EditCycleModal({ cycle, onSave, onClose }) {
  const [form, setForm] = useState({
    start_date:            cycle.start_date || "",
    end_date:              cycle.end_date || "",
    registration_end_date: cycle.registration_end_date || "",
    registration_status:   cycle.registration_status || "",
    total_enrollees:       cycle.total_enrollees ?? "",
    actual_price:          cycle.actual_price ?? "",
    branch:                cycle.branch || "",
    instructor:            cycle.instructor || "",
    study_days:            cycle.study_days || "",
    study_hours:           cycle.study_hours || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  const change = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const payload = {};
      for (const [k, v] of Object.entries(form)) {
        if (v === "" || v === null) continue;
        if (k === "total_enrollees")       payload[k] = parseInt(v, 10);
        else if (k === "actual_price")      payload[k] = parseFloat(v);
        else                                payload[k] = v;
      }
      await onSave(payload);
      onClose();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.cardBg, borderRadius: T.rLg, padding: 26, width: 580,
        maxHeight: "90vh", overflowY: "auto", boxShadow: T.shadowMd,
      }}>
        <h3 style={{ margin: "0 0 4px", color: T.textPrimary, fontSize: 18, fontWeight: 700 }}>
          עריכת מחזור — {cycle.course_name}
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: T.textMuted }}>
          ⚠ עריכה מקומית בלבד — לא חוזרת ל-Fireberry. הסנכרון הבא (06:00) ידרוס אם הרשומה קיימת שם.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <Field label="תאריך התחלה/מחזור" value={form.start_date}            onChange={change("start_date")}            type="date" />
          <Field label="תאריך סיום"          value={form.end_date}              onChange={change("end_date")}              type="date" />
          <Field label="תאריך סיום הרשמה"   value={form.registration_end_date} onChange={change("registration_end_date")} type="date" />
          <Field label="סטטוס רישום"         value={form.registration_status}   onChange={change("registration_status")}   placeholder="פתוח להרשמה / פעיל / סגור" />
          <Field label="סה״כ נרשמים"         value={form.total_enrollees}       onChange={change("total_enrollees")}       type="number" />
          <Field label="מחיר בפועל"          value={form.actual_price}          onChange={change("actual_price")}          type="number" />
          <Field label="סניף"                value={form.branch}                onChange={change("branch")} />
          <Field label="מרצה"                value={form.instructor}            onChange={change("instructor")} />
          <Field label="ימי לימוד"           value={form.study_days}            onChange={change("study_days")} />
          <Field label="שעות לימוד"          value={form.study_hours}           onChange={change("study_hours")} />
        </div>

        {err && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: T.rSm, fontSize: 12.5, marginBottom: 12 }}>
            שגיאה: {err}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={S.btnSecondary}>ביטול</button>
          <button type="button" onClick={submit} disabled={saving}
                  style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1 }}>
            {saving ? "שומר…" : "שמור"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Year selector — segmented control ──────────────────────────────────────

function YearSelector({ years, value, onChange }) {
  return (
    <div style={{
      display: "inline-flex", padding: 4, gap: 2,
      background: "#f1f5f9", borderRadius: T.rMd,
      border: `1px solid ${T.cardBorder}`,
    }}>
      {years.map((y) => {
        const active = value === y;
        return (
          <button
            key={y}
            type="button"
            onClick={() => onChange(y)}
            style={{
              padding: "8px 18px", fontSize: 13.5, fontWeight: 700,
              borderRadius: T.rSm, cursor: "pointer", minWidth: 72,
              background: active ? T.navy : "transparent",
              color:      active ? "#ffffff" : T.textSecondary,
              border:     "none",
              boxShadow:  active ? T.shadowSm : "none",
              transition: "all 0.15s",
            }}
          >
            {y}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export default function CoursesCyclesPanel() {
  const [courses,    setCourses]    = useState([]);
  const [cycles,     setCycles]     = useState([]);
  const [syncRuns,   setSyncRuns]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [err,        setErr]        = useState(null);
  const [scanning,   setScanning]   = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [filterCourse, setFilterCourse] = useState(""); // product_id selected (or empty)
  const [filterOpen,   setFilterOpen]   = useState("all");
  const [filterYear,   setFilterYear]   = useState(() => Math.max(MIN_YEAR, new Date().getFullYear()));

  async function loadAll() {
    setLoading(true); setErr(null);
    try {
      const [c, cy, runs] = await Promise.all([
        getCourses(),
        getCycles(),
        getCoursesSyncRuns(5),
      ]);
      // הסר placeholder "לא ידוע"
      setCourses((c.courses || []).filter((x) => x.name && x.name !== "לא ידוע"));
      setCycles(cy.cycles || []);
      setSyncRuns(runs.runs || []);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleScan() {
    setScanning(true); setErr(null);
    try {
      await triggerCoursesScan();
      await loadAll();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setScanning(false);
    }
  }

  async function handleSave(payload) {
    if (!editing) return;
    await updateCycle(editing.cycle_id, payload);
    await loadAll();
  }

  // ── Year-filtered cycles (single source of truth for everything) ──
  const yearsList = useMemo(() => availableYears(cycles), [cycles]);

  const cyclesInYear = useMemo(() => {
    return cycles.filter((c) => {
      if (!c.start_date) return false;
      const y = parseInt(String(c.start_date).slice(0, 4), 10);
      return y === filterYear;
    });
  }, [cycles, filterYear]);

  // ── Per-course aggregates (computed from year-filtered cycles) ──
  const courseAggregates = useMemo(() => {
    const m = new Map();
    for (const c of cyclesInYear) {
      const pid = c.product_id;
      if (!pid) continue;
      if (!m.has(pid)) {
        m.set(pid, {
          product_id:           pid,
          name:                 c.course_name || "—",
          cycles_count:         0,
          total_enrollees:      0,
          total_deals_amount:   0,
          total_discounts:      0,
          total_after_discounts: 0,
          total_collected:      0,
        });
      }
      const a = m.get(pid);
      a.cycles_count          += 1;
      a.total_enrollees       += Number(c.total_enrollees       || 0);
      a.total_deals_amount    += Number(c.total_deals_amount    || 0);
      a.total_discounts       += Number(c.total_discounts       || 0);
      a.total_after_discounts += Number(c.total_after_discounts || 0);
      a.total_collected       += Number(c.total_collected       || 0);
    }
    return Array.from(m.values()).sort((a, b) => b.total_deals_amount - a.total_deals_amount);
  }, [cyclesInYear]);

  // אם נבחר קורס שאין לו מחזורים בשנה הנבחרת, נרים את הסינון
  useEffect(() => {
    if (filterCourse && !courseAggregates.some((a) => a.product_id === filterCourse)) {
      setFilterCourse("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterYear]);

  // ── Filtered cycles for the cycles table ──
  const filteredCycles = useMemo(() => {
    return cyclesInYear.filter((c) => {
      if (filterCourse && c.product_id !== filterCourse) return false;
      const open = (c.registration_status || "").includes("פתוח") || (c.registration_status || "").includes("פעיל");
      if (filterOpen === "open"   && !open) return false;
      if (filterOpen === "closed" &&  open) return false;
      return true;
    });
  }, [cyclesInYear, filterCourse, filterOpen]);

  // ── Pies data ──
  const pieData = useMemo(() => {
    if (filterCourse) {
      // קורס נבחר → חלוקה לפי מחזורים שלו
      const courseCycles = cyclesInYear.filter((c) => c.product_id === filterCourse);
      const labelOf = (c) => {
        const d = c.start_date ? fmtDate(c.start_date) : "ללא תאריך";
        return d;
      };
      return {
        deals:      courseCycles.map((c) => ({ name: labelOf(c), value: Number(c.total_deals_amount    || 0) })),
        discounts:  courseCycles.map((c) => ({ name: labelOf(c), value: Number(c.total_discounts       || 0) })),
        collected:  courseCycles.map((c) => ({ name: labelOf(c), value: Number(c.total_collected       || 0) })),
      };
    }
    // אין סינון → חלוקה לפי קורס (אגרגציה לשנה)
    return {
      deals:     courseAggregates.map((a) => ({ name: a.name, value: a.total_deals_amount })),
      discounts: courseAggregates.map((a) => ({ name: a.name, value: a.total_discounts })),
      collected: courseAggregates.map((a) => ({ name: a.name, value: a.total_collected })),
    };
  }, [filterCourse, cyclesInYear, courseAggregates]);

  const totals = useMemo(() => ({
    deals:     pieData.deals.reduce((s, d) => s + d.value, 0),
    discounts: pieData.discounts.reduce((s, d) => s + d.value, 0),
    collected: pieData.collected.reduce((s, d) => s + d.value, 0),
  }), [pieData]);

  const lastSync = syncRuns[0];
  const selectedCourseName = filterCourse
    ? courseAggregates.find((a) => a.product_id === filterCourse)?.name
    : null;

  // ── Render ──
  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: T.textSecondary, fontSize: 14 }}>
        טוען נתוני קורסים ומחזורים…
      </div>
    );
  }

  return (
    <div>
      {err && (
        <div style={{ ...S.cardCompact, background: "#fee2e2", borderColor: "#fca5a5", color: "#991b1b" }}>
          שגיאה: {err}
        </div>
      )}

      {/* ── Year selector — first thing the user sees ── */}
      <div style={{
        ...S.card, padding: 16, display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: T.textSecondary, fontWeight: 600 }}>שנה:</span>
          <YearSelector years={yearsList} value={filterYear} onChange={setFilterYear} />
          {filterCourse && selectedCourseName && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "5px 10px", background: T.navyLight, color: T.navy,
              borderRadius: T.rSm, fontSize: 12.5, fontWeight: 600,
            }}>
              <span>סינון לפי קורס: {selectedCourseName}</span>
              <button type="button" onClick={() => setFilterCourse("")} style={{
                background: "transparent", border: "none", color: T.navy, cursor: "pointer",
                fontSize: 14, padding: "0 4px", fontWeight: 700,
              }}>✕</button>
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: T.textMuted }}>
          {cyclesInYear.length} מחזורים בשנת {filterYear}
        </div>
      </div>

      {/* ── 3 Pie cards ── */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <PieCard
          title={filterCourse ? "סכום עסקאות — לפי מחזור"  : "סכום עסקאות — לפי קורס"}
          accent={T.cDeals}
          data={pieData.deals}
          total={totals.deals}
          emptyText={`אין עסקאות בשנת ${filterYear}`}
        />
        <PieCard
          title={filterCourse ? "סכום הנחות — לפי מחזור"  : "סכום הנחות — לפי קורס"}
          accent={T.cDiscounts}
          data={pieData.discounts}
          total={totals.discounts}
          emptyText={`אין הנחות בשנת ${filterYear}`}
        />
        <PieCard
          title={filterCourse ? "נגבה בפועל — לפי מחזור"  : "נגבה בפועל — לפי קורס"}
          accent={T.cCollected}
          data={pieData.collected}
          total={totals.collected}
          emptyText={`אין גביות בשנת ${filterYear}`}
        />
      </div>

      {/* ── Courses table — year-aggregated, click to filter ── */}
      <div style={S.card}>
        <h3 style={S.sectionTitle}>
          <span>📚</span><span>קורסים — שנת {filterYear}</span>
        </h3>
        <p style={S.sectionHint}>
          הסכומים מחושבים מתוך המחזורים של אותה שנה בלבד. לחיצה על שורה מסננת את הפאי ואת טבלת המחזורים.
        </p>
        <div style={{ overflowX: "auto", borderRadius: T.rMd, border: `1px solid ${T.cardBorder}` }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>קורס</th>
                <th style={S.th}>מחזורים</th>
                <th style={S.th}>נרשמים</th>
                <th style={S.th}>סכום עסקאות</th>
                <th style={S.th}>הנחות</th>
                <th style={S.th}>אחרי הנחה</th>
                <th style={S.th}>נגבה בפועל</th>
              </tr>
            </thead>
            <tbody>
              {courseAggregates.map((a, idx) => {
                const selected = filterCourse === a.product_id;
                return (
                  <tr
                    key={a.product_id}
                    onClick={() => setFilterCourse(selected ? "" : a.product_id)}
                    style={{
                      cursor: "pointer",
                      background: selected ? T.navyLight : (idx % 2 ? T.rowAltBg : T.cardBg),
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "#f1f5f9"; }}
                    onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = idx % 2 ? T.rowAltBg : T.cardBg; }}
                  >
                    <td style={{ ...S.td, fontWeight: selected ? 700 : 600 }}>
                      {a.name}
                      {selected && <span style={{ color: T.navy, marginRight: 6 }}>•</span>}
                    </td>
                    <td style={S.tdSecondary}>{fmtNum(a.cycles_count)}</td>
                    <td style={S.tdSecondary}>{fmtNum(a.total_enrollees)}</td>
                    <td style={{ ...S.td, fontWeight: 600, color: T.cDeals }}>{fmtMoney(a.total_deals_amount)}</td>
                    <td style={{ ...S.tdSecondary, color: T.cDiscounts }}>{fmtMoney(a.total_discounts)}</td>
                    <td style={S.tdSecondary}>{fmtMoney(a.total_after_discounts)}</td>
                    <td style={{ ...S.td, fontWeight: 600, color: T.cCollected }}>{fmtMoney(a.total_collected)}</td>
                  </tr>
                );
              })}
              {courseAggregates.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...S.td, textAlign: "center", padding: 32, color: T.textMuted }}>
                    אין קורסים עם מחזורים בשנת {filterYear}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cycles table — year + course filtered, latest first ── */}
      <div style={S.card}>
        <h3 style={S.sectionTitle}>
          <span>📅</span>
          <span>
            מחזורים — שנת {filterYear}
            {selectedCourseName && <span style={{ fontWeight: 500, color: T.textSecondary }}> · {selectedCourseName}</span>}
          </span>
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <select value={filterOpen} onChange={(e) => setFilterOpen(e.target.value)}
                  style={{ ...S.input, width: "auto", paddingLeft: 28 }}>
            <option value="all">כל הסטטוסים</option>
            <option value="open">פתוחים להרשמה / פעילים</option>
            <option value="closed">סגורים / הסתיימו</option>
          </select>
          <span style={{ fontSize: 12, color: T.textMuted }}>
            מציג {filteredCycles.length} מתוך {cyclesInYear.length} מחזורים
          </span>
        </div>
        <div style={{ overflowX: "auto", borderRadius: T.rMd, border: `1px solid ${T.cardBorder}` }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>קורס</th>
                <th style={S.th}>תאריך התחלה/מחזור</th>
                <th style={S.th}>סיום הרשמה</th>
                <th style={S.th}>סטטוס רישום</th>
                <th style={S.th}>נרשמים</th>
                <th style={S.th}>סכום עסקאות</th>
                <th style={S.th}>נגבה בפועל</th>
                <th style={S.th}>סניף</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {[...filteredCycles]
                .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""))
                .map((c, idx) => (
                  <tr key={c.cycle_id} style={{ background: idx % 2 ? T.rowAltBg : T.cardBg }}>
                    <td style={{ ...S.td, fontWeight: 600 }}>
                      {c.source === "manual" && (
                        <span style={{ ...S.badge("#fef3c7", "#92400e"), marginLeft: 6, fontSize: 10 }}>manual</span>
                      )}
                      {c.manually_edited_at && (
                        <span style={{ ...S.badge("#fef3c7", "#92400e"), marginLeft: 6, fontSize: 10 }}>נערך</span>
                      )}
                      {c.course_name || "—"}
                    </td>
                    <td style={S.td}>{fmtDate(c.start_date)}</td>
                    <td style={S.tdSecondary}>{fmtDate(c.registration_end_date)}</td>
                    <td style={S.td}><StatusBadge status={c.registration_status} /></td>
                    <td style={S.tdSecondary}>{fmtNum(c.total_enrollees)}</td>
                    <td style={{ ...S.td, color: T.cDeals }}>{fmtMoney(c.total_deals_amount)}</td>
                    <td style={{ ...S.td, color: T.cCollected }}>{fmtMoney(c.total_collected)}</td>
                    <td style={S.tdSecondary}>{c.branch || "—"}</td>
                    <td style={S.td}>
                      <button type="button" onClick={() => setEditing(c)} style={S.btnGhost}
                              title="ערוך מחזור">✏️</button>
                    </td>
                  </tr>
                ))}
              {filteredCycles.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ ...S.td, textAlign: "center", padding: 32, color: T.textMuted }}>
                    אין מחזורים תואמי סינון בשנת {filterYear}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditCycleModal cycle={editing} onSave={handleSave} onClose={() => setEditing(null)} />
      )}

      {/* ── Sync footer — operational metadata, kept discreet at bottom ── */}
      <div style={{
        marginTop: 24, padding: "12px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        fontSize: 11.5, color: T.textMuted, borderTop: `1px dashed ${T.cardBorder}`,
      }}>
        <div>
          {lastSync ? (
            <>
              עודכן לאחרונה{" "}
              <span style={{ color: T.textSecondary, fontWeight: 600 }}>
                {fmtDateTime(lastSync.completed_at || lastSync.started_at)}
              </span>
              {lastSync.status !== "completed" && (
                <span style={{ color: "#dc2626", marginRight: 6 }}>· {lastSync.status}</span>
              )}
            </>
          ) : (
            "טרם בוצע סנכרון"
          )}
        </div>
        <button type="button" onClick={handleScan} disabled={scanning}
                style={{ ...S.btnGhost, fontSize: 11.5, color: T.textSecondary, textDecoration: "underline" }}>
          {scanning ? "סורק…" : "רענן עכשיו"}
        </button>
      </div>
    </div>
  );
}

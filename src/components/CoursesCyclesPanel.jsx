/**
 * CoursesCyclesPanel.jsx — תצוגת קורסים ומחזורים מ-Fireberry (משוקפים)
 * ====================================================================
 * נטען ע"י MediaReportsPage כשmode='courses_cycles'.
 *
 * תצוגה:
 *   - כפתור "סרוק עכשיו" + סטטוס סנכרון אחרון
 *   - טבלת קורסים (collapsible)
 *   - טבלת מחזורים מקובצים לפי קורס
 *   - עריכת מחזור inline (תאריך תחילה/סיום, סטטוס רישום, מרצה...)
 *
 * ⚠ עריכות מקומיות בלבד — לא חוזרות ל-Fireberry. הסנכרון הבא ב-06:00
 *   ידרוס אם הרשומה קיימת ב-Fireberry (תוכנית A).
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  getCourses,
  getCycles,
  updateCycle,
  triggerCoursesScan,
  getCoursesSyncRuns,
} from "../api.js";

function fmtNum(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("he-IL");
}

function fmtMoney(v) {
  if (v === null || v === undefined) return "—";
  return `₪${fmtNum(v)}`;
}

function fmtDate(v) {
  if (!v) return "—";
  return String(v).slice(0, 10);
}

function fmtDateTime(v) {
  if (!v) return "—";
  return new Date(v).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

const styles = {
  card: {
    background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10,
    padding: 16, marginBottom: 16,
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { background: "#f1f5f9", padding: "10px 12px", textAlign: "right",
        fontWeight: 600, color: "#0f172a", borderBottom: "1px solid #e2e8f0",
        position: "sticky", top: 0 },
  td: { padding: "8px 12px", borderBottom: "1px solid #f1f5f9", color: "#1e293b" },
  badgeOpen:   { background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600 },
  badgeClosed: { background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600 },
  badgeOther:  { background: "#e2e8f0", color: "#475569", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600 },
  badgeManual: { background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 3, fontSize: 11, fontWeight: 600, marginRight: 6 },
  btnPrimary: {
    background: "#1e3a5f", color: "#ffffff", border: "none", borderRadius: 8,
    padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  btnSecondary: {
    background: "#f1f5f9", color: "#1e40af", border: "1px solid #cbd5e1", borderRadius: 8,
    padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
  },
  input: {
    border: "1px solid #cbd5e1", borderRadius: 4, padding: "4px 8px", fontSize: 12,
    width: "100%", boxSizing: "border-box",
  },
  hint: { fontSize: 12, color: "#64748b" },
};

function StatusBadge({ status }) {
  if (!status) return <span style={styles.badgeOther}>—</span>;
  if (status.includes("פתוח")) return <span style={styles.badgeOpen}>{status}</span>;
  if (status.includes("סגור")) return <span style={styles.badgeClosed}>{status}</span>;
  // "פעיל" וכל מצב אחר נראה ב-Fireberry → ניטרלי
  return <span style={styles.badgeOther}>{status}</span>;
}

// ─── Edit modal ──────────────────────────────────────────────────────────────

function EditCycleModal({ cycle, onSave, onClose }) {
  const [form, setForm] = useState({
    name:                  cycle.name || "",
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
      // ערכים ריקים נעלמים → לא נשלחים → לא משנים שדה ב-DB
      const payload = {};
      for (const [k, v] of Object.entries(form)) {
        if (v === "" || v === null) continue;
        if (k === "total_enrollees")  payload[k] = parseInt(v, 10);
        else if (k === "actual_price") payload[k] = parseFloat(v);
        else                           payload[k] = v;
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
      position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#ffffff", borderRadius: 12, padding: 24, width: 560, maxHeight: "90vh", overflowY: "auto",
      }}>
        <h3 style={{ margin: "0 0 4px", color: "#0f172a", fontSize: 18 }}>עריכת מחזור</h3>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#64748b" }}>
          ⚠ העריכה מקומית בלבד — לא חוזרת ל-Fireberry. הסנכרון הבא (06:00) ידרוס אם הרשומה קיימת שם.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <Field label="שם המחזור" value={form.name} onChange={change("name")} />
          <Field label="סטטוס רישום" value={form.registration_status} onChange={change("registration_status")} placeholder="פתוח להרשמה / סגור" />
          <Field label="תאריך תחילה" value={form.start_date} onChange={change("start_date")} type="date" />
          <Field label="תאריך סיום" value={form.end_date} onChange={change("end_date")} type="date" />
          <Field label="סיום הרשמה" value={form.registration_end_date} onChange={change("registration_end_date")} type="date" />
          <Field label="סה״כ נרשמים" value={form.total_enrollees} onChange={change("total_enrollees")} type="number" />
          <Field label="מחיר בפועל" value={form.actual_price} onChange={change("actual_price")} type="number" />
          <Field label="סניף" value={form.branch} onChange={change("branch")} />
          <Field label="מרצה" value={form.instructor} onChange={change("instructor")} />
          <Field label="ימי לימוד" value={form.study_days} onChange={change("study_days")} />
          <Field label="שעות לימוד" value={form.study_hours} onChange={change("study_hours")} />
        </div>

        {err && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 12 }}>שגיאה: {err}</div>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={styles.btnSecondary}>ביטול</button>
          <button type="button" onClick={submit} disabled={saving} style={{ ...styles.btnPrimary, opacity: saving ? 0.6 : 1 }}>
            {saving ? "שומר..." : "שמור"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label style={{ fontSize: 12, color: "#64748b", display: "flex", flexDirection: "column", gap: 4 }}>
      {label}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={styles.input} />
    </label>
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
  const [editing,    setEditing]    = useState(null);   // cycle being edited
  const [filterCourse, setFilterCourse] = useState("");
  const [filterOpen,   setFilterOpen]   = useState("all"); // 'all' | 'open' | 'closed'

  async function loadAll() {
    setLoading(true); setErr(null);
    try {
      const [c, cy, runs] = await Promise.all([
        getCourses(),
        getCycles(),
        getCoursesSyncRuns(5),
      ]);
      setCourses(c.courses || []);
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

  // ── Filtering ──
  const filteredCycles = useMemo(() => {
    return cycles.filter((c) => {
      if (filterCourse && c.product_id !== filterCourse) return false;
      if (filterOpen === "open"   && !(c.registration_status || "").includes("פתוח")) return false;
      if (filterOpen === "closed" &&  (c.registration_status || "").includes("פתוח")) return false;
      return true;
    });
  }, [cycles, filterCourse, filterOpen]);

  // ── Group cycles by course ──
  const cyclesByCourse = useMemo(() => {
    const m = new Map();
    for (const c of filteredCycles) {
      const key = c.product_id || "(ללא קורס)";
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(c);
    }
    return m;
  }, [filteredCycles]);

  const lastSync = syncRuns[0];

  // ── Render ──
  return (
    <div>
      {/* ── Top bar — scan + status ── */}
      <div style={{ ...styles.card, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", color: "#0f172a", fontSize: 16 }}>קורסים ומחזורים — שיקוף Fireberry</h2>
          <div style={styles.hint}>
            סנכרון אוטומטי כל יום ב-06:00 · ניתן ללחוץ "סרוק עכשיו" לעדכון מיידי
          </div>
          {lastSync && (
            <div style={{ ...styles.hint, marginTop: 6 }}>
              סנכרון אחרון: <strong>{fmtDateTime(lastSync.completed_at || lastSync.started_at)}</strong> ·
              {" "}סטטוס: <strong>{lastSync.status}</strong> ·
              {" "}{lastSync.courses_fetched} קורסים · {lastSync.cycles_fetched} מחזורים
              {lastSync.cycles_promoted > 0 && (
                <> · קודמו manual→fireberry: <strong>{lastSync.cycles_promoted}</strong></>
              )}
              {" "}({lastSync.duration_ms}ms)
            </div>
          )}
        </div>
        <button type="button" onClick={handleScan} disabled={scanning || loading} style={{ ...styles.btnPrimary, opacity: (scanning || loading) ? 0.6 : 1 }}>
          {scanning ? "סורק..." : "🔄 סרוק עכשיו"}
        </button>
      </div>

      {err && (
        <div style={{ ...styles.card, background: "#fee2e2", borderColor: "#fca5a5", color: "#991b1b" }}>
          שגיאה: {err}
        </div>
      )}

      {/* ── Courses summary table ── */}
      <div style={styles.card}>
        <h3 style={{ margin: "0 0 12px", color: "#0f172a", fontSize: 15 }}>קורסים ({courses.length})</h3>
        <div style={{ overflowX: "auto", maxHeight: 280, overflowY: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>שם הקורס</th>
                <th style={styles.th}>קוד</th>
                <th style={styles.th}>מחיר</th>
                <th style={styles.th}>נרשמים</th>
                <th style={styles.th}>סכום עסקאות</th>
                <th style={styles.th}>הנחות</th>
                <th style={styles.th}>אחרי הנחה</th>
                <th style={styles.th}>נגבה בפועל</th>
                <th style={styles.th}>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.product_id} style={{ cursor: "pointer", background: filterCourse === c.product_id ? "#dbeafe" : "transparent" }}
                    onClick={() => setFilterCourse(filterCourse === c.product_id ? "" : c.product_id)}>
                  <td style={styles.td}><strong>{c.name}</strong></td>
                  <td style={styles.td}>{c.catalog_number || "—"}</td>
                  <td style={styles.td}>{fmtMoney(c.item_price)}</td>
                  <td style={styles.td}>{fmtNum(c.total_enrollees)}</td>
                  <td style={styles.td}>{fmtMoney(c.total_deals_amount)}</td>
                  <td style={styles.td}>{fmtMoney(c.total_discounts)}</td>
                  <td style={styles.td}>{fmtMoney(c.total_after_discounts)}</td>
                  <td style={styles.td}>{fmtMoney(c.total_collected)}</td>
                  <td style={styles.td}><StatusBadge status={c.status_text} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filterCourse && (
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={() => setFilterCourse("")} style={styles.btnSecondary}>
              ✕ הסר סינון לפי קורס
            </button>
          </div>
        )}
      </div>

      {/* ── Filter bar for cycles ── */}
      <div style={{ ...styles.card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label style={styles.hint}>
          סינון מחזורים:
        </label>
        <select value={filterOpen} onChange={(e) => setFilterOpen(e.target.value)}
                style={{ ...styles.input, width: "auto" }}>
          <option value="all">כל הסטטוסים</option>
          <option value="open">פתוחים להרשמה</option>
          <option value="closed">סגורים</option>
        </select>
        <span style={styles.hint}>
          מציג {filteredCycles.length} מתוך {cycles.length} מחזורים
        </span>
      </div>

      {/* ── Cycles table — grouped by course ── */}
      <div style={styles.card}>
        <h3 style={{ margin: "0 0 12px", color: "#0f172a", fontSize: 15 }}>מחזורים</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>קורס</th>
                <th style={styles.th}>שם המחזור</th>
                <th style={styles.th}>תאריך תחילה</th>
                <th style={styles.th}>סיום הרשמה</th>
                <th style={styles.th}>סטטוס רישום</th>
                <th style={styles.th}>נרשמים</th>
                <th style={styles.th}>סכום עסקאות</th>
                <th style={styles.th}>נגבה בפועל</th>
                <th style={styles.th}>סניף</th>
                <th style={styles.th}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(cyclesByCourse.entries()).map(([pid, list]) => {
                const courseName = list[0]?.course_name || "(ללא קורס)";
                const sorted = [...list].sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));
                return sorted.map((c, idx) => (
                  <tr key={c.cycle_id} style={{ background: idx % 2 ? "#fafafa" : "#ffffff" }}>
                    <td style={styles.td}>{idx === 0 ? <strong>{courseName}</strong> : ""}</td>
                    <td style={styles.td}>
                      {c.source === "manual" && <span style={styles.badgeManual}>manual</span>}
                      {c.manually_edited_at && <span style={styles.badgeManual}>נערך</span>}
                      {c.name || "—"}
                    </td>
                    <td style={styles.td}>{fmtDate(c.start_date)}</td>
                    <td style={styles.td}>{fmtDate(c.registration_end_date)}</td>
                    <td style={styles.td}><StatusBadge status={c.registration_status} /></td>
                    <td style={styles.td}>{fmtNum(c.total_enrollees)}</td>
                    <td style={styles.td}>{fmtMoney(c.total_deals_amount)}</td>
                    <td style={styles.td}>{fmtMoney(c.total_collected)}</td>
                    <td style={styles.td}>{c.branch || "—"}</td>
                    <td style={styles.td}>
                      <button type="button" onClick={() => setEditing(c)} style={styles.btnSecondary}>
                        ✏️ ערוך
                      </button>
                    </td>
                  </tr>
                ));
              })}
              {filteredCycles.length === 0 && !loading && (
                <tr>
                  <td colSpan={10} style={{ ...styles.td, textAlign: "center", padding: 24, color: "#94a3b8" }}>
                    אין מחזורים תואמים סינון
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
    </div>
  );
}

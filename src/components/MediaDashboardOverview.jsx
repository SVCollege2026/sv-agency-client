/**
 * MediaDashboardOverview.jsx — דשבורד תמונת מצב מדיה (טאב ברירת מחדל)
 * ====================================================================
 * 3 גרפי פאי בשורה אחת — לפי קורס:
 *   1. סכום עסקאות
 *   2. סכום הנחות
 *   3. סכום שנגבה בפועל
 *
 * הנתונים מ-public.fireberry_courses (שיקוף Fireberry, מתעדכן יומית 06:00).
 */
import React, { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getCourses } from "../api.js";

// פלטה של 15 צבעים — מספיקה ל-15 הקורסים שיש כיום
const PALETTE = [
  "#1e3a5f", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#84cc16", "#f97316",
  "#6366f1", "#06b6d4", "#dc2626", "#eab308", "#a855f7",
];

function fmtMoney(v) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
}

function CourseTooltip({ active, payload, total, label }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0";
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 6,
      padding: "8px 12px", fontSize: 12, boxShadow: "0 2px 8px rgba(15,23,42,0.1)",
    }}>
      <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{p.payload.name}</div>
      <div style={{ color: "#64748b" }}>{label}: <strong>{fmtMoney(p.value)}</strong></div>
      <div style={{ color: "#64748b" }}>חלק מסה״כ: <strong>{pct}%</strong></div>
    </div>
  );
}

function PieCard({ title, data, total }) {
  // נסנן שורות עם ערך 0/null — לא מציגים אותן בפאי
  const filtered = data.filter((d) => (d.value || 0) > 0);
  const tooltipLabel = title;

  return (
    <div style={{
      background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12,
      padding: 16, flex: "1 1 320px", minWidth: 320,
    }}>
      <div style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "#0f172a", fontWeight: 700 }}>{title}</h3>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          סה״כ: <strong>{fmtMoney(total)}</strong>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>
          אין נתונים
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={filtered}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={45}
              paddingAngle={1}
              isAnimationActive={false}
            >
              {filtered.map((entry, idx) => (
                <Cell key={entry.name} fill={PALETTE[idx % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<CourseTooltip total={total} label={tooltipLabel} />} />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="left"
              wrapperStyle={{ fontSize: 11, paddingLeft: 8 }}
              formatter={(value) => <span style={{ color: "#475569" }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function MediaDashboardOverview() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await getCourses();
        // מסננים את "לא ידוע" (placeholder ב-Fireberry, אין לו נתונים)
        const list = (r.courses || []).filter((c) => c.name && c.name !== "לא ידוע");
        setCourses(list);
      } catch (e) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { dealsData, dealsTotal, discountsData, discountsTotal, collectedData, collectedTotal } = useMemo(() => {
    const deals     = courses.map((c) => ({ name: c.name, value: Number(c.total_deals_amount    || 0) }));
    const discounts = courses.map((c) => ({ name: c.name, value: Number(c.total_discounts       || 0) }));
    const collected = courses.map((c) => ({ name: c.name, value: Number(c.total_collected       || 0) }));
    return {
      dealsData:     deals,
      dealsTotal:    deals.reduce((s, d) => s + d.value, 0),
      discountsData: discounts,
      discountsTotal: discounts.reduce((s, d) => s + d.value, 0),
      collectedData: collected,
      collectedTotal: collected.reduce((s, d) => s + d.value, 0),
    };
  }, [courses]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
        טוען נתוני קורסים...
      </div>
    );
  }
  if (err) {
    return (
      <div style={{ padding: 16, background: "#fee2e2", borderRadius: 8, color: "#991b1b" }}>
        שגיאה: {err}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 4px", color: "#0f172a", fontSize: 18 }}>תמונת מצב — קורסים</h2>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          חלוקה לפי קורס מתוך {courses.length} קורסים פעילים · נתונים מסונכרנים מ-Fireberry יומית
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <PieCard title="סכום עסקאות לפי קורס"      data={dealsData}     total={dealsTotal} />
        <PieCard title="סכום הנחות לפי קורס"        data={discountsData} total={discountsTotal} />
        <PieCard title="סכום שנגבה בפועל לפי קורס" data={collectedData} total={collectedTotal} />
      </div>
    </div>
  );
}

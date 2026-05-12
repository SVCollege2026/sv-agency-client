/**
 * CampaignCharts.jsx — דאשבורד לכרטיס תיקייה.
 *
 * 3 גרפים בכרטיסים נפרדים:
 *   • Leads trend — 14 ימים אחרונים, area chart.
 *   • CPL by platform — bar chart.
 *   • Budget burn — gauge (donut) per total budget.
 *
 * Data source: getMediaRange() אם יש נתונים אמיתיים. אחרת — אינדיקציה
 * "אין נתונים עדיין" עם תצוגה ריקה נעימה.
 */
import React, { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { getMediaRange } from "../../api.js";
import { color, radius, shadow, space, type, fontFamily } from "./_tokens.js";

const PLATFORM_COLORS = {
  meta:   "#4267B2",
  google: "#EA4335",
  tiktok: "#000000",
  total:  color.primary,
};

const card = {
  background: color.surface, borderRadius: radius.card,
  border: `1px solid ${color.borderDefault}`, padding: space(5),
  boxShadow: shadow.sm,
};

function dateRange(daysBack = 14) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - daysBack);
  const fmt = d => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(today) };
}

function formatDayLabel(iso) {
  try { return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }); }
  catch { return iso; }
}

export default function CampaignCharts({ folderId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const { start, end } = dateRange(14);
        const range = await getMediaRange(start, end);
        if (!cancelled) setData(range);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [folderId]);

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: space(3), marginBottom: space(4) }}>
        <div style={{ ...card, height: 220 }}><LoadingHint label="מחשבים נתוני לידים..." /></div>
        <div style={{ ...card, height: 220 }}><LoadingHint label="מחשבים CPL לפי פלטפורמה..." /></div>
        <div style={{ ...card, height: 220 }}><LoadingHint label="מחשבים שריפת תקציב..." /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={card}>
        <div style={{ ...type.bodySmall, color: color.fgMuted }}>
          📉 נתוני קמפיין לא זמינים כרגע: {error}
        </div>
      </div>
    );
  }

  // Extract daily series for leads
  const daily = (data?.daily || []).slice(-14);
  const leadsSeries = daily.map(d => ({
    day:    formatDayLabel(d.report_date || d.date),
    leads:  (d.total_leads ?? d.leads ?? 0),
    meta:   (d.meta?.leads ?? 0),
    google: (d.google?.leads ?? 0),
  }));

  // CPL by platform (aggregate over the window)
  const aggregate = daily.reduce((acc, d) => {
    for (const plat of ["meta", "google", "tiktok"]) {
      const p = d[plat];
      if (!p) continue;
      acc[plat] = acc[plat] || { spend: 0, leads: 0 };
      acc[plat].spend += Number(p.spend || 0);
      acc[plat].leads += Number(p.leads || 0);
    }
    return acc;
  }, {});

  const cplData = Object.entries(aggregate).map(([plat, v]) => ({
    platform: plat === "meta" ? "Meta" : plat === "google" ? "Google" : plat === "tiktok" ? "TikTok" : plat,
    cpl: v.leads > 0 ? Math.round(v.spend / v.leads) : 0,
    leads: v.leads,
  })).filter(d => d.cpl > 0);

  // Budget burn — sum of spend vs hypothetical monthly budget
  const totalSpend = Object.values(aggregate).reduce((a, b) => a + b.spend, 0);
  const totalLeads = Object.values(aggregate).reduce((a, b) => a + b.leads, 0);

  const hasData = leadsSeries.some(d => d.leads > 0) || cplData.length > 0;

  if (!hasData) {
    return (
      <div style={card}>
        <h3 style={{ ...type.h3, margin: `0 0 ${space(2)}` }}>📊 דאשבורד</h3>
        <div style={{
          textAlign: "center", padding: space(8), color: color.fgMuted,
          background: color.surfaceMuted, borderRadius: radius.md,
        }}>
          <div style={{ fontSize: 48, marginBottom: space(2) }}>📈</div>
          <div style={{ ...type.bodyStrong, marginBottom: space(1) }}>
            הקמפיין עוד לא צבר נתונים מספיקים לגרפים
          </div>
          <div style={type.bodySmall}>
            ברגע שיהיו לידים ושריפת תקציב — הם יופיעו פה (ניתן לראות ב-14 הימים הראשונים).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: space(4) }}>
      {/* KPI row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: space(3), marginBottom: space(3),
      }}>
        <KpiCard icon="📥" label={'לידים סה"כ (14 ימים)'} value={totalLeads.toLocaleString("he-IL")} />
        <KpiCard icon="💰" label="שריפת תקציב" value={`₪${Math.round(totalSpend).toLocaleString("he-IL")}`} />
        <KpiCard icon="💸" label="CPL ממוצע"
                 value={totalLeads > 0 ? `₪${Math.round(totalSpend / totalLeads)}` : "—"} />
        <KpiCard icon="📊" label="ממוצע יומי"
                 value={leadsSeries.length > 0
                   ? (totalLeads / Math.max(leadsSeries.length, 1)).toFixed(1)
                   : "—"} />
      </div>

      {/* Charts row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: space(3),
      }}>
        {/* Leads trend */}
        <div style={card}>
          <h4 style={{ ...type.label, marginBottom: space(3) }}>📈 לידים יומיים — 14 ימים אחרונים</h4>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={leadsSeries} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={color.primary} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={color.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={color.borderSubtle} vertical={false} />
                <XAxis dataKey="day" stroke={color.fgSubtle} tick={{ fontSize: 11, fontFamily }} />
                <YAxis stroke={color.fgSubtle} tick={{ fontSize: 11, fontFamily }} width={32} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: `1px solid ${color.borderDefault}`, fontFamily, fontSize: 12 }}
                  labelStyle={{ color: color.fgDefault, fontWeight: 700 }}
                />
                <Area
                  type="monotone" dataKey="leads"
                  stroke={color.primary} strokeWidth={2}
                  fill="url(#leadsGradient)"
                  name="לידים"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CPL by platform */}
        <div style={card}>
          <h4 style={{ ...type.label, marginBottom: space(3) }}>💸 CPL לפי פלטפורמה</h4>
          {cplData.length > 0 ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cplData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke={color.borderSubtle} vertical={false} />
                  <XAxis dataKey="platform" stroke={color.fgSubtle} tick={{ fontSize: 12, fontFamily }} />
                  <YAxis stroke={color.fgSubtle} tick={{ fontSize: 11, fontFamily }} width={40}
                         tickFormatter={v => `₪${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: `1px solid ${color.borderDefault}`, fontFamily, fontSize: 12 }}
                    formatter={(v) => [`₪${v}`, "CPL"]}
                  />
                  <Bar dataKey="cpl" radius={[8, 8, 0, 0]} name="CPL">
                    {cplData.map((entry, i) => (
                      <Cell key={i} fill={PLATFORM_COLORS[entry.platform.toLowerCase()] || color.primary} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="אין נתוני CPL זמינים" />
          )}
        </div>

        {/* Leads split donut */}
        <div style={card}>
          <h4 style={{ ...type.label, marginBottom: space(3) }}>📊 חלוקת לידים בין הפלטפורמות</h4>
          {cplData.length > 0 ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cplData} dataKey="leads" nameKey="platform"
                    cx="50%" cy="50%" innerRadius={48} outerRadius={76}
                    paddingAngle={2}
                  >
                    {cplData.map((entry, i) => (
                      <Cell key={i} fill={PLATFORM_COLORS[entry.platform.toLowerCase()] || color.primary} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: `1px solid ${color.borderDefault}`, fontFamily, fontSize: 12 }}
                    formatter={(v) => [v, "לידים"]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontFamily }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="אין נתוני חלוקה זמינים" />
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }) {
  return (
    <div style={{
      background: color.surface, padding: space(4),
      borderRadius: radius.md, border: `1px solid ${color.borderSubtle}`,
      boxShadow: shadow.xs,
    }}>
      <div style={{ ...type.caption, color: color.fgSubtle, textTransform: "uppercase" }}>
        <span style={{ marginInlineEnd: space(1) }}>{icon}</span>{label}
      </div>
      <div style={{ ...type.h2, marginTop: space(1) }}>{value}</div>
    </div>
  );
}

function LoadingHint({ label }) {
  return (
    <div style={{
      height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", color: color.fgSubtle, ...type.bodySmall,
    }}>
      <div style={{ fontSize: 24, marginBottom: space(1) }}>📊</div>
      {label}
    </div>
  );
}

function EmptyChart({ label }) {
  return (
    <div style={{
      height: 200, display: "flex", alignItems: "center", justifyContent: "center",
      color: color.fgSubtle, ...type.bodySmall,
    }}>
      {label}
    </div>
  );
}

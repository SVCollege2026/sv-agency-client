/**
 * FeasibilityWidget.jsx — חוות דעת המערכת על היחס יעד ↔ תקציב.
 *
 * Props:
 *   • folderId        — for future per-folder history (currently unused)
 *   • goal            — { target_leads, horizon_days, cpl_ceiling? }
 *   • budget          — { envelope_ils, envelope_period: "month" | "annual" }
 *   • onAcceptBudget  — optional callback (recommended_budget_ils) → caller decides what to do
 *
 * Renders a colored verdict card:
 *   ✅ realistic   → green
 *   ⚠ stretch     → amber, shows recommended_budget + accept/dismiss buttons
 *   ✗ unrealistic → red, two action paths: raise budget OR lower target
 */
import React, { useEffect, useState } from "react";
import { checkFeasibility } from "../../api.js";
import { color, radius, shadow, space, type, fontFamily, transition } from "./_tokens.js";

const VERDICT_STYLES = {
  realistic: {
    icon:    "✓",
    bg:      "#f0fdf4",
    border:  "#86efac",
    fg:      "#15803d",
    fgMuted: "#166534",
    label:   "ריאלי",
  },
  stretch: {
    icon:    "⚠",
    bg:      "#fffbeb",
    border:  "#fbbf24",
    fg:      "#a16207",
    fgMuted: "#854d0e",
    label:   "הדוק",
  },
  unrealistic: {
    icon:    "✗",
    bg:      "#fef2f2",
    border:  "#fca5a5",
    fg:      "#b91c1c",
    fgMuted: "#991b1b",
    label:   "לא ריאלי",
  },
};

export default function FeasibilityWidget({ folderId, goal, budget, onAcceptBudget, acceptInProgress = false }) {
  const [verdict, setVerdict] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!goal?.target_leads || !budget?.envelope_ils) {
      setLoading(false);
      return;
    }
    async function run() {
      setLoading(true); setError(null);
      try {
        const result = await checkFeasibility({
          goal: {
            target_leads: Number(goal.target_leads),
            horizon_days: Number(goal.horizon_days || 30),
            cpl_ceiling:  goal.cpl_ceiling ? Number(goal.cpl_ceiling) : null,
          },
          budget: {
            envelope_ils:    Number(budget.envelope_ils),
            envelope_period: budget.envelope_period || "month",
          },
          folder_id: folderId || null,
        });
        if (!cancelled) setVerdict(result);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [folderId, goal?.target_leads, goal?.horizon_days, goal?.cpl_ceiling,
      budget?.envelope_ils, budget?.envelope_period]);

  // Empty state — no goal or no budget set yet
  if (!goal?.target_leads || !budget?.envelope_ils) {
    return (
      <div style={{
        ...containerStyle, background: "#f9fafb",
        borderColor: color.borderDefault,
      }}>
        <div style={{ fontSize: 32, marginInlineEnd: space(2) }}>🎯</div>
        <div>
          <div style={{ ...type.bodyStrong, color: color.fgDefault }}>חוות דעת המערכת על היעד</div>
          <div style={{ ...type.bodySmall, color: color.fgMuted, marginTop: 2 }}>
            הזיני יעד (מספר לידים יעד + תקופה) ותקציב — וקבלי בדיקת היתכנות מבוססת היסטוריה + חיזוי.
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ ...containerStyle, background: "#f9fafb", borderColor: color.borderDefault }}>
        <div style={{ fontSize: 24 }}>⏳</div>
        <div style={{ ...type.bodySmall, color: color.fgMuted, marginInlineStart: space(2) }}>
          בודקת היתכנות תקציב מול היעד...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        ...containerStyle, background: color.dangerSoftBg, borderColor: "#fca5a5",
      }}>
        <div style={{ fontSize: 24 }}>⚠</div>
        <div style={{ marginInlineStart: space(2) }}>
          <div style={{ ...type.bodyStrong, color: color.dangerSoftFg }}>בדיקת ההיתכנות נכשלה</div>
          <div style={{ ...type.small, color: color.dangerSoftFg, marginTop: 2 }}>{error}</div>
        </div>
      </div>
    );
  }

  const v = verdict;
  const style = VERDICT_STYLES[v.verdict] || VERDICT_STYLES.stretch;
  const showRecommendation = v.verdict !== "realistic" && v.recommended_budget_ils > budget.envelope_ils;

  return (
    <div style={{
      ...containerStyle,
      background: style.bg,
      borderColor: style.border,
      display: "block",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: space(3) }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: style.fg, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 700, flexShrink: 0,
        }}>{style.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: space(2), flexWrap: "wrap" }}>
            <div style={{ ...type.bodyStrong, color: style.fg, fontSize: 16 }}>
              🎯 חוות דעת המערכת: <strong>{style.label}</strong>
            </div>
            <ConfidenceBadge confidence={v.confidence} />
          </div>
          <div style={{ ...type.bodySmall, color: style.fgMuted, marginTop: space(1.5), lineHeight: 1.6 }}>
            {v.rationale}
          </div>

          {/* Projection details */}
          <div style={{
            marginTop: space(3), padding: space(3),
            background: "rgba(255,255,255,0.55)", borderRadius: radius.md,
            display: "flex", gap: space(4), flexWrap: "wrap",
          }}>
            <Metric label="צפי לידים (מרכזי)" value={String(v.projection.leads_mid)} icon="📊" />
            <Metric label="טווח" value={`${v.projection.leads_low} – ${v.projection.leads_high}`} icon="📈" />
            <Metric label="יעד" value={String(v.target_leads)} icon="🎯" />
            <Metric
              label="CPL היסטורי"
              value={`₪${Math.round(v.historical_cpl.mean)}${v.historical_cpl.stdev > 0 ? ` ± ${Math.round(v.historical_cpl.stdev)}` : ""}`}
              icon="💸"
              hint={v.historical_cpl.source === "default"
                ? "ברירת מחדל (אין היסטוריה)"
                : `${v.historical_cpl.months_sample} חודשים`}
            />
          </div>

          {/* CPL ceiling warning */}
          {v.cpl_warning && (
            <div style={{
              marginTop: space(2), padding: space(2.5),
              background: "rgba(255,255,255,0.7)", borderRadius: radius.sm,
              border: `1px dashed ${style.border}`,
              ...type.small, color: style.fgMuted,
            }}>
              ⚠ {v.cpl_warning}
            </div>
          )}

          {/* Recommended budget action */}
          {showRecommendation && (
            <div style={{
              marginTop: space(3), padding: space(3),
              background: "#fff", borderRadius: radius.md,
              border: `1px solid ${style.border}`,
            }}>
              <div style={{ ...type.bodyStrong, color: color.fgDefault, marginBottom: space(1.5) }}>
                💡 המלצת המערכת
              </div>
              <div style={{ ...type.bodySmall, color: color.fgMuted, marginBottom: space(2.5) }}>
                כדי להגיע ליעד {v.target_leads} לידים בביטחון, מומלץ תקציב {budget.envelope_period === "annual" ? "שנתי" : "חודשי"} של:
                <strong style={{ color: style.fg, marginInlineStart: space(1) }}>
                  ₪{v.recommended_budget_ils.toLocaleString("he-IL")}
                </strong>
                <span style={{ color: color.fgSubtle, marginInlineStart: space(2) }}>
                  (במקום ₪{budget.envelope_ils.toLocaleString("he-IL")})
                </span>
              </div>
              {onAcceptBudget && (
                <div style={{ display: "flex", gap: space(2), flexWrap: "wrap" }}>
                  <button onClick={() => onAcceptBudget(v.recommended_budget_ils)}
                          disabled={acceptInProgress}
                          style={{
                            padding: `${space(2)} ${space(4)}`,
                            background: style.fg, color: "#fff", border: "none",
                            borderRadius: radius.md,
                            cursor: acceptInProgress ? "not-allowed" : "pointer",
                            fontSize: 13, fontWeight: 700, fontFamily,
                            transition: transition.fast,
                            opacity: acceptInProgress ? 0.6 : 1,
                          }}>
                    {acceptInProgress ? "יוצרת גרסה חדשה..." : "✓ קבלי המלצה — צרי גרסה חדשה של הבריף"}
                  </button>
                  <button onClick={() => onAcceptBudget(null)}
                          disabled={acceptInProgress}
                          style={{
                            padding: `${space(2)} ${space(4)}`,
                            background: "transparent", color: style.fgMuted,
                            border: `1px solid ${style.border}`,
                            borderRadius: radius.md,
                            cursor: acceptInProgress ? "not-allowed" : "pointer",
                            fontSize: 13, fontWeight: 700, fontFamily,
                            opacity: acceptInProgress ? 0.6 : 1,
                          }}>
                    ✗ דחי
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, hint }) {
  return (
    <div style={{ minWidth: 100 }}>
      <div style={{ ...type.small, color: color.fgSubtle, fontWeight: 700 }}>
        <span style={{ marginInlineEnd: space(1) }}>{icon}</span>{label}
      </div>
      <div style={{ ...type.bodyStrong, color: color.fgDefault, marginTop: 2 }}>{value}</div>
      {hint && <div style={{ ...type.small, color: color.fgSubtle, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function ConfidenceBadge({ confidence }) {
  const styles = {
    high:   { bg: "#dcfce7", fg: "#166534", label: "ביטחון גבוה" },
    medium: { bg: "#fef3c7", fg: "#854d0e", label: "ביטחון בינוני" },
    low:    { bg: "#f3f4f6", fg: "#4b5563", label: "ביטחון נמוך" },
  };
  const s = styles[confidence] || styles.medium;
  return (
    <span style={{
      background: s.bg, color: s.fg,
      padding: `2px ${space(2)}`,
      borderRadius: radius.pill,
      fontSize: 11, fontWeight: 700, fontFamily,
    }}>{s.label}</span>
  );
}

const containerStyle = {
  border: "2px solid",
  borderRadius: radius.md,
  padding: space(4),
  marginBottom: space(4),
  display: "flex",
  alignItems: "center",
  direction: "rtl",
  fontFamily,
  transition: transition.base,
};

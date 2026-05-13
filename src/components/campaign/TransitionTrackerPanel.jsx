/**
 * TransitionTrackerPanel.jsx — Limann (previous agency) transition tracker.
 *
 * Shows the result of the latest `limann_dependency_report` audit (built by
 * agents/make_dept/limann_dependency_auditor.py, PR api#45) and overlays
 * resolution decisions logged by the manager.
 *
 * Flow per item:
 *   ⚠ Limann-owned → manager re-auths the connection / migrates the drive
 *   → manager clicks "סמן כטופל" with a brief note
 *   → call to POST /api/optimization/limann-audit/resolve
 *   → decision_log stores the resolution
 *   → next render shows ✓ resolved
 *
 * Read-only against make.com — this panel never mutates connections directly.
 * The transfer itself happens in make.com (Reauthorize button), the panel
 * only tracks what's been done.
 */
import React, { useEffect, useState } from "react";
import {
  getLimannAuditLatest, runLimannAudit, resolveLimannItem,
} from "../../api.js";
import {
  color, radius, shadow, space, type, transition,
  button, input as inputStyle, fontFamily,
} from "./_tokens.js";
import { useToast } from "./Toast.jsx";

const OWNER_LABELS = {
  limann:    { label: "🔴 Limann",    bg: "#fee2e2", fg: "#b91c1c" },
  svcollege: { label: "🟢 SVCollege", bg: "#dcfce7", fg: "#166534" },
  external:  { label: "🟡 חיצוני",    bg: "#fef3c7", fg: "#a16207" },
  system:    { label: "⚙ make",       bg: "#f1f5f9", fg: "#475569" },
  unknown:   { label: "❓ לא ידוע",   bg: "#f1f5f9", fg: "#475569" },
};

export default function TransitionTrackerPanel() {
  const toast = useToast();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [running, setRunning]   = useState(false);
  const [resolveModal, setResolveModal] = useState(null);
  const [filter, setFilter]     = useState("limann"); // 'all' | 'limann' | 'resolved' | 'clean'

  async function reload() {
    setLoading(true); setError(null);
    try {
      const d = await getLimannAuditLatest();
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  async function rerunAudit() {
    setRunning(true);
    try {
      toast.info("מריצה audit מחדש על כל ה-make.com — לוקח ~30 שניות...");
      await runLimannAudit();
      toast.success("✓ Audit הסתיים — מרענן");
      await reload();
    } catch (e) {
      toast.error(`שגיאה ב-audit: ${e.message}`);
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return <div style={{ padding: space(6), color: color.fgMuted, fontFamily }}>טוען...</div>;
  }
  if (error) {
    return (
      <div style={{ padding: space(4), background: color.dangerSoftBg, color: color.dangerSoftFg,
                     borderRadius: radius.md, fontFamily }}>שגיאה: {error}</div>
    );
  }
  if (!data?.report) {
    return (
      <div style={{ direction: "rtl", fontFamily, padding: space(6) }}>
        <h2 style={{ ...type.h2, marginBottom: space(3) }}>🔄 מצב transition מ-Limann</h2>
        <div style={{
          padding: space(8), background: color.surface, borderRadius: radius.lg,
          border: `1px solid ${color.borderDefault}`, textAlign: "center",
        }}>
          <div style={{ fontSize: 56, marginBottom: space(3) }}>📊</div>
          <div style={{ ...type.h3, marginBottom: space(2) }}>אין עדיין דוח audit</div>
          <div style={{ ...type.bodySmall, color: color.fgSubtle, marginBottom: space(4) }}>
            הריצי את ה-audit הראשון כדי לראות מצב התלויות ב-Limann
          </div>
          <button onClick={rerunAudit} disabled={running} style={button.primary}>
            {running ? "רץ..." : "▶ הרץ audit ראשון"}
          </button>
        </div>
      </div>
    );
  }

  const payload      = data.report.payload || {};
  const summary      = payload.summary || {};
  const scenarios    = payload.scenarios || [];
  const conns_by_id  = payload.connections_by_id || {};
  const resolutions  = data.resolutions || [];

  // Build a lookup: which subject_ids have been resolved?
  const resolvedIds = new Set(resolutions.map(r => `${r.subject_table}:${r.subject_id}`));
  const isResolved = (table, id) => resolvedIds.has(`${table}:${id}`);

  const totalConns   = summary.connections_total || 0;
  const limannConns  = (summary.connections_by_owner || {}).limann || 0;
  const resolvedConns = Array.from(resolvedIds)
                              .filter(k => k.startsWith("make.connections:")).length;
  const remainingLimann = Math.max(limannConns - resolvedConns, 0);
  const transitionPct = limannConns === 0 ? 100
                          : Math.round((resolvedConns / limannConns) * 100);

  // Filter scenarios per current filter
  const filteredScenarios = scenarios.filter(s => {
    const counts = s.counts || {};
    const hasLimann = (counts.limann || 0) > 0;
    if (filter === "all")      return true;
    if (filter === "limann")   return hasLimann;
    if (filter === "clean")    return !hasLimann && (counts.external || 0) === 0;
    if (filter === "resolved") {
      // scenarios where ALL their limann connections are resolved
      const limannConnIds = (s.connections || [])
        .filter(c => c.classification === "limann").map(c => String(c.id));
      return hasLimann && limannConnIds.every(cid => isResolved("make.connections", cid));
    }
    return true;
  });

  return (
    <div style={{ direction: "rtl", fontFamily }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
                     marginBottom: space(4), flexWrap: "wrap", gap: space(3) }}>
        <div>
          <h2 style={{ ...type.h2, margin: 0 }}>🔄 מצב transition מ-Limann</h2>
          <div style={{ ...type.bodySmall, color: color.fgSubtle, marginTop: space(1) }}>
            עדכון אחרון: {data.report.created_at?.slice(0, 19).replace("T", " ")}
          </div>
        </div>
        <button onClick={rerunAudit} disabled={running} style={button.secondary}>
          {running ? "רץ..." : "🔄 הרץ audit מחדש"}
        </button>
      </div>

      {/* Progress card */}
      <div style={{
        background: color.surface, border: `1px solid ${color.borderDefault}`,
        borderRadius: radius.lg, padding: space(5), marginBottom: space(4),
        boxShadow: shadow.sm,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
                       marginBottom: space(2) }}>
          <div style={{ ...type.h3 }}>התקדמות</div>
          <div style={{ ...type.bodySmall, color: color.fgMuted }}>
            <strong style={{ color: transitionPct === 100 ? "#16a34a" : "#b91c1c", fontSize: 22 }}>
              {transitionPct}%
            </strong>
            {" "}— הועברו {resolvedConns} מתוך {limannConns} חיבורי Limann
          </div>
        </div>
        <div style={{
          height: 12, background: "#fee2e2", borderRadius: 999, overflow: "hidden",
          border: `1px solid ${color.borderSubtle}`,
        }}>
          <div style={{
            height: "100%", width: `${transitionPct}%`,
            background: "linear-gradient(90deg, #16a34a 0%, #22c55e 100%)",
            transition: transition.base,
          }} />
        </div>
        <div style={{ display: "flex", gap: space(3), flexWrap: "wrap", marginTop: space(3) }}>
          <Stat label={'חיבורים סה"כ'}           value={totalConns}                   tone="neutral" />
          <Stat label="🔴 Limann נשארו"           value={remainingLimann}              tone="danger" />
          <Stat label="🟢 SVCollege"             value={(summary.connections_by_owner || {}).svcollege || 0} tone="success" />
          <Stat label="🟡 חיצוני"                value={(summary.connections_by_owner || {}).external || 0}  tone="warning" />
          <Stat label="⚙ make / לא ידוע"        value={((summary.connections_by_owner || {}).system || 0) +
                                                       ((summary.connections_by_owner || {}).unknown || 0)}    tone="neutral" />
          <Stat label="תרחישים תלויי Limann"     value={summary.scenarios_with_limann || 0}                    tone="danger" />
          <Stat label="תרחישים נקיים"            value={summary.scenarios_clean || 0}                          tone="success" />
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: space(2), marginBottom: space(3), flexWrap: "wrap" }}>
        <FilterPill active={filter === "limann"}   onClick={() => setFilter("limann")}>
          ⚠ עם תלות ב-Limann ({scenarios.filter(s => (s.counts?.limann || 0) > 0).length})
        </FilterPill>
        <FilterPill active={filter === "resolved"} onClick={() => setFilter("resolved")}>
          ✓ הוטפל (פר תרחיש)
        </FilterPill>
        <FilterPill active={filter === "clean"}    onClick={() => setFilter("clean")}>
          🟢 נקי
        </FilterPill>
        <FilterPill active={filter === "all"}      onClick={() => setFilter("all")}>
          הכל ({scenarios.length})
        </FilterPill>
      </div>

      {/* Scenarios list */}
      {filteredScenarios.length === 0 && (
        <div style={{
          padding: space(8), textAlign: "center", background: color.surfaceMuted,
          borderRadius: radius.md, color: color.fgSubtle, ...type.bodySmall, fontFamily,
        }}>
          אין תרחישים בקטגוריה זו
        </div>
      )}
      {filteredScenarios.map(s => (
        <ScenarioRow key={s.scenario_inventory_id}
                     scenario={s}
                     isResolved={isResolved}
                     onResolve={(item) => setResolveModal(item)} />
      ))}

      {resolveModal && (
        <ResolveModal item={resolveModal}
                       onClose={() => setResolveModal(null)}
                       onDone={async () => { setResolveModal(null); await reload(); }}
                       toast={toast} />
      )}
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }) {
  const tones = {
    neutral: { bg: color.surfaceMuted, fg: color.fgDefault },
    danger:  { bg: "#fee2e2", fg: "#b91c1c" },
    success: { bg: "#dcfce7", fg: "#166534" },
    warning: { bg: "#fef3c7", fg: "#a16207" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <div style={{
      background: t.bg, color: t.fg, padding: `${space(2)} ${space(3)}`,
      borderRadius: radius.md, fontFamily,
      display: "flex", alignItems: "center", gap: space(2),
    }}>
      <span style={{ fontSize: 18, fontWeight: 800 }}>{value}</span>
      <span style={{ fontSize: 12 }}>{label}</span>
    </div>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: `${space(2)} ${space(4)}`, borderRadius: radius.pill,
      cursor: "pointer", fontSize: 13, fontWeight: 700,
      background: active ? color.primary : color.surface,
      color:      active ? color.fgOnDark : color.fgMuted,
      border: `1px solid ${active ? color.primary : color.borderDefault}`,
      transition: transition.fast, fontFamily,
    }}>{children}</button>
  );
}

function ScenarioRow({ scenario, isResolved, onResolve }) {
  const limannConns = (scenario.connections || []).filter(c => c.classification === "limann");
  const allResolved = limannConns.length > 0
                       && limannConns.every(c => isResolved("make.connections", String(c.id)));

  if (limannConns.length === 0) {
    // No-Limann scenarios in "all"/"clean" filter — render compact
    return (
      <div style={{
        padding: `${space(2)} ${space(3)}`, marginBottom: space(2),
        background: color.surfaceMuted, borderRadius: radius.md,
        ...type.bodySmall, color: color.fgMuted, fontFamily,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span>🟢 {scenario.scenario_name}</span>
        <span style={{ ...type.caption }}>נקי</span>
      </div>
    );
  }

  return (
    <div style={{
      background: color.surface, border: `2px solid ${allResolved ? "#bbf7d0" : "#fecaca"}`,
      borderRadius: radius.lg, padding: space(4), marginBottom: space(3),
      boxShadow: shadow.sm,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
                     marginBottom: space(2), gap: space(2), flexWrap: "wrap" }}>
        <div style={{ ...type.bodyStrong, fontFamily }}>
          {allResolved ? "✓ " : "⚠ "}
          {scenario.scenario_name || `Scenario ${scenario.make_scenario_id}`}
        </div>
        {!scenario.is_active && (
          <span style={{
            background: color.surfaceMuted, color: color.fgMuted,
            padding: "2px 8px", borderRadius: radius.pill, fontSize: 11, fontFamily,
          }}>כבוי</span>
        )}
      </div>
      <div style={{ ...type.caption, color: color.fgMuted, marginBottom: space(3), fontFamily }}>
        {scenario.recommendation}
      </div>

      {/* Per-connection list */}
      <div style={{ display: "flex", flexDirection: "column", gap: space(2) }}>
        {(scenario.connections || []).map((c, i) => {
          const cls = c.classification || "unknown";
          const ownerStyle = OWNER_LABELS[cls] || OWNER_LABELS.unknown;
          const resolved = isResolved("make.connections", String(c.id));
          return (
            <div key={`${c.id}-${i}`} style={{
              display: "flex", alignItems: "center", gap: space(2), flexWrap: "wrap",
              padding: space(2), background: resolved ? "#f0fdf4" : color.surfaceMuted,
              borderRadius: radius.md,
            }}>
              <span style={{
                background: ownerStyle.bg, color: ownerStyle.fg,
                padding: "2px 8px", borderRadius: radius.pill,
                fontSize: 11, fontWeight: 700, fontFamily,
              }}>{ownerStyle.label}</span>
              <span style={{ ...type.bodySmall, color: color.fgDefault, fontFamily, flex: 1, minWidth: 200 }}>
                {c.name || `Connection ${c.id}`}
              </span>
              <span style={{ ...type.caption, color: color.fgSubtle, fontFamily }}>
                ID: {c.id}
              </span>
              {cls === "limann" && (
                resolved ? (
                  <span style={{
                    background: "#dcfce7", color: "#166534",
                    padding: "4px 12px", borderRadius: radius.pill,
                    fontSize: 11, fontWeight: 700, fontFamily,
                  }}>✓ הוטפל</span>
                ) : (
                  <button onClick={() => onResolve({
                    subject_table: "make.connections",
                    subject_id:    String(c.id),
                    item_label:    c.name || `Connection ${c.id}`,
                    scenario_name: scenario.scenario_name,
                  })} style={{
                    background: "#7c3aed", color: "#fff", border: "none",
                    padding: "4px 12px", borderRadius: radius.md,
                    fontSize: 11, fontWeight: 700, fontFamily, cursor: "pointer",
                  }}>סמן כטופל</button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResolveModal({ item, onClose, onDone, toast }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy]     = useState(false);

  async function submit() {
    if (!reason.trim()) { toast.warning("יש להסביר מה נעשה (audit trail)"); return; }
    setBusy(true);
    try {
      await resolveLimannItem({
        subject_table: item.subject_table,
        subject_id:    item.subject_id,
        item_label:    item.item_label,
        reason:        reason.trim(),
      });
      toast.success(`✓ סומן כטופל: ${item.item_label}`);
      onDone();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
      padding: space(4), direction: "rtl",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: color.surface, borderRadius: radius.lg,
        maxWidth: 520, width: "100%", boxShadow: shadow.xl,
        padding: space(5), fontFamily,
      }}>
        <h3 style={{ ...type.h3, margin: `0 0 ${space(2)}` }}>
          סמן כטופל — {item.item_label}
        </h3>
        {item.scenario_name && (
          <div style={{ ...type.bodySmall, color: color.fgMuted, marginBottom: space(3) }}>
            תרחיש: <strong>{item.scenario_name}</strong>
          </div>
        )}
        <div style={{ ...type.bodySmall, color: color.fgMuted, marginBottom: space(2) }}>
          מה נעשה? <span style={{ color: "#dc2626" }}>*</span>
          (יישמר ב-decision_log כ-audit trail)
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder='לדוגמה: "Reauthorized to marketing@svcollege.co.il ב-13/05" או "מודול נמחק מהתרחיש — לא נחוץ"'
          rows={4}
          style={{ ...inputStyle, resize: "vertical", marginBottom: space(3), fontFamily }}
        />
        <div style={{ display: "flex", gap: space(2), justifyContent: "flex-end" }}>
          <button onClick={onClose} style={button.secondary}>ביטול</button>
          <button onClick={submit} disabled={busy || !reason.trim()}
                  style={{ ...button.success, opacity: (busy || !reason.trim()) ? 0.5 : 1 }}>
            {busy ? "שומר..." : "✓ אישור — סומן כטופל"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ArtifactPayloadModal — opens an artifact's payload in a full modal.
 * Renders different views per artifact_type.
 */
import React, { useEffect } from "react";
import { color, radius, shadow, space, fontFamily, transition } from "./_tokens.js";

// ─── Per-type renderers ──────────────────────────────────────────────────────

function MediaPlanRenderer({ payload }) {
  const platforms = payload?.platforms || payload?.channels || [];
  const breakdown = payload?.platform_breakdown || payload?.budgets || {};
  const total     = payload?.total_budget_ils || payload?.total_budget || null;
  return (
    <div style={{ fontSize: 14, fontFamily, direction: "rtl" }}>
      {total && (
        <div style={{ marginBottom: space(3), padding: space(3), background: color.primarySoftBg, borderRadius: radius.md }}>
          <span style={{ fontWeight: 700, color: color.primarySoftFg }}>סה"כ תקציב מתוכנן: </span>
          <span style={{ fontWeight: 800, color: color.primary }}>₪{Number(total).toLocaleString("he-IL")}</span>
        </div>
      )}
      {platforms.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={thStyle}>ערוץ</th>
              <th style={thStyle}>תקציב</th>
              <th style={thStyle}>פירוט</th>
            </tr>
          </thead>
          <tbody>
            {platforms.map((p, i) => {
              const pid = typeof p === "string" ? p : (p?.id || p?.platform || p);
              const budget = breakdown[pid]?.budget || breakdown[pid] || null;
              const note   = breakdown[pid]?.note || breakdown[pid]?.description || "";
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
                  <td style={tdStyle}>{pid}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>{budget ? `₪${Number(budget).toLocaleString("he-IL")}` : "—"}</td>
                  <td style={{ ...tdStyle, color: color.fgMuted }}>{note || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {payload?.notes && (
        <div style={{ marginTop: space(3), fontSize: 13, color: color.fgMuted, lineHeight: 1.6 }}>{payload.notes}</div>
      )}
    </div>
  );
}

function KeywordResearchRenderer({ payload }) {
  const keywords = payload?.keywords || payload?.keyword_list || [];
  return (
    <div style={{ fontSize: 14, fontFamily, direction: "rtl" }}>
      {keywords.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={thStyle}>#</th>
              <th style={thStyle}>ביטוי</th>
              <th style={thStyle}>נפח חיפוש</th>
              <th style={thStyle}>תחרות</th>
            </tr>
          </thead>
          <tbody>
            {keywords.slice(0, 100).map((kw, i) => {
              const text   = typeof kw === "string" ? kw : (kw.keyword || kw.term || kw.phrase || String(kw));
              const volume = typeof kw === "object" ? (kw.volume || kw.search_volume || "—") : "—";
              const comp   = typeof kw === "object" ? (kw.competition || kw.difficulty || "—") : "—";
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
                  <td style={{ ...tdStyle, color: color.fgSubtle, textAlign: "center", width: 40 }}>{i + 1}</td>
                  <td style={tdStyle}>{text}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{volume}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{comp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <JsonFallback payload={payload} />
      )}
    </div>
  );
}

function AdCopyRenderer({ payload }) {
  const variants = payload?.variants || payload?.copies || payload?.headlines || [];
  if (Array.isArray(variants) && variants.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: space(3) }}>
        {variants.map((v, i) => {
          const text = typeof v === "string" ? v : (v.text || v.body || v.copy || JSON.stringify(v));
          const label = typeof v === "object" ? (v.label || v.type || `וריאנט ${i + 1}`) : `וריאנט ${i + 1}`;
          return (
            <div key={i} style={{
              padding: space(3), background: color.surfaceMuted,
              borderRadius: radius.md, borderRight: `3px solid ${color.primary}`,
              fontSize: 13, fontFamily, direction: "rtl", lineHeight: 1.7,
            }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: color.fgSubtle, marginBottom: space(1), textTransform: "uppercase" }}>{label}</div>
              <div style={{ color: color.fgDefault, whiteSpace: "pre-wrap" }}>{text}</div>
            </div>
          );
        })}
      </div>
    );
  }
  if (payload?.body || payload?.text || payload?.copy) {
    const text = payload.body || payload.text || payload.copy;
    return (
      <div style={{ padding: space(3), background: color.surfaceMuted, borderRadius: radius.md, fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap", direction: "rtl", fontFamily }}>
        {text}
      </div>
    );
  }
  return <JsonFallback payload={payload} />;
}

function CreativeRenderer({ payload }) {
  const url       = payload?.file_url || payload?.url || payload?.thumbnail_url;
  const format    = payload?.format || payload?.creative_format || "";
  const desc      = payload?.description || payload?.caption || "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space(3), fontSize: 14, fontFamily, direction: "rtl" }}>
      {url && (
        <div style={{ textAlign: "center" }}>
          <img src={url} alt="creative" style={{ maxWidth: "100%", maxHeight: 300, borderRadius: radius.md, objectFit: "contain" }}
               onError={e => { e.target.style.display = "none"; }} />
        </div>
      )}
      {format && <div><span style={{ fontWeight: 700 }}>פורמט: </span>{format}</div>}
      {desc  && <div style={{ color: color.fgMuted }}>{desc}</div>}
      {!url && !format && !desc && <JsonFallback payload={payload} />}
    </div>
  );
}

function BudgetRecommendationRenderer({ payload }) {
  const breakdown = payload?.breakdown || {};
  const total     = payload?.total_budget_ils || payload?.total || null;
  const rationale = payload?.rationale || payload?.justification || "";
  const entries   = Object.entries(breakdown);
  return (
    <div style={{ fontSize: 14, fontFamily, direction: "rtl" }}>
      {total && (
        <div style={{ marginBottom: space(3), padding: space(3), background: "#dcfce7", borderRadius: radius.md }}>
          <span style={{ fontWeight: 700, color: "#15803d" }}>סה"כ מומלץ: </span>
          <span style={{ fontWeight: 800, color: "#15803d" }}>₪{Number(total).toLocaleString("he-IL")}</span>
        </div>
      )}
      {entries.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: space(3) }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={thStyle}>ערוץ</th>
              <th style={thStyle}>סכום</th>
              <th style={thStyle}>%</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([ch, val], i) => {
              const amount = typeof val === "object" ? (val.budget || val.amount || 0) : val;
              const pct = total ? Math.round((Number(amount) / Number(total)) * 100) : null;
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
                  <td style={tdStyle}>{ch}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>₪{Number(amount).toLocaleString("he-IL")}</td>
                  <td style={{ ...tdStyle, textAlign: "center", color: color.fgMuted }}>{pct != null ? `${pct}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {rationale && <div style={{ fontSize: 13, color: color.fgMuted, lineHeight: 1.6, borderTop: `1px solid ${color.borderSubtle}`, paddingTop: space(3) }}>{rationale}</div>}
    </div>
  );
}

function JsonFallback({ payload }) {
  return (
    <pre style={{
      fontSize: 12, color: color.fgMuted, overflow: "auto",
      background: "#f8fafc", padding: space(3), borderRadius: radius.md,
      maxHeight: 400, direction: "ltr", textAlign: "left",
    }}>
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}

// ─── Table cell helpers ──────────────────────────────────────────────────────
const thStyle = {
  padding: `${space(2)} ${space(3)}`, fontSize: 12, fontWeight: 700,
  color: "#6b7280", textAlign: "right", borderBottom: `1px solid #e5e7eb`,
};
const tdStyle = {
  padding: `${space(2)} ${space(3)}`, fontSize: 13, textAlign: "right",
  verticalAlign: "top",
};

// ─── Type → renderer map ─────────────────────────────────────────────────────
function PayloadRenderer({ artifactType, payload }) {
  const t = (artifactType || "").toLowerCase();
  if (t === "media_plan")               return <MediaPlanRenderer           payload={payload} />;
  if (t === "budget_recommendation")    return <BudgetRecommendationRenderer payload={payload} />;
  if (t === "keyword_research")         return <KeywordResearchRenderer      payload={payload} />;
  if (t === "creative_rendered")        return <CreativeRenderer             payload={payload} />;
  if (t.startsWith("ad_copy"))          return <AdCopyRenderer              payload={payload} />;
  return <JsonFallback payload={payload} />;
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export default function ArtifactPayloadModal({ artifact, onClose }) {
  useEffect(() => {
    function handler(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!artifact) return null;

  const title = artifact.title
    || artifact.artifact_type?.replace(/_/g, " ")
    || "תוצר";

  const versionLabel = (artifact.version_number || 1) > 1
    ? ` — גרסה ${artifact.version_number}`
    : "";

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "rgba(15,23,42,0.55)", zIndex: 10000,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: 60,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: color.surface, borderRadius: radius.lg,
        boxShadow: shadow.xl, width: 700, maxWidth: "95vw",
        maxHeight: "80vh", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: `${space(4)} ${space(5)}`,
          borderBottom: `1px solid ${color.borderDefault}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: color.fgDefault, fontFamily, direction: "rtl" }}>
              {title}{versionLabel}
            </div>
            {artifact.artifact_type && (
              <div style={{ fontSize: 12, color: color.fgSubtle, fontFamily, marginTop: 2 }}>
                {artifact.artifact_type.replace(/_/g, " ")} · {artifact.status}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 20, color: color.fgMuted, padding: 4,
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: `${space(5)} ${space(5)}` }}>
          <PayloadRenderer artifactType={artifact.artifact_type} payload={artifact.payload || {}} />
          {artifact.qa_history?.length > 0 && (
            <div style={{ marginTop: space(5), borderTop: `1px solid ${color.borderSubtle}`, paddingTop: space(4) }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: color.fgMuted, marginBottom: space(3), fontFamily }}>📋 היסטוריית QA</div>
              {artifact.qa_history.map((entry, i) => (
                <div key={i} style={{
                  fontSize: 12, color: color.fgMuted, fontFamily,
                  padding: `${space(2)} ${space(3)}`, borderRadius: radius.sm,
                  background: color.surfaceMuted, marginBottom: space(2),
                  direction: "rtl",
                }}>
                  <strong>{entry.status || entry.action}</strong>
                  {entry.note && <span> — {entry.note}</span>}
                  {entry.checked_at && <span style={{ marginRight: 8, opacity: 0.7 }}>{new Date(entry.checked_at).toLocaleDateString("he-IL")}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

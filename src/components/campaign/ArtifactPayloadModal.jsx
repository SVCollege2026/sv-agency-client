/**
 * ArtifactPayloadModal — opens an artifact's payload in a full modal.
 * Shows structured data as table + download link + inline note/revision.
 */
import React, { useEffect, useState } from "react";
import { color, radius, shadow, space, fontFamily, transition } from "./_tokens.js";
import { requestArtifactRevision } from "../../api.js";
import { useToast } from "./Toast.jsx";

// ─── Per-type renderers ──────────────────────────────────────────────────────

function MediaPlanRenderer({ payload }) {
  const platforms = payload?.platforms || payload?.channels || [];
  const breakdown = payload?.platform_breakdown || payload?.budgets || {};
  const total     = payload?.total_budget_ils || payload?.total_budget || null;
  const dates     = payload?.date_range || {};
  const methodology = payload?.methodology || payload?.optimization_type || null;

  const rows = platforms.map(p => {
    const pid = typeof p === "string" ? p : (p?.id || p?.platform || String(p));
    const bd  = breakdown[pid] || {};
    return {
      platform:    pid,
      budget:      bd.budget_ils ?? bd.budget ?? bd ?? null,
      objective:   bd.objective  || bd.goal || p?.objective || "—",
      format:      bd.format     || bd.ad_format || "—",
      note:        bd.note       || bd.description || "—",
    };
  });

  return (
    <div style={{ fontSize: 14, fontFamily, direction: "rtl" }}>
      {/* Summary bar */}
      <div style={{ display: "flex", gap: space(3), flexWrap: "wrap", marginBottom: space(4) }}>
        {total && (
          <SummaryChip label="סה&quot;כ תקציב" value={`₪${Number(total).toLocaleString("he-IL")}`} accent={color.primary} />
        )}
        {methodology && (
          <SummaryChip label="מתודולוגיה" value={methodology} />
        )}
        {(dates.start || dates.from) && (
          <SummaryChip label="תחילת פעילות" value={dates.start || dates.from} />
        )}
        {(dates.end || dates.to) && (
          <SummaryChip label="סיום" value={dates.end || dates.to} />
        )}
      </div>

      {rows.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={thStyle}>ערוץ</th>
              <th style={{ ...thStyle, textAlign: "center" }}>תקציב</th>
              <th style={thStyle}>מטרה</th>
              <th style={thStyle}>פורמט</th>
              <th style={thStyle}>הערות</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{r.platform}</td>
                <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: r.budget ? color.fgDefault : color.fgSubtle }}>
                  {r.budget != null ? `₪${Number(r.budget).toLocaleString("he-IL")}` : "—"}
                </td>
                <td style={tdStyle}>{r.objective}</td>
                <td style={tdStyle}>{r.format}</td>
                <td style={{ ...tdStyle, color: color.fgMuted }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rows.length === 0 && <JsonFallback payload={payload} />}

      {payload?.notes && (
        <div style={{ marginTop: space(3), fontSize: 13, color: color.fgMuted, lineHeight: 1.6,
                      borderTop: `1px solid ${color.borderSubtle}`, paddingTop: space(3) }}>
          {payload.notes}
        </div>
      )}
    </div>
  );
}

function KeywordResearchRenderer({ payload }) {
  const keywords = payload?.keywords || payload?.keyword_list || [];
  return (
    <div style={{ fontSize: 14, fontFamily, direction: "rtl" }}>
      {payload?.summary && (
        <div style={{ marginBottom: space(3), padding: space(3), background: color.surfaceMuted, borderRadius: radius.md, fontSize: 13, color: color.fgDefault }}>
          {payload.summary}
        </div>
      )}
      {keywords.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={{ ...thStyle, textAlign: "center", width: 40 }}>#</th>
              <th style={thStyle}>ביטוי</th>
              <th style={{ ...thStyle, textAlign: "center" }}>נפח חיפוש</th>
              <th style={{ ...thStyle, textAlign: "center" }}>תחרות</th>
              <th style={thStyle}>כוונה</th>
            </tr>
          </thead>
          <tbody>
            {keywords.slice(0, 200).map((kw, i) => {
              const text   = typeof kw === "string" ? kw : (kw.keyword || kw.term || kw.phrase || String(kw));
              const volume = typeof kw === "object" ? (kw.volume || kw.search_volume || "—") : "—";
              const comp   = typeof kw === "object" ? (kw.competition || kw.difficulty || "—") : "—";
              const intent = typeof kw === "object" ? (kw.intent || "—") : "—";
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
                  <td style={{ ...tdStyle, color: color.fgSubtle, textAlign: "center" }}>{i + 1}</td>
                  <td style={tdStyle}>{text}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{volume}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{comp}</td>
                  <td style={{ ...tdStyle, color: color.fgMuted }}>{intent}</td>
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
              borderRadius: radius.md, borderInlineEnd: `3px solid ${color.primary}`,
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
    return (
      <div style={{ padding: space(3), background: color.surfaceMuted, borderRadius: radius.md, fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap", direction: "rtl", fontFamily }}>
        {payload.body || payload.text || payload.copy}
      </div>
    );
  }
  return <JsonFallback payload={payload} />;
}

function CreativeRenderer({ payload }) {
  const url  = payload?.file_url || payload?.url || payload?.thumbnail_url;
  const format = payload?.format || payload?.creative_format || "";
  const desc = payload?.description || payload?.caption || "";
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
        <div style={{ marginBottom: space(3) }}>
          <SummaryChip label="סה&quot;כ מומלץ" value={`₪${Number(total).toLocaleString("he-IL")}`} accent="#15803d" />
        </div>
      )}
      {entries.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: space(3) }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={thStyle}>ערוץ</th>
              <th style={{ ...thStyle, textAlign: "center" }}>סכום</th>
              <th style={{ ...thStyle, textAlign: "center" }}>%</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([ch, val], i) => {
              const amount = typeof val === "object" ? (val.budget || val.amount || 0) : val;
              const pct = total ? Math.round((Number(amount) / Number(total)) * 100) : null;
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{ch}</td>
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

function SummaryChip({ label, value, accent }) {
  return (
    <div style={{
      display: "inline-flex", flexDirection: "column", padding: `${space(2)} ${space(3)}`,
      background: color.surfaceMuted, borderRadius: radius.md,
      border: `1px solid ${color.borderDefault}`,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: color.fgSubtle, textTransform: "uppercase", fontFamily }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: accent || color.fgDefault, fontFamily }}>{value}</span>
    </div>
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

// ─── Inline note panel ───────────────────────────────────────────────────────
function InlineNotePanel({ artifact, onSent }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!note.trim() || busy) return;
    setBusy(true);
    try {
      await requestArtifactRevision(artifact.id, { revision_note: note.trim() });
      toast.success("הערה נשלחה למחלקה");
      setNote("");
      onSent?.();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ borderTop: `1px solid ${color.borderDefault}`, padding: `${space(3)} ${space(4)}`, background: "#fffbf0" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: space(2), fontFamily }}>
        הוסיפי הערה או תיקון
      </div>
      <textarea
        value={note} onChange={e => setNote(e.target.value)}
        placeholder="לדוגמה: תקציב Meta צריך להיות ₪15K, לא ₪10K · הוסיפי קמפיין Display · שנאי את הפורמט ל-Reels"
        rows={3}
        style={{
          width: "100%", padding: space(2), fontSize: 13, fontFamily,
          border: `1px solid ${color.borderDefault}`, borderRadius: radius.sm,
          direction: "rtl", resize: "vertical", outline: "none",
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: space(2) }}>
        <button onClick={send} disabled={!note.trim() || busy} style={{
          background: "#92400e", color: "#fff", border: "none",
          borderRadius: radius.sm, padding: `${space(1.5)} ${space(4)}`,
          fontSize: 13, fontWeight: 700, cursor: note.trim() && !busy ? "pointer" : "not-allowed",
          opacity: note.trim() && !busy ? 1 : 0.5, fontFamily,
        }}>
          {busy ? "שולחת..." : "שלחי הערה למחלקה"}
        </button>
      </div>
    </div>
  );
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

  const fileUrl = artifact.file_url
    || artifact.payload?.file_url
    || artifact.payload?.download_url;

  const canComment = !["approved", "rejected"].includes(artifact.status);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "rgba(15,23,42,0.55)", zIndex: 10000,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: 48,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: color.surface, borderRadius: radius.lg,
        boxShadow: shadow.xl, width: 760, maxWidth: "95vw",
        maxHeight: "88vh", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: `${space(3)} ${space(5)}`,
          borderBottom: `1px solid ${color.borderDefault}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <div style={{ direction: "rtl" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: color.fgDefault, fontFamily }}>
              {title}{versionLabel}
            </div>
            <div style={{ fontSize: 12, color: color.fgSubtle, fontFamily, marginTop: 2 }}>
              {artifact.artifact_type?.replace(/_/g, " ")}
              {artifact.status && ` · ${artifact.status}`}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: space(2) }}>
            {fileUrl && (
              <a href={fileUrl} download target="_blank" rel="noreferrer" style={{
                background: color.surfaceMuted, border: `1px solid ${color.borderDefault}`,
                borderRadius: radius.sm, padding: `${space(1.5)} ${space(3)}`,
                fontSize: 12, fontWeight: 600, color: color.fgDefault, fontFamily,
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                cursor: "pointer",
              }}>
                הורדה
              </a>
            )}
            <button onClick={onClose} style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 20, color: color.fgMuted, padding: 4, lineHeight: 1,
            }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: `${space(4)} ${space(5)}` }}>
          <PayloadRenderer artifactType={artifact.artifact_type} payload={artifact.payload || {}} />

          {artifact.qa_history?.length > 0 && (
            <div style={{ marginTop: space(5), borderTop: `1px solid ${color.borderSubtle}`, paddingTop: space(4) }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: color.fgMuted, marginBottom: space(3), fontFamily }}>היסטוריית QA</div>
              {artifact.qa_history.map((entry, i) => (
                <div key={i} style={{
                  fontSize: 12, color: color.fgMuted, fontFamily,
                  padding: `${space(2)} ${space(3)}`, borderRadius: radius.sm,
                  background: color.surfaceMuted, marginBottom: space(2),
                  direction: "rtl",
                }}>
                  <strong>{entry.status || entry.action}</strong>
                  {entry.note && <span> — {entry.note}</span>}
                  {entry.checked_at && <span style={{ marginInlineStart: 8, opacity: 0.7 }}>{new Date(entry.checked_at).toLocaleDateString("he-IL")}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inline comment panel — always visible at bottom when not yet approved */}
        {canComment && (
          <InlineNotePanel artifact={artifact} onSent={onClose} />
        )}
      </div>
    </div>
  );
}

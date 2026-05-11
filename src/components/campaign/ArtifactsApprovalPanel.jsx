/**
 * ArtifactsApprovalPanel.jsx — תוצרים שמחכים לאישור.
 *
 * המקום שבו מנהלת השיווק רואה את כל מה שמחלקת המדיה/קופי/קריאייטיב/MAKE
 * הכינו וצריכים את האישור שלה. לכל תוצר היא יכולה:
 *   ✓ לאשר      — התוצר עובר ל-approved.
 *   ↩ לשלוח לתיקון — חוזר למחלקה עם הערה (חובה).
 *   ⏩ להעביר הלאה — אישור + שליחה לפרסום / למנכ"ל / לשלב הבא.
 */
import React, { useState, useEffect } from "react";
import { listArtifacts, approveArtifact, requestArtifactRevision, forwardArtifact, fileAccessUrl } from "../../api.js";

const ARTIFACT_TYPES = {
  media_plan:            { icon: "📊", label: "פריסת מדיה",         producer: "מחלקת מדיה" },
  budget_recommendation: { icon: "💰", label: "המלצת תקציב",        producer: "מחלקת מדיה" },
  market_research:       { icon: "🔍", label: "מחקר תחום ומתחרים",  producer: "מחלקת מדיה" },
  ad_copy_meta:          { icon: "📘", label: "קופי ל-Meta",         producer: "מחלקת קופי" },
  ad_copy_google:        { icon: "🔍", label: "קופי ל-Google",       producer: "מחלקת קופי" },
  ad_copy_tiktok:        { icon: "🎵", label: "קופי ל-TikTok",       producer: "מחלקת קופי" },
  lead_form_copy:        { icon: "📝", label: "קופי לטופס Lead",    producer: "מחלקת קופי" },
  creative_concept:      { icon: "🎨", label: "כיוון קריאייטיב",     producer: "מחלקת קריאייטיב" },
  creative_rendered:     { icon: "🖼", label: "קריאייטיב מוכן",     producer: "מחלקת קריאייטיב" },
  format_qa_report:      { icon: "📐", label: "בדיקת פורמטים",       producer: "מחלקת קריאייטיב" },
  make_scenario:         { icon: "🔌", label: "תרחיש Make",          producer: "מחלקת MAKE" },
};

const STATUS_BADGES = {
  internal_review:                { bg: "#e0e7ff", color: "#3730a3", label: "בבדיקה פנימית" },
  qa_passed:                      { bg: "#dcfce7", color: "#15803d", label: "QA עבר ✓" },
  waiting_for_marketing_approval: { bg: "#fef3c7", color: "#a16207", label: "ממתין לאישור שלך" },
  revision_required:              { bg: "#fee2e2", color: "#b91c1c", label: "נדרש תיקון" },
  approved:                       { bg: "#bbf7d0", color: "#166534", label: "אושר" },
};

const card = {
  background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
  padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
};

export default function ArtifactsApprovalPanel() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [filter, setFilter] = useState("pending"); // pending | all
  const [refreshKey, setRefreshKey] = useState(0);

  async function load() {
    setLoading(true); setError(null);
    try {
      const data = filter === "pending"
        ? await listArtifacts({ pendingForApproval: true, limit: 200 })
        : await listArtifacts({ limit: 200 });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter, refreshKey]);

  // Group by folder for visual organization
  const grouped = items.reduce((acc, a) => {
    const key = a.folder_name || "כללי / ללא תיקייה";
    (acc[key] ||= []).push(a);
    return acc;
  }, {});

  return (
    <div style={{ direction: "rtl" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <Pill active={filter === "pending"} onClick={() => setFilter("pending")} count={filter === "pending" ? items.length : null}>
            ממתינים לי
          </Pill>
          <Pill active={filter === "all"} onClick={() => setFilter("all")}>הכל</Pill>
        </div>
        <button onClick={() => setRefreshKey(k => k + 1)} style={{
          padding: "8px 14px", background: "#fff", color: "#374151",
          border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer", fontSize: 13,
        }}>🔄 רענון</button>
      </div>

      {error && <div style={{ padding: 12, background: "#fee2e2", color: "#b91c1c", borderRadius: 8, marginBottom: 12 }}>שגיאה: {error}</div>}
      {loading && <div style={{ padding: 20, color: "#6b7280" }}>טוען...</div>}

      {!loading && items.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>אין תוצרים שמחכים לך כרגע</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
            כשמחלקה תכין תוצר חדש (פריסת מדיה, קופי, קריאייטיב וכו') הוא יופיע פה לאישור.
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([folderName, list]) => (
        <div key={folderName} style={card}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>📁 {folderName}</h3>
            <span style={{ fontSize: 13, color: "#9ca3af" }}>
              {list.length} {list.length === 1 ? "תוצר" : "תוצרים"}
            </span>
          </div>
          {list.map(art => (
            <ArtifactCard key={art.id} artifact={art} onChanged={() => setRefreshKey(k => k + 1)} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Pill({ active, onClick, count, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 16px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 700,
      background: active ? "#1e3a5f" : "#fff",
      color:      active ? "#fff" : "#374151",
      border: `1px solid ${active ? "#1e3a5f" : "#e5e7eb"}`,
    }}>
      {children}
      {count !== null && count !== undefined && (
        <span style={{
          marginInlineStart: 6, background: active ? "rgba(255,255,255,0.25)" : "#1e3a5f",
          color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: 11,
        }}>{count}</span>
      )}
    </button>
  );
}

function ArtifactCard({ artifact, onChanged }) {
  const meta = ARTIFACT_TYPES[artifact.artifact_type] || { icon: "📎", label: artifact.artifact_type, producer: "—" };
  const status = STATUS_BADGES[artifact.status] || { bg: "#f1f5f9", color: "#475569", label: artifact.status };
  const [expanded, setExpanded]     = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState(null);

  async function doApprove() {
    setBusy(true); setError(null);
    try { await approveArtifact(artifact.id); onChanged(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{
      border: "1px solid #f3f4f6", borderRadius: 10, padding: 16, marginBottom: 12,
      background: "#fafbfc",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 30 }}>{meta.icon}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{artifact.title || meta.label}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              {meta.label} · הוכן ע"י {meta.producer}
            </div>
          </div>
        </div>
        <span style={{
          background: status.bg, color: status.color,
          padding: "4px 12px", borderRadius: 16, fontSize: 11, fontWeight: 700,
        }}>{status.label}</span>
      </div>

      {/* Preview */}
      <div style={{ marginTop: 14, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #f3f4f6" }}>
        <Preview artifact={artifact} expanded={expanded} />
        <button onClick={() => setExpanded(e => !e)} style={{
          marginTop: 8, background: "transparent", border: "none", color: "#1e3a5f",
          cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0,
        }}>
          {expanded ? "הסתר פרטים ▲" : "הצג עוד פרטים ▼"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 10, padding: 10, background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Actions */}
      {artifact.status !== "approved" && artifact.status !== "revision_required" && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <ActionBtn onClick={doApprove} disabled={busy} bg="#16a34a" icon="✓">אשרי</ActionBtn>
          <ActionBtn onClick={() => setShowRevise(true)} disabled={busy} bg="#fff" color="#b91c1c" border="#fecaca" icon="↩">שלחי לתיקון</ActionBtn>
          <ActionBtn onClick={() => setShowForward(true)} disabled={busy} bg="#fff" color="#1e3a5f" border="#dbeafe" icon="⏩">העברי הלאה</ActionBtn>
        </div>
      )}

      {showRevise && <ReviseModal artifact={artifact} onClose={() => setShowRevise(false)} onDone={() => { setShowRevise(false); onChanged(); }} />}
      {showForward && <ForwardModal artifact={artifact} onClose={() => setShowForward(false)} onDone={() => { setShowForward(false); onChanged(); }} />}
    </div>
  );
}

function ActionBtn({ children, icon, bg, color = "#fff", border = "transparent", ...p }) {
  return (
    <button {...p} style={{
      padding: "8px 16px", background: bg, color, border: `1px solid ${border}`,
      borderRadius: 8, cursor: p.disabled ? "not-allowed" : "pointer",
      fontWeight: 700, fontSize: 13, opacity: p.disabled ? 0.6 : 1,
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      <span>{icon}</span>{children}
    </button>
  );
}

function Preview({ artifact, expanded }) {
  const p = artifact.payload || {};
  const type = artifact.artifact_type;

  // Per-type minimal preview.
  if (type === "ad_copy_meta" || type === "ad_copy_google" || type === "ad_copy_tiktok") {
    const headlines = p.headlines || [];
    const primary = p.primary_texts || [];
    return (
      <div style={{ fontSize: 13, color: "#1f2937", lineHeight: 1.7 }}>
        {headlines.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <strong>כותרות:</strong>
            <ul style={{ margin: "4px 0", paddingInlineStart: 20 }}>
              {headlines.slice(0, expanded ? undefined : 2).map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </div>
        )}
        {primary.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <strong>טקסט ראשי:</strong>
            <div style={{ background: "#f9fafb", padding: 10, borderRadius: 6, marginTop: 4 }}>
              {(expanded ? primary : primary.slice(0, 1)).join("\n\n")}
            </div>
          </div>
        )}
        {p.ctas && p.ctas.length > 0 && (
          <div><strong>CTA:</strong> {p.ctas.join(" · ")}</div>
        )}
      </div>
    );
  }

  if (type === "creative_concept") {
    return (
      <div style={{ fontSize: 13, color: "#1f2937", lineHeight: 1.7 }}>
        <div><strong>קונספט:</strong> {p.concept_title || "—"}</div>
        <div><strong>טון:</strong> {p.tone || "—"}</div>
        {expanded && p.visual_directions && (
          <div style={{ marginTop: 8 }}>
            <strong>כיווני ויזואל:</strong>
            <ul style={{ margin: "4px 0", paddingInlineStart: 20 }}>
              {p.visual_directions.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (type === "media_plan") {
    return (
      <div style={{ fontSize: 13, color: "#1f2937" }}>
        <div><strong>פלטפורמות:</strong> {(p.platforms || []).join(" · ") || "—"}</div>
        <div><strong>אופק תכנון:</strong> {p.horizon_days || 30} ימים</div>
        {p.methodology?.note && <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>{p.methodology.note}</div>}
      </div>
    );
  }

  if (type === "budget_recommendation") {
    return (
      <div style={{ fontSize: 13, color: "#1f2937" }}>
        <div><strong>סכום זמין:</strong> ₪{Number(p.total_available_ils || 0).toLocaleString("he-IL")}</div>
        {p.breakdown && (
          <div style={{ marginTop: 6 }}>
            <strong>חלוקה:</strong>{" "}
            {Object.entries(p.breakdown).map(([k, v]) =>
              <span key={k} style={{ marginInlineEnd: 12 }}>{k}: ₪{Number(v).toLocaleString("he-IL")}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (type === "market_research") {
    return (
      <div style={{ fontSize: 13, color: "#1f2937" }}>
        <div><strong>קטגוריה:</strong> {p.category || p.domain || "—"}</div>
        {p.audience_segments && (
          <div><strong>פלחי קהל:</strong> {(p.audience_segments || []).slice(0, expanded ? undefined : 2).join(" · ")}</div>
        )}
        {expanded && p.messaging_hooks && (
          <div style={{ marginTop: 6 }}>
            <strong>וורי מסר:</strong>
            <ul style={{ margin: "4px 0", paddingInlineStart: 20 }}>{p.messaging_hooks.map((h, i) => <li key={i}>{h}</li>)}</ul>
          </div>
        )}
      </div>
    );
  }

  // Generic
  return (
    <div style={{ fontSize: 13, color: "#6b7280" }}>
      {artifact.title || meta_label(type)}
    </div>
  );
}
const meta_label = t => (ARTIFACT_TYPES[t]?.label || t);

function ReviseModal({ artifact, onClose, onDone }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);

  async function submit() {
    if (!note.trim()) { setErr("יש להסביר מה צריך לתקן"); return; }
    setBusy(true); setErr(null);
    try {
      await requestArtifactRevision(artifact.id, { revision_note: note.trim() });
      onDone();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="↩ שליחה לתיקון" onClose={onClose}>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
        כתבי במדויק מה צריך לשנות. ההערה תועבר חזרה למחלקה שהכינה את התוצר.
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={4} placeholder="לדוגמה: הכותרת הראשונה חזקה, הטקסט השני יוצא ארוך — לקצר ב-30 תווים..."
        style={modalInput} />
      {err && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 8 }}>{err}</div>}
      <div style={modalFooter}>
        <button onClick={onClose} style={modalCancel}>ביטול</button>
        <button onClick={submit} disabled={busy} style={modalPrimary}>
          {busy ? "שולחת..." : "↩ שלחי לתיקון"}
        </button>
      </div>
    </Modal>
  );
}

function ForwardModal({ artifact, onClose, onDone }) {
  const [target, setTarget] = useState("launch");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      await forwardArtifact(artifact.id, { target, note: note.trim() || null });
      onDone();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const targets = [
    { id: "launch",          icon: "🚀", label: "לפרסום",                  hint: "התוצר מאושר ונשלח לפרסום בפלטפורמה" },
    { id: "school_director", icon: "👔", label: "למנכ\"ל בית הספר",       hint: "החלטה אסטרטגית שדורשת אישור נוסף" },
    { id: "next_stage",      icon: "➡",  label: "לשלב הבא ב-workflow",     hint: "המשך טיפול במחלקה הבאה" },
  ];

  return (
    <Modal title="⏩ העברה הלאה" onClose={onClose}>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
        איפה את רוצה שהתוצר יגיע אחרי האישור שלך?
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {targets.map(t => (
          <div key={t.id} onClick={() => setTarget(t.id)} style={{
            padding: 12, borderRadius: 10, cursor: "pointer",
            background: target === t.id ? "#eff6ff" : "#fff",
            border: `2px solid ${target === t.id ? "#1e3a5f" : "#e5e7eb"}`,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 26 }}>{t.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: target === t.id ? "#1e3a5f" : "#111827" }}>{t.label}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{t.hint}</div>
            </div>
          </div>
        ))}
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="הערה (אופציונלי)" style={modalInput} />
      {err && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 8 }}>{err}</div>}
      <div style={modalFooter}>
        <button onClick={onClose} style={modalCancel}>ביטול</button>
        <button onClick={submit} disabled={busy} style={modalPrimary}>
          {busy ? "שולחת..." : "⏩ העברי הלאה"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16, direction: "rtl",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 14, padding: 22, maxWidth: 520, width: "100%",
        boxShadow: "0 20px 60px rgba(15,23,42,0.3)",
      }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 18, color: "#111827", fontWeight: 700 }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

const modalInput = {
  width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb",
  borderRadius: 8, fontSize: 14, direction: "rtl", resize: "vertical", fontFamily: "inherit", background: "#f9fafb",
};
const modalFooter = { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 };
const modalCancel = { padding: "10px 18px", background: "transparent", color: "#475569", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer" };
const modalPrimary = { padding: "10px 18px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 };

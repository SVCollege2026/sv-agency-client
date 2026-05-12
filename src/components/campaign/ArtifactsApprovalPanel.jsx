/**
 * ArtifactsApprovalPanel.jsx — תוצרים שמחכים לאישור.
 * Uses design tokens, toast notifications, skeleton loading, hover lift.
 */
import React, { useState, useEffect } from "react";
import { listArtifacts, approveArtifact, requestArtifactRevision, forwardArtifact, fileAccessUrl } from "../../api.js";
import { color, radius, shadow, space, type, transition, button as btn, input as inputStyle, emptyState, pill, fontFamily } from "./_tokens.js";
import { useToast } from "./Toast.jsx";
import { SkeletonCard } from "./Skeleton.jsx";
import { ApprovalGuardBanner } from "./ApprovalGuard.jsx";

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

const STATUS_TONES = {
  internal_review:                { tone: "accent",  label: "בבדיקה פנימית" },
  qa_passed:                      { tone: "success", label: "QA עבר" },
  waiting_for_marketing_approval: { tone: "warning", label: "ממתין לאישור שלך" },
  revision_required:              { tone: "danger",  label: "נדרש תיקון" },
  approved:                       { tone: "success", label: "אושר" },
};

const card = {
  background: color.surface, borderRadius: radius.card,
  border: `1px solid ${color.borderDefault}`, padding: space(5),
  marginBottom: space(4), boxShadow: shadow.sm,
};

export default function ArtifactsApprovalPanel() {
  const toast = useToast();
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [filter, setFilter] = useState("pending");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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

  // Reset selection when filter changes or content is reloaded
  useEffect(() => { setSelected(new Set()); }, [filter, refreshKey]);

  const grouped = items.reduce((acc, a) => {
    const key = a.folder_name || "כללי / ללא תיקייה";
    (acc[key] ||= []).push(a);
    return acc;
  }, {});

  const isApprovable = a => a.status !== "approved" && a.status !== "revision_required";
  const approvableItems = items.filter(isApprovable);

  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleGroup(list) {
    const ids = list.filter(isApprovable).map(a => a.id);
    const allSelected = ids.length > 0 && ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }

  function clearSelection() { setSelected(new Set()); }

  async function approveSelected() {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    let ok = 0, fail = 0;
    const results = await Promise.allSettled(ids.map(id => approveArtifact(id)));
    results.forEach(r => r.status === "fulfilled" ? ok++ : fail++);
    if (ok > 0) toast.success(`✓ אושרו ${ok} תוצרים`);
    if (fail > 0) toast.error(`${fail} תוצרים נכשלו באישור`);
    setBulkBusy(false);
    clearSelection();
    setRefreshKey(k => k + 1);
  }

  return (
    <div style={{ direction: "rtl", fontFamily }}>
      <ApprovalGuardBanner context="artifacts" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: space(4), flexWrap: "wrap", gap: space(2) }}>
        <div style={{ display: "flex", gap: space(2) }}>
          <Pill active={filter === "pending"} onClick={() => setFilter("pending")} count={filter === "pending" ? items.length : null}>
            ממתינים לי
          </Pill>
          <Pill active={filter === "all"} onClick={() => setFilter("all")}>הכל</Pill>
        </div>
        <button onClick={() => setRefreshKey(k => k + 1)} style={btn.secondary}>🔄 רענון</button>
      </div>

      {error && (
        <div style={{
          padding: space(3), background: color.dangerSoftBg, color: color.dangerSoftFg,
          borderRadius: radius.md, marginBottom: space(3),
        }}>שגיאה: {error}</div>
      )}

      {loading && (
        <div style={card}>
          <SkeletonCard /><SkeletonCard />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div style={{ ...card, ...emptyState, padding: space(10) }}>
          <div style={{ fontSize: 56, marginBottom: space(3) }}>🎉</div>
          <div style={{ ...type.h3, marginBottom: space(2) }}>אין תוצרים שמחכים לך כרגע</div>
          <div style={{ ...type.bodySmall, color: color.fgSubtle }}>
            כשמחלקה תכין תוצר חדש (פריסת מדיה, קופי, קריאייטיב וכו') הוא יופיע פה לאישור.
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([folderName, list]) => {
        const groupApprovable = list.filter(isApprovable);
        const groupIds = groupApprovable.map(a => a.id);
        const allChecked = groupIds.length > 0 && groupIds.every(id => selected.has(id));
        const someChecked = groupIds.some(id => selected.has(id));
        return (
          <div key={folderName} style={card}>
            <div style={{ display: "flex", alignItems: "baseline", gap: space(3), marginBottom: space(4), flexWrap: "wrap" }}>
              <h3 style={{ ...type.h3, margin: 0 }}>📁 {folderName}</h3>
              <span style={{ ...type.bodySmall, color: color.fgSubtle }}>
                {list.length} {list.length === 1 ? "תוצר" : "תוצרים"}
              </span>
              {groupApprovable.length > 0 && (
                <label style={{
                  display: "inline-flex", alignItems: "center", gap: space(1.5),
                  cursor: "pointer", marginInlineStart: "auto",
                  ...type.bodySmall, color: color.fgMuted,
                }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={el => { if (el) el.indeterminate = !allChecked && someChecked; }}
                    onChange={() => toggleGroup(list)}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: color.primary }}
                  />
                  {allChecked ? "נקי בחירה בקבוצה" : "סמני את כל התוצרים בקבוצה"}
                </label>
              )}
            </div>
            {list.map(art => (
              <ArtifactCard
                key={art.id}
                artifact={art}
                onChanged={() => setRefreshKey(k => k + 1)}
                toast={toast}
                selectable={isApprovable(art)}
                isSelected={selected.has(art.id)}
                onToggleSelect={() => toggleOne(art.id)}
              />
            ))}
          </div>
        );
      })}

      {selected.size > 0 && (
        <div style={{
          position: "fixed", bottom: space(5), insetInlineStart: "50%",
          transform: "translateX(50%)", zIndex: 80,
          background: color.fgDefault, color: color.fgOnDark,
          borderRadius: radius.pill, boxShadow: shadow.xl,
          padding: `${space(2.5)} ${space(4)}`,
          display: "flex", alignItems: "center", gap: space(3),
          direction: "rtl", fontFamily,
        }}>
          <span style={{ ...type.bodyStrong, color: color.fgOnDark }}>
            {selected.size} נבחרו
          </span>
          <button onClick={clearSelection} disabled={bulkBusy} style={{
            background: "transparent", color: color.fgOnDark,
            border: `1px solid rgba(255,255,255,0.3)`,
            borderRadius: radius.pill, padding: `${space(1.5)} ${space(3)}`,
            cursor: bulkBusy ? "not-allowed" : "pointer",
            fontSize: 13, fontWeight: 600, fontFamily,
            opacity: bulkBusy ? 0.5 : 1,
          }}>
            נקי
          </button>
          <button onClick={approveSelected} disabled={bulkBusy} style={{
            background: color.success || "#16a34a", color: color.fgOnDark,
            border: "none", borderRadius: radius.pill,
            padding: `${space(2)} ${space(4)}`,
            cursor: bulkBusy ? "not-allowed" : "pointer",
            fontSize: 13, fontWeight: 700, fontFamily,
            opacity: bulkBusy ? 0.6 : 1,
          }}>
            {bulkBusy ? "מאשרת..." : `✓ אישור ${selected.size} תוצרים`}
          </button>
        </div>
      )}
    </div>
  );
}

function Pill({ active, onClick, count, children }) {
  return (
    <button onClick={onClick} style={{
      padding: `${space(2)} ${space(4)}`, borderRadius: radius.pill,
      cursor: "pointer", fontSize: 13, fontWeight: 700,
      background: active ? color.primary : color.surface,
      color:      active ? color.fgOnDark : color.fgMuted,
      border: `1px solid ${active ? color.primary : color.borderDefault}`,
      transition: transition.fast, fontFamily,
    }}>
      {children}
      {count !== null && count !== undefined && (
        <span style={{
          marginInlineStart: space(1.5),
          background: active ? "rgba(255,255,255,0.25)" : color.primary,
          color: color.fgOnDark, borderRadius: radius.pill,
          padding: `1px ${space(2)}`, fontSize: 11,
        }}>{count}</span>
      )}
    </button>
  );
}

function ArtifactCard({ artifact, onChanged, toast, selectable = false, isSelected = false, onToggleSelect }) {
  const meta = ARTIFACT_TYPES[artifact.artifact_type] || { icon: "📎", label: artifact.artifact_type, producer: "—" };
  const statusInfo = STATUS_TONES[artifact.status] || { tone: "neutral", label: artifact.status };
  const [expanded, setExpanded]       = useState(false);
  const [showRevise, setShowRevise]   = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [busy, setBusy]               = useState(false);

  async function doApprove() {
    setBusy(true);
    try {
      await approveArtifact(artifact.id);
      toast.success(`✓ אושר: ${artifact.title || meta.label}`);
      onChanged();
    } catch (e) { toast.error(`שגיאה באישור: ${e.message}`); }
    finally { setBusy(false); }
  }

  return (
    <div style={{
      border: `1px solid ${isSelected ? color.primary : color.borderSubtle}`,
      borderRadius: radius.md,
      padding: space(4), marginBottom: space(3),
      background: isSelected ? (color.primarySoftBg || "#eff6ff") : color.surfaceMuted,
      transition: transition.base,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: space(3), flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: space(3), flex: 1, minWidth: 220 }}>
          {selectable && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              style={{ width: 18, height: 18, cursor: "pointer", accentColor: color.primary, flexShrink: 0 }}
              aria-label="סמני תוצר לאישור באצווה"
            />
          )}
          <div style={{ fontSize: 32 }}>{meta.icon}</div>
          <div>
            <div style={{ ...type.bodyStrong, color: color.fgDefault }}>{artifact.title || meta.label}</div>
            <div style={{ ...type.small, color: color.fgMuted, marginTop: 2 }}>
              {meta.label} · הוכן ע"י {meta.producer}
            </div>
          </div>
        </div>
        <span style={pill(statusInfo.tone)}>{statusInfo.label}</span>
      </div>

      <div style={{
        marginTop: space(3), padding: space(3), background: color.surface,
        borderRadius: radius.md, border: `1px solid ${color.borderSubtle}`,
      }}>
        <Preview artifact={artifact} expanded={expanded} />
        <button onClick={() => setExpanded(e => !e)} style={{
          ...btn.ghost, marginTop: space(2), padding: 0, color: color.primary,
        }}>
          {expanded ? "הסתר פרטים ▲" : "הצג עוד פרטים ▼"}
        </button>
      </div>

      {artifact.status !== "approved" && artifact.status !== "revision_required" && (
        <div style={{ display: "flex", gap: space(2), marginTop: space(3), flexWrap: "wrap" }}>
          <button onClick={doApprove} disabled={busy} style={btn.success}>
            ✓ אשרי
          </button>
          <button onClick={() => setShowRevise(true)} disabled={busy} style={btn.danger}>
            ↩ שלחי לתיקון
          </button>
          <button onClick={() => setShowForward(true)} disabled={busy} style={btn.secondary}>
            ⏩ העברי הלאה
          </button>
        </div>
      )}

      {showRevise && (
        <ReviseModal
          artifact={artifact}
          onClose={() => setShowRevise(false)}
          onDone={() => { setShowRevise(false); onChanged(); }}
          toast={toast}
        />
      )}
      {showForward && (
        <ForwardModal
          artifact={artifact}
          onClose={() => setShowForward(false)}
          onDone={() => { setShowForward(false); onChanged(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function Preview({ artifact, expanded }) {
  const p = artifact.payload || {};
  const t = artifact.artifact_type;

  if (t === "ad_copy_meta" || t === "ad_copy_google" || t === "ad_copy_tiktok") {
    const headlines = p.headlines || [];
    const primary = p.primary_texts || [];
    return (
      <div style={{ ...type.bodySmall, color: color.fgDefault }}>
        {headlines.length > 0 && (
          <div style={{ marginBottom: space(2) }}>
            <strong>כותרות:</strong>
            <ul style={{ margin: `${space(1)} 0`, paddingInlineStart: space(5) }}>
              {headlines.slice(0, expanded ? undefined : 2).map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </div>
        )}
        {primary.length > 0 && (
          <div style={{ marginBottom: space(2) }}>
            <strong>טקסט ראשי:</strong>
            <div style={{ background: color.surfaceMuted, padding: space(2.5), borderRadius: radius.sm, marginTop: space(1) }}>
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

  if (t === "creative_concept") {
    return (
      <div style={{ ...type.bodySmall, color: color.fgDefault }}>
        <div><strong>קונספט:</strong> {p.concept_title || "—"}</div>
        <div><strong>טון:</strong> {p.tone || "—"}</div>
        {expanded && p.visual_directions && (
          <div style={{ marginTop: space(2) }}>
            <strong>כיווני ויזואל:</strong>
            <ul style={{ margin: `${space(1)} 0`, paddingInlineStart: space(5) }}>
              {p.visual_directions.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (t === "media_plan") {
    return (
      <div style={{ ...type.bodySmall, color: color.fgDefault }}>
        <div><strong>פלטפורמות:</strong> {(p.platforms || []).join(" · ") || "—"}</div>
        <div><strong>אופק תכנון:</strong> {p.horizon_days || 30} ימים</div>
        {p.methodology?.note && <div style={{ marginTop: space(1.5), ...type.small, color: color.fgMuted }}>{p.methodology.note}</div>}
      </div>
    );
  }

  if (t === "budget_recommendation") {
    return (
      <div style={{ ...type.bodySmall, color: color.fgDefault }}>
        <div><strong>סכום זמין:</strong> ₪{Number(p.total_available_ils || 0).toLocaleString("he-IL")}</div>
        {p.breakdown && (
          <div style={{ marginTop: space(1.5) }}>
            <strong>חלוקה:</strong>{" "}
            {Object.entries(p.breakdown).map(([k, v]) =>
              <span key={k} style={{ marginInlineEnd: space(3) }}>{k}: ₪{Number(v).toLocaleString("he-IL")}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (t === "market_research") {
    return (
      <div style={{ ...type.bodySmall, color: color.fgDefault }}>
        <div><strong>קטגוריה:</strong> {p.category || p.domain || "—"}</div>
        {p.audience_segments && (
          <div><strong>פלחי קהל:</strong> {(p.audience_segments || []).slice(0, expanded ? undefined : 2).join(" · ")}</div>
        )}
        {expanded && p.messaging_hooks && (
          <div style={{ marginTop: space(1.5) }}>
            <strong>וורי מסר:</strong>
            <ul style={{ margin: `${space(1)} 0`, paddingInlineStart: space(5) }}>{p.messaging_hooks.map((h, i) => <li key={i}>{h}</li>)}</ul>
          </div>
        )}
      </div>
    );
  }

  return <div style={{ ...type.bodySmall, color: color.fgMuted }}>{artifact.title || meta_label(t)}</div>;
}
const meta_label = t => (ARTIFACT_TYPES[t]?.label || t);

function ReviseModal({ artifact, onClose, onDone, toast }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!note.trim()) { toast.warning("יש להסביר מה צריך לתקן"); return; }
    setBusy(true);
    try {
      await requestArtifactRevision(artifact.id, { revision_note: note.trim() });
      toast.success("↩ נשלח חזרה לתיקון");
      onDone();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="↩ שליחה לתיקון" onClose={onClose}>
      <div style={{ ...type.bodySmall, color: color.fgMuted, marginBottom: space(2.5) }}>
        כתבי במדויק מה צריך לשנות. ההערה תועבר חזרה למחלקה שהכינה את התוצר.
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={4}
        placeholder="לדוגמה: הכותרת הראשונה חזקה, הטקסט השני יוצא ארוך — לקצר ב-30 תווים..."
        style={{ ...inputStyle, resize: "vertical", fontFamily }} />
      <div style={modalFooter}>
        <button onClick={onClose} style={btn.secondary}>ביטול</button>
        <button onClick={submit} disabled={busy} style={btn.primary}>
          {busy ? "שולחת..." : "↩ שלחי לתיקון"}
        </button>
      </div>
    </Modal>
  );
}

function ForwardModal({ artifact, onClose, onDone, toast }) {
  const [target, setTarget] = useState("launch");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await forwardArtifact(artifact.id, { target, note: note.trim() || null });
      toast.success("⏩ הועבר הלאה בהצלחה");
      onDone();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  const targets = [
    { id: "launch",          icon: "🚀", label: "לפרסום",                 hint: "התוצר מאושר ונשלח לפרסום בפלטפורמה" },
    { id: "school_director", icon: "👔", label: "למנכ\"ל בית הספר",       hint: "החלטה אסטרטגית שדורשת אישור נוסף" },
    { id: "next_stage",      icon: "➡", label: "לשלב הבא ב-workflow",     hint: "המשך טיפול במחלקה הבאה" },
  ];

  return (
    <Modal title="⏩ העברה הלאה" onClose={onClose}>
      <div style={{ ...type.bodySmall, color: color.fgMuted, marginBottom: space(2.5) }}>
        איפה את רוצה שהתוצר יגיע אחרי האישור שלך?
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: space(2), marginBottom: space(3) }}>
        {targets.map(t => (
          <div key={t.id} onClick={() => setTarget(t.id)} style={{
            padding: space(3), borderRadius: radius.md, cursor: "pointer",
            background: target === t.id ? color.primarySoftBg : color.surface,
            border: `2px solid ${target === t.id ? color.primary : color.borderDefault}`,
            display: "flex", alignItems: "center", gap: space(3),
            transition: transition.fast,
          }}>
            <span style={{ fontSize: 26 }}>{t.icon}</span>
            <div>
              <div style={{ ...type.bodyStrong, color: target === t.id ? color.primary : color.fgDefault }}>{t.label}</div>
              <div style={{ ...type.small, color: color.fgMuted, marginTop: 2 }}>{t.hint}</div>
            </div>
          </div>
        ))}
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
        placeholder="הערה (אופציונלי)"
        style={{ ...inputStyle, resize: "vertical", fontFamily }} />
      <div style={modalFooter}>
        <button onClick={onClose} style={btn.secondary}>ביטול</button>
        <button onClick={submit} disabled={busy} style={btn.primary}>
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
      display: "flex", alignItems: "center", justifyContent: "center", padding: space(4),
      direction: "rtl", animation: "campaign-overlay-in 180ms ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: color.surface, borderRadius: radius.lg, padding: space(5),
        maxWidth: 520, width: "100%", boxShadow: shadow.xl,
        animation: "campaign-modal-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}>
        <h3 style={{ ...type.h2, margin: `0 0 ${space(3)}` }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

const modalFooter = { display: "flex", gap: space(2.5), justifyContent: "flex-end", marginTop: space(3) };

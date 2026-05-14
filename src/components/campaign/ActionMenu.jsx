/**
 * ActionMenu — "+ פעולה" popover. The marketing manager initiates new actions
 * mid-campaign: request video, copy variant, budget reallocation, channel, etc.
 *
 * Plan §B.1 (top-row) and §B.2 (subitem, prefilledChannel).
 */
import React, { useState, useRef, useEffect } from "react";
import { color, radius, shadow, space, fontFamily, transition } from "./_tokens.js";
import { submitChangeRequest, scheduleMethodologySwitch, closeCampaign, deleteCampaignFolder } from "../../api.js";
import { useToast } from "./Toast.jsx";
import ActionMiniForm from "./ActionMiniForm.jsx";

// ─── Action definitions ──────────────────────────────────────────────────────

function buildActions(prefilledChannel) {
  const ch = prefilledChannel; // may be null (top-row) or a channel id (subitem)

  const all = [
    // ── GROUP 1: תוצרים חדשים
    {
      group: "תוצרים חדשים",
      id: "add_video", icon: "🎬", label: "בקשי וידאו",
      desc: "הוסיפי פורמט וידאו לערוץ ספציפי",
      fields: [
        { key: "channel", label: "ערוץ", type: "channel", required: true },
        { key: "notes",   label: "כיוון / הוראות", type: "textarea", placeholder: "לדוגמה: 15 שניות, טון נינוח, עם כתוביות" },
      ],
      canSubmit: v => !!v.channel,
      toPayload: (v, fid) => [fid, "change", "add_creative_format", { format: "video", channel: v.channel, notes: v.notes }],
    },
    {
      group: "תוצרים חדשים",
      id: "add_copy", icon: "✍", label: "בקשי קופי נוסף",
      desc: "בקשי וריאנט קופי חדש",
      fields: [
        { key: "channel", label: "ערוץ", type: "channel", required: true },
        { key: "angle",   label: "כיוון", type: "select", options: ["instructional", "emotional", "funny", "urgency", "social_proof", "other"] },
        { key: "notes",   label: "הוראות ספציפיות", type: "textarea", placeholder: "מה חשוב שיהיה בקופי?" },
      ],
      canSubmit: v => !!v.channel,
      toPayload: (v, fid) => [fid, "change", "add_copy_variant", { channel: v.channel, angle: v.angle, notes: v.notes }],
    },
    {
      group: "תוצרים חדשים",
      id: "add_creative", icon: "🎨", label: "בקשי וריאנט קריאייטיב",
      desc: "בקשי גרסה ויזואלית נוספת",
      fields: [
        { key: "channel",   label: "ערוץ", type: "channel", required: true },
        { key: "direction", label: "כיוון ויזואלי", type: "textarea", placeholder: "לדוגמה: רקע כהה, טון מקצועי, עם לוגו גדול" },
      ],
      canSubmit: v => !!v.channel,
      toPayload: (v, fid) => [fid, "change", "add_creative_variant", { channel: v.channel, direction: v.direction }],
    },
    {
      group: "תוצרים חדשים",
      id: "add_keywords", icon: "🔍", label: "הוסיפי ביטויי גוגל",
      desc: "בקשי מחקר ביטויים נוסף",
      fields: [
        { key: "count", label: "כמות ביטויים", type: "number", placeholder: "לדוגמה: 20" },
        { key: "theme", label: "נושא / זווית", type: "text", placeholder: "לדוגמה: ביטויי long-tail לקורסי ערב" },
        { key: "notes", label: "הוראות נוספות", type: "textarea" },
      ],
      canSubmit: v => true,
      toPayload: (v, fid) => [fid, "change", "add_keywords", { count: v.count, theme: v.theme, notes: v.notes }],
    },

    // ── GROUP 2: תקציב וערוצים
    {
      group: "תקציב וערוצים",
      id: "add_channel", icon: "🌐", label: "הוסיפי ערוץ חדש",
      desc: "הרחיבי את מיקס הערוצים",
      fields: [
        { key: "channel", label: "ערוץ", type: "channel", required: true },
        { key: "budget",  label: "תקציב התחלתי (₪)", type: "number", required: true },
        { key: "reason",  label: "מדוע עכשיו?", type: "textarea" },
      ],
      canSubmit: v => !!v.channel && !!v.budget,
      toPayload: (v, fid) => [fid, "change", "add_channel", { channel: v.channel, budget: v.budget, reason: v.reason }],
    },
    {
      group: "תקציב וערוצים",
      id: "reallocate_budget", icon: "💰", label: "שיני הקצאת תקציב",
      desc: "העבירי תקציב בין ערוצים",
      fields: [
        { key: "from_channel", label: "מ-ערוץ", type: "channel", required: true },
        { key: "to_channel",   label: "ל-ערוץ",  type: "channel", required: true },
        { key: "amount",       label: "סכום (₪)", type: "number", required: true },
        { key: "reason",       label: "נימוק", type: "textarea", required: true },
      ],
      canSubmit: v => !!v.from_channel && !!v.to_channel && !!v.amount && !!v.reason,
      toPayload: (v, fid) => [fid, "change", "reallocate_budget", { from_channel: v.from_channel, to_channel: v.to_channel, amount: v.amount, reason: v.reason }],
    },
    {
      group: "תקציב וערוצים",
      id: "pause_channel", icon: "⏸", label: "השהי ערוץ",
      desc: "עצרי ערוץ ספציפי באופן זמני",
      fields: [
        { key: "channel",       label: "ערוץ", type: "channel", required: true },
        { key: "duration_days", label: "ימי השהייה", type: "number", placeholder: "לדוגמה: 7" },
        { key: "reason",        label: "סיבה", type: "textarea" },
      ],
      canSubmit: v => !!v.channel,
      toPayload: (v, fid) => [fid, "change", "pause_channel", { channel: v.channel, duration_days: v.duration_days, reason: v.reason }],
    },

    // ── GROUP 3: פעולות מערכת
    {
      group: "פעולות מערכת",
      id: "methodology_switch", icon: "🔄", label: "שיני Methodology",
      desc: "עברי בין clicks ל-conversion או להפך",
      fields: [
        { key: "switch_to",   label: "מעבר ל-", type: "select", options: [{value:"conversion", label:"Conversion"},{value:"clicks",label:"Clicks"}], required: true },
        { key: "switch_date", label: "תאריך מעבר", type: "text", placeholder: "YYYY-MM-DD (ריק = עכשיו)" },
      ],
      canSubmit: v => !!v.switch_to,
      isMethodologySwitch: true,
    },
    {
      group: "פעולות מערכת",
      id: "close_campaign", icon: "🚫", label: "סגרי קמפיין",
      desc: "סגירה סופית. פעולה בלתי הפיכה.",
      fields: [
        { key: "name_confirm", label: "הקלידי את שם הקמפיין לאישור", type: "text", required: true, placeholder: "שם הקמפיין" },
        { key: "reason",       label: "סיבת סגירה", type: "textarea", required: true },
      ],
      canSubmit: (v, folder) => !!v.reason?.trim() && !!v.name_confirm?.trim(),
      isClose: true,
      danger: true,
    },
    {
      group: "פעולות מערכת",
      id: "delete_row", icon: "🗑", label: "מחיקת שורה",
      desc: "מחיקה מוחלטת מהמערכת.",
      fields: [
        { key: "name_confirm", label: "הקלידי את שם הקמפיין לאישור", type: "text", required: true, placeholder: "שם הקמפיין" },
      ],
      canSubmit: (v) => !!v.name_confirm?.trim(),
      isDelete: true,
      danger: true,
    },
  ];

  // If prefilledChannel (subitem), filter to channel-relevant actions only + prefill
  if (ch) {
    return all
      .filter(a => ["add_video", "add_copy", "add_creative", "pause_channel"].includes(a.id))
      .map(a => ({
        ...a,
        fields: a.fields.map(f => f.key === "channel" ? { ...f, defaultValue: ch } : f),
      }));
  }

  return all;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ActionMenu({ folder, prefilledChannel, onRefresh }) {
  const toast   = useToast();
  const btnRef  = useRef(null);
  const [open, setOpen]       = useState(false);
  const [pos,  setPos]        = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [busy, setBusy]       = useState(false);

  const actions = buildActions(prefilledChannel);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      const menu = document.getElementById("action-menu-popover");
      if (!btnRef.current?.contains(e.target) && !menu?.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function openMenu() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - 280, r.left - 140));
    setPos({ top: r.bottom + 4, left });
    setOpen(true);
  }

  async function handleSubmit(vals) {
    if (!activeAction || busy) return;
    setBusy(true);
    try {
      if (activeAction.isMethodologySwitch) {
        await scheduleMethodologySwitch(folder.id, {
          switch_to: vals.switch_to,
          switch_date: vals.switch_date || new Date().toISOString().split("T")[0],
          requested_by: "marketing_manager",
        });
        toast.success("🔄 שינוי Methodology תוזמן");
      } else if (activeAction.isDelete) {
        if ((vals.name_confirm || "").trim() !== (folder.course_name || "").trim()) {
          toast.error("שם הקמפיין אינו תואם — בדקי שוב");
          setBusy(false);
          return;
        }
        await deleteCampaignFolder(folder.id);
        toast.success("🗑 השורה נמחקה");
      } else if (activeAction.isClose) {
        if ((vals.name_confirm || "").trim() !== (folder.course_name || "").trim()) {
          toast.error("שם הקמפיין אינו תואם — בדקי שוב");
          setBusy(false);
          return;
        }
        await closeCampaign(folder.id, {
          requested_by: "marketing_manager",
          reason: vals.reason,
          campaign_name_confirmation: vals.name_confirm,
        });
        toast.success("🚫 הקמפיין נסגר");
      } else {
        const args = activeAction.toPayload(vals, folder.id);
        await submitChangeRequest(...args);
        toast.success(`${activeAction.icon} הבקשה התקבלה — מחלקה תטפל בה`);
      }
      setActiveAction(null);
      setOpen(false);
      onRefresh?.();
    } catch (e) {
      toast.error(`שגיאה: ${e.message}`);
    } finally { setBusy(false); }
  }

  // Group actions
  const groups = [...new Set(actions.map(a => a.group))];

  return (
    <>
      <button ref={btnRef} onClick={e => { e.stopPropagation(); openMenu(); }} style={{
        background: color.surfaceMuted, border: `1px solid ${color.borderDefault}`,
        borderRadius: radius.sm, padding: `${space(1.5)} ${space(2.5)}`,
        fontSize: 12, fontWeight: 700, cursor: "pointer",
        color: color.fgMuted, fontFamily,
        display: "inline-flex", alignItems: "center", gap: space(1),
        transition: transition.fast,
        whiteSpace: "nowrap",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#e5e7eb"}
      onMouseLeave={e => e.currentTarget.style.background = color.surfaceMuted}
      >
        + פעולה
      </button>

      {open && pos && (
        <div id="action-menu-popover" style={{
          position: "fixed", top: pos.top, left: pos.left,
          background: color.surface, border: `1px solid ${color.borderDefault}`,
          borderRadius: radius.md, boxShadow: shadow.xl,
          zIndex: 9999, width: 280, padding: space(2),
        }} onClick={e => e.stopPropagation()}>
          {groups.map(g => (
            <React.Fragment key={g}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: color.fgSubtle,
                textTransform: "uppercase", letterSpacing: 0.5,
                padding: `${space(1.5)} ${space(2)} ${space(0.5)}`, fontFamily,
              }}>{g}</div>
              {actions.filter(a => a.group === g).map(a => (
                <div key={a.id}
                  onClick={() => { setOpen(false); setActiveAction(a); }}
                  style={{
                    display: "flex", alignItems: "center", gap: space(2),
                    padding: `${space(2)} ${space(2.5)}`, cursor: "pointer",
                    borderRadius: 4, fontSize: 13, fontFamily,
                    color: a.danger ? "#b91c1c" : color.fgDefault,
                    transition: transition.fast,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = a.danger ? "#fee2e2" : "#f3f4f6"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ width: 20, textAlign: "center" }}>{a.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.label}</div>
                    {a.desc && <div style={{ fontSize: 11, color: color.fgSubtle }}>{a.desc}</div>}
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}

      {activeAction && (
        <ActionMiniForm
          action={activeAction}
          folderId={folder.id}
          onSubmit={handleSubmit}
          onClose={() => setActiveAction(null)}
          busy={busy}
        />
      )}
    </>
  );
}

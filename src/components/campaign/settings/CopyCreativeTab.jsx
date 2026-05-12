/**
 * CopyCreativeTab.jsx — Settings · קופי + קריאייטיב.
 *
 * Payload keys (media_settings.payload):
 *   • copy_guidelines      — brand_voice, forbidden_words[], required_disclaimers[],
 *                            allowed_ctas[], max_lengths_per_format{}
 *   • creative_guidelines  — primary_colors[], logo_placement, visual_dos[], visual_donts[]
 */
import React, { useEffect, useState } from "react";
import { getGeneralSettings, updateGeneralSettings } from "../../../api.js";
import { color, radius, space, type, fontFamily } from "../_tokens.js";
import { useToast } from "../Toast.jsx";
import {
  card, Section, Row, FieldBox, TagList, Chip, SaveBar,
  ErrorBanner, LoadingBlock, input, select, textarea, fieldHint, fieldLabel,
  readPayload, primaryBtn,
} from "./_shared.jsx";

const VOICE_OPTIONS = [
  { id: "professional_warm", label: "מקצועי + חמים", hint: "נטרלי, אמין, אבל אנושי" },
  { id: "energetic",         label: "אנרגטי",         hint: "מוטיבציה, חיוב, רגש" },
  { id: "expert",            label: "מומחה",          hint: "מבוסס נתונים, אובייקטיבי" },
  { id: "friendly",          label: "חברי",           hint: "סלנג קל, קרוב לקהל היעד" },
];

const DEFAULT_CTAS = [
  "להרשמה",
  "לפרטים נוספים",
  "שריינו מקום",
  "הצטרפו עכשיו",
  "לימוד נוסף",
];

const MAX_LENGTH_FORMATS = [
  { id: "meta_feed",     label: "Meta Feed" },
  { id: "meta_story",    label: "Meta Story" },
  { id: "meta_reel",     label: "Meta Reel" },
  { id: "google_banner", label: "Google Banner" },
  { id: "google_youtube",label: "YouTube" },
  { id: "tiktok_video",  label: "TikTok Video" },
];

export default function CopyCreativeTab() {
  const toast = useToast();
  const [loaded, setLoaded] = useState(null);
  const [draft, setDraft]   = useState({
    copy_guidelines: {
      brand_voice: "professional_warm",
      tone_notes: "",
      forbidden_words: [],
      required_disclaimers: [],
      allowed_ctas: DEFAULT_CTAS,
      max_lengths_per_format: {},
    },
    creative_guidelines: {
      primary_colors: [],
      secondary_colors: [],
      logo_placement: "top_right",
      visual_dos: [],
      visual_donts: [],
      brand_notes: "",
    },
  });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const gs = await getGeneralSettings();
      const p = gs.payload || {};
      setLoaded(gs);
      setDraft({
        copy_guidelines: {
          brand_voice:            readPayload(p, "copy_guidelines.brand_voice", "professional_warm"),
          tone_notes:             readPayload(p, "copy_guidelines.tone_notes", ""),
          forbidden_words:        readPayload(p, "copy_guidelines.forbidden_words", []),
          required_disclaimers:   readPayload(p, "copy_guidelines.required_disclaimers", []),
          allowed_ctas:           readPayload(p, "copy_guidelines.allowed_ctas", DEFAULT_CTAS),
          max_lengths_per_format: readPayload(p, "copy_guidelines.max_lengths_per_format", {}),
        },
        creative_guidelines: {
          primary_colors:   readPayload(p, "creative_guidelines.primary_colors", []),
          secondary_colors: readPayload(p, "creative_guidelines.secondary_colors", []),
          logo_placement:   readPayload(p, "creative_guidelines.logo_placement", "top_right"),
          visual_dos:       readPayload(p, "creative_guidelines.visual_dos", []),
          visual_donts:     readPayload(p, "creative_guidelines.visual_donts", []),
          brand_notes:      readPayload(p, "creative_guidelines.brand_notes", ""),
        },
      });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function patchCopy(key, val)     { setDraft(prev => ({ ...prev, copy_guidelines:     { ...prev.copy_guidelines,     [key]: val } })); }
  function patchCreative(key, val) { setDraft(prev => ({ ...prev, creative_guidelines: { ...prev.creative_guidelines, [key]: val } })); }

  function patchMaxLength(format, val) {
    setDraft(prev => ({
      ...prev,
      copy_guidelines: {
        ...prev.copy_guidelines,
        max_lengths_per_format: {
          ...prev.copy_guidelines.max_lengths_per_format,
          [format]: val === "" ? null : Number(val),
        },
      },
    }));
  }

  async function save() {
    setBusy(true);
    try {
      const current = loaded || (await getGeneralSettings());
      const payload = {
        ...(current.payload || {}),
        copy_guidelines:     draft.copy_guidelines,
        creative_guidelines: draft.creative_guidelines,
      };
      await updateGeneralSettings({ payload, updated_by: "marketing_manager" });
      toast.success("✏ הנחיות קופי וקריאייטיב נשמרו");
      await load();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusy(false); }
  }

  if (loading) return <div style={card}><LoadingBlock /></div>;

  return (
    <div>
      <div style={card}>
        <ErrorBanner error={error} />
        <h4 style={{ ...type.h2, margin: `0 0 ${space(3)}`, color: color.primary }}>✏ הנחיות קופי</h4>

        <Section title="🎙 טון ושפה"
                 hint="הסגנון שכל הקופי שמופק יציית לו. ה-copy_generation_agent יקבל את זה כ-system prompt.">
          <Row>
            <FieldBox label="טון מותג">
              <select value={draft.copy_guidelines.brand_voice}
                      onChange={e => patchCopy("brand_voice", e.target.value)}
                      style={select}>
                {VOICE_OPTIONS.map(v => <option key={v.id} value={v.id}>{v.label} — {v.hint}</option>)}
              </select>
            </FieldBox>
          </Row>
          <div style={{ marginTop: space(3) }}>
            <FieldBox label="הערות סגנון חופשיות"
                      hint="כל הוראה מיוחדת על הטון, מבנה משפטים, או טריקים שאת רוצה שהמערכת תיישם.">
              <textarea value={draft.copy_guidelines.tone_notes}
                        onChange={e => patchCopy("tone_notes", e.target.value)}
                        placeholder="לדוגמה: שימי דגש על תוצאות מדידות. הימנעי מסופרלטיבים. תמיד התחילי בשאלה."
                        rows={3}
                        style={textarea} />
            </FieldBox>
          </div>
        </Section>

        <Section title="🚫 מילים אסורות"
                 hint="מילים שהקופי לא יכיל. שימושי לטרמינולוגיה משפטית, מילים שעלולות להפעיל אישור AI, או מותגים מתחרים.">
          <TagList
            items={draft.copy_guidelines.forbidden_words}
            onChange={v => patchCopy("forbidden_words", v)}
            placeholder='הקלידי מילה ולחצי Enter (לדוגמה: "מהפכני")'
            tone="danger"
          />
        </Section>

        <Section title="📋 Disclaimers חובה"
                 hint="טקסטים שחייבים להופיע בכל מודעה (לדוגמה: דרישות אסדרה, הסתייגות מתוצאות).">
          <TagList
            items={draft.copy_guidelines.required_disclaimers}
            onChange={v => patchCopy("required_disclaimers", v)}
            placeholder='הוסיפי disclaimer (לדוגמה: "* תוצאות אישיות, ללא התחייבות")'
            tone="warning"
          />
        </Section>

        <Section title="🎯 CTAs מורשים"
                 hint="הקופי יבחר רק מהרשימה. ככל שיותר אפשרויות — יותר וריאציות לבדיקה.">
          <TagList
            items={draft.copy_guidelines.allowed_ctas}
            onChange={v => patchCopy("allowed_ctas", v)}
            placeholder='הוסיפי CTA חדש (לדוגמה: "הרשמה עכשיו")'
            tone="success"
          />
        </Section>

        <Section title="📏 אורך מקסימלי לפי פורמט (תווים)"
                 hint="גג עליון לקופי לכל פורמט. ערך ריק = משתמש בערך מהפלטפורמה.">
          <Row minCol={140}>
            {MAX_LENGTH_FORMATS.map(f => (
              <FieldBox key={f.id} label={f.label}>
                <input type="number" min="0" placeholder="ברירת מחדל"
                       value={draft.copy_guidelines.max_lengths_per_format[f.id] ?? ""}
                       onChange={e => patchMaxLength(f.id, e.target.value)}
                       style={input} />
              </FieldBox>
            ))}
          </Row>
        </Section>
      </div>

      <div style={card}>
        <h4 style={{ ...type.h2, margin: `0 0 ${space(3)}`, color: color.primary }}>🎨 הנחיות קריאייטיב</h4>

        <Section title="🎨 פלטת צבעים"
                 hint="צבעי המותג. הזיני קודי HEX (כמו #1e3a5f) ולחצי Enter.">
          <div style={{ marginBottom: space(3) }}>
            <label style={fieldLabel}>צבעים ראשיים</label>
            <ColorTagList items={draft.creative_guidelines.primary_colors}
                          onChange={v => patchCreative("primary_colors", v)} />
          </div>
          <div>
            <label style={fieldLabel}>צבעים משניים</label>
            <ColorTagList items={draft.creative_guidelines.secondary_colors}
                          onChange={v => patchCreative("secondary_colors", v)} />
          </div>
        </Section>

        <Section title="🏷 מיקום לוגו">
          <Row>
            <FieldBox label="היכן הלוגו מופיע בכל מודעה?">
              <select value={draft.creative_guidelines.logo_placement}
                      onChange={e => patchCreative("logo_placement", e.target.value)}
                      style={select}>
                <option value="top_right">למעלה-ימין</option>
                <option value="top_left">למעלה-שמאל</option>
                <option value="bottom_right">למטה-ימין</option>
                <option value="bottom_left">למטה-שמאל</option>
                <option value="center">מרכז</option>
                <option value="no_logo">בלי לוגו</option>
              </select>
            </FieldBox>
          </Row>
        </Section>

        <Section title="✅ מותר ויזואלית">
          <TagList
            items={draft.creative_guidelines.visual_dos}
            onChange={v => patchCreative("visual_dos", v)}
            placeholder='לדוגמה: "תמונות אותנטיות של סטודנטים"'
            tone="success"
          />
        </Section>

        <Section title="❌ אסור ויזואלית">
          <TagList
            items={draft.creative_guidelines.visual_donts}
            onChange={v => patchCreative("visual_donts", v)}
            placeholder='לדוגמה: "סטוק photos עם חיוכים מזויפים"'
            tone="danger"
          />
        </Section>

        <Section title="📝 הערות חופשיות"
                 hint="כל מידע שיעזור לסוכן הקריאייטיב — referenced material, מנדטים אסדרתיים, וכו'.">
          <textarea value={draft.creative_guidelines.brand_notes}
                    onChange={e => patchCreative("brand_notes", e.target.value)}
                    placeholder="לדוגמה: הפונט הראשי הוא Heebo Bold. תמיד להשתמש בפילטר חם. הימנעי משחור מלא."
                    rows={4}
                    style={textarea} />
        </Section>

        <SaveBar onSave={save} busy={busy} dirty={true} />
      </div>
    </div>
  );
}

function ColorTagList({ items, onChange }) {
  const [val, setVal] = useState("");
  const add = () => {
    const v = val.trim();
    if (!v) return;
    const hex = v.startsWith("#") ? v : `#${v}`;
    if (!/^#[0-9A-Fa-f]{3,8}$/.test(hex)) return;
    if (items.includes(hex)) { setVal(""); return; }
    onChange([...items, hex]);
    setVal("");
  };
  return (
    <div>
      <div style={{ display: "flex", gap: space(2), marginBottom: space(2) }}>
        <input value={val} onChange={e => setVal(e.target.value)}
               onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())}
               placeholder="#1e3a5f"
               style={{ ...input, flex: 1 }} />
        <button onClick={add} style={primaryBtn}>הוסיפי</button>
      </div>
      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: space(2) }}>
          {items.map((hex, i) => (
            <div key={i} style={{
              display: "inline-flex", alignItems: "center", gap: space(1.5),
              padding: `${space(1)} ${space(2)}`, borderRadius: radius.pill,
              border: `1px solid ${color.borderDefault}`, background: "#fff",
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: "50%", background: hex,
                border: `1px solid ${color.borderDefault}`,
              }} />
              <span style={{ ...type.small, fontFamily: "monospace", color: color.fgDefault }}>{hex}</span>
              <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={{
                background: "none", border: "none", padding: 0, color: color.fgMuted,
                cursor: "pointer", fontSize: 16, lineHeight: 1,
              }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

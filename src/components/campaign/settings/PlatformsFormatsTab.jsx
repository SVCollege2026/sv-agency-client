/**
 * PlatformsFormatsTab.jsx — Settings · פלטפורמות + עורך פורמטים.
 *
 * Existing on/off toggle per platform + new format editor.
 * Backing: `media_platform_settings` table. Dedicated `formats` JSONB column.
 * Format shape: { [format_key]: { aspect_ratio, max_headline_chars, max_primary_chars, max_headlines, max_primary_texts, image_min_px, video_max_seconds, notes } }.
 */
import React, { useEffect, useState } from "react";
import { listPlatformSettings, updatePlatformSettings } from "../../../api.js";
import { color, radius, space, type, fontFamily } from "../_tokens.js";
import { useToast } from "../Toast.jsx";
import {
  card, Section, Row, FieldBox, Toggle, SaveBar, ErrorBanner, LoadingBlock,
  input, select, fieldLabel, fieldHint, primaryBtn, ghostBtn, dangerBtn,
} from "./_shared.jsx";

const PLATFORM_META = {
  meta:   { label: "📘 Meta (Facebook + Instagram)", defaultFormats: ["feed", "story", "reel", "explore"] },
  google: { label: "🔍 Google Ads",                  defaultFormats: ["banner", "display", "youtube"] },
  tiktok: { label: "🎵 TikTok Ads",                  defaultFormats: ["video", "static"] },
};

const FORMAT_FIELDS = [
  { key: "aspect_ratio",      label: "יחס גובה-רוחב",       hint: 'לדוגמה: "1:1", "9:16", "16:9"',  type: "text" },
  { key: "max_headline_chars", label: "כותרת — תווים מקס",   hint: "כמה תווים מותרים בכותרת ראשית",   type: "number" },
  { key: "max_primary_chars",  label: "טקסט ראשי — תווים מקס", hint: "טקסט ה-Body של המודעה",          type: "number" },
  { key: "max_headlines",      label: "מספר כותרות",          hint: "כמה וריאציות כותרת ניתן להעלות", type: "number" },
  { key: "max_primary_texts",  label: "מספר טקסטים ראשיים",   hint: "כמה וריאציות body",              type: "number" },
  { key: "image_min_px",       label: "תמונה — מינ' פיקסלים",   hint: 'לדוגמה: "1080×1080"',          type: "text" },
  { key: "video_max_seconds",  label: "וידאו — מקס שניות",     hint: "אורך מקסימלי לסרטון",            type: "number" },
];

export default function PlatformsFormatsTab() {
  const toast = useToast();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [expanded, setExpanded] = useState(null);

  async function load() {
    setLoading(true); setError(null);
    try { setRows(await listPlatformSettings({ activeOnly: false })); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function toggleActive(platform, active) {
    setBusyId(platform);
    try {
      const row = rows.find(r => r.platform === platform);
      await updatePlatformSettings(platform, {
        payload:  row?.payload || {},
        formats:  row?.formats || {},
        is_active: active,
        updated_by: "marketing_manager",
      });
      toast.success(active ? "פלטפורמה הופעלה" : "פלטפורמה הושבתה");
      await load();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusyId(null); }
  }

  async function saveFormats(platform, newFormats) {
    setBusyId(platform);
    try {
      const row = rows.find(r => r.platform === platform);
      await updatePlatformSettings(platform, {
        payload:   row?.payload || {},
        formats:   newFormats,
        is_active: row?.is_active ?? true,
        updated_by: "marketing_manager",
      });
      toast.success("📐 פורמטים נשמרו");
      await load();
    } catch (e) { toast.error(`שגיאה: ${e.message}`); }
    finally { setBusyId(null); }
  }

  if (loading) return <div style={card}><LoadingBlock /></div>;

  return (
    <div style={card}>
      <ErrorBanner error={error} />
      <h4 style={{ ...type.h3, margin: `0 0 ${space(1)}`, color: color.primary }}>📱 פלטפורמות מדיה</h4>
      <div style={fieldHint}>הפעילי / השביתי פלטפורמות. הקליקי על "ערכי פורמטים" כדי לערוך מגבלות (תווים, תמונה, וידאו) לכל פורמט.</div>

      <div style={{ marginTop: space(4), display: "flex", flexDirection: "column", gap: space(2) }}>
        {rows.map(r => {
          const meta = PLATFORM_META[r.platform] || { label: r.platform };
          const isExpanded = expanded === r.platform;
          const formatList = Object.keys(r.formats || {});
          return (
            <div key={r.platform} style={{
              border: `1px solid ${color.borderDefault}`, borderRadius: radius.md,
              background: r.is_active ? "#f0fdf4" : "#f9fafb",
              overflow: "hidden",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: `${space(3)} ${space(3.5)}`, gap: space(3), flexWrap: "wrap",
              }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ ...type.bodyStrong, color: color.fgDefault }}>{meta.label}</div>
                  <div style={{ ...type.small, color: color.fgMuted, marginTop: 2 }}>
                    פורמטים: {formatList.length > 0 ? formatList.join(" · ") : "טרם הוגדרו"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: space(2) }}>
                  <button onClick={() => setExpanded(isExpanded ? null : r.platform)} style={ghostBtn}>
                    {isExpanded ? "▲ סגור" : "📐 ערכי פורמטים"}
                  </button>
                  <Toggle checked={!!r.is_active} disabled={busyId === r.platform}
                          onChange={v => toggleActive(r.platform, v)} />
                </div>
              </div>

              {isExpanded && (
                <FormatEditor
                  platform={r.platform}
                  formats={r.formats || {}}
                  defaultFormats={meta.defaultFormats || []}
                  busy={busyId === r.platform}
                  onSave={f => saveFormats(r.platform, f)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormatEditor({ platform, formats, defaultFormats, busy, onSave }) {
  const [draft, setDraft] = useState(formats);
  const [newFormatName, setNewFormatName] = useState("");

  function addFormat(name) {
    const k = name.trim().toLowerCase().replace(/\s+/g, "_");
    if (!k || draft[k]) return;
    setDraft(prev => ({ ...prev, [k]: {} }));
    setNewFormatName("");
  }

  function patchFormat(formatKey, field, val) {
    setDraft(prev => ({
      ...prev,
      [formatKey]: { ...(prev[formatKey] || {}), [field]: val === "" ? null : (typeof val === "number" ? val : val) },
    }));
  }

  function removeFormat(formatKey) {
    if (!confirm(`להסיר את הפורמט "${formatKey}"?`)) return;
    setDraft(prev => {
      const next = { ...prev };
      delete next[formatKey];
      return next;
    });
  }

  const allKeys = Array.from(new Set([...defaultFormats, ...Object.keys(draft)]));

  return (
    <div style={{
      padding: space(4), background: "#fff",
      borderTop: `1px solid ${color.borderDefault}`,
    }}>
      <div style={{ display: "flex", gap: space(2), marginBottom: space(3), flexWrap: "wrap" }}>
        <input value={newFormatName} onChange={e => setNewFormatName(e.target.value)}
               onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addFormat(newFormatName))}
               placeholder='שם פורמט חדש (לדוגמה: "carousel")'
               style={{ ...input, flex: 1, minWidth: 200 }} />
        <button onClick={() => addFormat(newFormatName)} disabled={!newFormatName.trim()} style={{
          ...primaryBtn, opacity: newFormatName.trim() ? 1 : 0.5,
        }}>➕ הוסיפי פורמט</button>
      </div>

      {allKeys.length === 0 && (
        <div style={{ padding: space(4), background: "#f9fafb", borderRadius: radius.md, ...type.bodySmall, color: color.fgMuted, textAlign: "center" }}>
          אין פורמטים מוגדרים. הוסיפי אחד למעלה כדי להתחיל.
        </div>
      )}

      {allKeys.map(k => {
        const f = draft[k] || {};
        return (
          <div key={k} style={{
            border: `1px solid ${color.borderSubtle}`, borderRadius: radius.md,
            padding: space(3), marginBottom: space(3),
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: space(3) }}>
              <h5 style={{ ...type.bodyStrong, margin: 0 }}>📄 {k}</h5>
              <button onClick={() => removeFormat(k)} style={{ ...dangerBtn, padding: `${space(1)} ${space(2)}`, fontSize: 12 }}>
                🗑 הסר
              </button>
            </div>
            <Row minCol={180}>
              {FORMAT_FIELDS.map(field => (
                <FieldBox key={field.key} label={field.label} hint={field.hint}>
                  <input
                    type={field.type}
                    value={f[field.key] ?? ""}
                    onChange={e => patchFormat(k, field.key,
                      field.type === "number"
                        ? (e.target.value === "" ? "" : Number(e.target.value))
                        : e.target.value)}
                    style={input}
                    placeholder={field.type === "number" ? "0" : ""}
                  />
                </FieldBox>
              ))}
              <FieldBox label="הערות חופשי" hint="הנחיות נוספות שיופיעו ב-brief">
                <input value={f.notes ?? ""} onChange={e => patchFormat(k, "notes", e.target.value)} style={input}
                       placeholder='לדוגמה: "להימנע מתמונות עם טקסט מעבר ל-20%"' />
              </FieldBox>
            </Row>
          </div>
        );
      })}

      {Object.keys(draft).length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => onSave(draft)} disabled={busy} style={{
            ...primaryBtn, opacity: busy ? 0.5 : 1, cursor: busy ? "not-allowed" : "pointer",
          }}>
            {busy ? "שומר..." : "💾 שמירת פורמטים"}
          </button>
        </div>
      )}
    </div>
  );
}

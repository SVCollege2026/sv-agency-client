/**
 * TakeoverReadiness.jsx — חבילת-המוכנות פר-קורס למסך-ההשתלטות (§7).
 *
 * התנאי של נירית: היא מאשרת השתלטות **רק אחרי שהיא רואה בקורס את הכל** —
 * תקציב + קהלים✓ + קראייטיב + עיצוב + טופס + צילומי-מסך. הרכיב מציג את כל הראיות
 * במקום-אחד, עם דגלי-ה-QA שהמכונה כבר סימנה, ואם שער-הצילומים חוסם — אזהרה ברורה.
 *
 * תצוגה בלבד. הנתונים מ-GET /api/media/takeover/course-readiness (אגרגציה קריאה-בלבד).
 */
import React from "react";
import { apiAssetUrl } from "../api.js";
import { displayableAssetUrl } from "../lib.js";

const fmtIls = (n) =>
  (n != null && !isNaN(Number(n))) ? `₪${Math.round(Number(n)).toLocaleString()}` : "—";

/** image_url (Drive view / נתיב-API יחסי) → src מוטמע ב-<img>. */
function imgSrc(url) {
  if (!url) return null;
  return apiAssetUrl(displayableAssetUrl(url));
}

function Check({ ok, label, warn }) {
  const cls = ok ? "mi-chip-success" : (warn ? "mi-chip-warning" : "");
  return (
    <span className={`mi-chip ${cls}`} style={{ whiteSpace: "nowrap" }}>
      {ok ? "✓" : "•"} {label}
    </span>
  );
}

function VerdictBadge({ verdict }) {
  const map = {
    clean: ["mi-chip-success", "נבדק ונקי ✓"],
    flagged: ["mi-chip-warning", "⚠ דורש בדיקה"],
    unchecked: ["", "טרם נבדק אוטומטית"],
  };
  const [cls, he] = map[verdict] || ["", verdict || "—"];
  return <span className={`mi-chip ${cls}`}>{he}</span>;
}

function ImgCard({ url, caption, verdict, flags }) {
  const src = imgSrc(url);
  return (
    <figure style={{ margin: 0, border: "1px solid var(--mi-border)", borderRadius: 8,
                     overflow: "hidden", inlineSize: 220, background: "var(--mi-soft, #f6f7f9)" }}>
      {src ? (
        <img src={src} alt={caption || ""} loading="lazy"
             style={{ inlineSize: "100%", blockSize: 160, objectFit: "contain",
                      background: "#fff" }} />
      ) : (
        <div style={{ blockSize: 160, display: "flex", alignItems: "center",
                      justifyContent: "center", color: "var(--mi-ink-soft, #888)" }}>
          🖼 אין תצוגה
        </div>
      )}
      <figcaption style={{ padding: "6px 8px" }}>
        {caption && <div className="mi-meta" style={{ marginBlockEnd: 4 }}>{caption}</div>}
        {verdict && <VerdictBadge verdict={verdict} />}
        {(flags || []).length > 0 && (
          <ul style={{ margin: "6px 0 0", paddingInlineStart: 16, color: "var(--mi-warning, #9a6700)" }}>
            {flags.map((f, i) => <li key={i} className="mi-meta">{f}</li>)}
          </ul>
        )}
      </figcaption>
    </figure>
  );
}

// ─── החלטות-מדיה להשתלטות (ABO ad-cut) + נימוק ───────────────────────────────
const _RULE_HE = {
  rule_a_zero_lead_waste: "כלל A · בזבזן — 0 לידים על פני החלון (מטא + פיירברי בקונצנזוס)",
  rule_b_high_cpl_quality: "כלל B · CPL גבוה ואיכות נמוכה (לידים בשלים, 0 איכות/רישום)",
};
const _boLevel = (lvl) => (lvl === "ad" ? "ABO" : lvl === "campaign" ? "CBO" : (lvl || "—"));
function _evidenceText(ev) {
  if (!ev || typeof ev !== "object") return null;
  return Object.entries(ev)
    .map(([k, v]) => `${k}: ${typeof v === "number" ? Math.round(v).toLocaleString() : v}`)
    .join("  ·  ");
}

function AdCutCard({ item, kind }) {
  const isStop = kind === "stop";
  return (
    <div style={{ border: "1px solid var(--mi-border)", borderRadius: 8, padding: "10px 12px",
                  marginBlockEnd: 8, background: "var(--mi-soft, #f6f7f9)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBlockEnd: 4 }}>
        <span className={`mi-chip ${isStop ? "mi-chip-warning" : "mi-chip-success"}`}>
          {isStop ? "⏹ לעצור" : "➕ להוסיף קראייטיב"}
        </span>
        <span className="mi-chip">{_boLevel(item.budget_owner_level)}</span>
        <strong className="mi-body">{item.ad_name || item.campaign_name || "מודעה"}</strong>
      </div>
      {item.ad_name && item.campaign_name && (
        <div className="mi-meta">קמפיין: {item.campaign_name}</div>
      )}
      {item.rule && <div className="mi-meta">{_RULE_HE[item.rule] || item.rule}</div>}
      {_evidenceText(item.evidence) && (
        <div className="mi-meta mi-ltr" style={{ marginBlockStart: 2 }}>{_evidenceText(item.evidence)}</div>
      )}
      {item.explanation && (
        <div className="mi-body" style={{ marginBlockStart: 6, whiteSpace: "pre-wrap" }}>{item.explanation}</div>
      )}
      {item.expected_impact && (
        <div className="mi-meta" style={{ marginBlockStart: 4 }}>צפי: {item.expected_impact}</div>
      )}
    </div>
  );
}

function AdCutDecisions({ data }) {
  const stop = data?.stop_ads || [];
  const add = data?.add_creative || [];
  return (
    <div style={{ marginBlockEnd: 12 }}>
      <h3 className="mi-h2" style={{ fontSize: 15, marginBlockEnd: 6 }}>
        החלטות-מדיה להשתלטות{" "}
        <span className="mi-meta" style={{ fontWeight: 400 }}>— אילו מודעות לעצור ולמה (ממתין לאישורך)</span>
      </h3>
      {!data?.has_decisions ? (
        <p className="mi-meta">
          טרם חושבו החלטות-עצירה לקורס הזה — המערכת לא מצאה מודעות-בזבזניות בחלון הנוכחי, או שהסריקה
          עוד לא רצה. ריק כאן = אין מה לעצור כרגע, לא תקלה.
        </p>
      ) : (
        <>
          {stop.length > 0 && (
            <>
              <div className="mi-meta" style={{ marginBlockEnd: 4 }}>לעצור — בזבוז ({stop.length})</div>
              {stop.map((it) => <AdCutCard key={it.id} item={it} kind="stop" />)}
            </>
          )}
          {add.length > 0 && (
            <>
              <div className="mi-meta" style={{ marginBlockEnd: 4, marginBlockStart: stop.length ? 8 : 0 }}>
                CBO — להוסיף קראייטיב, לא לעצור ({add.length})
              </div>
              {add.map((it) => <AdCutCard key={it.id} item={it} kind="add" />)}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function TakeoverReadiness({ readiness, onGenerateScreenshots, shotBusy }) {
  if (!readiness) return null;
  const { audiences, creative, screenshot_gate: gate, readiness: r, ad_cut_decisions: adCuts } = readiness;
  const checklist = r?.checklist || {};

  return (
    <section className="mi-card" style={{ padding: 16, marginBlockEnd: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                    marginBlockEnd: 10 }}>
        <h2 className="mi-h2" style={{ margin: 0 }}>מוכנות להשתלטות</h2>
        <span className="mi-meta">כל מה שצריך לראות לפני אישור — תקציב · קהלים · קראייטיב · טופס · צילומי-מסך</span>
      </div>

      {/* תקציר-מוכנות: שורת ✓ */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBlockEnd: 12 }}>
        <Check ok={checklist.budget_recommended} label="תקציב" warn />
        <Check ok={checklist.audiences_ready} label="קהלים" warn />
        <Check ok={checklist.creative_ready} label="קראייטיב + עיצוב" warn />
        <Check ok={checklist.form_present} label="טופס" warn />
        <Check ok={checklist.screenshots_clean} label="צילומי-מסך" warn />
      </div>

      {/* חסימת-עלייה: שער-הצילומים סימן חשד מאומת */}
      {r?.go_live_blocked && (
        <div role="alert" style={{ background: "var(--mi-warning-bg, #fff4e0)",
             color: "var(--mi-warning, #9a6700)", borderRadius: 8, padding: "10px 14px",
             marginBlockEnd: 12 }}>
          <strong>⚠ הקמפיין חסום לעלייה־לאוויר עד תיקון הקראייטיב.</strong>
          <ul style={{ margin: "6px 0 0", paddingInlineStart: 18 }}>
            {(r.blocking_flags || []).map((f, i) => <li key={i}>{f}</li>)}
          </ul>
          <div className="mi-meta" style={{ marginBlockStart: 6 }}>
            המכונה סימנה חשד ויזואלי. אחרי תיקון הקראייטיב ורענון הצילומים — החסימה תוסר אוטומטית.
          </div>
        </div>
      )}

      {/* החלטות-מדיה (ABO ad-cut) + נימוק — ה'שכל' שנירית ביקשה לראות פר-החלטה */}
      <AdCutDecisions data={adCuts} />

      {/* קהלים ✓ */}
      {audiences && (
        <div style={{ marginBlockEnd: 12 }}>
          <h3 className="mi-h2" style={{ fontSize: 15, marginBlockEnd: 6 }}>
            קהלים{" "}
            <Check ok={audiences.state === "ready"} warn
                   label={audiences.state === "ready" ? "מוכנים" :
                          (audiences.state === "errors" ? "שגיאות בסנכרון" : "טרם הוגדרו")} />
          </h3>
          <p className="mi-meta">{audiences.note}</p>
          {audiences.last_sync && (
            <p className="mi-meta mi-ltr">
              סנכרון אחרון: {audiences.last_sync.synced_at?.slice(0, 10)} ·
              {" "}{Number(audiences.recent_records || 0).toLocaleString()} רשומות ·
              {" "}{audiences.recent_errors || 0} שגיאות
            </p>
          )}
          {(audiences.course_matches || []).length > 0 && (
            <ul style={{ margin: "4px 0 0", paddingInlineStart: 16 }}>
              {audiences.course_matches.map((m, i) => (
                <li key={i} className="mi-meta">
                  {m.audience_name} — {Number(m.records_uploaded || 0).toLocaleString()} רשומות
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* קראייטיב — קופי + עיצוב + טופס */}
      {creative && (creative.has_copy || creative.has_design) && (
        <div style={{ marginBlockEnd: 12 }}>
          <h3 className="mi-h2" style={{ fontSize: 15, marginBlockEnd: 6 }}>קראייטיב</h3>
          {(creative.copy || []).map((c) => (
            <div key={c.id} style={{ marginBlockEnd: 8, padding: "8px 10px",
                 background: "var(--mi-soft, #f6f7f9)", borderRadius: 8 }}>
              <div className="mi-meta" style={{ marginBlockEnd: 4 }}>קופי · {c.platform}</div>
              {(c.headlines || []).map((h, i) => (
                <div key={`h${i}`} className="mi-body" style={{ fontWeight: 600 }}>{h}</div>
              ))}
              {(c.primary_texts || []).map((t, i) => (
                <div key={`p${i}`} className="mi-body" style={{ whiteSpace: "pre-wrap" }}>{t}</div>
              ))}
              {(c.ctas || []).length > 0 && (
                <div className="mi-meta" style={{ marginBlockStart: 4 }}>כפתור: {c.ctas.join(" · ")}</div>
              )}
            </div>
          ))}
          {(creative.designs || []).some((d) => d.image_url) && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBlockStart: 8 }}>
              {creative.designs.filter((d) => d.image_url).map((d) => (
                <ImgCard key={d.id} url={d.image_url} caption={d.title || "עיצוב"} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* טופס */}
      {gate?.form && (
        <div style={{ marginBlockEnd: 12 }}>
          <h3 className="mi-h2" style={{ fontSize: 15, marginBlockEnd: 6 }}>הטופס</h3>
          <div className="mi-meta">{gate.form.form_name} · {gate.form.status}</div>
          {(gate.form.fields || []).length > 0 && (
            <ul style={{ margin: "4px 0 0", paddingInlineStart: 16 }}>
              {gate.form.fields.map((f, i) => (
                <li key={i} className="mi-meta">{f.label || f.key}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* צילומי-מסך — הקראייטיב כפי שייראה + תצוגת-מטא-חיה */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                      marginBlockEnd: 8 }}>
          <h3 className="mi-h2" style={{ fontSize: 15, margin: 0 }}>צילומי-מסך לפני הפעלה</h3>
          <span style={{ flex: 1 }} />
          <button className="mi-btn mi-btn-secondary" disabled={shotBusy}
                  onClick={onGenerateScreenshots} style={{ minBlockSize: 32 }}>
            {shotBusy ? "מצלם…" : (gate ? "↻ רענן צילומי-מסך" : "הפק צילומי-מסך")}
          </button>
        </div>
        {!gate ? (
          <p className="mi-meta">
            טרם הופקו צילומי-מסך. לחצי "הפק צילומי-מסך" כדי לראות איך המודעה והטופס ייראו —
            המערכת תסמן חשד (לוגו / טקסט / תוספות-מטא) לפני שתאשרי.
          </p>
        ) : (
          <>
            <p className="mi-meta" style={{ marginBlockEnd: 8 }}>
              {gate.live_preview_note || "המכונה בדקה ראשונה — את האחרונה (אישור בעין)."}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {(gate.creatives || []).map((c, i) => (
                <ImgCard key={`c${i}`} url={c.image_url} caption={c.title || "הקראייטיב"}
                         verdict={c.verdict} flags={c.flags} />
              ))}
              {(gate.live_previews || []).map((p, i) => (
                <ImgCard key={`l${i}`} url={p.image_url}
                         caption={`תצוגת-מטא · מודעה ${p.ad_id}`}
                         verdict={p.verdict} flags={p.flags} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

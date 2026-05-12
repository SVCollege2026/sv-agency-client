/**
 * HelpCenter.jsx — מודל "איך זה עובד" — סקירה לפעם הראשונה.
 *
 * Triggered by an "❓ עזרה" button in the page header.
 * Stored as `?` first-visit hint via localStorage so it can auto-open once.
 */
import React, { useState } from "react";
import { color, radius, shadow, space, type, transition, fontFamily } from "./_tokens.js";

const SECTIONS = [
  {
    id: "no_action_without_approval",
    icon: "🛡",
    title: "שום שינוי לא קורה בלי אישורך",
    content: [
      "זה העיקרון הכי חשוב במערכת ולכן הוא מופיע ראשון: המערכת לעולם לא מבצעת שום שינוי, פעולה, או החלטה — בלי הלחיצה המפורשת שלך.",
      "סוכן ניהול תקציב לא משנה תקציב בפועל. הוא כותב המלצה. את מאשרת או דוחה.",
      "סוכן הקופי לא מעלה מודעה לאוויר. הוא מכין נוסחים. את מאשרת איזה לפרסם.",
      "ה-recommendations engine לא עוצר קמפיין. הוא מתריע. את לוחצת על 'אשרי / דחי / דחי לעת עתה'.",
      "מצב Dry Run (ב-הגדרות → כללי) פעיל כברירת מחדל — שום פעולה חיה כלל, גם אחרי שאת מאשרת. את משחררת את זה רק כשאת בטוחה.",
      "תראי את התגית 🛡 'לא מבוצע ללא אישורך' בכותרת בכל עמוד. זו ההבטחה.",
    ],
  },
  {
    id: "what_is_this",
    icon: "✨",
    title: "מה זאת המערכת?",
    content: [
      "SV Agency הוא משרד פרסום אוטומטי שמנהל את כל מחזור החיים של קמפיין שיווקי — מהרגע שהקורס נכנס לתכנון ועד שהוא יורד מהאוויר.",
      'במקום שתתפעלי כל דבר ידנית (Meta, Google, MAKE, מייל וכו\'), המערכת מורכבת מ-15+ סוכני AI שעובדים בשבילך. כל סוכן עושה דבר אחד — מתכנן מדיה, כותב קופי, מכין קריאייטיב, בודק תוצאות.',
      'התפקיד שלך כמנהלת שיווק: לקבל בריף, לאשר תוצרים, ולקבל החלטות על המלצות חכמות. אף סוכן לא מבצע פעולה חיה בלי שתאשרי אותה במפורש.',
    ],
  },
  {
    id: "brief_flow",
    icon: "📝",
    title: "איך מתחיל קמפיין?",
    content: [
      "1. את שולחת בריף ב-'בריף חדש' — או בית-ספרי (תקציב שנתי/חודשי, יעדים) או של קורס ספציפי.",
      "2. ברגע שמילאת יעד + תקציב, המערכת בודקת מיד אם הם ריאליים — לפי CPL היסטורי. את רואה ירוק/כתום/אדום עם המלצה.",
      "3. הבריף עובר ל-traffic_router שמפנה אותו למחלקות הנכונות (מדיה, קופי, קריאייטיב).",
      "4. כל מחלקה מכינה תוצר. את תראי כל תוצר ב-'תוצרים לאישור' עם 3 פעולות: ✓ אישור / ↩ תיקון / ⏩ העברה.",
      "5. אחרי שכל התוצרים אושרו, התיקייה עוברת ל-'מוכן לעלייה'. אחרי שאת מאשרת עלייה — הקמפיין באוויר.",
    ],
  },
  {
    id: "recommendations",
    icon: "💡",
    title: "המלצות מהמערכת — מתי ולמה",
    content: [
      "המערכת ממליצה על שינויים מבוססי דאטה: 'CPL ב-Meta עלה 35% מעל הסף — מומלץ להקטין תקציב ב-20%', 'התקציב לא יספיק ליעד — מומלץ להעלות ב-₪30,000'.",
      "כל המלצה כוללת: 🔍 signal (מה זוהה), 🧭 context (למה זה רלוונטי עכשיו), 📐 policy (איזה חוק הופעל), ✅ action (מה מוצע).",
      "המערכת לעולם לא מבצעת המלצה לבד. את מאשרת/דוחה/דוחה זמנית בלחיצה.",
      "דחיית המלצה לא משתיקה אותה — אם ה-signal ימשיך להיות נכון, המערכת תציע שוב (ולא תייצר רשומות כפולות).",
    ],
  },
  {
    id: "guardrails",
    icon: "🛡",
    title: "Guardrails — מה תמיד מוגן",
    content: [
      "מצב Dry Run (בהגדרות) — שום פעולה חיה. הכל מתועד בלוג, אבל שום קמפיין לא עולה, שום תקציב לא משתנה. ברירת מחדל ON.",
      "תקרות יומיות לפלטפורמה (בהגדרות → תקציב) — הסוכן לעולם לא ימליץ מעבר לטווח.",
      "Quality Gate לפני עלייה — כל הקמפיינים עוברים בדיקה אוטומטית לפני שמותרת עלייה.",
      "החלטות חיות תמיד דורשות אישור אנושי שלך — סגירה / שינוי תקציב גדול / שינוי methodology.",
    ],
  },
  {
    id: "make_integration",
    icon: "🔌",
    title: "make.com — איך זה משולב",
    content: [
      "בטאב 🔌 MAKE את רואה את כל 55 התרחישים שלך ב-make.com.",
      "המערכת לא נוגעת בהם ישירות. את מסמנת בעצמך אילו תרחישים רלוונטיים למערכת הקמפיינים (לידים, התראות וכו').",
      "תרחיש מסומן = המערכת תעקוב אחריו (בריאות, ביצועים, התראות אם הוא נופל).",
      "תרחיש לא מסומן = ממשיך לעבוד ב-make כרגיל, אבל המערכת לא נוגעת בו.",
    ],
  },
];

export default function HelpCenter({ open, onClose }) {
  const [active, setActive] = useState(SECTIONS[0].id);
  if (!open) return null;

  const section = SECTIONS.find(s => s.id === active) || SECTIONS[0];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: space(4),
      direction: "rtl", fontFamily,
      animation: "campaign-overlay-in 200ms ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: color.surface, borderRadius: radius.lg,
        maxWidth: 760, width: "100%", maxHeight: "85vh",
        boxShadow: shadow.xl, overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: `${space(4)} ${space(5)}`,
          borderBottom: `1px solid ${color.borderDefault}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <h2 style={{ ...type.h2, margin: 0, display: "flex", alignItems: "center", gap: space(2) }}>
              <span style={{ fontSize: 24 }}>❓</span>
              איך זה עובד?
            </h2>
            <div style={{ ...type.bodySmall, color: color.fgMuted, marginTop: space(1) }}>
              סקירה מהירה של הזרימה במערכת
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "none", background: color.surfaceMuted, color: color.fgMuted,
            fontSize: 18, cursor: "pointer", fontFamily,
          }} aria-label="סגור">×</button>
        </div>

        {/* Body — sidebar + content */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
          {/* Sidebar */}
          <nav style={{
            width: 240, borderInlineEnd: `1px solid ${color.borderDefault}`,
            background: color.surfaceMuted, padding: space(2),
            overflowY: "auto",
          }}>
            {SECTIONS.map(s => {
              const on = s.id === active;
              return (
                <button key={s.id} onClick={() => setActive(s.id)} style={{
                  display: "flex", alignItems: "center", gap: space(2),
                  width: "100%", padding: `${space(2.5)} ${space(3)}`,
                  background: on ? color.surface : "transparent",
                  border: "none",
                  borderRadius: radius.md,
                  cursor: "pointer",
                  textAlign: "right", direction: "rtl",
                  ...type.bodySmall,
                  fontWeight: on ? 700 : 500,
                  color: on ? color.primary : color.fgDefault,
                  marginBottom: space(0.5),
                  fontFamily,
                  transition: transition.fast,
                }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  {s.title}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div style={{
            flex: 1, padding: space(5), overflowY: "auto",
            ...type.body, color: color.fgDefault,
          }}>
            <h3 style={{ ...type.h2, margin: 0, marginBottom: space(3), display: "flex", alignItems: "center", gap: space(2) }}>
              <span style={{ fontSize: 28 }}>{section.icon}</span>
              {section.title}
            </h3>
            {section.content.map((para, i) => (
              <p key={i} style={{
                margin: 0, marginBottom: space(3),
                ...type.body, color: color.fgDefault, lineHeight: 1.7,
              }}>{para}</p>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: `${space(3)} ${space(5)}`,
          borderTop: `1px solid ${color.borderDefault}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: color.surfaceMuted,
        }}>
          <div style={{ ...type.small, color: color.fgMuted }}>
            לחצי על "❓ עזרה" בכל שלב כדי לחזור לכאן.
          </div>
          <button onClick={onClose} style={{
            padding: `${space(2)} ${space(4)}`,
            background: color.primary, color: "#fff", border: "none",
            borderRadius: radius.md, cursor: "pointer",
            fontSize: 13, fontWeight: 700, fontFamily,
          }}>הבנתי, סגרי</button>
        </div>
      </div>
    </div>
  );
}

/** Helper: hook to manage first-visit auto-open. */
export function useHelpFirstVisit() {
  const [open, setOpen] = useState(false);
  React.useEffect(() => {
    try {
      if (!localStorage.getItem("sv_help_seen")) {
        setOpen(true);
        localStorage.setItem("sv_help_seen", "1");
      }
    } catch { /* ignore */ }
  }, []);
  return { open, setOpen };
}

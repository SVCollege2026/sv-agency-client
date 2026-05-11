/**
 * NotificationBell.jsx — In-app feed עם ניסוחים אנושיים.
 * אין "blocker" בתצוגה — קוראים "התראה" / "משימה ממתינה".
 */
import React, { useState, useEffect } from "react";
import { listNotifications, markNotificationRead } from "../../api.js";

const RECIPIENT_ROLE = "marketing_manager";

const EVENT_LABELS = {
  blocker_opened:                 { icon: "✋", label: "משימה ממתינה" },
  approval_required:              { icon: "👀", label: "אישור נדרש" },
  recommendation_ready:           { icon: "💡", label: "המלצה חדשה" },
  make_failure:                   { icon: "⚠",  label: "תקלה ב-Make" },
  qa_failure:                     { icon: "🔧", label: "QA דורש תיקון" },
  platform_connection_pending:    { icon: "🔌", label: "המתנה לחיבור" },
  platform_connection_completed:  { icon: "✅", label: "פלטפורמה חוברה" },
};

function relTime(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)     return "ממש עכשיו";
  if (diff < 3600)   return `לפני ${Math.floor(diff / 60)} דק'`;
  if (diff < 86400)  return `לפני ${Math.floor(diff / 3600)} שעות`;
  if (diff < 604800) return `לפני ${Math.floor(diff / 86400)} ימים`;
  return new Date(iso).toLocaleDateString("he-IL");
}

export default function NotificationBell({ pollMs = 30000 }) {
  const [items, setItems] = useState([]);
  const [open, setOpen]   = useState(false);
  const [error, setError] = useState(null);

  async function refresh() {
    try {
      const data = await listNotifications({ recipientRole: RECIPIENT_ROLE, onlyUnread: true, limit: 20 });
      setItems(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) { setError(e.message); }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, pollMs);
    return () => clearInterval(t);
  }, [pollMs]);

  async function onMarkRead(eventId) {
    try {
      await markNotificationRead(eventId, RECIPIENT_ROLE);
      setItems(prev => prev.filter(i => i.id !== eventId));
    } catch (e) { alert(`שגיאה: ${e.message}`); }
  }

  const unread = items.length;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(o => !o)} title="התראות" style={{
        position: "relative", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 999,
        padding: "8px 14px", cursor: "pointer", fontSize: 14, color: "#374151",
        display: "flex", alignItems: "center", gap: 4, fontWeight: 600,
      }}>
        🔔 התראות
        {unread > 0 && (
          <span style={{
            background: "#dc2626", color: "#fff", borderRadius: 999,
            padding: "1px 8px", fontSize: 11, marginInlineStart: 4, fontWeight: 700,
            minWidth: 20, textAlign: "center",
          }}>{unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", insetInlineStart: 0, top: "calc(100% + 8px)",
          width: 380, maxHeight: 500, overflow: "auto",
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: 12, boxShadow: "0 16px 40px rgba(15,23,42,0.15)",
          zIndex: 50, direction: "rtl",
        }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
              🔔 התראות חדשות
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>{unread} ממתינות</div>
          </div>

          {error && <div style={{ padding: 14, color: "#b91c1c", fontSize: 13 }}>שגיאה: {error}</div>}

          {!error && items.length === 0 && (
            <div style={{ padding: 36, color: "#6b7280", fontSize: 14, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              הכל מטופל! אין התראות חדשות.
            </div>
          )}

          {items.map(n => {
            const m = EVENT_LABELS[n.event_type] || { icon: "📩", label: "עדכון" };
            return (
              <div key={n.id} style={{
                padding: 14, borderTop: "1px solid #f3f4f6",
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <span style={{ fontSize: 18 }}>{m.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                        {n.subject || m.label}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{relTime(n.queued_at)}</div>
                    </div>
                  </div>
                  <button onClick={() => onMarkRead(n.id)} style={{
                    background: "transparent", border: "1px solid #e5e7eb",
                    borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer",
                    color: "#6b7280", whiteSpace: "nowrap",
                  }} title="סמני כנקראה">סמני ✓</button>
                </div>
                {n.body && (
                  <div style={{ fontSize: 12, color: "#4b5563", whiteSpace: "pre-wrap", lineHeight: 1.5, paddingInlineStart: 26 }}>
                    {n.body}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

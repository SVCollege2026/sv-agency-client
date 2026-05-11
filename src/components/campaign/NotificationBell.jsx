/**
 * NotificationBell.jsx — In-app feed (Spec 01 §15, Plan §"Notification channels MVP").
 * Polls /api/notifications/ every 30s. Displays unread count badge.
 */
import React, { useState, useEffect } from "react";
import { listNotifications, markNotificationRead } from "../../api.js";

const RECIPIENT_ROLE = "marketing_manager";

export default function NotificationBell({ pollMs = 30000 }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);

  async function refresh() {
    try {
      const data = await listNotifications({ recipientRole: RECIPIENT_ROLE, onlyUnread: true, limit: 20 });
      setItems(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
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
    } catch (e) {
      alert(`שגיאה: ${e.message}`);
    }
  }

  const unread = items.length;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="התראות"
        style={{
          background: "transparent",
          border: "1px solid #cbd5e1",
          borderRadius: 999,
          padding: "6px 12px",
          cursor: "pointer",
          fontSize: 14,
          color: "#1e293b",
        }}
      >
        🔔 {unread > 0 && (
          <span style={{
            background: "#dc2626", color: "#fff", borderRadius: 999,
            padding: "1px 7px", fontSize: 11, marginInlineStart: 4, fontWeight: 700,
          }}>{unread}</span>
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", insetInlineStart: 0, top: "110%",
          width: 360, maxHeight: 480, overflow: "auto",
          background: "#ffffff", border: "1px solid #e2e8f0",
          borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          padding: 8, zIndex: 50, direction: "rtl",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", padding: "6px 10px" }}>
            התראות חדשות {unread > 0 && <span style={{ color: "#64748b" }}>({unread})</span>}
          </div>
          {error && (
            <div style={{ padding: 12, color: "#b91c1c", fontSize: 12 }}>שגיאה: {error}</div>
          )}
          {!error && items.length === 0 && (
            <div style={{ padding: 16, color: "#64748b", fontSize: 13, textAlign: "center" }}>
              אין התראות חדשות.
            </div>
          )}
          {items.map(n => (
            <div key={n.id} style={{
              padding: 10, borderTop: "1px solid #f1f5f9",
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                  {n.subject || n.event_type}
                </div>
                <button
                  onClick={() => onMarkRead(n.id)}
                  style={{
                    background: "transparent", border: "1px solid #cbd5e1",
                    borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer",
                    color: "#475569",
                  }}
                  title="סמן כנקרא"
                >סמן ✓</button>
              </div>
              {n.body && (
                <div style={{ fontSize: 12, color: "#475569", whiteSpace: "pre-wrap" }}>{n.body}</div>
              )}
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {n.severity} · {n.event_type} · {new Date(n.queued_at).toLocaleString("he-IL")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

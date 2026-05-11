/**
 * BlockersInbox.jsx — מציג את כל החסמים הפתוחים שמחכים למנהלת השיווק
 * עם כפתור "סמן שטופל".
 */
import React, { useState, useEffect } from "react";
import { listWorkflowBlockers, resolveBlocker } from "../../api.js";
import StatusPill from "./StatusPill.jsx";

export default function BlockersInbox() {
  const [rows, setRows]   = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState({});

  async function load() {
    setLoading(true); setError(null);
    try {
      const data = await listWorkflowBlockers({ ownerRole: "marketing_manager", onlyOpen: true });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function resolve(b) {
    const text = (resolution[b.id] || "").trim();
    if (!text) { alert("נא להוסיף הערה לפתרון"); return; }
    setBusyId(b.id);
    try {
      await resolveBlocker(b.id, { resolution: text, resolved_by: "marketing_manager" });
      await load();
    } catch (e) {
      alert(`שגיאה: ${e.message}`);
    } finally { setBusyId(null); }
  }

  return (
    <div style={{
      background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0",
      padding: 18, direction: "rtl",
    }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f172a", fontWeight: 700 }}>
        ⛔ חסמים פתוחים שמחכים לי ({rows.length})
      </h3>
      {error && <div style={{ color: "#b91c1c", marginBottom: 10 }}>שגיאה: {error}</div>}
      {loading && <div style={{ color: "#64748b" }}>טוען...</div>}
      {!loading && rows.length === 0 && (
        <div style={{ color: "#64748b", textAlign: "center", padding: 24 }}>
          אין חסמים פתוחים כרגע. 🎉
        </div>
      )}
      {rows.map(b => (
        <div key={b.id} style={{
          padding: 14, marginBottom: 10, background: "#fffbeb",
          border: "1px solid #fef3c7", borderRadius: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <strong style={{ color: "#0f172a", fontSize: 14 }}>{b.blocker_type}</strong>
                <StatusPill value={b.severity} />
              </div>
              <div style={{ marginTop: 6, color: "#475569", fontSize: 13 }}>{b.description}</div>
              <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
                נפתח: {new Date(b.opened_at).toLocaleString("he-IL")}
                {b.payload?.platform && <> · פלטפורמה: <strong>{b.payload.platform}</strong></>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              placeholder="פתרון / הערה לסגירת החסם"
              value={resolution[b.id] || ""}
              onChange={e => setResolution(prev => ({ ...prev, [b.id]: e.target.value }))}
              style={{
                flex: 1, padding: "8px 10px", border: "1px solid #cbd5e1",
                borderRadius: 6, fontSize: 13, direction: "rtl",
              }}
            />
            <button
              onClick={() => resolve(b)} disabled={busyId === b.id}
              style={{
                padding: "8px 14px", background: "#16a34a", color: "#fff",
                border: "none", borderRadius: 6, fontWeight: 700,
                cursor: busyId === b.id ? "not-allowed" : "pointer", fontSize: 13,
              }}
            >{busyId === b.id ? "..." : "✓ סמן שטופל"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

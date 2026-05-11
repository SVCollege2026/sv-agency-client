/**
 * FolderList.jsx — Monday-style folder grid for campaign management.
 * Lists campaign_folders with status pills + planned_go_live_date.
 */
import React, { useState, useEffect } from "react";
import { listCampaignFolders, createCampaignFolder } from "../../api.js";
import StatusPill from "./StatusPill.jsx";

const headerStyle = {
  textAlign: "right", padding: "10px 14px", fontSize: 12, fontWeight: 700,
  color: "#64748b", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap",
};

const cellStyle = {
  padding: "12px 14px", fontSize: 14, color: "#334155",
  borderBottom: "1px solid #f1f5f9", verticalAlign: "middle",
};

export default function FolderList({ onSelectFolder, refreshKey = 0 }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("all");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await listCampaignFolders(filter === "all" ? {} : { status: filter });
      setFolders(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [filter, refreshKey]);

  async function createFolder() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const folder = await createCampaignFolder({ course_name: newName.trim(), created_by: "marketing_manager" });
      setNewName(""); setShowNew(false);
      await refresh();
      onSelectFolder && onSelectFolder(folder.id);
    } catch (e) {
      alert(`שגיאה: ${e.message}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ direction: "rtl" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { id: "all",              label: "הכל" },
            { id: "draft",            label: "טיוטה" },
            { id: "in_progress",      label: "בעבודה" },
            { id: "ready_to_launch",  label: "מוכן לעלייה" },
            { id: "live",             label: "באוויר" },
            { id: "closed",           label: "סגור" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: filter === f.id ? "#1e3a5f" : "#fff",
                color:      filter === f.id ? "#fff" : "#475569",
                border: `1px solid ${filter === f.id ? "#1e3a5f" : "#cbd5e1"}`,
              }}
            >{f.label}</button>
          ))}
        </div>
        <button
          onClick={() => setShowNew(s => !s)}
          style={{
            padding: "8px 14px", background: "#16a34a", color: "#fff",
            border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700,
          }}
        >➕ תיקייה חדשה</button>
      </div>

      {showNew && (
        <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>תיקיית קמפיין חדשה</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="שם הקורס / הפעילות"
              style={{ flex: 1, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14 }}
            />
            <button onClick={createFolder} disabled={creating || !newName.trim()}
              style={{
                padding: "8px 16px", background: "#1e3a5f", color: "#fff", border: "none",
                borderRadius: 6, cursor: creating ? "not-allowed" : "pointer", fontWeight: 700,
              }}
            >{creating ? "..." : "צור"}</button>
            <button onClick={() => { setShowNew(false); setNewName(""); }}
              style={{
                padding: "8px 14px", background: "transparent", color: "#475569",
                border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer",
              }}
            >ביטול</button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: 12, background: "#fee2e2", color: "#b91c1c", borderRadius: 8, marginBottom: 12 }}>
          שגיאה: {error}
        </div>
      )}

      {loading && <div style={{ padding: 20, color: "#64748b" }}>טוען...</div>}

      {!loading && !error && folders.length === 0 && (
        <div style={{ padding: 24, color: "#64748b", textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: 8 }}>
          אין תיקיות במצב הזה. צרי תיקייה חדשה כדי להתחיל.
        </div>
      )}

      {!loading && folders.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <th style={headerStyle}>שם הקורס</th>
                <th style={headerStyle}>סטטוס</th>
                <th style={headerStyle}>תאריך עלייה</th>
                <th style={headerStyle}>מעבר methodology</th>
                <th style={headerStyle}>נוצרה</th>
                <th style={headerStyle}></th>
              </tr>
            </thead>
            <tbody>
              {folders.map(f => (
                <tr key={f.id} style={{ cursor: "pointer", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}
                    onClick={() => onSelectFolder && onSelectFolder(f.id)}>
                  <td style={cellStyle}>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>{f.course_name}</span>
                    {f.activity_label && (
                      <span style={{ marginInlineStart: 8, color: "#94a3b8", fontSize: 12 }}>· {f.activity_label}</span>
                    )}
                  </td>
                  <td style={cellStyle}><StatusPill value={f.status} /></td>
                  <td style={cellStyle}>{f.planned_go_live_date || "—"}</td>
                  <td style={cellStyle}>
                    {f.methodology_switch_date
                      ? <span style={{ fontSize: 12 }}>{f.methodology_switch_date} → {f.methodology_switch_to}</span>
                      : "—"}
                  </td>
                  <td style={cellStyle}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      {f.created_at ? new Date(f.created_at).toLocaleDateString("he-IL") : ""}
                    </span>
                  </td>
                  <td style={{ ...cellStyle, textAlign: "left" }}>
                    <span style={{ color: "#1e3a5f", fontWeight: 700 }}>פתח ›</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * FolderBoard.jsx — Monday-style Kanban board for campaign folders.
 *
 * Groups folders by status into vertical columns. Each card shows the
 * primary fields with a color-coded left border matching the status.
 *
 * Replaces the table-style FolderList (looked like "80s folders").
 */
import React, { useState, useEffect } from "react";
import { listCampaignFolders, createCampaignFolder } from "../../api.js";

// ─── Status groups — order + color per Spec 03 §3 + StatusPill ──────────
const COLUMNS = [
  { id: "draft",           label: "טיוטה",         color: "#94a3b8", bg: "#f1f5f9" },
  { id: "in_progress",     label: "בעבודה",        color: "#0369a1", bg: "#e0f2fe" },
  { id: "ready_to_launch", label: "מוכן לעלייה",   color: "#15803d", bg: "#dcfce7" },
  { id: "live",            label: "באוויר",        color: "#166534", bg: "#bbf7d0" },
  { id: "closing",         label: "בסגירה",        color: "#a16207", bg: "#fef3c7" },
  { id: "closed",          label: "סגור",          color: "#b91c1c", bg: "#fee2e2" },
];

const colHeader = (col, count) => ({
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "10px 14px", borderRadius: "10px 10px 0 0",
  background: col.bg, color: col.color,
  fontWeight: 700, fontSize: 13, borderBottom: `3px solid ${col.color}`,
});

const cardBase = (color) => ({
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderInlineStart: `4px solid ${color}`,
  borderRadius: 8,
  padding: 12,
  marginBottom: 10,
  cursor: "pointer",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
  transition: "all 0.15s ease",
  display: "flex",
  flexDirection: "column",
  gap: 8,
});

const fieldLine = {
  fontSize: 12,
  color: "#64748b",
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const dot = (color) => ({
  width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block",
});

function formatDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("he-IL"); } catch { return iso; }
}

export default function FolderBoard({ onSelectFolder, refreshKey = 0 }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await listCampaignFolders();
      setFolders(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [refreshKey]);

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
    } finally { setCreating(false); }
  }

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.id] = folders.filter(f => f.status === col.id);
    return acc;
  }, {});

  return (
    <div style={{ direction: "rtl" }}>
      {/* Top toolbar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 16, flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h3 style={{ margin: 0, color: "#0f172a", fontSize: 18 }}>📋 לוח קמפיינים</h3>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            {folders.length} {folders.length === 1 ? "תיקייה" : "תיקיות"} סה"כ
          </span>
        </div>
        <button
          onClick={() => setShowNew(s => !s)}
          style={{
            padding: "9px 16px", background: "#1e3a5f", color: "#fff",
            border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700,
            boxShadow: "0 2px 4px rgba(30, 58, 95, 0.2)",
          }}
        >➕ תיקייה חדשה</button>
      </div>

      {showNew && (
        <div style={{
          background: "#fff", border: "1px solid #cbd5e1", borderRadius: 10,
          padding: 14, marginBottom: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>תיקיית קמפיין חדשה</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="שם הקורס / הפעילות"
              autoFocus
              style={{ flex: 1, padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14 }}
            />
            <button onClick={createFolder} disabled={creating || !newName.trim()}
              style={{
                padding: "10px 18px", background: "#16a34a", color: "#fff", border: "none",
                borderRadius: 6, cursor: creating ? "not-allowed" : "pointer", fontWeight: 700,
              }}
            >{creating ? "..." : "צור"}</button>
            <button onClick={() => { setShowNew(false); setNewName(""); }}
              style={{
                padding: "10px 16px", background: "transparent", color: "#475569",
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

      {!loading && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
          paddingBottom: 20,
        }}>
          {COLUMNS.map(col => (
            <div key={col.id} style={{
              background: "#f8fafc",
              borderRadius: 10,
              padding: "0 10px 10px",
              border: "1px solid #e2e8f0",
              minHeight: 140,
              display: "flex", flexDirection: "column",
            }}>
              <div style={colHeader(col, grouped[col.id].length)}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={dot(col.color)} />
                  {col.label}
                </span>
                <span style={{
                  background: "rgba(255,255,255,0.6)", padding: "2px 9px",
                  borderRadius: 999, fontSize: 12, fontWeight: 700, color: col.color,
                }}>{grouped[col.id].length}</span>
              </div>
              <div style={{ paddingTop: 10, flex: 1 }}>
                {grouped[col.id].length === 0 && (
                  <div style={{
                    textAlign: "center", fontSize: 12, color: "#94a3b8",
                    padding: "20px 8px", border: "1px dashed #e2e8f0", borderRadius: 6,
                  }}>אין תיקיות במצב הזה</div>
                )}
                {grouped[col.id].map(f => (
                  <div
                    key={f.id}
                    style={cardBase(col.color)}
                    onClick={() => onSelectFolder && onSelectFolder(f.id)}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(15, 23, 42, 0.08)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = "";
                      e.currentTarget.style.boxShadow = "0 1px 3px rgba(15, 23, 42, 0.04)";
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 14, lineHeight: 1.3 }}>
                      {f.course_name}
                    </div>
                    {f.activity_label && (
                      <div style={{ fontSize: 11, color: "#64748b" }}>{f.activity_label}</div>
                    )}

                    <div style={fieldLine}>
                      <span>🚀</span>
                      <span>תאריך עלייה: <strong style={{ color: "#334155" }}>{f.planned_go_live_date || "—"}</strong></span>
                    </div>

                    {f.methodology_switch_date && (
                      <div style={fieldLine}>
                        <span>🔄</span>
                        <span>{f.methodology_switch_date} → {f.methodology_switch_to}</span>
                      </div>
                    )}

                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      paddingTop: 6, marginTop: 4, borderTop: "1px dashed #e2e8f0",
                      fontSize: 11, color: "#94a3b8",
                    }}>
                      <span>נוצרה: {formatDate(f.created_at)}</span>
                      <span style={{ color: col.color, fontWeight: 700 }}>פתח ›</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

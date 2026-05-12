/**
 * FolderBoard.jsx — Monday-style Kanban board for campaign folders.
 * Uses design tokens, soft shadows, hover lift, skeleton loading, toasts.
 */
import React, { useState, useEffect } from "react";
import { listCampaignFolders, createCampaignFolder } from "../../api.js";
import { color, radius, shadow, space, type, transition, button, input as inputStyle, emptyState } from "./_tokens.js";
import { useToast } from "./Toast.jsx";
import { SkeletonBoard } from "./Skeleton.jsx";

const COLUMNS = [
  { id: "draft",           label: "טיוטה",         dot: "#94a3b8", strip: "#94a3b8", soft: "#f8fafc" },
  { id: "in_progress",     label: "בעבודה",        dot: "#0369a1", strip: "#0369a1", soft: "#f0f9ff" },
  { id: "ready_to_launch", label: "מוכן לעלייה",   dot: "#15803d", strip: "#15803d", soft: "#f0fdf4" },
  { id: "live",            label: "באוויר",        dot: "#16a34a", strip: "#16a34a", soft: "#ecfdf5" },
  { id: "closing",         label: "בסגירה",        dot: "#a16207", strip: "#a16207", soft: "#fffbeb" },
  { id: "closed",          label: "סגור",          dot: "#b91c1c", strip: "#b91c1c", soft: "#fef2f2" },
];

function formatDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("he-IL"); } catch { return iso; }
}

export default function FolderBoard({ onSelectFolder, refreshKey = 0 }) {
  const toast = useToast();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");

  async function refresh() {
    setLoading(true); setError(null);
    try {
      const data = await listCampaignFolders();
      setFolders(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [refreshKey]);

  async function createFolder() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const folder = await createCampaignFolder({ course_name: newName.trim(), created_by: "marketing_manager" });
      setNewName(""); setShowNew(false);
      toast.success(`✓ נוצרה תיקיית קמפיין: ${folder.course_name}`);
      await refresh();
      onSelectFolder && onSelectFolder(folder.id);
    } catch (e) { toast.error(`שגיאה ביצירת תיקייה: ${e.message}`); }
    finally { setCreating(false); }
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? folders.filter(f =>
        (f.course_name || "").toLowerCase().includes(q) ||
        (f.activity_label || "").toLowerCase().includes(q)
      )
    : folders;

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.id] = filtered.filter(f => f.status === col.id);
    return acc;
  }, {});

  return (
    <div style={{ direction: "rtl" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: space(4), flexWrap: "wrap", gap: space(3),
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: space(3) }}>
          <h3 style={{ ...type.h2, margin: 0 }}>📋 לוח קמפיינים</h3>
          <span style={{ ...type.bodySmall, color: color.fgSubtle }}>
            {q
              ? `${filtered.length} מתוך ${folders.length}`
              : `${folders.length} ${folders.length === 1 ? "תיקייה" : "תיקיות"} סה"כ`}
          </span>
        </div>
        <div style={{ display: "flex", gap: space(2), alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", insetInlineStart: space(2.5),
              top: "50%", transform: "translateY(-50%)",
              color: color.fgSubtle, fontSize: 14, pointerEvents: "none",
            }}>🔎</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם קורס..."
              style={{ ...inputStyle, paddingInlineStart: space(7), minWidth: 240 }}
            />
            {q && (
              <button
                onClick={() => setQuery("")}
                style={{
                  position: "absolute", insetInlineEnd: space(1.5),
                  top: "50%", transform: "translateY(-50%)",
                  background: "transparent", border: "none", cursor: "pointer",
                  color: color.fgMuted, fontSize: 16, padding: 4, lineHeight: 1,
                }}
                aria-label="נקי חיפוש"
              >×</button>
            )}
          </div>
          <button onClick={() => setShowNew(s => !s)} style={button.primary}
                  onMouseEnter={e => e.currentTarget.style.background = color.primaryHover}
                  onMouseLeave={e => e.currentTarget.style.background = color.primary}>
            ➕ תיקייה חדשה
          </button>
        </div>
      </div>

      {showNew && (
        <div style={{
          background: color.surface, border: `1px solid ${color.borderDefault}`,
          borderRadius: radius.card, padding: space(4), marginBottom: space(4),
          boxShadow: shadow.sm,
        }}>
          <div style={{ ...type.label, marginBottom: space(2) }}>תיקיית קמפיין חדשה</div>
          <div style={{ display: "flex", gap: space(2) }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="שם הקורס / הפעילות"
              autoFocus
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={createFolder} disabled={creating || !newName.trim()}
              style={{ ...button.success, opacity: creating || !newName.trim() ? 0.5 : 1 }}>
              {creating ? "..." : "צור"}
            </button>
            <button onClick={() => { setShowNew(false); setNewName(""); }} style={button.secondary}>
              ביטול
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          padding: space(3), background: color.dangerSoftBg, color: color.dangerSoftFg,
          borderRadius: radius.md, marginBottom: space(3), ...type.bodySmall,
        }}>שגיאה: {error}</div>
      )}

      {loading && <SkeletonBoard />}

      {!loading && folders.length === 0 && (
        <div style={{ ...emptyState, padding: space(12) }}>
          <div style={{ fontSize: 56, marginBottom: space(3) }}>🌱</div>
          <div style={{ ...type.h3, marginBottom: space(2) }}>אין עדיין תיקיות קמפיין</div>
          <div style={{ ...type.bodySmall, color: color.fgSubtle, marginBottom: space(4) }}>
            צרי את התיקייה הראשונה שלך כדי להתחיל בניהול קמפיינים
          </div>
          <button onClick={() => setShowNew(true)} style={button.primary}>
            ➕ צרי תיקייה ראשונה
          </button>
        </div>
      )}

      {!loading && folders.length > 0 && filtered.length === 0 && (
        <div style={{ ...emptyState, padding: space(10) }}>
          <div style={{ fontSize: 44, marginBottom: space(2) }}>🔍</div>
          <div style={{ ...type.h3, marginBottom: space(2) }}>לא נמצאו תיקיות לחיפוש זה</div>
          <div style={{ ...type.bodySmall, color: color.fgSubtle, marginBottom: space(3) }}>
            נסי מילה אחרת או נקי את החיפוש כדי לראות הכל.
          </div>
          <button onClick={() => setQuery("")} style={button.secondary}>נקי חיפוש</button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: space(3), paddingBottom: space(5),
        }}>
          {COLUMNS.map(col => (
            <div key={col.id} style={{
              background: color.surfaceMuted, borderRadius: radius.card,
              border: `1px solid ${color.borderSubtle}`,
              minHeight: 160, display: "flex", flexDirection: "column",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: `${space(3)} ${space(4)}`, background: col.soft,
                borderRadius: `${radius.card}px ${radius.card}px 0 0`,
                borderBottom: `2px solid ${col.strip}`,
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: space(2),
                                color: col.strip, ...type.label, fontSize: 13 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.dot, display: "inline-block" }} />
                  {col.label}
                </span>
                <span style={{
                  background: color.surface, padding: `${space(0.5)} ${space(2)}`,
                  borderRadius: radius.pill, fontSize: 11, fontWeight: 700, color: col.strip,
                  minWidth: 22, textAlign: "center",
                }}>{grouped[col.id].length}</span>
              </div>
              <div style={{ padding: space(2), flex: 1 }}>
                {grouped[col.id].length === 0 && (
                  <div style={{
                    textAlign: "center", padding: space(4), color: color.fgSubtle,
                    fontSize: 12, border: `1px dashed ${color.borderDefault}`,
                    borderRadius: radius.sm,
                  }}>—</div>
                )}
                {grouped[col.id].map(f => (
                  <div
                    key={f.id}
                    className="campaign-card"
                    onClick={() => onSelectFolder && onSelectFolder(f.id)}
                    style={{
                      background: color.surface,
                      border: `1px solid ${color.borderSubtle}`,
                      borderInlineStart: `4px solid ${col.dot}`,
                      borderRadius: radius.md,
                      padding: space(3),
                      marginBottom: space(2),
                      cursor: "pointer",
                      boxShadow: shadow.xs,
                      transition: transition.base,
                      display: "flex", flexDirection: "column", gap: space(2),
                    }}
                  >
                    <div style={{ ...type.bodyStrong, color: color.fgDefault, lineHeight: "20px" }}>
                      {f.course_name}
                    </div>
                    {f.activity_label && (
                      <div style={{ ...type.small, color: color.fgSubtle }}>{f.activity_label}</div>
                    )}

                    <div style={{ ...type.small, color: color.fgMuted, display: "flex", gap: space(1) }}>
                      <span>🚀</span>
                      <span>עולה לאוויר: <strong style={{ color: color.fgDefault }}>{f.planned_go_live_date || "טרם נקבע"}</strong></span>
                    </div>

                    {f.methodology_switch_date && (
                      <div style={{ ...type.small, color: color.fgMuted, display: "flex", gap: space(1) }}>
                        <span>🎯</span>
                        <span>{f.methodology_switch_date} → {f.methodology_switch_to === "conversion" ? "Conversion" : "Clicks"}</span>
                      </div>
                    )}

                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      paddingTop: space(2), marginTop: space(1),
                      borderTop: `1px dashed ${color.borderSubtle}`,
                      fontSize: 11, color: color.fgSubtle,
                    }}>
                      <span>{formatDate(f.created_at)}</span>
                      <span style={{ color: col.strip, fontWeight: 700 }}>פתחי ›</span>
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

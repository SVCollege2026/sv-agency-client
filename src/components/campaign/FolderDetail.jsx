/**
 * FolderDetail.jsx — תצוגת תיקיית קמפיין יחידה (אין UUIDs בתצוגה).
 */
import React, { useState, useEffect } from "react";
import {
  getCampaignFolder, listFolderBriefs, listRecommendations,
  scheduleMethodologySwitch, listWorkflowBlockers,
} from "../../api.js";
import StatusPill from "./StatusPill.jsx";
import BriefIntakeForm from "./BriefIntakeForm.jsx";
import RecommendationsPanel from "./RecommendationsPanel.jsx";
import CloseCampaignDialog from "./CloseCampaignDialog.jsx";

const card = {
  background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
  padding: 22, marginBottom: 16, boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
};
const sectionTitle = {
  margin: "0 0 14px", fontSize: 16, color: "#111827", fontWeight: 700,
  display: "flex", alignItems: "center", gap: 8,
};

const REQUEST_TYPE_LABELS = {
  school_level:    "🏫 בריף בית-ספרי",
  new_course:      "🎯 בריף קורס",
  change_request:  "✏ עדכון",
  closure_request: "🛑 בקשת סגירה",
};

export default function FolderDetail({ folderId, onBack }) {
  const [folder, setFolder] = useState(null);
  const [briefs, setBriefs] = useState([]);
  const [blockers, setBlockers] = useState([]);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBrief, setShowBrief] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [refresh, setRefresh] = useState(0);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [f, b, bl, r] = await Promise.all([
        getCampaignFolder(folderId, { includeVersions: true }),
        listFolderBriefs(folderId),
        listWorkflowBlockers({ onlyOpen: true }),
        listRecommendations({ folderId, limit: 20 }),
      ]);
      setFolder(f);
      setBriefs(Array.isArray(b) ? b : []);
      setBlockers(Array.isArray(bl) ? bl : []);
      setRecs(Array.isArray(r) ? r : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [folderId, refresh]);

  if (loading && !folder) return <div style={{ padding: 20, color: "#6b7280" }}>טוען...</div>;
  if (error) return <div style={{ padding: 20, color: "#b91c1c" }}>שגיאה: {error}</div>;
  if (!folder) return null;

  const currentBriefs = briefs.filter(b => b.is_current_version);
  const briefsByType = briefs.reduce((acc, b) => { (acc[b.request_type] ||= []).push(b); return acc; }, {});

  return (
    <div style={{ direction: "rtl" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 16, flexWrap: "wrap", gap: 10,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "1px solid #e5e7eb", borderRadius: 8,
          padding: "8px 14px", cursor: "pointer", color: "#374151", fontSize: 13,
        }}>‹ חזרה ללוח</button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowBrief(s => !s)} style={primaryBtn}>📝 בריף חדש / עדכון</button>
          <button onClick={() => setShowMethodology(s => !s)} style={secondaryBtn}>
            🎯 תזמון מעבר Clicks ↔ Conversion
          </button>
          {folder.status !== "closed" && folder.status !== "closing" && (
            <button onClick={() => setShowClose(true)} style={dangerBtn}>🛑 סגור קמפיין</button>
          )}
        </div>
      </div>

      {/* Hero header */}
      <div style={{
        background: "linear-gradient(135deg, #fff 0%, #f9fafb 100%)",
        borderRadius: 14, border: "1px solid #e5e7eb",
        padding: 24, marginBottom: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <StatusPill value={folder.status} />
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            נוצרה {folder.created_at ? new Date(folder.created_at).toLocaleDateString("he-IL") : ""}
          </span>
        </div>
        <h1 style={{ margin: 0, color: "#111827", fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
          {folder.course_name}
        </h1>
        {folder.activity_label && (
          <div style={{ color: "#6b7280", marginTop: 6, fontSize: 14 }}>{folder.activity_label}</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 18 }}>
          <Stat icon="🚀" label="עולה לאוויר" value={fmtDate(folder.planned_go_live_date) || "טרם נקבע"} />
          <Stat
            icon="🎯"
            label="מעבר Clicks ↔ Conversion"
            value={folder.methodology_switch_date
              ? `${fmtDate(folder.methodology_switch_date)} → ${folder.methodology_switch_to === "conversion" ? "Conversion" : "Clicks"}`
              : "ללא מעבר מתוכנן"}
          />
          <Stat icon="📄" label="בריפים פעילים" value={`${currentBriefs.length}${briefs.length > currentBriefs.length ? ` (מתוך ${briefs.length} גרסאות)` : ""}`} />
          <Stat icon="✅" label="המלצות שמחכות" value={String(recs.filter(r => r.decision_status === "pending").length)} />
        </div>
      </div>

      {showMethodology && (
        <MethodologySection folderId={folder.id} current={folder} onDone={() => { setShowMethodology(false); setRefresh(r => r + 1); }} />
      )}

      {showBrief && (
        <div style={card}>
          <BriefIntakeForm
            folderId={folder.id}
            onSubmitted={() => { setShowBrief(false); setRefresh(r => r + 1); }}
            onCancel={() => setShowBrief(false)}
          />
        </div>
      )}

      <div style={card}>
        <h3 style={sectionTitle}>
          📄 בריפים <span style={{ fontSize: 13, fontWeight: 400, color: "#9ca3af" }}>
            ({currentBriefs.length} {currentBriefs.length === 1 ? "פעיל" : "פעילים"}{briefs.length > currentBriefs.length ? `, ${briefs.length} גרסאות` : ""})
          </span>
        </h3>
        {briefs.length === 0 && (
          <div style={emptyStateStyle}>
            עדיין לא הוגש בריף לתיקייה הזו.<br />
            <span style={{ color: "#9ca3af", fontSize: 13, fontWeight: 400 }}>הקליקי "בריף חדש / עדכון" למעלה כדי להתחיל.</span>
          </div>
        )}
        {Object.entries(briefsByType).map(([type, list]) => (
          <div key={type} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
              {REQUEST_TYPE_LABELS[type] || type}
            </div>
            {list.sort((a, b) => b.version_number - a.version_number).map(b => (
              <div key={b.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", background: b.is_current_version ? "#f0fdf4" : "#f9fafb",
                borderRadius: 8, marginBottom: 6, fontSize: 13,
                border: `1px solid ${b.is_current_version ? "#bbf7d0" : "#e5e7eb"}`,
              }}>
                <span>
                  <strong>גרסה {b.version_number}</strong>
                  {b.is_current_version && <span style={{ color: "#15803d", marginInlineStart: 8 }}>● נוכחית</span>}
                  <span style={{ color: "#9ca3af", marginInlineStart: 8 }}>
                    {new Date(b.created_at).toLocaleString("he-IL")}
                  </span>
                </span>
                <StatusPill value={b.status} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={card}>
        <h3 style={sectionTitle}>
          ✅ משימות פתוחות בתיקייה <span style={{ fontSize: 13, fontWeight: 400, color: "#9ca3af" }}>({blockers.length})</span>
        </h3>
        {blockers.length === 0 && (
          <div style={emptyStateStyle}>🎉 הכל מטופל בתיקייה זו.</div>
        )}
        {blockers.map(b => (
          <div key={b.id} style={{ padding: 12, borderRadius: 8, background: "#fffbeb", border: "1px solid #fef3c7", marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{b.description || "משימה ממתינה"}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              {new Date(b.opened_at).toLocaleString("he-IL")}
            </div>
          </div>
        ))}
      </div>

      <RecommendationsPanel folderId={folder.id} recommendations={recs} onChanged={() => setRefresh(r => r + 1)} />

      {showClose && (
        <CloseCampaignDialog
          folder={folder}
          onClose={() => setShowClose(false)}
          onClosed={() => { setShowClose(false); setRefresh(r => r + 1); }}
        />
      )}
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div style={{ background: "#f9fafb", padding: "12px 14px", borderRadius: 10, border: "1px solid #f3f4f6" }}>
      <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 0.5 }}>
        <span style={{ marginInlineEnd: 4 }}>{icon}</span>{label}
      </div>
      <div style={{ fontSize: 15, color: "#111827", marginTop: 4, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString("he-IL"); } catch { return iso; }
}

const emptyStateStyle = {
  textAlign: "center", padding: "24px 12px", color: "#6b7280",
  background: "#f9fafb", borderRadius: 10, fontSize: 14, fontWeight: 600,
};

const primaryBtn = {
  padding: "9px 16px", background: "#1e3a5f", color: "#fff", border: "none",
  borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13,
  boxShadow: "0 2px 4px rgba(30,58,95,0.2)",
};
const secondaryBtn = {
  padding: "9px 16px", background: "#fff", color: "#374151",
  border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
};
const dangerBtn = {
  padding: "9px 16px", background: "#fef2f2", color: "#b91c1c",
  border: "1px solid #fecaca", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700,
};

function MethodologySection({ folderId, current, onDone }) {
  const [date, setDate]     = useState(current.methodology_switch_date || "");
  const [target, setTarget] = useState(current.methodology_switch_to || "conversion");
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState(null);

  async function save() {
    if (!date) { setErr("נא להזין תאריך"); return; }
    setBusy(true); setErr(null);
    try {
      await scheduleMethodologySwitch(folderId, {
        switch_date:  date,
        switch_to:    target,
        requested_by: "marketing_manager",
      });
      onDone();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={card}>
      <h3 style={sectionTitle}>🎯 תזמון מעבר בין יעדי קמפיין</h3>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12, lineHeight: 1.5 }}>
        קמפיין מתחיל בדרך כלל ב-<strong>Clicks</strong> (מודדים כניסות לדף נחיתה) ועובר בהמשך ל-<strong>Conversion</strong> (מודדים לידים שמשאירים פרטים). כאן את קובעת מתי המעבר יקרה — האלגוריתם יתאים את עצמו בתאריך הזה.
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: "#374151", fontWeight: 700, marginBottom: 4 }}>תאריך המעבר</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
                 style={{ width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 8 }} />
        </label>
        <label style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, color: "#374151", fontWeight: 700, marginBottom: 4 }}>עברי ליעד</div>
          <select value={target} onChange={e => setTarget(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#f9fafb" }}>
            <option value="conversion">Conversion (לידים)</option>
            <option value="clicks">Clicks (כניסות)</option>
          </select>
        </label>
        <button onClick={save} disabled={busy} style={primaryBtn}>
          {busy ? "שומר..." : "שמירת תזמון"}
        </button>
      </div>
      {err && <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 13 }}>{err}</div>}
    </div>
  );
}

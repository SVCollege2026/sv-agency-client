/**
 * FolderDetail.jsx — View one campaign_folder with briefs, artifacts,
 * workflow items, blockers, recommendations, and actions (close, etc.).
 */
import React, { useState, useEffect } from "react";
import {
  getCampaignFolder, listFolderBriefs, listRecommendations,
  scheduleMethodologySwitch, listWorkflowBlockers, updateCampaignFolder,
} from "../../api.js";
import StatusPill from "./StatusPill.jsx";
import BriefIntakeForm from "./BriefIntakeForm.jsx";
import RecommendationsPanel from "./RecommendationsPanel.jsx";
import CloseCampaignDialog from "./CloseCampaignDialog.jsx";

const sectionStyle = {
  background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0",
  padding: 18, marginBottom: 16,
};

const sectionTitle = {
  margin: "0 0 12px", fontSize: 15, color: "#0f172a", fontWeight: 700,
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
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [folderId, refresh]);

  if (loading && !folder) {
    return <div style={{ padding: 20, color: "#64748b" }}>טוען תיקייה...</div>;
  }
  if (error) {
    return <div style={{ padding: 20, color: "#b91c1c" }}>שגיאה: {error}</div>;
  }
  if (!folder) return null;

  const briefsByType = briefs.reduce((acc, b) => {
    (acc[b.request_type] ||= []).push(b);
    return acc;
  }, {});

  return (
    <div style={{ direction: "rtl" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "1px solid #cbd5e1", borderRadius: 6,
          padding: "6px 12px", cursor: "pointer", color: "#475569", fontSize: 13,
        }}>‹ חזרה לרשימה</button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowBrief(s => !s)} style={{
            padding: "8px 14px", background: "#1e3a5f", color: "#fff", border: "none",
            borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 13,
          }}>📝 בריף חדש / עדכון</button>
          <button onClick={() => setShowMethodology(s => !s)} style={{
            padding: "8px 14px", background: "#fff", color: "#475569",
            border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer", fontSize: 13,
          }}>🔄 מעבר methodology</button>
          {folder.status !== "closed" && folder.status !== "closing" && (
            <button onClick={() => setShowClose(true)} style={{
              padding: "8px 14px", background: "#fef2f2", color: "#b91c1c",
              border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700,
            }}>🛑 סגור קמפיין</button>
          )}
        </div>
      </div>

      {/* Header */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, color: "#0f172a", fontSize: 22 }}>{folder.course_name}</h2>
            {folder.activity_label && (
              <div style={{ color: "#64748b", marginTop: 4, fontSize: 13 }}>{folder.activity_label}</div>
            )}
          </div>
          <StatusPill value={folder.status} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 14 }}>
          <Stat label="תאריך עלייה מתוכנן" value={folder.planned_go_live_date || "—"} />
          <Stat label="מעבר methodology" value={
            folder.methodology_switch_date
              ? `${folder.methodology_switch_date} → ${folder.methodology_switch_to}`
              : "—"
          }/>
          <Stat label="נוצרה" value={folder.created_at ? new Date(folder.created_at).toLocaleDateString("he-IL") : "—"} />
          <Stat label="folder_id" value={folder.id} mono />
        </div>
      </div>

      {showMethodology && (
        <MethodologySection folderId={folder.id} current={folder} onDone={() => { setShowMethodology(false); setRefresh(r => r + 1); }} />
      )}

      {showBrief && (
        <div style={sectionStyle}>
          <BriefIntakeForm
            folderId={folder.id}
            onSubmitted={() => { setShowBrief(false); setRefresh(r => r + 1); }}
            onCancel={() => setShowBrief(false)}
          />
        </div>
      )}

      {/* Briefs */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>📄 בריפים ({briefs.filter(b => b.is_current_version).length} פעילים, {briefs.length} כולל גרסאות)</h3>
        {briefs.length === 0 && <div style={{ color: "#64748b", fontSize: 13 }}>אין בריפים. הקליקי "בריף חדש" כדי להתחיל.</div>}
        {Object.entries(briefsByType).map(([type, list]) => (
          <div key={type} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
              {type === "school_level" ? "בית-ספרי" : type === "new_course" ? "קורס חדש" : type}
            </div>
            {list.sort((a, b) => b.version_number - a.version_number).map(b => (
              <div key={b.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 10px", background: b.is_current_version ? "#f0fdf4" : "#f8fafc",
                borderRadius: 6, marginBottom: 4, fontSize: 13,
              }}>
                <span>
                  <strong>גרסה {b.version_number}</strong>
                  <span style={{ color: "#94a3b8", marginInlineStart: 8 }}>{new Date(b.created_at).toLocaleString("he-IL")}</span>
                </span>
                <StatusPill value={b.status} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Blockers */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>⛔ חסמים פתוחים ({blockers.length})</h3>
        {blockers.length === 0 && <div style={{ color: "#64748b", fontSize: 13 }}>אין חסמים פתוחים.</div>}
        {blockers.map(b => (
          <div key={b.id} style={{ padding: 10, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{b.blocker_type}</div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{b.description}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                {b.owner_role || "—"} · {b.opened_at ? new Date(b.opened_at).toLocaleString("he-IL") : ""}
              </div>
            </div>
            <StatusPill value={b.severity} />
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <RecommendationsPanel
        folderId={folder.id}
        recommendations={recs}
        onChanged={() => setRefresh(r => r + 1)}
      />

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

const Stat = ({ label, value, mono }) => (
  <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 8 }}>
    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: 14, color: "#0f172a", fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-all", marginTop: 2 }}>
      {value}
    </div>
  </div>
);

function MethodologySection({ folderId, current, onDone }) {
  const [date, setDate] = useState(current.methodology_switch_date || "");
  const [target, setTarget] = useState(current.methodology_switch_to || "conversion");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function save() {
    if (!date) { setErr("נא להזין תאריך"); return; }
    setBusy(true); setErr(null);
    try {
      await scheduleMethodologySwitch(folderId, {
        switch_date: date,
        switch_to:   target,
        requested_by: "marketing_manager",
      });
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div style={sectionStyle}>
      <h3 style={sectionTitle}>🔄 מעבר methodology</h3>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginBottom: 4 }}>תאריך מעבר</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
                 style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6 }} />
        </label>
        <label style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginBottom: 4 }}>יעד</div>
          <select value={target} onChange={e => setTarget(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6 }}>
            <option value="conversion">conversion</option>
            <option value="clicks">clicks</option>
          </select>
        </label>
        <button onClick={save} disabled={busy} style={{
          padding: "9px 16px", background: "#1e3a5f", color: "#fff", border: "none",
          borderRadius: 6, cursor: busy ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13,
        }}>{busy ? "שומר..." : "שמור"}</button>
      </div>
      {err && <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 13 }}>{err}</div>}
    </div>
  );
}

/**
 * FileUpload.jsx — drag/drop + click file upload to Supabase Storage.
 * Used for brief documents + syllabus files.
 */
import React, { useState, useRef } from "react";
import { uploadCampaignFile, fileAccessUrl } from "../../api.js";

export default function FileUpload({
  folderId = null,
  purpose = "brief",
  accept = ".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.csv,.png,.jpg,.jpeg,.webp,.txt,.md",
  value = null,         // { path, name, mime, size, access_url }
  onUploaded = () => {},
  label = "העלאת קובץ",
  hint = null,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const result = await uploadCampaignFile(file, { folderId, purpose });
      onUploaded(result);
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div style={{
        border: drag ? "2px dashed #1e3a5f" : "2px dashed #cbd5e1",
        background: drag ? "#eff6ff" : value ? "#f0fdf4" : "#f8fafc",
        borderRadius: 10, padding: 20, textAlign: "center",
        transition: "all 0.15s ease", cursor: busy ? "not-allowed" : "pointer",
      }}
        onClick={() => !busy && inputRef.current?.click()}
        onDragEnter={e => { e.preventDefault(); setDrag(true); }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault(); setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={e => handleFile(e.target.files?.[0])}
        />
        {busy ? (
          <div style={{ color: "#64748b", fontSize: 14 }}>⏳ מעלה...</div>
        ) : value ? (
          <div style={{ direction: "rtl" }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>✅</div>
            <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 700 }}>
              {value.name}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {value.mime || "—"} · {Math.round((value.size || 0) / 1024)} KB
            </div>
            <a
              href={fileAccessUrl(value.path)} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 12, color: "#1e3a5f", marginTop: 6, display: "inline-block" }}
            >פתח קובץ ↗</a>
            <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
              הקלקה / גרירה תחליף קובץ זה
            </div>
          </div>
        ) : (
          <div style={{ direction: "rtl" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📤</div>
            <div style={{ fontSize: 14, color: "#334155", fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              גרור קובץ לכאן או לחץ לבחירה
            </div>
            {hint && (
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>{hint}</div>
            )}
          </div>
        )}
      </div>
      {error && (
        <div style={{ marginTop: 8, padding: 8, background: "#fee2e2", color: "#b91c1c", borderRadius: 6, fontSize: 12 }}>
          שגיאה: {error}
        </div>
      )}
    </div>
  );
}

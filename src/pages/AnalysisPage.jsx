import React, { useState, useEffect, useRef } from "react";
import {
  uploadQuestionsFile,
  askQuestion,
  getQuestions,
  deleteQuestion,
  runAnalysis,
  cancelRun,
  getAnalysisStatus,
  getRunResults,
  listRuns,
} from "../api.js";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_STEPS = [
  { key: "pending",              label: "ממתין להתחלה",            icon: "⏳" },
  { key: "running_integrity",    label: "בודק שלמות נתונים",       icon: "🔍" },
  { key: "running_fetch",        label: "שולף נתונים",              icon: "📡" },
  { key: "running_numbers",      label: "מחשב מספרים ודיבייט",     icon: "🔢" },
  { key: "running_calculations", label: "מחשב מדדים",               icon: "📊" },
  { key: "running_moderator",    label: "מנחה: מזהה אנומליות",     icon: "🎯" },
  { key: "running_ecosystem",    label: "מנתח אקו-סיסטם חיצוני",  icon: "🌐" },
  { key: "running_analysis",     label: "מנתח תוצאות",              icon: "🧠" },
  { key: "running_synthesis",    label: "מסנתז מסקנות",             icon: "🧩" },
  { key: "completed",            label: "הניתוח הושלם!",            icon: "✅" },
  { key: "failed",               label: "שגיאה בניתוח",             icon: "❌" },
  { key: "error",                label: "שגיאה בניתוח",             icon: "❌" },
];

function statusLabel(status) {
  const step = STATUS_STEPS.find((s) => s.key === status);
  return step ? `${step.icon} ${step.label}` : status;
}

function statusColor(status) {
  if (status === "completed") return "text-green-600 bg-green-50 border-green-200";
  if (status === "error" || status === "failed") return "text-red-600 bg-red-50 border-red-200";
  if (status === "running" || status?.startsWith("running_")) return "text-blue-600 bg-blue-50 border-blue-200";
  return "text-amber-600 bg-amber-50 border-amber-200";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ small = false }) {
  return (
    <div
      className={`border-4 border-accent border-t-transparent rounded-full animate-spin ${
        small ? "w-4 h-4" : "w-7 h-7"
      }`}
    />
  );
}

function QuestionTag({ question, onDelete, deletable = true }) {
  return (
    <div className="flex items-start justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm group">
      <p className="text-slate-700 flex-1 leading-snug">{question.question_text}</p>
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(question.status)}`}>
          {question.status === "pending" ? "ממתין" : question.status === "answered" ? "נענה" : question.status}
        </span>
        {deletable && (
          <button
            onClick={() => onDelete(question.id)}
            className="text-slate-300 hover:text-red-500 transition-colors text-lg leading-none opacity-0 group-hover:opacity-100"
            title="מחק שאלה"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function ProgressTracker({ runId, onComplete, onCancel }) {
  const [status, setStatus] = useState("pending");
  const [runData, setRunData] = useState(null);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const intervalRef = useRef(null);

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelRun(runId);
      clearInterval(intervalRef.current);
      setStatus("failed");
      if (onCancel) onCancel();
    } catch {
      // status will update on next poll
    } finally {
      setCancelling(false);
    }
  }

  useEffect(() => {
    async function poll() {
      try {
        const data = await getAnalysisStatus(runId);
        setRunData(data);
        setStatus(data.status);
        if (data.status === "completed" || data.status === "failed" || data.status === "error") {
          clearInterval(intervalRef.current);
          if (data.status === "completed" && onComplete) onComplete();
        }
      } catch (err) {
        setError(err.message);
        clearInterval(intervalRef.current);
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 5000);
    return () => clearInterval(intervalRef.current);
  }, [runId]);

  const runningSteps = STATUS_STEPS.filter((s) => !["error"].includes(s.key));
  const currentIndex = runningSteps.findIndex((s) => s.key === status);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">מצב ניתוח</h3>
        <span className={`text-sm px-3 py-1 rounded-full border font-medium ${statusColor(status)}`}>
          {statusLabel(status)}
        </span>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {runningSteps.slice(0, -1).map((step, i) => (
          <React.Fragment key={step.key}>
            <div
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                i < currentIndex
                  ? "bg-green-500 border-green-500 text-white"
                  : i === currentIndex
                  ? "border-blue-500 bg-blue-50 text-blue-600"
                  : "border-slate-200 bg-white text-slate-300"
              }`}
              title={step.label}
            >
              {i < currentIndex ? "✓" : i + 1}
            </div>
            {i < runningSteps.length - 2 && (
              <div
                className={`flex-1 h-0.5 min-w-[12px] ${
                  i < currentIndex - 1 ? "bg-green-400" : "bg-slate-200"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Details */}
      {runData && (
        <div className="text-xs text-slate-400 font-mono">
          run_id: {runId?.slice(0, 16)}…
          {runData.started_at && (
            <span className="mr-3">
              התחיל: {new Date(runData.started_at).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem" })}
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {status === "error" && runData?.error_message && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {runData.error_message}
        </div>
      )}

      {/* Polling indicator + cancel */}
      {status !== "completed" && status !== "error" && status !== "failed" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Spinner small />
            <span>מתבצע בדיקה כל 5 שניות…</span>
          </div>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
          >
            {cancelling ? "מבטל…" : "בטל ניתוח"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Results Panel ───────────────────────────────────────────────────────────

function ResultsPanel({ run, onClose }) {
  const summary = run?.results_summary || {};
  const synthesis = summary.synthesis || "";
  const findings = summary.key_findings || [];

  if (!synthesis && findings.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center text-slate-400 text-sm">
        אין תוצאות לריצה זו
      </div>
    );
  }

  // render simple markdown: bold (**), headings (#), line breaks
  function renderMarkdown(text) {
    return text
      .split("\n")
      .map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        if (trimmed.startsWith("## ")) return <h3 key={i} className="font-bold text-slate-800 text-base mt-4 mb-1">{trimmed.slice(3)}</h3>;
        if (trimmed.startsWith("# "))  return <h2 key={i} className="font-bold text-[#1e3a5f] text-lg mt-5 mb-2">{trimmed.slice(2)}</h2>;
        // bold spans
        const parts = trimmed.split(/\*\*(.*?)\*\*/g);
        const rendered = parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p);
        return <p key={i} className="text-slate-700 text-sm leading-relaxed">{rendered}</p>;
      });
  }

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
      <div className="bg-[#1e3a5f] text-white px-5 py-3 flex items-center justify-between">
        <h2 className="font-semibold text-sm">
          דוח סינתזה — {run.id?.slice(0, 8)}…
          {run.completed_at && (
            <span className="text-blue-200 font-normal mr-2 text-xs">
              {new Date(run.completed_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}
            </span>
          )}
        </h2>
        <button onClick={onClose} className="text-blue-200 hover:text-white text-xl leading-none">×</button>
      </div>

      <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
        {/* Synthesis */}
        {synthesis && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">דוח מלא</h3>
            <div className="space-y-1">{renderMarkdown(synthesis)}</div>
          </div>
        )}

        {/* Key Findings */}
        {findings.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">ממצאים מרכזיים</h3>
            <ul className="space-y-2">
              {findings.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="text-blue-500 font-bold flex-shrink-0">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const INSTRUCTIONS_KEY = "sv_analyst_instructions";

export default function AnalysisPage() {
  const [questions, setQuestions] = useState([]);
  const [loadingQ, setLoadingQ] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [manualQ, setManualQ] = useState("");
  const [instructions, setInstructions] = useState(
    () => localStorage.getItem(INSTRUCTIONS_KEY) || ""
  );
  const [instructionsSaved, setInstructionsSaved] = useState(true);
  const [addingQ, setAddingQ] = useState(false);
  const [runs, setRuns] = useState([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runId, setRunId] = useState(null);        // נקבע רק לאחר לחיצה על כפתור הרץ
  const [buttonLoading, setButtonLoading] = useState(false);
  const [selectedRunData, setSelectedRunData] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [notification, setNotification] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);   // file waiting for replace/append decision
  const [showRunModal, setShowRunModal] = useState(false); // modal for full vs incremental
  const fileInputRef = useRef(null);

  function notify(msg, type = "success") {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  }

  async function loadQuestions() {
    try {
      const data = await getQuestions();
      setQuestions(data.questions || []);
    } catch (err) {
      notify(`שגיאה בטעינת שאלות: ${err.message}`, "error");
    } finally {
      setLoadingQ(false);
    }
  }

  async function loadRuns() {
    try {
      const data = await listRuns();
      const allRuns = data.runs || [];
      setRuns(allRuns);
      // אם יש ריצה פעילה ואין runId בסשן הנוכחי — resume אוטומטי
      const activeRun = allRuns.find((r) => r.status?.startsWith("running_"));
      if (activeRun && !runId) {
        setRunId(activeRun.id);
      }
    } catch {
      // non-critical
    } finally {
      setLoadingRuns(false);
    }
  }

  useEffect(() => {
    loadQuestions();
    loadRuns();
  }, []);

  async function doUpload(file, mode) {
    setUploading(true);
    setPendingFile(null);
    try {
      const result = await uploadQuestionsFile(file, { mode });
      if (result.questions_extracted === 0) {
        notify(result.message || "לא נוספו שאלות חדשות (כולן כבר קיימות)", "info");
      } else {
        const extra = result.skipped_duplicates > 0
          ? ` (${result.skipped_duplicates} כפולות דולגו)`
          : result.deleted_existing > 0
          ? ` (נמחקו ${result.deleted_existing} ישנות)`
          : "";
        notify(`נוספו ${result.questions_extracted} שאלות${extra}`);
      }
      await loadQuestions();
    } catch (err) {
      notify(`שגיאה בהעלאה: ${err.message}`, "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileUpload(file) {
    if (!file || !file.name.endsWith(".docx")) {
      notify("רק קבצי .docx מותרים", "error");
      return;
    }
    // אם יש שאלות קיימות — שאל מה לעשות
    if (questions.length > 0) {
      setPendingFile(file);
    } else {
      doUpload(file, "replace");
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  async function handleAddManual(e) {
    e.preventDefault();
    if (!manualQ.trim()) return;
    setAddingQ(true);
    try {
      await askQuestion(manualQ.trim());
      setManualQ("");
      notify("השאלה נוספה");
      await loadQuestions();
    } catch (err) {
      notify(`שגיאה: ${err.message}`, "error");
    } finally {
      setAddingQ(false);
    }
  }

  async function handleDeleteQ(id) {
    try {
      await deleteQuestion(id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      notify(`שגיאה במחיקה: ${err.message}`, "error");
    }
  }

  async function handleViewResults(run) {
    if (run.status !== "completed") return;
    setLoadingResults(true);
    try {
      const data = await getRunResults(run.id);
      setSelectedRunData(data);
    } catch (err) {
      notify(`שגיאה בטעינת תוצאות: ${err.message}`, "error");
    } finally {
      setLoadingResults(false);
    }
  }

  const lastCompletedRun = runs.find((r) => r.status === "completed");

  function saveInstructions() {
    localStorage.setItem(INSTRUCTIONS_KEY, instructions);
    setInstructionsSaved(true);
  }

  async function doRunAnalysis(baseRunId = null) {
    setShowRunModal(false);
    setButtonLoading(true);
    try {
      const result = await runAnalysis({
        base_run_id: baseRunId,
        instructions: instructions.trim() || null,
      });
      setRunId(result.run_id);
      notify(baseRunId ? "ניתוח מצטבר הופעל ברקע" : "ניתוח מלא הופעל ברקע");
      await loadRuns();
    } catch (err) {
      notify(`שגיאה בהפעלת ניתוח: ${err.message}`, "error");
    } finally {
      setButtonLoading(false);
    }
  }

  function handleRunAnalysis() {
    if (lastCompletedRun) {
      setShowRunModal(true);
    } else {
      doRunAnalysis(null);
    }
  }

  const pendingQuestions = questions.filter((q) => q.status === "pending");

  return (
    <div className="page-content space-y-8" dir="rtl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">ניתוח שלב 0</h1>
        <p className="text-slate-500 text-sm mt-0.5">העלה שאלות מחקר, הפעל ניתוח וצפה בסטטוס</p>
      </div>

      {/* Replace / Append modal */}
      {pendingFile && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl">📋</span>
              <div>
                <h3 className="font-semibold text-slate-800 text-base">
                  יש כבר {questions.length} שאלות
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  קובץ: <strong className="text-slate-700">{pendingFile.name}</strong>
                  <br />מה תרצי לעשות עם השאלות הקיימות?
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => doUpload(pendingFile, "replace")}
                className="w-full flex items-start gap-3 border-2 border-red-200 hover:border-red-400 hover:bg-red-50 rounded-xl p-3 text-right transition-colors group"
              >
                <span className="text-xl mt-0.5">🔄</span>
                <div>
                  <p className="font-semibold text-slate-800 text-sm group-hover:text-red-700">
                    החלף הכל
                  </p>
                  <p className="text-xs text-slate-400">
                    מחק את {questions.length} השאלות הקיימות והוסף את השאלות מהקובץ החדש
                  </p>
                </div>
              </button>

              <button
                onClick={() => doUpload(pendingFile, "append")}
                className="w-full flex items-start gap-3 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl p-3 text-right transition-colors group"
              >
                <span className="text-xl mt-0.5">➕</span>
                <div>
                  <p className="font-semibold text-slate-800 text-sm group-hover:text-blue-700">
                    הוסף שאלות חדשות בלבד
                  </p>
                  <p className="text-xs text-slate-400">
                    שמור על השאלות הקיימות — הוסף רק שאלות שעדיין לא ברשימה
                  </p>
                </div>
              </button>
            </div>

            <button
              onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="w-full text-slate-400 hover:text-slate-600 text-sm py-1 transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Run mode modal — full vs incremental */}
      {showRunModal && lastCompletedRun && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl">🚀</span>
              <div>
                <h3 className="font-semibold text-slate-800 text-base">הפעלת ניתוח</h3>
                <p className="text-slate-500 text-sm mt-1">
                  קיים ניתוח מושלם מ-
                  <strong className="text-slate-700">
                    {new Date(lastCompletedRun.started_at).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}
                  </strong>
                  . כיצד להמשיך?
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => doRunAnalysis(lastCompletedRun.id)}
                className="w-full flex items-start gap-3 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl p-3 text-right transition-colors group"
              >
                <span className="text-xl mt-0.5">➕</span>
                <div>
                  <p className="font-semibold text-slate-800 text-sm group-hover:text-blue-700">
                    הוסף שאלות לניתוח הקיים
                  </p>
                  <p className="text-xs text-slate-400">
                    מריץ רק סינתזה מחדש עם השאלות החדשות. הנתונים נלקחים מהניתוח הקודם — מהיר.
                  </p>
                </div>
              </button>

              <button
                onClick={() => doRunAnalysis(null)}
                className="w-full flex items-start gap-3 border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 rounded-xl p-3 text-right transition-colors group"
              >
                <span className="text-xl mt-0.5">🔄</span>
                <div>
                  <p className="font-semibold text-slate-800 text-sm group-hover:text-slate-700">
                    ניתוח מלא מחדש
                  </p>
                  <p className="text-xs text-slate-400">
                    שולף נתונים עדכניים, מריץ את כל השלבים מהתחלה. אורך כ-20-40 דקות.
                  </p>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowRunModal(false)}
              className="w-full text-slate-400 hover:text-slate-600 text-sm py-1 transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {notification && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
            notification.type === "error"
              ? "bg-red-600 text-white"
              : "bg-green-600 text-white"
          }`}
        >
          {notification.msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Questions */}
        <div className="lg:col-span-2 space-y-6">

          {/* Section 1 — File Upload */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
              <h2 className="font-semibold text-slate-700">1. העלאת קובץ שאלות (.docx)</h2>
            </div>
            <div className="p-5 space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
                />
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Spinner />
                    <p className="text-slate-500 text-sm">מעבד קובץ…</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-4xl mb-2">📄</div>
                    <p className="text-slate-600 font-medium">גרור לכאן קובץ .docx</p>
                    <p className="text-slate-400 text-sm mt-1">או לחץ לבחירת קובץ</p>
                  </div>
                )}
              </div>

              {/* Manual question input */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  הוסף שאלה ידנית
                </label>
                <form onSubmit={handleAddManual} className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="הקלד שאלה ולחץ הוסף..."
                    value={manualQ}
                    onChange={(e) => setManualQ(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={addingQ || !manualQ.trim()}
                    className="bg-[#3b82f6] hover:bg-blue-600 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {addingQ ? "…" : "הוסף"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Section 2 — Questions list & Run */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">
                2. שאלות ({questions.length})
              </h2>
              {pendingQuestions.length > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {pendingQuestions.length} ממתינות לניתוח
                </span>
              )}
            </div>
            <div className="p-5">
              {loadingQ ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : questions.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">
                  אין שאלות עדיין. העלה קובץ .docx או הוסף שאלה ידנית.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {questions.map((q) => (
                    <QuestionTag
                      key={q.id}
                      question={q}
                      onDelete={handleDeleteQ}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 3 — הנחיות לאנליסטים */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">3. הנחיות לאנליסטים</h2>
              <span className="text-xs text-slate-400">אופציונלי — מוזרק ל-context של הדיבייט</span>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none text-right"
                dir="rtl"
                rows={5}
                placeholder="לדוגמה: התמקד בשינויים שהתרחשו משנת 2024. אל תסיק מסקנות על קורסים עם פחות מ-50 לידים. בכל ניתוח ציין את מקור הנתון..."
                value={instructions}
                onChange={(e) => { setInstructions(e.target.value); setInstructionsSaved(false); }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {instructionsSaved ? "✓ נשמר" : "לא נשמר"}
                </span>
                <button
                  onClick={saveInstructions}
                  disabled={instructionsSaved}
                  className="text-sm bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 px-4 py-1.5 rounded-lg transition-colors"
                >
                  שמור הנחיות
                </button>
              </div>
            </div>
          </div>

          {/* Section 4 — Run button */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-700 mb-4">4. הפעלת ניתוח</h2>
            <button
              onClick={handleRunAnalysis}
              disabled={buttonLoading}
              className="w-full bg-[#1e3a5f] hover:bg-[#2a4f7c] disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl text-base transition-colors flex items-center justify-center gap-2"
            >
              {buttonLoading ? (
                <><Spinner small /> מפעיל…</>
              ) : (
                "🚀 הרץ ניתוח שלב 0"
              )}
            </button>
            <p className="text-xs text-slate-400 mt-2 text-center">
              הניתוח רץ ברקע — לא צריך להשאיר את הדף פתוח
            </p>
          </div>

          {/* Progress tracker — מוצג רק לאחר לחיצה על כפתור הרץ בסשן הנוכחי */}
          {runId && (
            <ProgressTracker
              runId={runId}
              onComplete={loadRuns}
              onCancel={loadRuns}
            />
          )}
        </div>

        {/* Right column: Previous runs + Results */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
              <h2 className="font-semibold text-slate-700 text-sm">ריצות קודמות</h2>
            </div>
            <div className="p-4">
              {loadingRuns ? (
                <div className="flex justify-center py-4"><Spinner small /></div>
              ) : runs.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-4">אין ריצות קודמות</p>
              ) : (
                <div className="space-y-2">
                  {runs.slice(0, 10).map((run) => (
                    <div
                      key={run.id}
                      onClick={() => handleViewResults(run)}
                      className={`border rounded-lg p-3 transition-colors ${
                        run.status === "completed"
                          ? "cursor-pointer hover:bg-blue-50 hover:border-blue-200 border-slate-100"
                          : "border-slate-100"
                      } ${selectedRunData?.id === run.id ? "bg-blue-50 border-blue-300" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs text-slate-500">
                          {run.id?.slice(0, 8)}…
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(run.status)}`}>
                          {statusLabel(run.status)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 flex items-center gap-2">
                        {run.started_at
                          ? new Date(run.started_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })
                          : "—"}
                        {run.run_metadata?.mode === "incremental" && (
                          <span className="text-purple-500 font-medium">• מצטבר</span>
                        )}
                      </p>
                      {run.status === "completed" && (
                        <p className="text-xs text-blue-400 mt-1">לחץ לצפייה בדוח</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Results panel */}
          {loadingResults && (
            <div className="flex justify-center py-6"><Spinner /></div>
          )}
          {selectedRunData && !loadingResults && (
            <ResultsPanel
              run={selectedRunData}
              onClose={() => setSelectedRunData(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

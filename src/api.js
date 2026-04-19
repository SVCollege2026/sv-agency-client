/**
 * api.js — All backend API calls
 * Base URL from VITE_API_URL env variable (default: http://localhost:8000)
 */

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(method, path, body = null, isFormData = false) {
  const options = {
    method,
    headers: isFormData ? {} : { "Content-Type": "application/json" },
  };

  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, options);

  if (!res.ok) {
    let errMsg = `שגיאת שרת: ${res.status}`;
    try {
      const errData = await res.json();
      errMsg = errData.detail || errMsg;
    } catch {
      // ignore parse errors
    }
    throw new Error(errMsg);
  }

  return res.json();
}

// ─── Questions ────────────────────────────────────────────────────────────────

export async function uploadQuestionsFile(file, { runId = null, mode = "replace" } = {}) {
  const form = new FormData();
  form.append("file", file);
  const params = new URLSearchParams({ mode });
  if (runId) params.set("run_id", runId);
  const res = await fetch(`${BASE}/api/questions/upload?${params}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `שגיאה בהעלאת הקובץ: ${res.status}`);
  }
  return res.json();
}

export async function askQuestion(question, runId = null) {
  return request("POST", "/api/questions/ask", { question, run_id: runId });
}

export async function getQuestions(runId = null) {
  const url = runId ? `/api/questions/?run_id=${runId}` : "/api/questions/";
  return request("GET", url);
}

export async function deleteQuestion(id) {
  return request("DELETE", `/api/questions/${id}`);
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

export async function runAnalysis(questions = null) {
  return request("POST", "/api/analysis/run", { questions });
}

export async function getAnalysisStatus(runId) {
  return request("GET", `/api/analysis/status/${runId}`);
}

export async function getRunResults(runId) {
  // status/{runId} returns both status + results_summary for completed runs
  return request("GET", `/api/analysis/status/${runId}`);
}

export async function getRunSynthesis(runId) {
  // Fetches the synthesis/key_findings stored in analysis_runs.results_summary
  return request("GET", `/api/analysis/status/${runId}`).then(r => r?.results_summary ?? null);
}

export async function getAnalysisResults() {
  return request("GET", "/api/analysis/results");
}

export async function listRuns() {
  return request("GET", "/api/analysis/runs");
}

export async function cancelRun(runId) {
  return request("POST", `/api/analysis/cancel/${runId}`);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStage0() {
  return request("GET", "/api/dashboard/stage0");
}

export async function getCalculations() {
  return request("GET", "/api/dashboard/calculations");
}

export async function getDashboardSummary() {
  return request("GET", "/api/dashboard/summary");
}

/** All structured analytics — full dashboard data */
export async function getAnalytics() {
  return request("GET", "/api/dashboard/analytics");
}

// ─── Bugs ─────────────────────────────────────────────────────────────────────

export async function submitBugReport(data) {
  return request("POST", "/api/bugs/", data);
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export async function getGoals() {
  return request("GET", "/api/goals/");
}

export async function createGoal(goal) {
  return request("POST", "/api/goals/", goal);
}

export async function updateGoal(id, goal) {
  return request("PUT", `/api/goals/${id}`, goal);
}

export async function deleteGoal(id) {
  return request("DELETE", `/api/goals/${id}`);
}

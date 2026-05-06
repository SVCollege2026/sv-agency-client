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

export async function runAnalysis({ questions = null, base_run_id = null, instructions = null } = {}) {
  return request("POST", "/api/analysis/run", { questions, base_run_id, instructions });
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

export async function quickTable(question_text, instructions = null) {
  // Single ad-hoc calculation — no debate, no synthesis. Returns a table layout.
  return request("POST", "/api/analysis/quick-table", { question_text, instructions });
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

export async function getExecutiveAnalysis() {
  return request("GET", "/api/dashboard/executive-analysis");
}

export async function getStage0History() {
  return request("GET", "/api/dashboard/stage0-history");
}

export async function getBaselineFacts() {
  return request("GET", "/api/dashboard/baseline-facts");
}

export async function getStage0Report(reportId) {
  return request("GET", `/api/dashboard/stage0-report/${reportId}`);
}

export async function setStage0Baseline(reportId) {
  return request("POST", `/api/dashboard/stage0-baseline/${reportId}`);
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

// ─── Clarifications ───────────────────────────────────────────────────────────

export async function getClarifications() {
  return request("GET", "/api/clarifications/");
}

export async function addClarification(question) {
  return request("POST", "/api/clarifications/", { question });
}

export async function answerClarification(id, answer) {
  return request("PATCH", `/api/clarifications/${id}`, { answer });
}

export async function deleteClarification(id) {
  return request("DELETE", `/api/clarifications/${id}`);
}

// ─── Media Reports ────────────────────────────────────────────────────────────

export async function getMediaPlatforms() {
  return request("GET", "/api/media-reports/platforms");
}

export async function getMediaDaily(date) {
  return request("GET", `/api/media-reports/daily?date=${encodeURIComponent(date)}`);
}

export async function getMediaWeekly(weekStart, weekEnd) {
  const params = new URLSearchParams();
  if (weekStart) params.set("week_start", weekStart);
  if (weekEnd)   params.set("week_end",   weekEnd);
  const qs = params.toString();
  return request("GET", `/api/media-reports/weekly${qs ? "?" + qs : ""}`);
}

export async function getMediaRange(start, end) {
  return request(
    "GET",
    `/api/media-reports/range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  );
}

export async function getMediaRuns(limit = 50) {
  return request("GET", `/api/media-reports/runs?limit=${limit}`);
}

export async function getMediaWeeklyRuns(limit = 20) {
  return request("GET", `/api/media-reports/weekly-runs?limit=${limit}`);
}

export async function runMediaDaily({ day = null, send_email = false } = {}) {
  return request("POST", "/api/media-reports/run-daily", { day, send_email });
}

export async function runMediaWeekly({ week_start = null, week_end = null, send_email = false } = {}) {
  return request("POST", "/api/media-reports/run-weekly", { week_start, week_end, send_email });
}

export async function sendMediaDailyEmail(day) {
  return request("POST", "/api/media-reports/send-email/daily", { day });
}

export async function sendMediaWeeklyEmail(week_start, week_end) {
  return request("POST", "/api/media-reports/send-email/weekly", { week_start, week_end });
}

// ─── Monthly KPI Y-o-Y ─────────────────────────────────────────────────────
// טבלאות public.monthly_school_kpi + public.monthly_course_kpi_ytd
// מתעדכנות אוטומטית ב-1 לכל חודש דרך scheduler.py

export async function getMonthlySchoolKpi() {
  return request("GET", "/api/media-reports/monthly-kpi/school");
}

export async function getMonthlyCoursesKpi({ year = null, course = null } = {}) {
  const params = new URLSearchParams();
  if (year)   params.set("year", year);
  if (course) params.set("course", course);
  const qs = params.toString();
  return request("GET", `/api/media-reports/monthly-kpi/courses${qs ? "?" + qs : ""}`);
}

export async function runMonthlyKpi(year, month) {
  return request("POST", `/api/media-reports/monthly-kpi/run?year=${year}&month=${month}`);
}

// ─── Forecasting ──────────────────────────────────────────────────────────────

export async function submitForecast({ department = "manual", question, questionKind = "forecast", requestedBy = null, metadata = null } = {}) {
  return request("POST", "/api/forecasting/request", {
    department,
    question,
    question_kind: questionKind,
    requested_by:  requestedBy,
    metadata,
  });
}

export async function getForecastStatus(requestId) {
  return request("GET", `/api/forecasting/request/${requestId}/status`);
}

export async function getForecastResult(requestId) {
  return request("GET", `/api/forecasting/request/${requestId}/result`);
}

export async function listForecasts({ limit = 50, status = null, department = null } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (status)     params.set("status", status);
  if (department) params.set("department", department);
  return request("GET", `/api/forecasting/requests?${params.toString()}`);
}

export async function listPatterns({ kind = null, active = true, minConfidence = null, limit = 50 } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (kind)          params.set("kind", kind);
  if (minConfidence) params.set("min_confidence", minConfidence);
  params.set("active", active ? "true" : "false");
  return request("GET", `/api/forecasting/patterns?${params.toString()}`);
}

export async function getPattern(patternId) {
  return request("GET", `/api/forecasting/patterns/${patternId}`);
}

export async function listCandidatePatterns(limit = 200) {
  return request("GET", `/api/forecasting/candidate-patterns?limit=${limit}`);
}

export async function triggerStage0(requestedBy = "manual") {
  return request("POST", "/api/forecasting/stage0/trigger", { requested_by: requestedBy });
}

export async function getStage0Status() {
  return request("GET", "/api/forecasting/stage0/status");
}

export async function getStage0Runs(limit = 10) {
  return request("GET", `/api/forecasting/stage0/runs?limit=${limit}`);
}

export async function getForecastingCronStatus() {
  return request("GET", "/api/forecasting/cron-status");
}

export async function getRecentSignals({ type = null, limit = 100 } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (type) params.set("type", type);
  return request("GET", `/api/forecasting/signals/recent?${params.toString()}`);
}

// ─── Investigations (Phase 2) ─────────────────────────────────────────────────
// חקירות אסטרטגיות שמורות מ-`media.investigations`. כל חקירה מכילה
// summary, findings, data_gaps, evidence_sources.

export async function getInvestigations({ platform = null, start = null, end = null, status = null, limit = 50 } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (platform) params.set("platform", platform);
  if (start)    params.set("start",    start);
  if (end)      params.set("end",      end);
  if (status)   params.set("status",   status);
  return request("GET", `/api/media-reports/investigations?${params.toString()}`);
}

export async function getInvestigation(id) {
  return request("GET", `/api/media-reports/investigations/${id}`);
}

export async function getInvestigationQuestions({ platform = null, limit = 100 } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (platform) params.set("platform", platform);
  return request("GET", `/api/media-reports/investigations-questions?${params.toString()}`);
}

export async function getMediaStage0Latest() {
  return request("GET", "/api/media-reports/stage0-report/latest");
}

export async function generateMediaStage0({ start = null, end = null } = {}) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end)   params.set("end",   end);
  const qs = params.toString();
  return request("POST", `/api/media-reports/stage0-report${qs ? "?" + qs : ""}`);
}

export async function listMediaStage0(limit = 20) {
  return request("GET", `/api/media-reports/stage0-report/list?limit=${limit}`);
}

export async function runInvestigation({ platform, question, extraData = [], start = null, end = null } = {}) {
  // Backend endpoints (POST /investigate/{platform}) expect query params, not JSON body.
  const params = new URLSearchParams();
  params.set("question", question);
  if (start) params.set("start", start);
  if (end)   params.set("end",   end);
  if (extraData && extraData.length) {
    params.set("extra_data", extraData.join(","));
  }
  return request("POST", `/api/media-reports/investigate/${platform}?${params.toString()}`);
}

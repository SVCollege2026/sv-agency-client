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

export async function getDashboardKpiLive() {
  return request("GET", "/api/dashboard/kpi-live");
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

export async function getLatestForecast() {
  return request("GET", "/api/forecasting/latest");
}

export async function getDeterministicForecast(year = 2026) {
  return request("GET", `/api/forecasting/deterministic?year=${year}`);
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

// ─── Courses & Cycles (Fireberry mirror) ─────────────────────────────────────

export async function getCourses() {
  return request("GET", "/api/courses-cycles/courses");
}

export async function getCycles({ courseId = null, registrationOpen = null } = {}) {
  const params = new URLSearchParams();
  if (courseId) params.set("course_id", courseId);
  if (registrationOpen !== null) params.set("registration_open", registrationOpen);
  const qs = params.toString();
  return request("GET", `/api/courses-cycles/cycles${qs ? "?" + qs : ""}`);
}

export async function updateCycle(cycleId, fields) {
  return request("PATCH", `/api/courses-cycles/cycles/${cycleId}`, fields);
}

export async function createCycle(payload) {
  return request("POST", "/api/courses-cycles/cycles", payload);
}

export async function triggerCoursesScan() {
  return request("POST", "/api/courses-cycles/scan");
}

export async function getCoursesSyncRuns(limit = 10) {
  return request("GET", `/api/courses-cycles/sync-runs?limit=${limit}`);
}

// ─── Campaign Management — Workflow ───────────────────────────────────────────
// Spec 01 v6 — Workflow Spine. POST /requests starts the full pipeline.

export async function submitCampaignRequest(body) {
  // body: { folder_id?, request_type, brief_type, brief_payload, brief_doc_url?, submitter? }
  return request("POST", "/api/workflow/requests", body);
}

export async function getWorkflowItem(itemId) {
  return request("GET", `/api/workflow/items/${itemId}`);
}

export async function approveWorkflowItem(itemId, body) {
  // body: { approved_by, reason? }
  return request("POST", `/api/workflow/items/${itemId}/approve`, body);
}

export async function rejectWorkflowItem(itemId, body) {
  // body: { rejected_by, reason } — reason חובה (Spec 03 §6.2)
  return request("POST", `/api/workflow/items/${itemId}/reject`, body);
}

export async function listWorkflowQueue(targetDepartment = null) {
  const qs = targetDepartment ? `?target_department=${encodeURIComponent(targetDepartment)}` : "";
  return request("GET", `/api/workflow/queue${qs}`);
}

export async function listWorkflowBlockers({ ownerRole = null, severity = null, onlyOpen = true } = {}) {
  const p = new URLSearchParams({ only_open: onlyOpen ? "true" : "false" });
  if (ownerRole) p.set("owner_role", ownerRole);
  if (severity)  p.set("severity",   severity);
  return request("GET", `/api/workflow/blockers?${p.toString()}`);
}

export async function resolveBlocker(blockerId, body) {
  // body: { resolution, resolved_by? }
  return request("POST", `/api/workflow/blockers/${blockerId}/resolve`, body);
}

export async function dispatchDepartment(department, agentId = "ui_dispatcher") {
  return request(
    "POST",
    `/api/workflow/dispatch?department=${encodeURIComponent(department)}&agent_id=${encodeURIComponent(agentId)}`,
  );
}

// ─── Campaign Management — Campaigns (folders + briefs) ───────────────────────

export async function listCampaignFolders({ status = null, fireberryCourseId = null } = {}) {
  const p = new URLSearchParams();
  if (status) p.set("status", status);
  if (fireberryCourseId) p.set("fireberry_course_id", fireberryCourseId);
  const qs = p.toString();
  return request("GET", `/api/campaigns/folders${qs ? "?" + qs : ""}`);
}

export async function getCampaignFolder(folderId, { includeVersions = false } = {}) {
  const qs = includeVersions ? "?include_versions=true" : "";
  return request("GET", `/api/campaigns/folders/${folderId}${qs}`);
}

export async function createCampaignFolder(body) {
  // body: { course_name, fireberry_course_id?, activity_label?, planned_go_live_date?,
  //         methodology_switch_date?, methodology_switch_to?, created_by?, metadata? }
  return request("POST", "/api/campaigns/folders", body);
}

export async function updateCampaignFolder(folderId, body) {
  return request("PATCH", `/api/campaigns/folders/${folderId}`, body);
}

export async function listFolderBriefs(folderId, { includeVersions = false } = {}) {
  const qs = includeVersions ? "?include_versions=true" : "";
  return request("GET", `/api/campaigns/briefs/${folderId}${qs}`);
}

export async function getBriefVersionHistory(folderId, requestType) {
  return request("GET", `/api/campaigns/briefs/${folderId}/${requestType}/history`);
}

// ─── Campaign Management — Notifications (multi-channel) ─────────────────────

export async function listNotifications({ recipientRole = "marketing_manager", onlyUnread = true, limit = 50 } = {}) {
  const p = new URLSearchParams({
    recipient_role: recipientRole,
    only_unread: onlyUnread ? "true" : "false",
    limit: String(limit),
  });
  return request("GET", `/api/notifications/?${p.toString()}`);
}

export async function markNotificationRead(eventId, byRole = "marketing_manager") {
  return request("POST", `/api/notifications/${eventId}/read?by_role=${encodeURIComponent(byRole)}`);
}

export async function listNotificationChannels({ activeOnly = false } = {}) {
  const qs = activeOnly ? "?active_only=true" : "";
  return request("GET", `/api/notifications/channels${qs}`);
}

export async function toggleNotificationChannel(channelId, body) {
  // body: { is_active, changed_by?, change_reason? }
  return request("PATCH", `/api/notifications/channels/${channelId}/active`, body);
}

export async function listNotificationPreferences(recipientRole = null) {
  const qs = recipientRole ? `?recipient_role=${encodeURIComponent(recipientRole)}` : "";
  return request("GET", `/api/notifications/preferences${qs}`);
}

export async function upsertNotificationPreference(body) {
  // body: { recipient_role, channel_id, event_type, is_enabled, min_severity }
  return request("PUT", "/api/notifications/preferences", body);
}

// ─── Campaign Management — Settings ─────────────────────────────────────────

export async function getGeneralSettings() {
  return request("GET", "/api/settings/general");
}

export async function updateGeneralSettings(body) {
  // body: { payload, updated_by, change_reason? }
  return request("PUT", "/api/settings/general", body);
}

export async function getCourseSettings(folderId) {
  return request("GET", `/api/settings/course/${folderId}`);
}

export async function upsertCourseSettings(folderId, body) {
  return request("PUT", `/api/settings/course/${folderId}`, body);
}

export async function listPlatformSettings({ activeOnly = false } = {}) {
  const qs = activeOnly ? "?active_only=true" : "";
  return request("GET", `/api/settings/platform${qs}`);
}

export async function getPlatformSettings(platform) {
  return request("GET", `/api/settings/platform/${platform}`);
}

export async function updatePlatformSettings(platform, body) {
  // body: { payload, formats?, is_active?, updated_by, change_reason? }
  return request("PUT", `/api/settings/platform/${platform}`, body);
}

export async function getEffectiveSettings({ folderId = null, platform = null } = {}) {
  const p = new URLSearchParams();
  if (folderId) p.set("folder_id", folderId);
  if (platform) p.set("platform",  platform);
  const qs = p.toString();
  return request("GET", `/api/settings/effective${qs ? "?" + qs : ""}`);
}

export async function listMediaRules({ scope = null, activeOnly = true } = {}) {
  const p = new URLSearchParams({ active_only: activeOnly ? "true" : "false" });
  if (scope) p.set("scope", scope);
  return request("GET", `/api/settings/rules?${p.toString()}`);
}

export async function createMediaRule(body) {
  return request("POST", "/api/settings/rules", body);
}

export async function updateMediaRule(ruleId, body) {
  return request("PATCH", `/api/settings/rules/${ruleId}`, body);
}

export async function listBudgetSources(folderId = null) {
  const qs = folderId ? `?folder_id=${folderId}` : "";
  return request("GET", `/api/settings/budgets/sources${qs}`);
}

export async function createBudgetSource(body) {
  return request("POST", "/api/settings/budgets/sources", body);
}

export async function listBudgetAllocations(folderId = null) {
  const qs = folderId ? `?folder_id=${folderId}` : "";
  return request("GET", `/api/settings/budgets/allocations${qs}`);
}

export async function decideBudgetAllocation(allocationId, { decision, decidedBy, reason = null } = {}) {
  const p = new URLSearchParams({ decision, decided_by: decidedBy });
  if (reason) p.set("reason", reason);
  return request("PATCH", `/api/settings/budgets/allocations/${allocationId}/decide?${p.toString()}`);
}

// ─── Campaign Management — Recommendations Engine ───────────────────────────

export async function runRecommendationEngine(body) {
  // body: { metrics, platform, folder_id?, activity_label?, campaign_ref?, data_window? }
  return request("POST", "/api/recommendations/run", body);
}

export async function listRecommendations({ folderId = null, platform = null, decisionStatus = null, limit = 50 } = {}) {
  const p = new URLSearchParams({ limit: String(limit) });
  if (folderId)       p.set("folder_id", folderId);
  if (platform)       p.set("platform", platform);
  if (decisionStatus) p.set("decision_status", decisionStatus);
  return request("GET", `/api/recommendations/?${p.toString()}`);
}

export async function getRecommendation(recId) {
  return request("GET", `/api/recommendations/${recId}`);
}

export async function decideRecommendation(recId, body) {
  // body: { decided_by, decision, reason?, qa_feedback_dimensions[] }
  return request("POST", `/api/recommendations/${recId}/decide`, body);
}

export async function listRecommendationPolicies({ activeOnly = true } = {}) {
  const qs = activeOnly ? "?active_only=true" : "?active_only=false";
  return request("GET", `/api/recommendations/policies${qs}`);
}

// ─── Campaign Management — QA harnesses ────────────────────────────────────

export async function runSetupSimulation(body) {
  // body: { brief_payload, request_type, folder_id? }
  return request("POST", "/api/qa/setup-simulation", body);
}

export async function runRecommendationsSimulation(body) {
  // body: { metrics, platform, folder_id? }
  return request("POST", "/api/qa/recommendations-simulation", body);
}

// ─── Campaign Management — Closure + Methodology + Dry Run ──────────────────

export async function closeCampaign(folderId, body) {
  // body: { requested_by, reason, campaign_name_confirmation } — reason חובה
  return request("POST", `/api/closure/folders/${folderId}/close`, body);
}

export async function scheduleMethodologySwitch(folderId, body) {
  // body: { switch_date, switch_to: 'conversion'|'clicks', requested_by }
  return request("POST", `/api/closure/folders/${folderId}/methodology-switch`, body);
}

export async function getDryRunStatus() {
  return request("GET", "/api/closure/dry-run-status");
}

// ─── Campaign Management — MAKE department ──────────────────────────────────

export async function syncMakeInventory() {
  return request("POST", "/api/make-dept/inventory/sync");
}

export async function listMakeInventory({ category = null, activeOnly = false } = {}) {
  const p = new URLSearchParams({ active_only: activeOnly ? "true" : "false" });
  if (category) p.set("category", category);
  return request("GET", `/api/make-dept/inventory?${p.toString()}`);
}

export async function markMakeRelevant(inventoryId, body) {
  // body: { relevance_reason, business_label?, confirmed_by? }
  return request("POST", `/api/make-dept/inventory/${inventoryId}/mark-relevant`, body);
}

export async function runMakeHealth() {
  return request("POST", "/api/make-dept/health/run");
}

export async function listMakeHealthEvents({ status = "open", limit = 50 } = {}) {
  const p = new URLSearchParams({ limit: String(limit) });
  if (status) p.set("status", status);
  return request("GET", `/api/make-dept/health/events?${p.toString()}`);
}

// ─── Campaign Management — Platform Connector (Phase 10) ───────────────────

export async function startPlatformConnection(body) {
  // body: { platform, requested_by? }
  return request("POST", "/api/platform-connect/start", body);
}

export async function completePlatformConnection(workflowItemId, body) {
  // body: { platform, api_key_env_name, api_key_value, by? }
  return request("POST", `/api/platform-connect/${workflowItemId}/complete`, body);
}

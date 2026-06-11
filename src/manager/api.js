/**
 * src/manager/api.js — קריאות ה-API של ממשק מנהלת השיווק.
 * read-models (PHASE-1) + קריאות-תצוגה לכל מסכי המוקאפ + דלתות החלטה קיימות.
 * אפס endpoints מומצאים — כל נתיב כאן אומת מול api/routes/* ב-origin/master.
 */

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(method, path, body = null, isFormData = false) {
  const options = {
    method,
    headers: body && !isFormData ? { "Content-Type": "application/json" } : {},
  };
  if (body) options.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    let msg = `שגיאת שרת: ${res.status}`;
    try {
      const data = await res.json();
      msg = data.detail || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

/* ── read-models של הממשק ─────────────────────────────── */

export function getOverview() {
  return request("GET", "/api/manager/overview");
}

export function getApprovalsInbox(tab = "pending", course = null, limit = 100) {
  const params = new URLSearchParams({ tab, limit: String(limit) });
  if (course) params.set("course", course);
  return request("GET", `/api/manager/approvals-inbox?${params}`);
}

export function getRecentDecisions(limit = 50) {
  return request("GET", `/api/decisions/?limit=${limit}`);
}

export function getDecisionsFor(subjectId, limit = 50) {
  return request("GET", `/api/decisions/?subject_id=${subjectId}&limit=${limit}`);
}

export function getDecisionsTrace(correlationId, limit = 100) {
  return request("GET", `/api/decisions/?correlation_id=${correlationId}&limit=${limit}`);
}

/* ── הגדרות-מדיה גלובליות — היקף-הניהול (פריסת-המדיה המאושרת) ── */

export function getGeneralSettings() {
  return request("GET", "/api/settings/general");
}

/* ── תיקיות (קורסים) ומחזורים — עמוד-השדרה של הניווט ── */

export function getFolders() {
  return request("GET", "/api/campaigns/folders");
}

export function createFolder({ courseName, plannedGoLiveDate = null, metadata = {} }) {
  return request("POST", "/api/campaigns/folders", {
    course_name: courseName,
    planned_go_live_date: plannedGoLiveDate,
    created_by: "marketing_manager",
    metadata,
  });
}

export function getFolder(folderId, includeVersions = false) {
  return request("GET", `/api/campaigns/folders/${folderId}?include_versions=${includeVersions}`);
}

export function getCycles(courseId = null) {
  const q = courseId ? `?course_id=${courseId}` : "";
  return request("GET", `/api/courses-cycles/cycles${q}`);
}

/* ── תוצרים (artifacts) — טבלת-הקורס, תיק-פריט, Review ── */

export function getArtifacts({ folderId = null, status = null, artifactType = null, limit = 200 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (folderId) params.set("folder_id", folderId);
  if (status) params.set("status", status);
  if (artifactType) params.set("artifact_type", artifactType);
  return request("GET", `/api/artifacts/?${params}`);
}

export function getArtifact(artifactId) {
  return request("GET", `/api/artifacts/${artifactId}`);
}

/* ── workflow — חסמים ותהליכים ── */

export function getBlockers() {
  return request("GET", "/api/workflow/blockers");
}

export function getWorkflowItem(itemId) {
  return request("GET", `/api/workflow/items/${itemId}`);
}

/* ── המלצות מדיה — להעשרת כרטיסי-הגלריה (read בלבד) ── */

export function getRecommendations(limit = 100) {
  return request("GET", `/api/recommendations/?limit=${limit}`);
}

/* ── תקציב — פריסות מדיה ותקציב ── */

export function getBudgetAllocations() {
  return request("GET", "/api/settings/budgets/allocations");
}

export function getBudgetSources() {
  return request("GET", "/api/settings/budgets/sources");
}

/* ── הערות — חוזה-ההערות האחוד (sql/091) ── */

export function getComments(objectType, objectId, { version = null, status = null } = {}) {
  const params = new URLSearchParams({ object_type: objectType, object_id: objectId });
  if (version != null) params.set("version", String(version));
  if (status) params.set("status", status);
  return request("GET", `/api/comments/?${params}`);
}

export function addComment(body) {
  // body: {object_type, object_id, version?, section_key?, field_path?, body, author?}
  return request("POST", "/api/comments/", body);
}

/* ── בקשה חדשה — דרך דלת-הבקשות הקיימת של ה-workflow ── */

export function submitRequest({ folderId = null, requestType, briefPayload, briefDocUrl = null, briefDocName = null }) {
  return request("POST", "/api/workflow/requests", {
    folder_id: folderId,
    request_type: requestType,
    brief_type: "structured_form",
    brief_payload: briefPayload,
    brief_doc_url: briefDocUrl,
    brief_doc_name: briefDocName,
    submitter: "marketing_manager",
  });
}

export async function uploadBriefFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  return request("POST", "/api/campaigns/upload", fd, true);
}

/* ── דלתות החלטה קיימות — פר-פריט, צמוד-גרסה, בלי bulk ── */

export function approveArtifact(artifactId, note = null) {
  return request("POST", `/api/artifacts/${artifactId}/approve`, {
    decided_by: "marketing_manager",
    note,
  });
}

export function requestArtifactRevision(artifactId, revisionNote) {
  return request("POST", `/api/artifacts/${artifactId}/request-revision`, {
    decided_by: "marketing_manager",
    revision_note: revisionNote,
  });
}

export function decideAllocation(allocationId, decision, reason = null) {
  const params = new URLSearchParams({ decision, decided_by: "marketing_manager" });
  if (reason) params.set("reason", reason);
  return request(
    "PATCH",
    `/api/settings/budgets/allocations/${allocationId}/decide?${params}`,
  );
}

export function decideRecommendation(recId, decision, reason = null) {
  return request("POST", `/api/recommendations/${recId}/decide`, {
    decided_by: "marketing_manager",
    decision, // 'approve' | 'reject'
    reason,
  });
}

export function resolveBlocker(blockerId, resolution) {
  return request("POST", `/api/workflow/blockers/${blockerId}/resolve`, {
    resolution,
    resolved_by: "marketing_manager",
  });
}

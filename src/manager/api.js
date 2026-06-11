/**
 * src/manager/api.js — קריאות ה-API של ממשק מנהלת השיווק (PHASE-1).
 * Endpoints חדשים (PR feature/mgmt-interface-phase1 ב-backend) + דלתות קיימות.
 */

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(method, path, body = null) {
  const options = {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
  };
  if (body) options.body = JSON.stringify(body);

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

/* ── read-models חדשים ─────────────────────────────── */

export function getOverview() {
  return request("GET", "/api/manager/overview");
}

export function getApprovalsInbox(tab = "pending") {
  return request("GET", `/api/manager/approvals-inbox?tab=${tab}`);
}

export function getRecentDecisions(limit = 20) {
  return request("GET", `/api/decisions/?limit=${limit}`);
}

/** ההמלצה המלאה — טקסט, נימוק, מספרים, payload. נשלף רק בפתיחת הפריט. */
export function getRecommendation(recId) {
  return request("GET", `/api/recommendations/${recId}`);
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

/**
 * ManagerLayout.jsx — שלד ממשק המנהלת לפי המוקאפ המחייב:
 * סרגל-צד ימני (הניווט הראשי) + אזור-תוכן + "בקשה חדשה +" גלובלי.
 * מקור הסרגל: הקורסים המנוהלים-הפעילים מהיקף-הניהול שב-DB
 * (media_settings.media_deployment) — לא טבלת-התיקיות הגולמית.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import NewRequestModal from "./components/NewRequestModal.jsx";
import NewCourseModal from "./components/NewCourseModal.jsx";
import { getApprovalsInbox, getFolders, getGeneralSettings } from "./api.js";
import {
  filterInboxItems, managedCourses, stripInternalSteps, testFolderIdSet,
} from "./lib.js";
import "./tokens.css";

export default function ManagerLayout() {
  const [folders, setFolders] = useState([]);
  const [courses, setCourses] = useState([]);
  const [coursesError, setCoursesError] = useState(null);
  const [foldersError, setFoldersError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [requestModal, setRequestModal] = useState(null); // null | {folderId?, newCourse?}
  const [pendingCount, setPendingCount] = useState(null);  // מונה "מחכה לך" לתג בניווט

  const loadFolders = useCallback(() => {
    setFoldersError(null);
    getFolders().then(setFolders).catch((e) => setFoldersError(e.message));
  }, []);
  useEffect(loadFolders, [loadFolders]);

  useEffect(() => {
    getGeneralSettings()
      .then((s) => setCourses(managedCourses(s)))
      .catch((e) => setCoursesError(e.message));
  }, []);

  // מונה הפריטים שמחכים להחלטת המנהלת — לתג בניווט (אישורים = פריט-ניווט מהשורה הראשונה).
  // אותו מסנן בדיוק כמו ApprovalsPage: בלי תיקיות-טסט, בלי שלבי-ביניים פנימיים.
  // ApprovalsPage יכול לעדכן את המונה דרך setPendingCount בלי טעינה כפולה.
  useEffect(() => {
    getApprovalsInbox("pending")
      .then((d) => {
        const items = stripInternalSteps(
          filterInboxItems(d.items || [], testFolderIdSet(folders || [])));
        setPendingCount(items.length);
      })
      .catch(() => setPendingCount(null));
  }, [folders]);

  return (
    <div className="mi-root" dir="rtl" lang="he">
      <a href="#mi-main" className="mi-meta"
         style={{ position: "absolute", insetInlineStart: -9999 }}
         onFocus={(e) => { e.target.style.insetInlineStart = "8px"; }}
         onBlur={(e) => { e.target.style.insetInlineStart = "-9999px"; }}>
        דלגי לתוכן
      </a>

      <div className="mi-shell">
        <Sidebar courses={courses} coursesError={coursesError}
                 pendingCount={pendingCount}
                 open={sidebarOpen} onClose={() => setSidebarOpen(false)}
                 onNewCourse={() => setRequestModal({ newCourse: true })} />

        <div className="mi-main">
          <div className="mi-topbar">
            <button className="mi-btn mi-btn-ghost mi-sidebar-burger" aria-label="פתיחת תפריט"
                    aria-expanded={sidebarOpen}
                    onClick={() => setSidebarOpen(true)}>
              ☰
            </button>
            <span style={{ flex: 1 }} />
            <button className="mi-btn mi-btn-primary"
                    onClick={() => setRequestModal({})}>
              ＋ בקשה חדשה
            </button>
          </div>

          <main id="mi-main">
            <Outlet context={{ courses, folders, foldersError,
                               pendingCount, setPendingCount,
                               openNewRequest: (opts = {}) => setRequestModal(opts) }} />
          </main>
        </div>
      </div>

      {requestModal && (requestModal.newCourse ? (
        <NewCourseModal onClose={() => setRequestModal(null)}
                        onCreated={loadFolders} />
      ) : (
        <NewRequestModal courses={courses} folders={folders}
                         initialFolderId={requestModal.folderId || null}
                         onClose={() => setRequestModal(null)} />
      ))}
    </div>
  );
}

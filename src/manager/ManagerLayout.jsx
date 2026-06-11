/**
 * ManagerLayout.jsx — שלד ממשק המנהלת לפי המוקאפ המחייב:
 * סרגל-צד ימני (הניווט הראשי, תיקיות דינמיות) + אזור-תוכן + "בקשה חדשה +"
 * גלובלי שפותח את חלון-הבקשה (מסך 5). RTL מלא.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import NewRequestModal from "./components/NewRequestModal.jsx";
import NewCourseModal from "./components/NewCourseModal.jsx";
import { getApprovalsInbox, getFolders } from "./api.js";
import { filterInboxItems, testFolderIdSet } from "./lib.js";
import "./tokens.css";

export default function ManagerLayout() {
  const [folders, setFolders] = useState([]);
  const [foldersError, setFoldersError] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [requestModal, setRequestModal] = useState(null); // null | {folderId?, newCourse?}

  const loadFolders = useCallback(() => {
    setFoldersError(null);
    getFolders().then(setFolders).catch((e) => setFoldersError(e.message));
  }, []);
  useEffect(loadFolders, [loadFolders]);

  useEffect(() => {
    let alive = true;
    if (!folders.length) return undefined;
    // המונה = מה שבאמת מחכה לה: בלי פריטים של תיקיות-טסט (מונה ↔ תוכן עקביים)
    getApprovalsInbox("pending")
      .then((d) => {
        if (!alive) return;
        setPendingCount(filterInboxItems(d?.items ?? [], testFolderIdSet(folders)).length);
      })
      .catch(() => {}); // ה-badge הוא קישוט — הדפים עצמם מדווחים כשל במלואו
    return () => { alive = false; };
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
        <Sidebar folders={folders} foldersError={foldersError}
                 open={sidebarOpen} onClose={() => setSidebarOpen(false)}
                 onNewCourse={() => setRequestModal({ newCourse: true })}
                 pendingCount={pendingCount} />

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
            <Outlet context={{ setPendingCount, folders, foldersError,
                               openNewRequest: (opts = {}) => setRequestModal(opts) }} />
          </main>
        </div>
      </div>

      {requestModal && (requestModal.newCourse ? (
        <NewCourseModal onClose={() => setRequestModal(null)}
                        onCreated={loadFolders} />
      ) : (
        <NewRequestModal folders={folders}
                         initialFolderId={requestModal.folderId || null}
                         onClose={() => setRequestModal(null)} />
      ))}
    </div>
  );
}

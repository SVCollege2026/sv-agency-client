/**
 * Sidebar.jsx — סרגל-הצד הימני מהמוקאפ. הניווט הראשי של הממשק.
 *
 * התיקיות = עמוד-השדרה: סקירה כללית · כל הקורסים · תיקייה לכל קורס אמיתי
 * (מ-campaign_folders, דינמי — אפס hardcode) · קידומי סושיאל · פריסות מדיה
 * ותקציב · + פתיחת קורס חדש. למטה: המנהלת. תיקיות-טסט לא מוצגות.
 */
import React from "react";
import { NavLink } from "react-router-dom";
import { MANAGER, courseTone, groupFoldersByCourse } from "../lib.js";

function SideLink({ to, icon, tone = "accent", label, end = false, onNavigate, badge }) {
  return (
    <NavLink to={to} end={end} onClick={onNavigate}
      className={({ isActive }) => `mi-sidelink${isActive ? " mi-sidelink-active" : ""}`}>
      <span className="mi-sidelink-icon" aria-hidden="true"
            style={{ background: `var(--mi-${tone}-bg, var(--mi-accent-bg))`,
                     color: `var(--mi-${tone}, var(--mi-accent))` }}>
        {icon}
      </span>
      <span style={{ flex: 1, minInlineSize: 0, overflow: "hidden",
                     textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {badge > 0 && <span className="mi-nav-badge">{badge}</span>}
    </NavLink>
  );
}

export default function Sidebar({ folders, foldersError, open, onClose, onNewCourse, pendingCount = 0 }) {
  // תיקייה-לכל-קורס: projection שמקבץ את תיקיות-העבודה לפי הקורס הקנוני
  const courses = groupFoldersByCourse(folders || []);

  return (
    <>
      {open && <div className="mi-sidebar-overlay" onClick={onClose} aria-hidden="true" />}
      <aside className={`mi-sidebar${open ? " mi-sidebar-open" : ""}`}
             aria-label="ניווט ראשי">
        <div className="mi-sidebar-head">
          <span className="mi-sidebar-logo" aria-hidden="true">SV</span>
          ניהול מדיה וקמפיינים
        </div>

        <nav aria-label="תיקיות">
          <SideLink to="/media" end icon="🏠" tone="accent" label="סקירה כללית" onNavigate={onClose} />
          <SideLink to="/media/courses" end icon="🗂" tone="info" label="כל הקורסים" onNavigate={onClose} />

          {foldersError && (
            <p className="mi-meta" role="alert" style={{ padding: "6px 10px", color: "var(--mi-danger)" }}>
              הקורסים לא נטענו — {foldersError}
            </p>
          )}
          {courses.map((c) => (
            <SideLink key={c.key} to={`/media/courses/${encodeURIComponent(c.key)}`}
                      icon={(c.name || "?").trim().charAt(0)}
                      tone={courseTone(c.name)} label={c.name} onNavigate={onClose} />
          ))}

          <hr className="mi-sidebar-divider" />

          <SideLink to="/media/social" icon="📣" tone="primary" label="קידומי סושיאל" onNavigate={onClose} />
          <SideLink to="/media/plans" icon="📊" tone="success" label="פריסות מדיה ותקציב" onNavigate={onClose} />
          <SideLink to="/media/approvals" icon="✋" tone="warning" label="אישורים" onNavigate={onClose}
                    badge={pendingCount} />

          <button type="button" className="mi-sidelink"
                  onClick={() => { onClose?.(); onNewCourse?.(); }}>
            <span className="mi-sidelink-icon" aria-hidden="true"
                  style={{ background: "var(--mi-primary-soft)", color: "var(--mi-primary)" }}>＋</span>
            פתיחת קורס חדש
          </button>
        </nav>

        <div className="mi-sidebar-user">
          <span className="mi-avatar" aria-hidden="true">{MANAGER.name.charAt(0)}</span>
          <span>
            <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--mi-ink)" }}>
              {MANAGER.name}
            </span>
            <span className="mi-meta">{MANAGER.role}</span>
          </span>
        </div>
      </aside>
    </>
  );
}

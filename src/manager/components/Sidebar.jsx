/**
 * Sidebar.jsx — סרגל-הצד מהמוקאפ, אחד-לאחד (תיקון נירית 11/06):
 * · דאטה: הקורסים המנוהלים-הפעילים בלבד (היקף-הניהול שב-DB, שם קנוני אחד) —
 *   לא טבלת-התיקיות הגולמית. ההיסטוריה נשארת בדאטה, לא בניווט.
 * · נראות: אייקוני-קו אפורים (לא אותיות בעיגולים), הפרדות בין קבוצות,
 *   מצב-נבחר ורוד, פס-אייקונים צר בקצה, והמשתמשת למטה.
 */
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Icon, { courseIconName } from "./icons.jsx";
import { MANAGER } from "../lib.js";

function SideLink({ to, icon, label, end = false, onNavigate, badge = null }) {
  return (
    <NavLink to={to} end={end} onClick={onNavigate}
      className={({ isActive }) => `mi-sidelink${isActive ? " mi-sidelink-active" : ""}`}>
      <span className="mi-sidelink-ic" aria-hidden="true"><Icon name={icon} /></span>
      <span style={{ flex: 1, minInlineSize: 0, overflow: "hidden",
                     textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {badge != null && badge > 0 && (
        <span className="mi-nav-badge" aria-label={`${badge} ממתינים`}>{badge}</span>
      )}
    </NavLink>
  );
}

export default function Sidebar({ courses = [], coursesError, pendingCount = null,
                                  open, onClose, onNewCourse }) {
  const navigate = useNavigate();

  return (
    <>
      {open && <div className="mi-sidebar-overlay" onClick={onClose} aria-hidden="true" />}
      <aside className={`mi-sidebar${open ? " mi-sidebar-open" : ""}`}
             aria-label="ניווט ראשי">
        <div className="mi-sidebar-col">
          <div className="mi-sidebar-head">
            <span className="mi-sidebar-logo" aria-hidden="true">א</span>
            ניהול מדיה וקמפיינים
          </div>

          <nav aria-label="תיקיות">
            <SideLink to="/media" end icon="overview" label="סקירה כללית" onNavigate={onClose} />
            <SideLink to="/media/approvals" icon="gallery" label="מה מחכה לי"
                      badge={pendingCount} onNavigate={onClose} />
            <SideLink to="/media/courses" end icon="folders" label="כל הקורסים" onNavigate={onClose} />

            {coursesError && (
              <p className="mi-meta" role="alert" style={{ padding: "6px 12px", color: "var(--mi-danger)" }}>
                הקורסים לא נטענו — {coursesError}
              </p>
            )}
            {courses.map((c) => (
              <SideLink key={c} to={`/media/courses/${encodeURIComponent(c)}`}
                        icon={courseIconName(c)} label={c} onNavigate={onClose} />
            ))}

            <hr className="mi-sidebar-divider" />

            <SideLink to="/media/social" icon="users" label="קידומי סושיאל" onNavigate={onClose} />
            <SideLink to="/media/plans" icon="chart" label="פריסות מדיה ותקציב" onNavigate={onClose} />

            <button type="button" className="mi-sidelink"
                    onClick={() => { onClose?.(); onNewCourse?.(); }}>
              <span className="mi-sidelink-ic" aria-hidden="true"><Icon name="plus" /></span>
              פתיחת קורס חדש
            </button>
          </nav>

          <div className="mi-sidebar-user">
            <span className="mi-avatar" aria-hidden="true">{MANAGER.name.charAt(0)}</span>
            <span style={{ flex: 1, minInlineSize: 0 }}>
              <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--mi-ink)" }}>
                {MANAGER.name}
              </span>
              <span className="mi-meta">{MANAGER.role}</span>
            </span>
            <span aria-hidden="true" style={{ color: "var(--mi-ink-3)" }}>
              <Icon name="chevron" size={16} />
            </span>
          </div>
        </div>

        {/* הפס הצר בקצה הסרגל — כמו במוקאפ */}
        <div className="mi-rail" aria-label="קיצורים">
          <button type="button" className="mi-rail-btn mi-rail-btn-active" title="סקירה כללית"
                  aria-label="סקירה כללית"
                  onClick={() => { onClose?.(); navigate("/media"); }}>
            <Icon name="grid" size={17} />
          </button>
          <button type="button" className="mi-rail-btn" title="תצוגת אישורים — גלריה"
                  aria-label="תצוגת אישורים"
                  onClick={() => { onClose?.(); navigate("/media/approvals"); }}>
            <Icon name="gallery" size={17} />
          </button>
        </div>
      </aside>
    </>
  );
}

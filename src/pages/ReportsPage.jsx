import React, { useState } from "react";

const REPORT_SECTIONS = [
  {
    id: "daily",
    title: "דוחות יומיים",
    icon: "📅",
    description: "סקירה יומית של לידים, פניות ופעילות שיווקית",
    reports: [
      {
        id: "daily-leads",
        title: "לידים יומיים",
        embedUrl: null, // Will be filled with Supabase embed URL
        description: "מעקב יומי אחר כמות ואיכות הלידים",
      },
      {
        id: "daily-conversions",
        title: "המרות יומיות",
        embedUrl: null,
        description: "שיעורי המרה ורישום יומיים",
      },
    ],
  },
  {
    id: "weekly",
    title: "דוחות שבועיים",
    icon: "📊",
    description: "ניתוח שבועי של מגמות ביצועים שיווקיים",
    reports: [
      {
        id: "weekly-summary",
        title: "סיכום שבועי",
        embedUrl: null,
        description: "מגמות שבועיות של כלל פעילות הסוכנות",
      },
      {
        id: "weekly-suppliers",
        title: "ביצועי ספקים שבועי",
        embedUrl: null,
        description: "השוואת ביצועי ספקי לידים לאורך השבוע",
      },
    ],
  },
];

function ReportCard({ report }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <h3 className="font-semibold text-slate-700">{report.title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{report.description}</p>
        </div>
        <span className={`text-slate-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
          ▼
        </span>
      </div>

      {expanded && (
        <div className="border-t border-slate-100">
          {report.embedUrl ? (
            <iframe
              src={report.embedUrl}
              title={report.title}
              className="w-full h-96 border-0"
              loading="lazy"
            />
          ) : (
            <div className="p-8 text-center bg-slate-50">
              <div className="text-4xl mb-3">🔗</div>
              <p className="text-slate-500 font-medium text-sm">
                דוח זה יהיה זמין לאחר חיבור Supabase
              </p>
              <p className="text-slate-400 text-xs mt-1">
                הגדר את embed URL מ-Supabase Realtime Dashboard
              </p>
              <div className="mt-4 bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-mono text-slate-400 inline-block">
                embedUrl: null → יש להגדיר בקוד
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <div className="page-content space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">דוחות יומיים ושבועיים</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            נתונים מתעדכנים אוטומטית מ-Supabase
          </p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          מתעדכן בזמן אמת
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3">
        <span className="text-amber-500 text-xl flex-shrink-0">ℹ️</span>
        <div>
          <p className="text-amber-800 font-medium text-sm">חיבור Supabase ממתין</p>
          <p className="text-amber-700 text-xs mt-0.5">
            הדוחות יוצגו כ-iframes מ-Supabase Realtime. להפעלה — יש להגדיר את embed URLs
            בקובץ{" "}
            <span className="font-mono bg-amber-100 px-1 rounded">ReportsPage.jsx</span>.
          </p>
        </div>
      </div>

      {/* Report sections */}
      {REPORT_SECTIONS.map((section) => (
        <div key={section.id}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{section.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-[#1e3a5f]">{section.title}</h2>
              <p className="text-xs text-slate-400">{section.description}</p>
            </div>
          </div>
          <div className="space-y-3">
            {section.reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        </div>
      ))}

      {/* Supabase embed guide */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-700 mb-3 text-sm">כיצד להוסיף דוח חדש</h3>
        <ol className="space-y-2 text-xs text-slate-600 list-decimal list-inside">
          <li>היכנס ל-Supabase Dashboard → SQL Editor או Table Editor</li>
          <li>צור View או שאילתה עם הנתונים הרצויים</li>
          <li>השג embed URL מהגדרות ה-Dashboard</li>
          <li>
            עדכן את{" "}
            <span className="font-mono bg-white border border-slate-200 px-1 rounded">
              embedUrl
            </span>{" "}
            ב-REPORT_SECTIONS בקובץ זה
          </li>
        </ol>
      </div>
    </div>
  );
}

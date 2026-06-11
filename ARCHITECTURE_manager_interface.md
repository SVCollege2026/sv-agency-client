# ARCHITECTURE — ממשק מנהלת השיווק (/media)

**עודכן:** 11/06/2026 · branch `feature/media-mockup-fidelity`
**משימה:** MEDIA-INTERFACE-MOCKUP-FIDELITY — המסכים של נירית מהמוקאפ, אחד-לאחד.

## עקרון-העל

המוקאפ של נירית הוא המפרט. הסרגל-הימני עם התיקיות הוא הניווט הראשי;
שרשרת הניווט: תיקייה → טבלת פריטי-עבודה → תיק-פריט → Review צמוד-גרסה.
אפס נתונים מומצאים: כל מספר מגיע מ-endpoint חי, כשל-שליפה מוצג, ריק מוצג כריק.

## קבצים

| קובץ | תפקיד |
|---|---|
| `src/manager/ManagerLayout.jsx` | שלד: סרגל-צד + topbar + חלון בקשה-חדשה גלובלי |
| `src/manager/components/Sidebar.jsx` | הניווט הראשי: סקירה, כל הקורסים, תיקייה-לכל-קורס (דינמי), סושיאל, פריסות-ותקציב, אישורים, פתיחת-קורס, כרטיס-המנהלת |
| `src/manager/components/NewRequestModal.jsx` | מסך 5: טקסט חופשי, קובץ/Drive, עדיפות, מועד, שיוך-קורס. POST דרך `/api/workflow/requests` |
| `src/manager/components/RejectDialog.jsx` | דחייה עם סיבה (קיים מ-PHASE-1) |
| `src/manager/pages/OverviewPage.jsx` | מסך-הבית: ברכה, 4 מונים, "מה מחכה לך עכשיו" (פסי-צבע), "פעילות אחרונה" (מסונן), "בקצרה" מול יעד עסקי |
| `src/manager/pages/CoursesPage.jsx` | "כל הקורסים" — כרטיס לכל קורס-קנוני |
| `src/manager/pages/CoursePage.jsx` | מסך 1: לוח-קורס, טאבים טבלה/ציר-זמן/פעילים/אישורים, 3 עמודות-סטטוס נפרדות |
| `src/manager/pages/ItemPage.jsx` | מסך 2: פרטי-פריט, קבצים-וגרסאות, סיכום בדיקות-מערכת (qa_history), פעילות (decision_log) |
| `src/manager/pages/ReviewPage.jsx` | מסך 3: Review צמוד-גרסה, Feed/Story/Reel, קופי/עיצוב/פרטים/הערות, אישור-למרות-ההערות (snapshot), בקשת-שינויים (סיבה חובה) |
| `src/manager/pages/ApprovalsPage.jsx` | מסך 4: גלריה עם thumbnails, "מחכה לאישור שלי"/"אישורים שניתנו" |
| `src/manager/pages/ActivityPage.jsx` | יומן-פעילות מלא (עם מתג "כל פעילות-המערכת") |
| `src/manager/pages/SocialPage.jsx` | קידומי סושיאל = תוצרים ללא שיוך-קורס |
| `src/manager/pages/PlansBudgetPage.jsx` | פריסות מדיה ותקציב: מקורות + הקצאות (החלטות בגלריה בלבד) |
| `src/manager/lib.js` | **ההיגיון התצוגתי הדטרמיניסטי** — ראו למטה |
| `src/manager/api.js` | כל קריאות ה-API — endpoints קיימים בלבד, אומתו מול origin/master |
| `src/manager/tokens.css` | טוקני-עיצוב + שלד sidebar/table/gallery/placement (AA נאכף ב-prebuild) |

## lib.js — החלטות-הליבה

- **projection "תיקייה-לכל-קורס"** (`groupFoldersByCourse`): הדאטה מחזיקה
  תיקיית-עבודה פר-ריצה ("QA — קופי 04/06"); המוקאפ דורש תיקייה-פר-קורס.
  הקיבוץ לפי הקידומת שלפני " — ". זו תצוגה — לא entity חדש (3.1 בתוכנית).
- **תיקיות-טסט לא נספרות** (`isTestFolder`, `testFolderIdSet`, `filterInboxItems`):
  E2E/Sim/diag/בדיקה/Integration/"(טרם זוהה)". סינון-תצוגה בלבד — אפס מחיקה.
- **חסמי-מערכת מנותבים מהפיד** (`isManagerBlocker`): רק חסם שממוען אליה
  (סוג אנושי + owner_role מתאים + לא שריד-טסט) מופיע אצלה.
- **"פעילות אחרונה" מסונן** (`filterActivityForManager`): רק החלטות-שלה + בוצע/טופל.
- **% מהיעד העסקי** (`cyclesForCourse` + `pctOfTarget`): נרשמים בפועל מול
  `target_min_enrollments` של המחזור הרלוונטי — לא מדדי-מדיה. התאמת
  מחזור↔קורס לפי שם בניקוד (מדויק > מתחיל-ב > מכיל), aliases רק EN↔HE.
- **שלוש עמודות-סטטוס נפרדות**: `workStatus` ≠ `approvalStatus` ≠ `requiredOfYou`.
- **נכסי Drive** (`displayableAssetUrl`): קישור-צפייה → thumbnail endpoint;
  כשהקובץ לא נגיש אנונימית — fallback כן עם קישור ל-Drive (לא תצוגה מזויפת).

## Endpoints בשימוש (כולם קיימים — אפס backend חדש)

`/api/manager/overview` · `/api/manager/approvals-inbox` · `/api/decisions/` ·
`/api/campaigns/folders` (+detail) · `/api/courses-cycles/cycles` ·
`/api/artifacts/` (+detail/approve/request-revision) · `/api/workflow/blockers`
(+resolve) · `/api/workflow/requests` (POST) · `/api/campaigns/upload` ·
`/api/comments/` (sql/091) · `/api/recommendations/` (+decide) ·
`/api/settings/budgets/sources|allocations` (+decide)

## מה עוד לא הושלם

- **proxy לנכסי Drive** — תצוגת placement מציגה את הקובץ רק אם הוא נגיש
  לדפדפן; קבצים פרטיים מקבלים קישור-Drive. דורש endpoint backend (קריאת
  bytes דרך OAuth של marketing@).
- **read-model לקורס** — CoursePage מאחד תיקיות ב-N קריאות artifacts
  (קטן היום; כשהדאטה תגדל — endpoint מאוחד).
- **כותרות המלצות** — `_recommendation_items` ב-manager.py לא מושך
  `recommendation_text`; הגלריה מעשירה client-side. עדיף תיקון backend קטן.
- **ביצוע מהלכי-ההיגיינה** (ארכוב תיקיות-טסט, expiry להמלצות-עבר, איחוד
  שמות-קורסים) — ממתין לאישור נירית. ראו ספירות ב-PR.
- מסכי תוכנית-חודשית ודוחות (חבילות B/F) — שלב הבא לפי התוכנית.

import React, { useState, useEffect } from "react";
import { getGoals, createGoal, updateGoal, deleteGoal } from "../api.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function progressPercent(current, target) {
  if (!current || !target || target === 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

function progressColor(pct) {
  if (pct >= 100) return "bg-green-500";
  if (pct >= 70)  return "bg-blue-500";
  if (pct >= 40)  return "bg-amber-500";
  return "bg-red-400";
}

function daysRemaining(targetDate) {
  if (!targetDate) return null;
  const diff = new Date(targetDate) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="w-6 h-6 border-4 border-accent border-t-transparent rounded-full animate-spin" />
  );
}

function GoalCard({ goal, onEdit, onDelete }) {
  const pct = progressPercent(goal.current_value, goal.target_value);
  const days = daysRemaining(goal.target_date);
  const color = progressColor(pct);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-800">{goal.name}</h3>
          {goal.description && (
            <p className="text-xs text-slate-400 mt-0.5">{goal.description}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0 mr-3">
          <button
            onClick={() => onEdit(goal)}
            className="text-slate-400 hover:text-blue-600 transition-colors text-sm px-2 py-1 rounded hover:bg-blue-50"
            title="ערוך"
          >
            ✏️
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            className="text-slate-400 hover:text-red-600 transition-colors text-sm px-2 py-1 rounded hover:bg-red-50"
            title="מחק"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5 text-xs text-slate-500">
          <span>
            {goal.current_value !== null ? goal.current_value?.toLocaleString("he-IL") : "—"}
            {goal.unit && ` ${goal.unit}`}
          </span>
          <span className="font-semibold text-slate-700">
            {pct}%
          </span>
          <span>
            {goal.target_value?.toLocaleString("he-IL")}
            {goal.unit && ` ${goal.unit}`}
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
        {goal.target_date && (
          <span>
            📅 יעד:{" "}
            {new Date(goal.target_date).toLocaleDateString("he-IL", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
        {days !== null && (
          <span
            className={
              days < 0
                ? "text-red-500"
                : days < 14
                ? "text-amber-600"
                : "text-green-600"
            }
          >
            {days < 0
              ? `⚠️ עבר ${Math.abs(days)} ימים`
              : days === 0
              ? "⏰ היום!"
              : `${days} ימים נותרו`}
          </span>
        )}
        {pct >= 100 && (
          <span className="text-green-600 font-semibold">✅ הושג!</span>
        )}
      </div>
    </div>
  );
}

function GoalForm({ initial, onSave, onCancel, loading }) {
  const [form, setForm] = useState(
    initial || {
      name: "",
      current_value: "",
      target_value: "",
      target_date: "",
      unit: "",
      description: "",
    }
  );

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.target_value) return;
    onSave({
      name: form.name.trim(),
      current_value: form.current_value !== "" ? parseFloat(form.current_value) : null,
      target_value: parseFloat(form.target_value),
      target_date: form.target_date || null,
      unit: form.unit.trim() || null,
      description: form.description.trim() || null,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border-2 border-blue-200 rounded-xl p-5 space-y-4 shadow-sm"
    >
      <h3 className="font-semibold text-[#1e3a5f]">
        {initial ? "עריכת יעד" : "יעד חדש"}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            שם היעד <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder='למשל: "שיעור המרה 5%"'
            value={form.name}
            onChange={handleChange}
          />
        </div>

        {/* Current value */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">ערך נוכחי</label>
          <input
            name="current_value"
            type="number"
            step="any"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="0"
            value={form.current_value}
            onChange={handleChange}
          />
        </div>

        {/* Target value */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            ערך יעד <span className="text-red-500">*</span>
          </label>
          <input
            name="target_value"
            type="number"
            step="any"
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="100"
            value={form.target_value}
            onChange={handleChange}
          />
        </div>

        {/* Target date */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">תאריך יעד</label>
          <input
            name="target_date"
            type="date"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={form.target_date}
            onChange={handleChange}
          />
        </div>

        {/* Unit */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">יחידה</label>
          <input
            name="unit"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder='%, ₪, לידים, רישומים…'
            value={form.unit}
            onChange={handleChange}
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">תיאור (אופציונלי)</label>
          <input
            name="description"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="הסבר קצר על היעד..."
            value={form.description}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-[#3b82f6] hover:bg-blue-600 disabled:bg-slate-300 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
        >
          {loading ? "שומר..." : initial ? "שמור שינויים" : "צור יעד"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  function notify(msg, type = "success") {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  }

  async function load() {
    try {
      const data = await getGoals();
      setGoals(data.goals || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(formData) {
    setSaving(true);
    try {
      await createGoal(formData);
      notify("היעד נוצר בהצלחה");
      setShowForm(false);
      await load();
    } catch (err) {
      notify(`שגיאה: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(formData) {
    if (!editingGoal) return;
    setSaving(true);
    try {
      await updateGoal(editingGoal.id, formData);
      notify("היעד עודכן בהצלחה");
      setEditingGoal(null);
      await load();
    } catch (err) {
      notify(`שגיאה: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("למחוק יעד זה?")) return;
    try {
      await deleteGoal(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
      notify("היעד נמחק");
    } catch (err) {
      notify(`שגיאה: ${err.message}`, "error");
    }
  }

  return (
    <div className="page-content space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">יעדים שיווקיים</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            הסוכנים שולפים יעדים אלו בכל ריצה ומשווים אליהם את התוצאות
          </p>
        </div>
        {!showForm && !editingGoal && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#3b82f6] hover:bg-blue-600 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5"
          >
            <span className="text-lg leading-none">+</span> יעד חדש
          </button>
        )}
      </div>

      {/* Toast */}
      {notification && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
            notification.type === "error" ? "bg-red-600 text-white" : "bg-green-600 text-white"
          }`}
        >
          {notification.msg}
        </div>
      )}

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-start gap-3">
        <span className="text-blue-500 text-lg flex-shrink-0">🎯</span>
        <p className="text-blue-800 text-sm">
          <span className="font-semibold">שימוש ביעדים:</span> בכל הרצת ניתוח, הסוכנים שולפים
          יעדים אלו ומשווים את הביצועים הנוכחיים. הגדר יעדים ריאליסטיים עם תאריך יעד ברור.
        </p>
      </div>

      {/* Create form */}
      {showForm && (
        <GoalForm
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          loading={saving}
        />
      )}

      {/* Edit form */}
      {editingGoal && (
        <GoalForm
          initial={editingGoal}
          onSave={handleUpdate}
          onCancel={() => setEditingGoal(null)}
          loading={saving}
        />
      )}

      {/* Goals list */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
          <p className="font-semibold mb-1">שגיאה בטעינת יעדים</p>
          <p>{error}</p>
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-3">🎯</div>
          <h2 className="text-lg font-semibold text-slate-700 mb-2">אין יעדים עדיין</h2>
          <p className="text-slate-400 text-sm mb-5">
            צור יעד ראשון עם ערך יעד ותאריך. הסוכנים ינטרו את ההתקדמות בכל ניתוח.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#3b82f6] hover:bg-blue-600 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            צור יעד ראשון
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={setEditingGoal}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

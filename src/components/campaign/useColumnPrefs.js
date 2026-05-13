/**
 * useColumnPrefs — persists column widths + visibility to localStorage.
 * Key: `folderboard:cols:v1`
 */
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "folderboard:cols:v1";

export function useColumnPrefs(defaults) {
  const [prefs, setPrefs] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        widths:  { ...defaults.widths,   ...(stored.widths  || {}) },
        hidden:  { ...defaults.hidden,   ...(stored.hidden  || {}) },
      };
    } catch {
      return { widths: { ...defaults.widths }, hidden: { ...defaults.hidden } };
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
  }, [prefs]);

  const setWidth = useCallback((colId, px) => {
    setPrefs(p => ({ ...p, widths: { ...p.widths, [colId]: px } }));
  }, []);

  const toggleHidden = useCallback((colId) => {
    setPrefs(p => ({ ...p, hidden: { ...p.hidden, [colId]: !p.hidden[colId] } }));
  }, []);

  return { prefs, setWidth, toggleHidden };
}

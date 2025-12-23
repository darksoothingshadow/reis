/**
 * useTheme - Hook for managing dark/light theme preference.
 * 
 * Stores preference in chrome.storage.local and applies data-theme to shadow root.
 */

import { useState, useEffect, useCallback } from "react";
import { loggers } from "../utils/logger";
import { StorageService, STORAGE_KEYS } from "../services/storage";

export type Theme = "mendelu" | "mendelu-dark";

export interface UseThemeResult {
  /** Current theme */
  theme: Theme;
  /** Whether theme is dark mode */
  isDark: boolean;
  /** Whether theme is loading from storage */
  isLoading: boolean;
  /** Toggle between light and dark theme */
  toggle: () => void;
  /** Set specific theme */
  setTheme: (theme: Theme) => void;
}

const DEFAULT_THEME: Theme = "mendelu";

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from storage on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedTheme = await StorageService.getAsync<Theme>(STORAGE_KEYS.THEME);
        if (storedTheme && (storedTheme === "mendelu" || storedTheme === "mendelu-dark")) {
          setThemeState(storedTheme);
          applyTheme(storedTheme);
        } else {
          applyTheme(DEFAULT_THEME);
        }
      } catch (e) {
        loggers.ui.error("[useTheme] Failed to load theme:", e);
        applyTheme(DEFAULT_THEME);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  // Listen for storage changes (sync across tabs)
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[STORAGE_KEYS.THEME]) {
        const newTheme = changes[STORAGE_KEYS.THEME].newValue as Theme;
        if (newTheme) {
          setThemeState(newTheme);
          applyTheme(newTheme);
        }
      }
    };

    return StorageService.onChanged(handleStorageChange);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    // Set data-theme on <html> element (works in iframe)
    document.documentElement.setAttribute("data-theme", newTheme);
    loggers.ui.info("[useTheme] Applied theme:", newTheme);
  };

  const setTheme = useCallback(async (newTheme: Theme) => {
    try {
      await StorageService.setAsync(STORAGE_KEYS.THEME, newTheme);
      setThemeState(newTheme);
      applyTheme(newTheme);
    } catch (e) {
      loggers.ui.error("[useTheme] Failed to save theme:", e);
    }
  }, []);

  const toggle = useCallback(() => {
    const newTheme: Theme = theme === "mendelu" ? "mendelu-dark" : "mendelu";
    setTheme(newTheme);
  }, [theme, setTheme]);

  return {
    theme,
    isDark: theme === "mendelu-dark",
    isLoading,
    toggle,
    setTheme,
  };
}

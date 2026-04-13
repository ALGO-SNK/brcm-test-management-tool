import { useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  APP_FONT_OPTIONS,
  ACCENT_OPTIONS,
  ThemeContext,
  type AccentMode,
  type AppFontMode,
  type ThemeMode,
} from './themeContext.shared';

const THEME_MODE_KEY = 'theme-mode';
const THEME_ACCENT_KEY = 'theme-accent';
const THEME_FONT_KEY = 'theme-font';

const THEME_MODES: ThemeMode[] = [
  'dark',
  'midnight',
  'slate',
  'light',
  'mist',
  'dawn',
  'oneui-dark',
  'oneui-light',
  'macos-dark',
  'macos-light',
];

const LIGHT_MODES: ThemeMode[] = ['light', 'mist', 'dawn', 'oneui-light', 'macos-light'];

const THEME_TOGGLE_MAP: Record<ThemeMode, ThemeMode> = {
  dark: 'light',
  light: 'dark',
  midnight: 'mist',
  mist: 'midnight',
  slate: 'dawn',
  dawn: 'slate',
  'oneui-dark': 'oneui-light',
  'oneui-light': 'oneui-dark',
  'macos-dark': 'macos-light',
  'macos-light': 'macos-dark',
};

function parseThemeMode(value: string | null): ThemeMode {
  if (value && THEME_MODES.includes(value as ThemeMode)) return value as ThemeMode;
  return 'oneui-dark';
}

function parseAccent(value: string | null): AccentMode {
  if (value && ACCENT_OPTIONS.some((item) => item.value === value)) return value as AccentMode;
  return 'blue';
}

function parseFont(value: string | null): AppFontMode {
  if (value && APP_FONT_OPTIONS.some((item) => item.value === value)) return value as AppFontMode;
  return 'system-default';
}

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    return parseThemeMode(localStorage.getItem(THEME_MODE_KEY));
  });
  const [accent, setAccentMode] = useState<AccentMode>(() => {
    return parseAccent(localStorage.getItem(THEME_ACCENT_KEY));
  });
  const [font, setFontMode] = useState<AppFontMode>(() => {
    return parseFont(localStorage.getItem(THEME_FONT_KEY));
  });

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const newMode: ThemeMode = THEME_TOGGLE_MAP[prev] ?? (LIGHT_MODES.includes(prev) ? 'dark' : 'light');
      localStorage.setItem(THEME_MODE_KEY, newMode);
      return newMode;
    });
  }, []);

  const setTheme = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem(THEME_MODE_KEY, newMode);
  }, []);

  const setAccent = useCallback((newAccent: AccentMode) => {
    setAccentMode(newAccent);
    localStorage.setItem(THEME_ACCENT_KEY, newAccent);
  }, []);

  const setFont = useCallback((newFont: AppFontMode) => {
    setFontMode(newFont);
    localStorage.setItem(THEME_FONT_KEY, newFont);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.setAttribute('data-app-font', font);
  }, [font]);

  return (
    <ThemeContext.Provider value={{ mode, accent, font, toggleTheme, setTheme, setAccent, setFont }}>
      {children}
    </ThemeContext.Provider>
  );
}

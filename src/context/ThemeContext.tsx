import { useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  APP_FONT_OPTIONS,
  ThemeContext,
  type AppFontMode,
  type ThemeMode,
} from './themeContext.shared';

const THEME_MODE_KEY = 'theme-mode';
const THEME_FONT_KEY = 'theme-font';
const THEME_DEFAULT_VERSION_KEY = 'theme-default-version';
const THEME_DEFAULT_VERSION = 'light-v1';

const THEME_MODES: ThemeMode[] = [
  'dark',
  'light',
  'paper',
  'high-contrast',
  'dark-cyan',
  'light-cyan',
  'light-orange',
  'light-blue-grey',
  'black-soft',
];

const THEME_TOGGLE_MAP: Partial<Record<ThemeMode, ThemeMode>> = {
  dark: 'light',
  light: 'dark',
  paper: 'dark',
  'high-contrast': 'dark',
  'dark-teal': 'light',
  'dark-cyan': 'light',
  'black-soft': 'white-soft',
  'white-soft': 'black-soft',
};

function parseThemeMode(value: string | null): ThemeMode {
  if (value && THEME_MODES.includes(value as ThemeMode)) {
    return value as ThemeMode;
  }
  return 'light';
}

function parseFont(value: string | null): AppFontMode {
  if (value === 'aptos') {
    return 'aptos-narrow';
  }

  if (value === 'bookerly' || value === 'caecilia') {
    return 'droid-serif';
  }

  if (value && APP_FONT_OPTIONS.some((o) => o.value === value)) {
    return value as AppFontMode;
  }
  return 'system';
}

function getInitialThemeMode(): ThemeMode {
  const appliedDefaultVersion = localStorage.getItem(THEME_DEFAULT_VERSION_KEY);
  if (appliedDefaultVersion !== THEME_DEFAULT_VERSION) {
    localStorage.setItem(THEME_MODE_KEY, 'light');
    localStorage.setItem(THEME_DEFAULT_VERSION_KEY, THEME_DEFAULT_VERSION);
    return 'light';
  }

  return parseThemeMode(localStorage.getItem(THEME_MODE_KEY));
}

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialThemeMode);

  const [font, setFontMode] = useState<AppFontMode>(() =>
      parseFont(localStorage.getItem(THEME_FONT_KEY)),
  );

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = THEME_TOGGLE_MAP[prev] ?? (prev === 'light' ? 'dark' : 'light');
      localStorage.setItem(THEME_MODE_KEY, next);
      return next;
    });
  }, []);

  const setTheme = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem(THEME_MODE_KEY, newMode);
  }, []);

  const setFont = useCallback((newFont: AppFontMode) => {
    setFontMode(newFont);
    localStorage.setItem(THEME_FONT_KEY, newFont);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font', font);
  }, [font]);

  return (
      <ThemeContext.Provider value={{ mode, font, toggleTheme, setTheme, setFont }}>
        {children}
      </ThemeContext.Provider>
  );
}

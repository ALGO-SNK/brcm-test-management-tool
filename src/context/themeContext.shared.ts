import { createContext } from 'react';

/* --------------------------------------------------------------------------
   Theme modes — match [data-theme="..."] in style.css
   -------------------------------------------------------------------------- */
export type ThemeMode =
    | 'dark'
    | 'light'
    | 'paper'
    | 'high-contrast'
    | 'dark-teal'
    | 'dark-cyan'
    | 'light-blue'
    | 'light-cyan'
    | 'light-orange'
    | 'paper-brown'
    | 'light-blue-grey'
    | 'black-soft'
    | 'white-soft';

/* --------------------------------------------------------------------------
   Font modes — match [data-font="..."] in style.css
   -------------------------------------------------------------------------- */
export type AppFontMode =
    | 'ibm-plex-mono'
    | 'jetbrains-mono'
    | 'roboto-mono'
    | 'source-code-pro'
    | 'space-mono'
    | 'inter'
    | 'manrope'
    | 'system';

export interface ThemeModeOption {
  value: ThemeMode;
  label: string;
  description: string;
}

export interface AppFontOption {
  value: AppFontMode;
  label: string;
  mono: boolean;
}

/* --------------------------------------------------------------------------
   Options — used by WorkspaceSettings preference panels
   -------------------------------------------------------------------------- */
export const THEME_MODE_OPTIONS: ThemeModeOption[] = [
  { value: 'dark',            label: 'Dark',            description: '' },
  { value: 'dark-cyan',       label: 'Arctic',       description: '' },
  { value: 'black-soft',      label: 'Graphite',      description: '' },

  { value: 'light',           label: 'Light',           description: '' },
  { value: 'paper',           label: 'Paper',           description: '' },
  { value: 'light-cyan',      label: 'Mist',      description: '' },
  { value: 'light-orange',    label: 'Amber',    description: '' },
  { value: 'light-blue-grey', label: 'Slate', description: '' },
  { value: 'high-contrast',   label: 'Contrast',   description: '' },
];

export const APP_FONT_OPTIONS: AppFontOption[] = [
  { value: 'ibm-plex-mono',   label: 'IBM Plex Mono',   mono: true },
  { value: 'jetbrains-mono',  label: 'JetBrains Mono',  mono: true },
  { value: 'roboto-mono',     label: 'Roboto Mono',     mono: true },
  { value: 'source-code-pro', label: 'Source Code Pro', mono: true },
  { value: 'space-mono',      label: 'Space Mono',      mono: true },
  { value: 'inter',           label: 'Inter',           mono: false },
  { value: 'manrope',         label: 'Manrope',         mono: false },
  { value: 'system',          label: 'System UI',       mono: false },
];

export interface ThemeContextType {
  mode: ThemeMode;
  font: AppFontMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  setFont: (font: AppFontMode) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
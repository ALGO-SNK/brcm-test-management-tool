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
    | 'jetbrains-mono'
    | 'source-code-pro'
    | 'droid-serif'
    | 'georgia'
    | 'helvetica'
    | 'lucida'
    | 'aptos-narrow'
    | 'inter'
    | 'manrope'
    | 'google-sans'
    | 'montserrat'
    | 'quicksand'
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
  { value: 'jetbrains-mono',  label: 'JetBrains Mono',  mono: true },
  { value: 'source-code-pro', label: 'Source Code Pro', mono: true },
  { value: 'droid-serif',     label: 'Droid Serif',     mono: false },
  { value: 'georgia',         label: 'Georgia',         mono: false },
  { value: 'helvetica',       label: 'Helvetica',       mono: false },
  { value: 'lucida',          label: 'Lucida',          mono: false },
  { value: 'aptos-narrow',    label: 'Aptos Narrow',    mono: false },
  { value: 'inter',           label: 'Inter',           mono: false },
  { value: 'manrope',         label: 'Manrope',         mono: false },
  { value: 'google-sans',     label: 'Google Sans',     mono: false },
  { value: 'montserrat',      label: 'Montserrat',      mono: false },
  { value: 'quicksand',       label: 'Quicksand',       mono: false },
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

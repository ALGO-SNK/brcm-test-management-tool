import { createContext } from 'react';

/* --------------------------------------------------------------------------
   Theme modes — match [data-theme="..."] in style.css
   -------------------------------------------------------------------------- */
export type ThemeMode =
  | 'dark'
  | 'light'
  | 'paper'
  | 'high-contrast';

/* --------------------------------------------------------------------------
   Accent modes — match [data-accent="..."] in style.css
   -------------------------------------------------------------------------- */
export type AccentMode =
  | 'indigo'
  | 'blue'
  | 'light-blue'
  | 'cyan'
  | 'teal'
  | 'green'
  | 'orange'
  | 'brown'
  | 'grey'
  | 'blue-grey'
  | 'white'
  | 'black';

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

export interface AccentOption {
  value: AccentMode;
  label: string;
  gradient: string;
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
  { value: 'dark',          label: 'Dark',          description: 'Pure black surfaces, high-contrast text.' },
  { value: 'light',         label: 'Light',         description: 'Clean white surfaces, maximum readability.' },
  { value: 'paper',         label: 'Paper',         description: 'Warm cream surfaces, easy on the eyes.' },
  { value: 'high-contrast', label: 'High Contrast', description: 'Pure black + white for accessibility.' },
];

export const ACCENT_OPTIONS: AccentOption[] = [
  { value: 'indigo',    label: 'Indigo',      gradient: 'linear-gradient(135deg, #1a237e 0%, #3949ab 100%)' },
  { value: 'blue',      label: 'Blue',        gradient: 'linear-gradient(135deg, #0d47a1 0%, #1976d2 100%)' },
  { value: 'light-blue',label: 'Light Blue',  gradient: 'linear-gradient(135deg, #01579b 0%, #0288d1 100%)' },
  { value: 'cyan',      label: 'Cyan',        gradient: 'linear-gradient(135deg, #006064 0%, #00838f 100%)' },
  { value: 'teal',      label: 'Teal',        gradient: 'linear-gradient(135deg, #004d40 0%, #00695c 100%)' },
  { value: 'green',     label: 'Green',       gradient: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)' },
  { value: 'orange',    label: 'Deep Orange', gradient: 'linear-gradient(135deg, #bf360c 0%, #d84315 100%)' },
  { value: 'brown',     label: 'Brown',       gradient: 'linear-gradient(135deg, #3e2723 0%, #5d4037 100%)' },
  { value: 'grey',      label: 'Grey',        gradient: 'linear-gradient(135deg, #212121 0%, #424242 100%)' },
  { value: 'blue-grey', label: 'Blue Grey',   gradient: 'linear-gradient(135deg, #263238 0%, #37474f 100%)' },
  { value: 'black',     label: 'Black',       gradient: 'linear-gradient(135deg, #000000 0%, #212121 100%)' },
  { value: 'white',     label: 'White',       gradient: 'linear-gradient(135deg, #ffffff 0%, #e8e8e8 100%)' },
];

export const APP_FONT_OPTIONS: AppFontOption[] = [
  { value: 'ibm-plex-mono',  label: 'IBM Plex Mono',   mono: true  },
  { value: 'jetbrains-mono', label: 'JetBrains Mono',  mono: true  },
  { value: 'roboto-mono',    label: 'Roboto Mono',     mono: true  },
  { value: 'source-code-pro',label: 'Source Code Pro', mono: true  },
  { value: 'space-mono',     label: 'Space Mono',      mono: true  },
  { value: 'inter',          label: 'Inter',           mono: false },
  { value: 'manrope',        label: 'Manrope',         mono: false },
  { value: 'system',         label: 'System UI',       mono: false },
];

export interface ThemeContextType {
  mode: ThemeMode;
  accent: AccentMode;
  font: AppFontMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  setAccent: (accent: AccentMode) => void;
  setFont: (font: AppFontMode) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

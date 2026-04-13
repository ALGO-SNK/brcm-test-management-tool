import { createContext } from 'react';

export type ThemeMode =
  | 'dark'
  | 'midnight'
  | 'slate'
  | 'light'
  | 'mist'
  | 'dawn'
  | 'oneui-dark'
  | 'oneui-light'
  | 'macos-dark'
  | 'macos-light';
export type AccentMode = 'blue' | 'cyan' | 'teal' | 'emerald' | 'amber' | 'coral';
export type AppFontMode =
  | 'system-default'
  | 'apple-system'
  | 'samsung-one'
  | 'inter'
  | 'manrope'
  | 'poppins'
  | 'nunito'
  | 'ibm-plex'
  | 'space-grotesk'
  | 'jetbrains-mono'
  | 'roboto-mono'
  | 'ibm-plex-mono'
  | 'source-code-pro';

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
}

export const THEME_MODE_OPTIONS: ThemeModeOption[] = [
  { value: 'oneui-dark', label: 'One UI Dark', description: 'Samsung-style dark with strong UI contrast and clean accents.' },
  { value: 'oneui-light', label: 'One UI Light', description: 'Samsung-inspired bright surfaces with clear hierarchy.' },
  { value: 'macos-dark', label: 'macOS Dark', description: 'Dense graphite dark with subtle depth and restrained glow.' },
  { value: 'macos-light', label: 'macOS Light', description: 'Soft, airy light mode with balanced neutral surfaces.' },
  { value: 'dark', label: 'Dark', description: 'High-contrast dark for focused editing.' },
  { value: 'midnight', label: 'Midnight', description: 'Cool deep-blue dark with soft highlights.' },
  { value: 'slate', label: 'Slate', description: 'Neutral dark surfaces with balanced contrast.' },
  { value: 'light', label: 'Light', description: 'Clean bright canvas for daytime work.' },
  { value: 'mist', label: 'Mist', description: 'Soft cool light for long mixed-contrast sessions.' },
  { value: 'dawn', label: 'Dawn', description: 'Warm paper-like light with muted edges.' },
];

export const ACCENT_OPTIONS: AccentOption[] = [
  { value: 'blue', label: 'Blue', gradient: 'linear-gradient(135deg, #2f7df6 0%, #61b3ff 100%)' },
  { value: 'cyan', label: 'Cyan', gradient: 'linear-gradient(135deg, #0c90b6 0%, #48c7e8 100%)' },
  { value: 'teal', label: 'Teal', gradient: 'linear-gradient(135deg, #0f8f85 0%, #4fc9be 100%)' },
  { value: 'emerald', label: 'Emerald', gradient: 'linear-gradient(135deg, #1a9259 0%, #5ad089 100%)' },
  { value: 'amber', label: 'Amber', gradient: 'linear-gradient(135deg, #b67a16 0%, #f5bf5a 100%)' },
  { value: 'coral', label: 'Coral', gradient: 'linear-gradient(135deg, #d36451 0%, #ff9f8c 100%)' },
];

export const APP_FONT_OPTIONS: AppFontOption[] = [
  { value: 'system-default', label: 'System UI' },
  { value: 'apple-system', label: 'SF Pro (Apple)' },
  { value: 'samsung-one', label: 'Samsung One' },
  { value: 'inter', label: 'Inter' },
  { value: 'manrope', label: 'Manrope' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'nunito', label: 'Nunito Sans' },
  { value: 'ibm-plex', label: 'IBM Plex Sans' },
  { value: 'space-grotesk', label: 'Space Grotesk' },
  { value: 'jetbrains-mono', label: 'JetBrains Mono' },
  { value: 'roboto-mono', label: 'Roboto Mono' },
  { value: 'ibm-plex-mono', label: 'IBM Plex Mono' },
  { value: 'source-code-pro', label: 'Source Code Pro' },
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

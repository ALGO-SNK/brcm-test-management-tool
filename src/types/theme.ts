/**
 * Theme Configuration Types
 */

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeColors {
  primary: string;           // Main action color (e.g., #0078D4)
  secondary: string;        // Secondary color
  accent: string;           // Accent highlights
  background: string;       // Main background
  surface: string;          // Card/panel background
  text: string;             // Primary text
  textSecondary: string;   // Secondary text (muted)
  border: string;           // Border color
  error: string;            // Error state
  warning: string;          // Warning state
  success: string;          // Success state
  info: string;             // Info state
}

export interface ThemeTypography {
  fontFamily: string;       // System font or custom
  fontSize: 12 | 14 | 16 | 18;
  lineHeight: number;       // e.g., 1.5
}

export interface ThemeEditor {
  fontFamily: string;       // Monospace font
  fontSize: 12 | 13 | 14 | 15 | 16;
  theme: 'light' | 'dark' | 'high-contrast';
  tabSize: 2 | 4;
  syntaxHighlight: boolean;
}

export interface ThemeUI {
  borderRadius: 'sharp' | 'rounded' | 'smooth';
  animations: boolean;
  density: 'compact' | 'comfortable' | 'spacious';
}

export interface ThemeConfig {
  id: string;               // Unique theme ID
  name: string;             // Display name
  description?: string;
  mode: ThemeMode;          // light/dark/auto
  colors: ThemeColors;
  typography: ThemeTypography;
  editor: ThemeEditor;
  ui: ThemeUI;
  isBuiltIn: boolean;       // System theme (cannot delete)
  createdAt: string;        // ISO timestamp
  updatedAt: string;        // ISO timestamp
}

export interface ThemeContextType {
  // Current theme
  currentTheme: ThemeConfig;

  // Theme management
  themes: ThemeConfig[];
  selectTheme: (themeId: string) => void;
  createTheme: (config: Omit<ThemeConfig, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTheme: (themeId: string, updates: Partial<ThemeConfig>) => void;
  deleteTheme: (themeId: string) => void;
  exportTheme: (themeId: string) => string;  // JSON string
  importTheme: (json: string) => void;

  // Utilities
  resetToDefault: () => void;
  applyTheme: (config: ThemeConfig) => void;
}

export type PresetThemeName =
  | 'system-default'
  | 'azure-blue'
  | 'high-contrast'
  | 'minimalist-light'
  | 'minimalist-dark';

import { useContext } from 'react';
import { ThemeContext } from './themeContext.shared';

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeContextProvider');
  }

  return context;
}

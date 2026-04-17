import type { ReactNode } from 'react';
import { Header } from './Header';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  onHelpClick?: () => void;
  onSettingsClick?: () => void;
}

export function MainLayout({ children, title, onHelpClick, onSettingsClick }: MainLayoutProps) {
  return (
    <div className="app-shell">
      <Header title={title} onHelpClick={onHelpClick} onSettingsClick={onSettingsClick} />
      <main className="app-main app-main--scroll">
        {children}
      </main>
    </div>
  );
}

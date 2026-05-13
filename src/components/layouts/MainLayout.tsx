import type { ReactNode } from 'react';
import { Header } from './Header';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  onAutomationRepoClick?: () => void;
  onHelpClick?: () => void;
  onSettingsClick?: () => void;
}

export function MainLayout({
  children,
  title,
  onAutomationRepoClick,
  onHelpClick,
  onSettingsClick,
}: MainLayoutProps) {
  return (
    <div className="app-shell">
      <Header
        title={title}
        onAutomationRepoClick={onAutomationRepoClick}
        onHelpClick={onHelpClick}
        onSettingsClick={onSettingsClick}
      />
      <main className="app-main app-main--scroll">
        {children}
      </main>
    </div>
  );
}

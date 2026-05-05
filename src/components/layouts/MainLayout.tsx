import type { ReactNode } from 'react';
import { Header } from './Header';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  onBrowseSeleniumScripts?: () => void;
  canBrowseSeleniumScripts?: boolean;
  onOpenDbUpdater?: () => void;
  onHelpClick?: () => void;
  onSettingsClick?: () => void;
}

export function MainLayout({
  children,
  title,
  onBrowseSeleniumScripts,
  canBrowseSeleniumScripts,
  onOpenDbUpdater,
  onHelpClick,
  onSettingsClick,
}: MainLayoutProps) {
  return (
    <div className="app-shell">
      <Header
        title={title}
        onBrowseSeleniumScripts={onBrowseSeleniumScripts}
        canBrowseSeleniumScripts={canBrowseSeleniumScripts}
        onOpenDbUpdater={onOpenDbUpdater}
        onHelpClick={onHelpClick}
        onSettingsClick={onSettingsClick}
      />
      <main className="app-main app-main--scroll">
        {children}
      </main>
    </div>
  );
}

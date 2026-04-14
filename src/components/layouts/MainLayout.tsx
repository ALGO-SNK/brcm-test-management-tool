import type { ReactNode } from 'react';
import { Header } from './Header';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  onSettingsClick?: () => void;
}

export function MainLayout({ children, title, onSettingsClick }: MainLayoutProps) {
  return (
    <div className="app-shell">
      <Header title={title} onSettingsClick={onSettingsClick} />
      <main className="app-main app-main--scroll" style={{ padding: 'var(--space-5)' }}>
        {children}
      </main>
    </div>
  );
}

import type { ReactNode } from 'react';
import { Header } from './Header';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  onSettingsClick?: () => void;
}

export function MainLayout({ children, title, onSettingsClick }: MainLayoutProps) {
  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--dark-bg)' }}>
      <Header title={title} onSettingsClick={onSettingsClick} />
      <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--spacing-lg)' }}>
        {children}
      </div>
    </div>
  );
}

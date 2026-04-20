import type { ReactNode } from 'react';
/*import { useThemeContext } from '../../context/useThemeContext';*/
import {
  IconHelp,
 /* IconMoon,
  IconSearch,*/
  IconSettings,
 /* IconSun,*/
} from '../Common/Icons';
import brandLogo from '../../assets/brand-logo.png';

interface HeaderProps {
  title?: string;
  contextTitle?: string;
  contextMeta?: string;
  actions?: ReactNode;
  onHelpClick?: () => void;
  onSettingsClick?: () => void;
}

export function Header({
  title = 'Azure DevOps Test Case Editor',
  contextTitle,
  contextMeta,
  actions,
  onHelpClick,
  onSettingsClick,
}: HeaderProps) {
 /* const { mode, toggleTheme } = useThemeContext();*/
  const canOpenHelp = typeof onHelpClick === 'function';
  const canOpenSettings = typeof onSettingsClick === 'function';
  /*const isLightMode = mode === 'light';*/

  return (
    <header className="app-header" title={title}>
      <div className="app-header__brand-group">
        <img src={brandLogo} alt="BromCom" className="app-header__logo" />
        <div className="app-header__brand-copy">
          <span className="app-header__brand">Bromcom</span>
          <span className="app-header__subtitle">Automation Test Case Builder</span>
        </div>
      </div>

      {contextTitle && (
        <div className="app-header__context">
          <span className="app-header__title" title={contextTitle}>{contextTitle}</span>
          {contextMeta && (
            <span className="app-header__meta">{contextMeta}</span>
          )}
        </div>
      )}

      <div className="app-header__actions">
        {actions}
        {/*Hiiden for now*/}
        {/*<button className="app-header__icon-btn" title="Search">
          <IconSearch size={18} />
        </button>
        <button className="app-header__icon-btn" title="Help">
          <IconHelp size={18} />
        </button>*/}
        {/*<button
          className="app-header__icon-btn"
          onClick={toggleTheme}
          title={`Switch to ${isLightMode ? 'dark' : 'light'} mode`}
        >
          {isLightMode ? <IconMoon size={18} /> : <IconSun size={18} />}
        </button>*/}
        <button
          className="app-header__icon-btn"
          onClick={onHelpClick}
          disabled={!canOpenHelp}
          title="Open help guide"
        >
          <IconHelp size={18} />
        </button>
        <button
          className="app-header__icon-btn"
          onClick={onSettingsClick}
          disabled={!canOpenSettings}
          title="Open settings"
        >
          <IconSettings size={18} />
        </button>
      </div>
    </header>
  );
}

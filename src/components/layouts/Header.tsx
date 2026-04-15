import { useThemeContext } from '../../context/useThemeContext';
import {
  IconHelp,
  IconMoon,
  IconSearch,
  IconSettings,
  IconSun,
} from '../Common/Icons';
import brandLogo from '../../assets/brand-logo.png';

interface HeaderProps {
  title?: string;
  onSettingsClick?: () => void;
}

export function Header({ title = 'ADO Test Case Editor', onSettingsClick }: HeaderProps) {
  const { mode, toggleTheme } = useThemeContext();
  const canOpenSettings = typeof onSettingsClick === 'function';
  const isLightMode = mode === 'light';

  return (
    <header className="app-header" title={title}>
      <div className="app-header__brand-group">
        <img src={brandLogo} alt="BromCom" className="app-header__logo" />
        <div className="app-header__brand-copy">
          <span className="app-header__brand">BromCom</span>
          <span className="app-header__subtitle">Test Plan Builder</span>
        </div>
      </div>

      <div className="app-header__actions">
        <button className="app-header__icon-btn" title="Search">
          <IconSearch size={18} />
        </button>
        <button className="app-header__icon-btn" title="Help">
          <IconHelp size={18} />
        </button>
        <button
          className="app-header__icon-btn"
          onClick={toggleTheme}
          title={`Switch to ${isLightMode ? 'dark' : 'light'} mode`}
        >
          {isLightMode ? <IconMoon size={18} /> : <IconSun size={18} />}
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

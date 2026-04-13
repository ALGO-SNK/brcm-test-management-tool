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
  const isLightMode = mode === 'macos-light';

  return (
    <nav className="navbar app-header" title={title}>
      <div className="nav-wrapper">
        <div className="flex items-center gap-md flex-1">
          <div className="flex items-center gap-sm">
            <img src={brandLogo} alt="BromCom" className="app-header__logo" width="32" />
            <span className="app-header__brand">BromCom</span>
            <span className="app-header__subtitle">Test Plan Builder</span>
          </div>
        </div>

        <div className="app-header__actions flex items-center gap-md">
          <button className="btn-icon-flat" title="Search">
            <IconSearch size={18} />
          </button>
          <button className="btn-icon-flat" title="Help">
            <IconHelp size={18} />
          </button>
          <button
            className="btn-icon-flat"
            onClick={toggleTheme}
            title={`Switch to ${isLightMode ? 'dark' : 'light'} mode`}
          >
            {isLightMode ? <IconMoon size={18} /> : <IconSun size={18} />}
          </button>
          <button
            className="btn-icon-flat"
            onClick={onSettingsClick}
            disabled={!canOpenSettings}
            title="Open settings"
          >
            <IconSettings size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
}

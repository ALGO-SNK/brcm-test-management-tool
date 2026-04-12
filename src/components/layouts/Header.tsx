import { AppBar, Toolbar, Typography, IconButton, Box } from '@mui/material';
import { Brightness4, Brightness7, Settings } from '@mui/icons-material';
import { useThemeContext } from '../../context/ThemeContext';

interface HeaderProps {
  title?: string;
  onSettingsClick?: () => void;
}

export function Header({ title = 'ADO Test Case Editor', onSettingsClick }: HeaderProps) {
  const { mode, toggleTheme } = useThemeContext();

  return (
    <AppBar position="static" sx={{ background: 'linear-gradient(135deg, #1a1f3a 0%, #252d4a 100%)' }}>
      <Toolbar>
        <Typography
          variant="h6"
          sx={{
            flexGrow: 1,
            fontWeight: 700,
            letterSpacing: '0.5px',
          }}
        >
          {title}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <IconButton
            onClick={toggleTheme}
            color="inherit"
            title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
            size="small"
          >
            {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
          </IconButton>

          <IconButton
            onClick={onSettingsClick}
            color="inherit"
            title="Open settings"
            size="small"
          >
            <Settings />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

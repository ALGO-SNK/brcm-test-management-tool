import type { ReactNode } from 'react';
import { Box, Container } from '@mui/material';
import { Header } from './Header';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  onSettingsClick?: () => void;
}

export function MainLayout({ children, title, onSettingsClick }: MainLayoutProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Header title={title} onSettingsClick={onSettingsClick} />

      <Container
        maxWidth="xl"
        sx={{
          flex: 1,
          py: 3,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </Container>
    </Box>
  );
}

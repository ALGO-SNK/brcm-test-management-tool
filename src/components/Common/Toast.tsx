import { Alert, Snackbar, Stack } from '@mui/material';
import { useNotification } from '../../context/NotificationContext';

export function Toast() {
  const { notifications, removeNotification } = useNotification();

  return (
    <Stack
      spacing={2}
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {notifications.map(notification => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={notification.duration}
          onClose={() => removeNotification(notification.id)}
          sx={{ pointerEvents: 'auto' }}
        >
          <Alert
            onClose={() => removeNotification(notification.id)}
            severity={
              notification.type === 'success'
                ? 'success'
                : notification.type === 'error'
                  ? 'error'
                  : notification.type === 'warning'
                    ? 'warning'
                    : 'info'
            }
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </Stack>
  );
}

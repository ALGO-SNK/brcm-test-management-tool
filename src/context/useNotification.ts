import { useContext } from 'react';
import { NotificationContext } from './notificationContext.shared';

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationContextProvider');
  }

  return context;
}

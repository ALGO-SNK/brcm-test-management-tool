import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  NotificationContext,
  type Notification,
  type NotificationType,
} from './notificationContext.shared';

export function NotificationContextProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeNotification = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const addNotification = useCallback(
    (type: NotificationType, message: string, duration: number = 4000): string => {
      const id = uuidv4();
      const notification: Notification = { id, type, message, duration };

      setNotifications(prev => [...prev, notification]);

      if (duration > 0) {
        const timer = setTimeout(() => {
          removeNotification(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [removeNotification],
  );

  const clearNotifications = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setNotifications([]);
  }, []);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

import { useNotification } from '../../context/useNotification';
import { IconCheckCircle, IconError, IconInfo, IconWarning, IconX } from './Icons';
import type { NotificationType } from '../../context/notificationContext.shared';

const TOAST_META: Record<NotificationType, { title: string; icon: typeof IconInfo }> = {
  success: { title: 'Success', icon: IconCheckCircle },
  error: { title: 'Something went wrong', icon: IconError },
  warning: { title: 'Attention needed', icon: IconWarning },
  info: { title: 'Heads up', icon: IconInfo },
};

export function Toast() {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className="toast-container">
      {notifications.map((notification) => {
        const meta = TOAST_META[notification.type];
        const Icon = meta.icon;

        return (
          <div key={notification.id} className={`toast toast--${notification.type}`} role="status" aria-live="polite">
            <div className="toast__icon-wrap" aria-hidden="true">
              <Icon size={18} className="toast__icon" />
            </div>
            <div className="toast__body">
              <p className="toast__title">{meta.title}</p>
              <p className="toast__message">{notification.message}</p>
            </div>
            <button
              type="button"
              className="toast__close"
              onClick={() => removeNotification(notification.id)}
              aria-label="Dismiss notification"
            >
              <IconX size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

import { useNotification } from '../../context/useNotification';
import { IconX } from './Icons';

export function Toast() {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className="toast-container">
      {notifications.map(notification => (
        <div key={notification.id} className={`toast toast--${notification.type}`}>
          <span style={{ flex: 1 }}>{notification.message}</span>
          <button
            className="alert__close"
            onClick={() => removeNotification(notification.id)}
          >
            <IconX size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

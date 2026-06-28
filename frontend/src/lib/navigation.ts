import type { NotificationTarget } from '../api/notifications';

export function getNotificationTargetPath(
  target: NotificationTarget | null,
): string | null {
  if (!target) {
    return null;
  }

  if (target.type === 'CHAT') {
    return `/chats/${target.id}`;
  }

  if (target.type === 'TRANSACTION') {
    return `/transactions/${target.id}`;
  }

  if (target.type === 'PRODUCT') {
    return `/products/${target.id}`;
  }

  if (target.type === 'REPORT') {
    return '/reports';
  }

  return null;
}

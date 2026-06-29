import type { NotificationTarget } from '../api/notifications';

interface NotificationTargetPathOptions {
  isAdmin?: boolean;
}

export function getNotificationTargetPath(
  target: NotificationTarget | null,
  options: NotificationTargetPathOptions = {},
): string | null {
  if (!target || !target.id) {
    return null;
  }

  const targetId = encodeURIComponent(target.id);

  if (target.type === 'CHAT' || target.type === 'CHAT_MESSAGE') {
    return `/chats/${targetId}`;
  }

  if (target.type === 'TRANSACTION') {
    return `/transactions/${targetId}`;
  }

  if (target.type === 'PRODUCT') {
    return `/products/${targetId}`;
  }

  if (target.type === 'REPORT') {
    return options.isAdmin ? '/admin/reports' : '/reports';
  }

  return null;
}

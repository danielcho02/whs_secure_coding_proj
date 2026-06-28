import { apiClient } from './client';

export interface NotificationTarget {
  type: string;
  id: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  target: NotificationTarget | null;
}

export interface NotificationPage {
  items: AppNotification[];
  page: number;
  limit: number;
  total: number;
}

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function listNotifications(
  params: ListNotificationsParams = {},
): Promise<NotificationPage> {
  const response = await apiClient.get<ApiSuccess<NotificationPage>>(
    '/notifications',
    { params },
  );
  return response.data.data;
}

export async function markNotificationRead(
  notificationId: string,
): Promise<AppNotification> {
  const response = await apiClient.post<ApiSuccess<AppNotification>>(
    `/notifications/${notificationId}/read`,
    {},
  );
  return response.data.data;
}

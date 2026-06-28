export interface NotificationTargetResponse {
  type: string;
  id: string;
}

export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  message: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
  target: NotificationTargetResponse | null;
}

export interface PaginatedNotificationsResponse {
  items: NotificationResponse[];
  page: number;
  limit: number;
  total: number;
}

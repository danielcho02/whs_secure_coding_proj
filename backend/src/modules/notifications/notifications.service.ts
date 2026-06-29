import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import {
  NotificationResponse,
  PaginatedNotificationsResponse,
} from './dto/notification-response.dto';

const NOTIFICATION_RESPONSE_SELECT = {
  id: true,
  type: true,
  message: true,
  targetType: true,
  targetId: true,
  isRead: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof NOTIFICATION_RESPONSE_SELECT;
}>;

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async listNotifications(
    userId: string,
    query: ListNotificationsDto,
  ): Promise<PaginatedNotificationsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly === true ? { isRead: false } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: NOTIFICATION_RESPONSE_SELECT,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toNotificationResponse(item)),
      page,
      limit,
      total,
    };
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: NOTIFICATION_RESPONSE_SELECT,
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.isRead) {
      return this.toNotificationResponse(notification);
    }

    const updatedNotification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
      select: NOTIFICATION_RESPONSE_SELECT,
    });

    return this.toNotificationResponse(updatedNotification);
  }

  private toNotificationResponse(
    notification: NotificationRecord,
  ): NotificationResponse {
    return {
      id: notification.id,
      type: notification.type,
      title: this.toNotificationTitle(notification.type),
      message: notification.message,
      body: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      target:
        notification.targetType && notification.targetId
          ? { type: notification.targetType, id: notification.targetId }
          : null,
    };
  }

  private toNotificationTitle(type: string): string {
    const titles: Record<string, string> = {
      CHAT: '새 메시지가 도착했습니다',
      TRANSACTION: '거래 진행 상황을 확인해주세요',
      TX: '거래 진행 상황을 확인해주세요',
      REPORT: '신고가 처리되었습니다',
      ADMIN_REPORT: '검토할 신고가 있습니다',
      FAVORITE: '관심 상품 소식',
    };

    return titles[type] ?? '알림';
  }
}

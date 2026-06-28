/* eslint-disable @typescript-eslint/unbound-method */

import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

function createPrismaMock(): PrismaService {
  return {
    notification: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  } as unknown as PrismaService;
}

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const notificationId = '33333333-3333-4333-8333-333333333333';
const notificationRecord = {
  id: notificationId,
  userId,
  type: 'CHAT',
  message: '새 채팅 메시지가 도착했습니다.',
  targetType: 'CHAT',
  targetId: '44444444-4444-4444-8444-444444444444',
  isRead: false,
  createdAt: new Date('2026-06-28T00:00:00.000Z'),
};

describe('NotificationsService', () => {
  let prisma: PrismaService;
  let service: NotificationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
    service = new NotificationsService(prisma);
  });

  it('lists only notifications owned by the authenticated user', async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      notificationRecord,
    ]);
    vi.mocked(prisma.notification.count).mockResolvedValue(1);

    const result = await service.listNotifications(userId, {
      page: 1,
      limit: 20,
    });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
        take: 20,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty('userId');
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('filters unread notifications when requested', async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);
    vi.mocked(prisma.notification.count).mockResolvedValue(0);

    await service.listNotifications(userId, {
      page: 1,
      limit: 20,
      unreadOnly: true,
    });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, isRead: false },
      }),
    );
  });

  it('marks an owned notification as read', async () => {
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(
      notificationRecord,
    );
    vi.mocked(prisma.notification.update).mockResolvedValue({
      ...notificationRecord,
      isRead: true,
    });

    const result = await service.markAsRead(userId, notificationId);

    expect(prisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: notificationId, userId },
      }),
    );
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: notificationId },
        data: { isRead: true },
      }),
    );
    expect(result.isRead).toBe(true);
  });

  it('returns 404 for another user notification id', async () => {
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null);

    await expect(
      service.markAsRead(otherUserId, notificationId),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('is idempotent when a notification is already read', async () => {
    vi.mocked(prisma.notification.findFirst).mockResolvedValue({
      ...notificationRecord,
      isRead: true,
    });

    const result = await service.markAsRead(userId, notificationId);

    expect(result.isRead).toBe(true);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });
});

/* eslint-disable @typescript-eslint/unbound-method */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ProductStatus,
  ReportStatus,
  ReportType,
  Role,
  UserStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

function createPrismaMock(): PrismaService {
  return {
    chatMessage: {
      findUnique: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    report: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  } as unknown as PrismaService;
}

const reporterId = '22222222-2222-4222-8222-222222222222';
const sellerId = '33333333-3333-4333-8333-333333333333';
const productId = '11111111-1111-4111-8111-111111111111';
const chatId = '55555555-5555-4555-8555-555555555555';
const messageId = '66666666-6666-4666-8666-666666666666';
const reportRecord = {
  id: '44444444-4444-4444-8444-444444444444',
  reporterId,
  type: ReportType.PRODUCT,
  targetId: productId,
  reason: '사기 의심',
  description: '외부 결제 유도',
  status: ReportStatus.PENDING,
  adminId: null,
  adminNote: null,
  reviewedAt: null,
  createdAt: new Date('2026-06-28T00:00:00.000Z'),
};
const chatReportRecord = {
  ...reportRecord,
  type: ReportType.CHAT,
  targetId: messageId,
};
const reporterRecord = {
  id: reporterId,
  email: 'reporter@example.com',
  role: Role.USER,
  status: UserStatus.ACTIVE,
};

describe('ReportsService', () => {
  let prisma: PrismaService;
  let service: ReportsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: '77777777-7777-4777-8777-777777777777' },
    ]);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 });
    service = new ReportsService(prisma);
  });

  it('creates a pending product report using the authenticated reporter id', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(reporterRecord);
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      id: productId,
      sellerId,
      title: '아이폰 15',
      status: ProductStatus.ON_SALE,
      isHidden: false,
    });
    vi.mocked(prisma.report.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.report.create).mockResolvedValue(reportRecord);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 });

    const result = await service.createReport(reporterId, {
      targetType: ReportType.PRODUCT,
      targetId: productId,
      reason: '사기 의심',
      description: '외부 결제 유도',
    });

    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          reporterId,
          type: ReportType.PRODUCT,
          targetId: productId,
          reason: '사기 의심',
          description: '외부 결제 유도',
          status: ReportStatus.PENDING,
        },
      }),
    );
    expect(result.reporterId).toBe(reporterId);
    expect(result.status).toBe(ReportStatus.PENDING);
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: 'ADMIN_REPORT',
          message: '새로운 신고가 접수되었습니다.',
          targetType: 'REPORT',
          targetId: reportRecord.id,
        }),
      ],
    });
  });

  it('rejects reports for a missing target', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(reporterRecord)
      .mockResolvedValueOnce(null);

    await expect(
      service.createReport(reporterId, {
        targetType: ReportType.USER,
        targetId: '55555555-5555-4555-8555-555555555555',
        reason: '사기 의심',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects reporting yourself', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(reporterRecord);

    await expect(
      service.createReport(reporterId, {
        targetType: ReportType.USER,
        targetId: reporterId,
        reason: '셀프 신고',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects reporting your own product', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(reporterRecord);
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      id: productId,
      sellerId: reporterId,
      title: '내 상품',
      status: ProductStatus.ON_SALE,
      isHidden: false,
    });

    await expect(
      service.createReport(reporterId, {
        targetType: ReportType.PRODUCT,
        targetId: productId,
        reason: '셀프 상품 신고',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a pending chat message report for a participant', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(reporterRecord);
    vi.mocked(prisma.chatMessage.findUnique).mockResolvedValue({
      id: messageId,
      senderId: sellerId,
      chat: {
        id: chatId,
        buyerId: reporterId,
        sellerId,
      },
    });
    vi.mocked(prisma.report.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.report.create).mockResolvedValue(chatReportRecord);

    const result = await service.createReport(reporterId, {
      targetType: ReportType.CHAT,
      targetId: messageId,
      reason: '욕설 메시지',
    });

    expect(prisma.chatMessage.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: messageId },
      }),
    );
    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          reporterId,
          type: ReportType.CHAT,
          targetId: messageId,
          reason: '욕설 메시지',
          description: undefined,
          status: ReportStatus.PENDING,
        },
      }),
    );
    expect(result.targetType).toBe(ReportType.CHAT);
  });

  it('rejects chat message reports from non participants', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(reporterRecord);
    vi.mocked(prisma.chatMessage.findUnique).mockResolvedValue({
      id: messageId,
      senderId: sellerId,
      chat: {
        id: chatId,
        buyerId: '77777777-7777-4777-8777-777777777777',
        sellerId,
      },
    });

    await expect(
      service.createReport(reporterId, {
        targetType: ReportType.CHAT,
        targetId: messageId,
        reason: '참여하지 않은 채팅 신고',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it('rejects reporting your own chat message', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(reporterRecord);
    vi.mocked(prisma.chatMessage.findUnique).mockResolvedValue({
      id: messageId,
      senderId: reporterId,
      chat: {
        id: chatId,
        buyerId: reporterId,
        sellerId,
      },
    });

    await expect(
      service.createReport(reporterId, {
        targetType: ReportType.CHAT,
        targetId: messageId,
        reason: '셀프 메시지 신고',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate reports for the same reporter and target', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(reporterRecord);
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      id: productId,
      sellerId,
      title: '아이폰 15',
      status: ProductStatus.ON_SALE,
      isHidden: false,
    });
    vi.mocked(prisma.report.findUnique).mockResolvedValue(reportRecord);

    await expect(
      service.createReport(reporterId, {
        targetType: ReportType.PRODUCT,
        targetId: productId,
        reason: '중복 신고',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects report creation by a suspended reporter', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...reporterRecord,
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.createReport(reporterId, {
        targetType: ReportType.PRODUCT,
        targetId: productId,
        reason: '정지 사용자 신고',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.product.findUnique).not.toHaveBeenCalled();
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it('lists only the authenticated reporter reports', async () => {
    vi.mocked(prisma.report.findMany).mockResolvedValue([reportRecord]);
    vi.mocked(prisma.report.count).mockResolvedValue(1);

    const result = await service.listMyReports(reporterId, {
      page: 1,
      limit: 20,
    });

    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reporterId },
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});

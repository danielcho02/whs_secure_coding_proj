/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ProductStatus,
  ReportStatus,
  ReportType,
  Role,
  TxStatus,
  UserStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

type PrismaTxMock = ReturnType<typeof createPrismaMock>;

function createPrismaMock(): PrismaService {
  const delegates = {
    adminLog: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    product: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    report: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    transaction: {
      count: vi.fn(),
    },
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  };

  return {
    ...delegates,
    $transaction: vi.fn((callback: (tx: PrismaTxMock) => unknown) =>
      Promise.resolve(callback(delegates as unknown as PrismaTxMock)),
    ),
  } as unknown as PrismaService;
}

const adminId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const targetUserId = '33333333-3333-4333-8333-333333333333';
const reportRecord = {
  id: '44444444-4444-4444-8444-444444444444',
  reporterId: '55555555-5555-4555-8555-555555555555',
  type: ReportType.PRODUCT,
  targetId: productId,
  reason: '사기 의심',
  description: '외부 결제 유도',
  status: ReportStatus.PENDING,
  adminId: null,
  adminNote: null,
  reviewedAt: null,
  createdAt: new Date('2026-06-28T00:00:00.000Z'),
  reporter: {
    id: '55555555-5555-4555-8555-555555555555',
    nickname: 'reporter',
    avatarUrl: null,
    trustScore: 0,
    completedTx: 0,
  },
};

describe('AdminService', () => {
  let prisma: PrismaService;
  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
    service = new AdminService(prisma);
  });

  it('updates report status and writes an admin log', async () => {
    vi.mocked(prisma.report.findUnique).mockResolvedValue(reportRecord);
    vi.mocked(prisma.report.update).mockResolvedValue({
      ...reportRecord,
      status: ReportStatus.RESOLVED,
      adminId,
      adminNote: '상품 숨김',
      reviewedAt: new Date('2026-06-28T01:00:00.000Z'),
    });
    vi.mocked(prisma.adminLog.create).mockResolvedValue({
      id: 'log-1',
      adminId,
      action: 'UPDATE_REPORT_STATUS',
      targetType: 'REPORT',
      targetId: reportRecord.id,
      reason: '상품 숨김',
      detail: '{}',
      createdAt: new Date(),
    });
    vi.mocked(prisma.notification.create).mockResolvedValue({
      id: 'notification-1',
    });

    const result = await service.updateReportStatus(adminId, reportRecord.id, {
      status: ReportStatus.RESOLVED,
      adminNote: '상품 숨김',
    });

    expect(prisma.report.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReportStatus.RESOLVED,
          adminId,
          adminNote: '상품 숨김',
        }),
      }),
    );
    expect(prisma.adminLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adminId,
          action: 'UPDATE_REPORT_STATUS',
          targetType: 'REPORT',
          targetId: reportRecord.id,
          reason: '상품 숨김',
        }),
      }),
    );
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: reportRecord.reporterId,
        type: 'REPORT',
        message: '회원님이 접수한 신고가 처리되었습니다.',
        targetType: 'REPORT',
        targetId: reportRecord.id,
      }),
      select: { id: true },
    });
    expect(result.status).toBe(ReportStatus.RESOLVED);
  });

  it('hides and restores products with admin logs', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      id: productId,
      sellerId: targetUserId,
      title: '위험 상품',
      status: ProductStatus.HIDDEN,
      isHidden: true,
      createdAt: new Date(),
      price: 1000,
      category: '기타',
    });
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);
    vi.mocked(prisma.product.update).mockResolvedValue({
      id: productId,
      sellerId: targetUserId,
      title: '위험 상품',
      status: ProductStatus.ON_SALE,
      isHidden: false,
      createdAt: new Date(),
      price: 1000,
      category: '기타',
    });
    vi.mocked(prisma.adminLog.create).mockResolvedValue({
      id: 'log-1',
      adminId,
      action: 'RESTORE_PRODUCT',
      targetType: 'PRODUCT',
      targetId: productId,
      reason: '오탐',
      detail: '{}',
      createdAt: new Date(),
    });

    const result = await service.restoreProduct(adminId, productId, {
      reason: '오탐',
    });

    expect(prisma.transaction.count).toHaveBeenCalledWith({
      where: {
        productId,
        status: {
          in: [
            TxStatus.RESERVED,
            TxStatus.PAYMENT_PENDING,
            TxStatus.PAID,
            TxStatus.SHIPPING,
            TxStatus.COMPLETED,
          ],
        },
      },
    });
    expect(result.status).toBe(ProductStatus.ON_SALE);
    expect(prisma.adminLog.create).toHaveBeenCalled();
  });

  it('prevents restoring hidden products into resale when active or completed transactions exist', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      id: productId,
      sellerId: targetUserId,
      title: '거래 진행 상품',
      status: ProductStatus.HIDDEN,
      isHidden: true,
      createdAt: new Date(),
      price: 1000,
      category: '기타',
    });
    vi.mocked(prisma.transaction.count).mockResolvedValue(1);

    await expect(
      service.restoreProduct(adminId, productId, { reason: '복구 요청' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('suspends and restores users with admin logs', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: targetUserId,
      role: Role.USER,
      status: UserStatus.ACTIVE,
      nickname: 'bad-user',
    });
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: targetUserId,
      role: Role.USER,
      status: UserStatus.SUSPENDED,
      nickname: 'bad-user',
    });
    vi.mocked(prisma.adminLog.create).mockResolvedValue({
      id: 'log-1',
      adminId,
      action: 'SUSPEND_USER',
      targetType: 'USER',
      targetId: targetUserId,
      reason: '사기',
      detail: '{}',
      createdAt: new Date(),
    });

    const result = await service.suspendUser(adminId, targetUserId, {
      reason: '사기',
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: UserStatus.SUSPENDED },
      }),
    );
    expect(result.status).toBe(UserStatus.SUSPENDED);
    expect(prisma.adminLog.create).toHaveBeenCalled();
  });

  it('rejects suspending yourself', async () => {
    await expect(
      service.suspendUser(adminId, adminId, { reason: 'self' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects suspending the last active admin', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: targetUserId,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      nickname: 'admin',
    });
    vi.mocked(prisma.user.count).mockResolvedValue(1);

    await expect(
      service.suspendUser(adminId, targetUserId, { reason: 'last admin' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists admin logs without sensitive fields and without unsafe SQL', async () => {
    vi.mocked(prisma.adminLog.findMany).mockResolvedValue([
      {
        id: 'log-1',
        adminId,
        action: 'SUSPEND_USER',
        targetType: 'USER',
        targetId: targetUserId,
        reason: '사기',
        detail: '{}',
        createdAt: new Date('2026-06-28T00:00:00.000Z'),
        admin: {
          id: adminId,
          nickname: 'admin',
          avatarUrl: null,
          trustScore: 0,
          completedTx: 0,
        },
      },
    ]);
    vi.mocked(prisma.adminLog.count).mockResolvedValue(1);

    const result = await service.listAdminLogs({
      page: 1,
      limit: 20,
    });

    expect(result.items[0].actor).not.toHaveProperty('passwordHash');
    expect(result.items[0].actor).not.toHaveProperty('email');
    expect(result.items[0].actor).not.toHaveProperty('phone');
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});

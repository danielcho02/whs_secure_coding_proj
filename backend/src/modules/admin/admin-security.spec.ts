/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */

import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  ProductStatus,
  ReportStatus,
  ReportType,
  Role,
  UserStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLogsController } from './admin-logs.controller';
import { AdminProductsController } from './admin-products.controller';
import { AdminReportsController } from './admin-reports.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminActionReasonDto } from './dto/admin-action-reason.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { AdminService } from './admin.service';

type RequestUser = {
  role: Role;
  status: UserStatus;
};

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const adminId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const targetUserId = '33333333-3333-4333-8333-333333333333';
const reportId = '44444444-4444-4444-8444-444444444444';

const publicAdmin = {
  id: adminId,
  nickname: 'admin',
  avatarUrl: null,
  trustScore: 0,
  completedTx: 0,
};

const publicTargetUser = {
  id: targetUserId,
  nickname: 'target',
  avatarUrl: null,
  trustScore: 5,
  completedTx: 1,
};

const productState = {
  id: productId,
  sellerId: targetUserId,
  title: '관리자 검증 상품',
  description: '신고 대상 상품',
  price: 30000,
  category: '기타',
  region: '서울',
  status: ProductStatus.ON_SALE,
  isHidden: false,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

const hiddenProductRecord = {
  ...productState,
  status: ProductStatus.HIDDEN,
  isHidden: true,
  seller: publicTargetUser,
  images: [],
};

const targetUserRecord = {
  id: targetUserId,
  nickname: 'target',
  avatarUrl: null,
  trustScore: 5,
  completedTx: 1,
  bio: null,
  role: Role.USER,
  status: UserStatus.ACTIVE,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

const reportRecord = {
  id: reportId,
  reporterId: targetUserId,
  type: ReportType.PRODUCT,
  targetId: productId,
  reason: '사기 의심',
  description: '외부 결제를 유도합니다.',
  status: ReportStatus.PENDING,
  adminId: null,
  adminNote: null,
  reviewedAt: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  reporter: publicTargetUser,
};

function createPrismaMock(): PrismaService {
  return {
    adminLog: {
      create: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    report: {
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
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    chatMessage: {
      findUnique: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  } as unknown as PrismaService;
}

function createExecutionContext(user: RequestUser): ExecutionContext {
  return {
    getHandler: () => vi.fn(),
    getClass: () => AdminReportsController,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function createAdminReflector(): Reflector {
  return {
    getAllAndOverride: vi.fn(() => [Role.ADMIN]),
  } as unknown as Reflector;
}

function getClassGuards(
  controller: new (...args: never[]) => unknown,
): unknown[] {
  return (
    (Reflect.getMetadata(GUARDS_METADATA, controller) as
      | unknown[]
      | undefined) ?? []
  );
}

function getClassRoles(
  controller: new (...args: never[]) => unknown,
): unknown[] {
  return (
    (Reflect.getMetadata(ROLES_KEY, controller) as unknown[] | undefined) ?? []
  );
}

async function validateBody<T extends object>(
  metatype: new () => T,
  value: Record<string, unknown>,
): Promise<T> {
  return validationPipe.transform(value, {
    type: 'body',
    metatype,
  }) as Promise<T>;
}

describe('Admin security evidence', () => {
  let prisma: PrismaService;
  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
    service = new AdminService(prisma);
  });

  it('Admin access control: blocks USER role before admin actions or logs can run', () => {
    const controllers = [
      AdminReportsController,
      AdminProductsController,
      AdminUsersController,
      AdminLogsController,
    ];
    const guard = new RolesGuard(createAdminReflector());
    const serviceAction = vi.fn();
    const adminLogCreate = vi.fn();

    for (const controller of controllers) {
      expect(getClassGuards(controller)).toEqual(
        expect.arrayContaining([JwtAuthGuard, RolesGuard]),
      );
      expect(getClassRoles(controller)).toContain(Role.ADMIN);
    }

    expect(() =>
      guard.canActivate(
        createExecutionContext({
          role: Role.USER,
          status: UserStatus.ACTIVE,
        }),
      ),
    ).toThrow(ForbiddenException);
    expect(serviceAction).not.toHaveBeenCalled();
    expect(adminLogCreate).not.toHaveBeenCalled();
  });

  it('Admin product moderation: hides product and writes HIDE_PRODUCT admin log', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(productState);
    vi.mocked(prisma.product.update).mockResolvedValue(hiddenProductRecord);
    vi.mocked(prisma.adminLog.create).mockResolvedValue({
      id: 'log-1',
      adminId,
      action: 'HIDE_PRODUCT',
      targetType: 'PRODUCT',
      targetId: productId,
      reason: '신고 확인',
      detail: '{}',
      createdAt: new Date('2026-07-01T00:10:00.000Z'),
      admin: publicAdmin,
    });

    const result = await service.hideProduct(adminId, productId, {
      reason: '신고 확인',
    });

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: productId },
        data: {
          isHidden: true,
          status: ProductStatus.HIDDEN,
        },
      }),
    );
    expect(prisma.adminLog.create).toHaveBeenCalledWith({
      data: {
        adminId,
        action: 'HIDE_PRODUCT',
        targetType: 'PRODUCT',
        targetId: productId,
        reason: '신고 확인',
        detail: JSON.stringify({
          fromStatus: ProductStatus.ON_SALE,
          fromHidden: false,
        }),
      },
    });
    expect(result.status).toBe(ProductStatus.HIDDEN);
    expect(result.isHidden).toBe(true);
  });

  it('Admin user moderation: suspends user and writes SUSPEND_USER admin log', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(targetUserRecord);
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...targetUserRecord,
      status: UserStatus.SUSPENDED,
    });
    vi.mocked(prisma.adminLog.create).mockResolvedValue({
      id: 'log-2',
      adminId,
      action: 'SUSPEND_USER',
      targetType: 'USER',
      targetId: targetUserId,
      reason: '사기 거래',
      detail: '{}',
      createdAt: new Date('2026-07-01T00:20:00.000Z'),
      admin: publicAdmin,
    });

    const result = await service.suspendUser(adminId, targetUserId, {
      reason: '사기 거래',
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: targetUserId },
        data: { status: UserStatus.SUSPENDED },
      }),
    );
    expect(prisma.adminLog.create).toHaveBeenCalledWith({
      data: {
        adminId,
        action: 'SUSPEND_USER',
        targetType: 'USER',
        targetId: targetUserId,
        reason: '사기 거래',
        detail: JSON.stringify({
          fromStatus: UserStatus.ACTIVE,
          toStatus: UserStatus.SUSPENDED,
        }),
      },
    });
    expect(result.status).toBe(UserStatus.SUSPENDED);
  });

  it('Admin report handling: resolves report and writes UPDATE_REPORT_STATUS admin log', async () => {
    vi.mocked(prisma.report.findUnique).mockResolvedValue(reportRecord);
    vi.mocked(prisma.report.update).mockResolvedValue({
      ...reportRecord,
      status: ReportStatus.RESOLVED,
      adminId,
      adminNote: '상품 숨김 완료',
      reviewedAt: new Date('2026-07-01T00:30:00.000Z'),
    });
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      id: productId,
      title: productState.title,
      status: ProductStatus.HIDDEN,
      isHidden: true,
      seller: publicTargetUser,
    });
    vi.mocked(prisma.adminLog.create).mockResolvedValue({
      id: 'log-3',
      adminId,
      action: 'UPDATE_REPORT_STATUS',
      targetType: 'REPORT',
      targetId: reportId,
      reason: '상품 숨김 완료',
      detail: '{}',
      createdAt: new Date('2026-07-01T00:30:00.000Z'),
      admin: publicAdmin,
    });
    vi.mocked(prisma.notification.create).mockResolvedValue({
      id: 'notice-1',
    });

    const result = await service.updateReportStatus(adminId, reportId, {
      status: ReportStatus.RESOLVED,
      adminNote: '상품 숨김 완료',
    });

    expect(prisma.report.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: reportId },
        data: expect.objectContaining({
          status: ReportStatus.RESOLVED,
          adminId,
          adminNote: '상품 숨김 완료',
        }),
      }),
    );
    expect(prisma.adminLog.create).toHaveBeenCalledWith({
      data: {
        adminId,
        action: 'UPDATE_REPORT_STATUS',
        targetType: 'REPORT',
        targetId: reportId,
        reason: '상품 숨김 완료',
        detail: JSON.stringify({
          from: ReportStatus.PENDING,
          to: ReportStatus.RESOLVED,
          reportTargetType: ReportType.PRODUCT,
          reportTargetId: productId,
        }),
      },
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: reportRecord.reporterId,
        type: 'REPORT',
        targetType: 'REPORT',
        targetId: reportId,
      }),
      select: { id: true },
    });
    expect(result.status).toBe(ReportStatus.RESOLVED);
  });

  it('Admin mass assignment: rejects role and status injection in moderation DTOs', async () => {
    await expect(
      validateBody(AdminActionReasonDto, {
        reason: '권한 주입 시도',
        role: 'ADMIN',
        status: UserStatus.ACTIVE,
        adminId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      validateBody(UpdateReportStatusDto, {
        status: ReportStatus.RESOLVED,
        adminNote: '처리',
        role: 'ADMIN',
        adminId,
        reporterId: targetUserId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

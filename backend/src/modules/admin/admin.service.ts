import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductStatus,
  ReportType,
  Role,
  TxStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminActionReasonDto } from './dto/admin-action-reason.dto';
import {
  AdminLogResponse,
  AdminProductResponse,
  AdminReportResponse,
  AdminUserResponse,
  PaginatedAdminResponse,
} from './dto/admin-response.dto';
import { ListAdminLogsDto } from './dto/list-admin-logs.dto';
import { ListAdminProductsDto } from './dto/list-admin-products.dto';
import { ListAdminReportsDto } from './dto/list-admin-reports.dto';
import { ListAdminUsersDto } from './dto/list-admin-users.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';

const PUBLIC_USER_SELECT = {
  id: true,
  nickname: true,
  avatarUrl: true,
  trustScore: true,
  completedTx: true,
} satisfies Prisma.UserSelect;

const ADMIN_USER_SELECT = {
  ...PUBLIC_USER_SELECT,
  bio: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const REPORT_ADMIN_SELECT = {
  id: true,
  reporterId: true,
  type: true,
  targetId: true,
  reason: true,
  description: true,
  status: true,
  adminId: true,
  adminNote: true,
  reviewedAt: true,
  createdAt: true,
  reporter: {
    select: PUBLIC_USER_SELECT,
  },
} satisfies Prisma.ReportSelect;

const ADMIN_PRODUCT_SELECT = {
  id: true,
  sellerId: true,
  title: true,
  description: true,
  price: true,
  category: true,
  region: true,
  status: true,
  isHidden: true,
  createdAt: true,
  seller: {
    select: PUBLIC_USER_SELECT,
  },
} satisfies Prisma.ProductSelect;

const PRODUCT_STATE_SELECT = {
  id: true,
  sellerId: true,
  title: true,
  description: true,
  price: true,
  category: true,
  region: true,
  status: true,
  isHidden: true,
  createdAt: true,
} satisfies Prisma.ProductSelect;

const ADMIN_LOG_SELECT = {
  id: true,
  adminId: true,
  action: true,
  targetType: true,
  targetId: true,
  reason: true,
  detail: true,
  createdAt: true,
  admin: {
    select: PUBLIC_USER_SELECT,
  },
} satisfies Prisma.AdminLogSelect;

const RESTORE_BLOCKING_TRANSACTION_STATUSES = [
  TxStatus.RESERVED,
  TxStatus.PAYMENT_PENDING,
  TxStatus.PAID,
  TxStatus.SHIPPING,
  TxStatus.COMPLETED,
] as const;

type ReportRecord = Prisma.ReportGetPayload<{
  select: typeof REPORT_ADMIN_SELECT;
}>;
type ProductRecord = Prisma.ProductGetPayload<{
  select: typeof ADMIN_PRODUCT_SELECT;
}>;
type ProductStateRecord = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_STATE_SELECT;
}>;
type UserRecord = Prisma.UserGetPayload<{ select: typeof ADMIN_USER_SELECT }>;
type AdminLogRecord = Prisma.AdminLogGetPayload<{
  select: typeof ADMIN_LOG_SELECT;
}>;

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async listReports(
    query: ListAdminReportsDto,
  ): Promise<PaginatedAdminResponse<AdminReportResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ReportWhereInput = {
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.targetType !== undefined ? { type: query.targetType } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: REPORT_ADMIN_SELECT,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      items: await Promise.all(
        items.map((item) => this.toReportResponse(item)),
      ),
      page,
      limit,
      total,
    };
  }

  async getReport(reportId: string): Promise<AdminReportResponse> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: REPORT_ADMIN_SELECT,
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return this.toReportResponse(report);
  }

  async updateReportStatus(
    adminId: string,
    reportId: string,
    dto: UpdateReportStatusDto,
  ): Promise<AdminReportResponse> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: REPORT_ADMIN_SELECT,
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const updatedReport = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: dto.status,
        adminId,
        adminNote: dto.adminNote,
        reviewedAt: new Date(),
      },
      select: REPORT_ADMIN_SELECT,
    });

    await this.writeAdminLog(adminId, {
      action: 'UPDATE_REPORT_STATUS',
      targetType: 'REPORT',
      targetId: reportId,
      reason: dto.adminNote,
      detail: {
        from: report.status,
        to: dto.status,
        reportTargetType: report.type,
        reportTargetId: report.targetId,
      },
    });

    return this.toReportResponse(updatedReport);
  }

  async listProducts(
    query: ListAdminProductsDto,
  ): Promise<PaginatedAdminResponse<AdminProductResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildProductWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: ADMIN_PRODUCT_SELECT,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toProductResponse(item)),
      page,
      limit,
      total,
    };
  }

  async hideProduct(
    adminId: string,
    productId: string,
    dto: AdminActionReasonDto,
  ): Promise<AdminProductResponse> {
    const product = await this.findProductStateOrThrow(productId);

    const updatedProduct = await this.prisma.product.update({
      where: { id: product.id },
      data: {
        isHidden: true,
        status: ProductStatus.HIDDEN,
      },
      select: ADMIN_PRODUCT_SELECT,
    });

    await this.writeAdminLog(adminId, {
      action: 'HIDE_PRODUCT',
      targetType: 'PRODUCT',
      targetId: product.id,
      reason: dto.reason,
      detail: {
        fromStatus: product.status,
        fromHidden: product.isHidden,
      },
    });

    return this.toProductResponse(updatedProduct);
  }

  async restoreProduct(
    adminId: string,
    productId: string,
    dto: AdminActionReasonDto,
  ): Promise<AdminProductResponse> {
    const product = await this.findProductStateOrThrow(productId);
    const blockingTransactions = await this.prisma.transaction.count({
      where: {
        productId,
        status: { in: [...RESTORE_BLOCKING_TRANSACTION_STATUSES] },
      },
    });

    if (blockingTransactions > 0) {
      throw new ConflictException('Product cannot be restored for resale');
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id: product.id },
      data: {
        isHidden: false,
        status: ProductStatus.ON_SALE,
      },
      select: ADMIN_PRODUCT_SELECT,
    });

    await this.writeAdminLog(adminId, {
      action: 'RESTORE_PRODUCT',
      targetType: 'PRODUCT',
      targetId: product.id,
      reason: dto.reason,
      detail: {
        fromStatus: product.status,
        fromHidden: product.isHidden,
        restorePolicy: 'HIDDEN_TO_ON_SALE_WHEN_NO_ACTIVE_OR_COMPLETED_TX',
      },
    });

    return this.toProductResponse(updatedProduct);
  }

  async listUsers(
    query: ListAdminUsersDto,
  ): Promise<PaginatedAdminResponse<AdminUserResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.UserWhereInput = {
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.role !== undefined ? { role: query.role } : {}),
      ...(query.q !== undefined
        ? { nickname: { contains: query.q, mode: 'insensitive' } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: ADMIN_USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toUserResponse(item)),
      page,
      limit,
      total,
    };
  }

  async suspendUser(
    adminId: string,
    targetUserId: string,
    dto: AdminActionReasonDto,
  ): Promise<AdminUserResponse> {
    if (adminId === targetUserId) {
      throw new BadRequestException('Cannot suspend yourself');
    }

    const user = await this.findUserForModerationOrThrow(targetUserId);

    if (user.role === Role.ADMIN && user.status === UserStatus.ACTIVE) {
      const activeAdminCount = await this.prisma.user.count({
        where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
      });

      if (activeAdminCount <= 1) {
        throw new ForbiddenException('Cannot suspend the last active admin');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status: UserStatus.SUSPENDED },
      select: ADMIN_USER_SELECT,
    });

    await this.writeAdminLog(adminId, {
      action: 'SUSPEND_USER',
      targetType: 'USER',
      targetId: targetUserId,
      reason: dto.reason,
      detail: {
        fromStatus: user.status,
        toStatus: UserStatus.SUSPENDED,
      },
    });

    return this.toUserResponse(updatedUser);
  }

  async restoreUser(
    adminId: string,
    targetUserId: string,
    dto: AdminActionReasonDto,
  ): Promise<AdminUserResponse> {
    const user = await this.findUserForModerationOrThrow(targetUserId);

    if (user.status === UserStatus.WITHDRAWN) {
      throw new BadRequestException('Withdrawn users cannot be restored');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status: UserStatus.ACTIVE },
      select: ADMIN_USER_SELECT,
    });

    await this.writeAdminLog(adminId, {
      action: 'RESTORE_USER',
      targetType: 'USER',
      targetId: targetUserId,
      reason: dto.reason,
      detail: {
        fromStatus: user.status,
        toStatus: UserStatus.ACTIVE,
      },
    });

    return this.toUserResponse(updatedUser);
  }

  async listAdminLogs(
    query: ListAdminLogsDto,
  ): Promise<PaginatedAdminResponse<AdminLogResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.AdminLogWhereInput = {
      ...(query.action !== undefined ? { action: query.action } : {}),
      ...(query.targetType !== undefined
        ? { targetType: query.targetType }
        : {}),
      ...(query.targetId !== undefined ? { targetId: query.targetId } : {}),
      ...(query.adminId !== undefined ? { adminId: query.adminId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.adminLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: ADMIN_LOG_SELECT,
      }),
      this.prisma.adminLog.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toAdminLogResponse(item)),
      page,
      limit,
      total,
    };
  }

  private async findProductStateOrThrow(
    productId: string,
  ): Promise<ProductStateRecord> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: PRODUCT_STATE_SELECT,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private async findUserForModerationOrThrow(
    userId: string,
  ): Promise<Pick<UserRecord, 'id' | 'role' | 'status' | 'nickname'>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        nickname: true,
      },
    });

    if (!user || user.status === UserStatus.WITHDRAWN) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private buildProductWhere(
    query: ListAdminProductsDto,
  ): Prisma.ProductWhereInput {
    return {
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.isHidden !== undefined ? { isHidden: query.isHidden } : {}),
      ...(query.sellerId !== undefined ? { sellerId: query.sellerId } : {}),
      ...(query.q !== undefined
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
              { category: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private async toReportResponse(
    report: ReportRecord,
  ): Promise<AdminReportResponse> {
    return {
      id: report.id,
      reporter: report.reporter,
      targetType: report.type,
      targetId: report.targetId,
      target: await this.getTargetSummary(report.type, report.targetId),
      reason: report.reason,
      description: report.description,
      status: report.status,
      adminNote: report.adminNote,
      reviewedAt: report.reviewedAt,
      createdAt: report.createdAt,
    };
  }

  private async getTargetSummary(
    targetType: ReportType,
    targetId: string,
  ): Promise<unknown> {
    if (targetType === ReportType.PRODUCT) {
      return this.prisma.product.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          title: true,
          status: true,
          isHidden: true,
          seller: { select: PUBLIC_USER_SELECT },
        },
      });
    }

    if (targetType === ReportType.USER) {
      return this.prisma.user.findUnique({
        where: { id: targetId },
        select: PUBLIC_USER_SELECT,
      });
    }

    return { id: targetId, type: targetType };
  }

  private toProductResponse(product: ProductRecord): AdminProductResponse {
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      category: product.category,
      region: product.region,
      status: product.status,
      isHidden: product.isHidden,
      createdAt: product.createdAt,
      seller: product.seller,
    };
  }

  private toUserResponse(user: UserRecord): AdminUserResponse {
    return user;
  }

  private toAdminLogResponse(log: AdminLogRecord): AdminLogResponse {
    return {
      id: log.id,
      actor: log.admin,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      reason: log.reason,
      createdAt: log.createdAt,
    };
  }

  private async writeAdminLog(
    adminId: string,
    input: {
      action: string;
      targetType: string;
      targetId: string;
      reason?: string;
      detail: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        detail: JSON.stringify(input.detail),
      },
    });
  }
}

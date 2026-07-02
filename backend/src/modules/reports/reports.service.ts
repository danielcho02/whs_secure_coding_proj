import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReportStatus, ReportType, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ListMyReportsDto } from './dto/list-my-reports.dto';
import {
  PaginatedReportsResponse,
  ReportResponse,
} from './dto/report-response.dto';

const REPORT_RESPONSE_SELECT = {
  id: true,
  reporterId: true,
  type: true,
  targetId: true,
  reason: true,
  description: true,
  status: true,
  adminNote: true,
  reviewedAt: true,
  createdAt: true,
} satisfies Prisma.ReportSelect;

type ReportRecord = Prisma.ReportGetPayload<{
  select: typeof REPORT_RESPONSE_SELECT;
}>;

const CHAT_MESSAGE_REPORT_SELECT = {
  id: true,
  senderId: true,
  chat: {
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
    },
  },
} satisfies Prisma.ChatMessageSelect;

type ChatMessageReportTarget = Prisma.ChatMessageGetPayload<{
  select: typeof CHAT_MESSAGE_REPORT_SELECT;
}>;

@Injectable()
export class ReportsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async createReport(
    reporterId: string,
    dto: CreateReportDto,
  ): Promise<ReportResponse> {
    await this.assertReporterActive(reporterId);
    await this.assertReportTargetAllowed(reporterId, dto);

    const existingReport = await this.prisma.report.findUnique({
      where: {
        reporterId_type_targetId: {
          reporterId,
          type: dto.targetType,
          targetId: dto.targetId,
        },
      },
      select: { id: true },
    });

    if (existingReport) {
      throw new ConflictException('Report already exists');
    }

    try {
      const report = await this.prisma.report.create({
        data: {
          reporterId,
          type: dto.targetType,
          targetId: dto.targetId,
          reason: dto.reason,
          description: dto.description,
          status: ReportStatus.PENDING,
        },
        select: REPORT_RESPONSE_SELECT,
      });

      await this.notifyAdminsOfReport(report.id);

      return this.toReportResponse(report);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Report already exists');
      }

      throw error;
    }
  }

  private async notifyAdminsOfReport(reportId: string): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
      select: { id: true },
    });

    if (admins.length === 0) {
      return;
    }

    await this.prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: 'ADMIN_REPORT',
        message: '새로운 신고가 접수되었습니다.',
        targetType: 'REPORT',
        targetId: reportId,
      })),
    });
  }

  async listMyReports(
    reporterId: string,
    query: ListMyReportsDto,
  ): Promise<PaginatedReportsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { reporterId };

    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: REPORT_RESPONSE_SELECT,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toReportResponse(item)),
      page,
      limit,
      total,
    };
  }

  private async assertReporterActive(reporterId: string): Promise<void> {
    const reporter = await this.prisma.user.findUnique({
      where: { id: reporterId },
      select: { id: true, status: true },
    });

    if (!reporter || reporter.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Only active users can create reports');
    }
  }

  private async assertReportTargetAllowed(
    reporterId: string,
    dto: CreateReportDto,
  ): Promise<void> {
    if (dto.targetType === ReportType.USER) {
      if (dto.targetId === reporterId) {
        throw new BadRequestException('Cannot report yourself');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: dto.targetId },
        select: { id: true, status: true },
      });

      if (!user || user.status === UserStatus.WITHDRAWN) {
        throw new NotFoundException('User not found');
      }

      return;
    }

    if (dto.targetType === ReportType.PRODUCT) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.targetId },
        select: {
          id: true,
          sellerId: true,
          title: true,
          status: true,
          isHidden: true,
        },
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      if (product.sellerId === reporterId) {
        throw new BadRequestException('Cannot report your own product');
      }

      return;
    }

    if (dto.targetType === ReportType.CHAT) {
      await this.assertChatMessageReportTargetAllowed(reporterId, dto.targetId);
      return;
    }

    throw new BadRequestException('Unsupported report target type');
  }

  private async assertChatMessageReportTargetAllowed(
    reporterId: string,
    messageId: string,
  ): Promise<void> {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: CHAT_MESSAGE_REPORT_SELECT,
    });

    if (!message) {
      throw new NotFoundException('Chat message not found');
    }

    this.assertCanReportChatMessage(reporterId, message);
  }

  private assertCanReportChatMessage(
    reporterId: string,
    message: ChatMessageReportTarget,
  ): void {
    if (
      message.chat.buyerId !== reporterId &&
      message.chat.sellerId !== reporterId
    ) {
      throw new ForbiddenException('Access denied');
    }

    if (message.senderId === reporterId) {
      throw new BadRequestException('Cannot report your own message');
    }
  }

  private toReportResponse(report: ReportRecord): ReportResponse {
    return {
      id: report.id,
      reporterId: report.reporterId,
      targetType: report.type,
      targetId: report.targetId,
      reason: report.reason,
      description: report.description,
      status: report.status,
      adminNote: report.adminNote,
      reviewedAt: report.reviewedAt,
      createdAt: report.createdAt,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}

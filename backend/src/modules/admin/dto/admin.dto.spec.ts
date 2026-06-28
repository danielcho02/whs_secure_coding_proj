import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AdminActionReasonDto } from './admin-action-reason.dto';
import { ListAdminLogsDto } from './list-admin-logs.dto';
import { UpdateReportStatusDto } from './update-report-status.dto';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function validateDto<T extends object>(
  metatype: new () => T,
  value: Record<string, unknown>,
  type: 'body' | 'query' = 'body',
): Promise<T> {
  return validationPipe.transform(value, {
    type,
    metatype,
  }) as Promise<T>;
}

describe('Admin DTO validation', () => {
  it('accepts report status updates with admin note', async () => {
    await expect(
      validateDto(UpdateReportStatusDto, {
        status: ReportStatus.RESOLVED,
        adminNote: '상품 숨김 조치 완료',
      }),
    ).resolves.toBeInstanceOf(UpdateReportStatusDto);
  });

  it('rejects PENDING status and authority field injection on report status updates', async () => {
    await expect(
      validateDto(UpdateReportStatusDto, {
        status: ReportStatus.PENDING,
        reporterId: 'attacker',
        adminId: 'attacker',
        role: 'ADMIN',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects admin action authority field injection', async () => {
    await expect(
      validateDto(AdminActionReasonDto, {
        reason: '악성 상품',
        adminId: 'attacker',
        status: 'ACTIVE',
        role: 'ADMIN',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces pagination limit for admin logs', async () => {
    await expect(
      validateDto(ListAdminLogsDto, { page: '1', limit: '101' }, 'query'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

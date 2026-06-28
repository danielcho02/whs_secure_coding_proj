import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ReportStatus, ReportType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { CreateReportDto } from './create-report.dto';
import { ListMyReportsDto } from './list-my-reports.dto';

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

describe('Reports DTO validation', () => {
  it('accepts a valid user or product report payload', async () => {
    await expect(
      validateDto(CreateReportDto, {
        targetType: ReportType.PRODUCT,
        targetId: '11111111-1111-4111-8111-111111111111',
        reason: '사기 의심',
        description: '외부 결제를 유도했습니다.',
      }),
    ).resolves.toBeInstanceOf(CreateReportDto);
  });

  it('rejects reporterId/status/adminId/role injection', async () => {
    await expect(
      validateDto(CreateReportDto, {
        targetType: ReportType.USER,
        targetId: '11111111-1111-4111-8111-111111111111',
        reason: '욕설',
        reporterId: 'attacker',
        status: ReportStatus.RESOLVED,
        adminId: 'admin',
        role: 'ADMIN',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsupported report target types for v1', async () => {
    await expect(
      validateDto(CreateReportDto, {
        targetType: ReportType.CHAT,
        targetId: '11111111-1111-4111-8111-111111111111',
        reason: '메시지 신고',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces pagination limit for my reports', async () => {
    await expect(
      validateDto(ListMyReportsDto, { page: '1', limit: '101' }, 'query'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

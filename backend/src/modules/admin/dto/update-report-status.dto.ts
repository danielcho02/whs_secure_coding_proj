import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { ReportStatus } from '@prisma/client';
import { trimString } from './admin-dto.util';

export const ADMIN_REPORT_STATUS_VALUES = [
  ReportStatus.REVIEWING,
  ReportStatus.RESOLVED,
  ReportStatus.REJECTED,
] as const;

export class UpdateReportStatusDto {
  @IsIn(ADMIN_REPORT_STATUS_VALUES)
  status!: ReportStatus;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  @Transform(trimString)
  adminNote?: string;
}

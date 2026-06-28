import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { ReportType } from '@prisma/client';
import { trimString } from './report-dto.util';

export const REPORT_TARGET_TYPE_VALUES = [
  ReportType.USER,
  ReportType.PRODUCT,
  ReportType.CHAT,
] as const;

export class CreateReportDto {
  @IsIn(REPORT_TARGET_TYPE_VALUES)
  targetType!: ReportType;

  @IsUUID('4')
  targetId!: string;

  @IsString()
  @Length(1, 100)
  @Transform(trimString)
  reason!: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  @Transform(trimString)
  description?: string;
}

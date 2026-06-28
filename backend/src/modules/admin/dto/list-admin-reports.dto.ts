import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ReportStatus, ReportType } from '@prisma/client';
import { optionalInteger } from './admin-dto.util';

export class ListAdminReportsDto {
  @IsOptional()
  @Transform(optionalInteger)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(optionalInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportType)
  targetType?: ReportType;
}

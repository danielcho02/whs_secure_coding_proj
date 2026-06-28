import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { optionalInteger, trimString } from './admin-dto.util';

export class ListAdminLogsDto {
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
  @IsString()
  @Length(1, 80)
  @Transform(trimString)
  action?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  @Transform(trimString)
  targetType?: string;

  @IsOptional()
  @IsUUID('4')
  targetId?: string;

  @IsOptional()
  @IsUUID('4')
  adminId?: string;
}

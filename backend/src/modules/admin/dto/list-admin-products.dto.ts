import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';
import { optionalBoolean, optionalInteger, trimString } from './admin-dto.util';

export class ListAdminProductsDto {
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
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  isHidden?: boolean;

  @IsOptional()
  @IsUUID('4')
  sellerId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Transform(trimString)
  q?: string;
}

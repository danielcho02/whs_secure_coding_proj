import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ProductStatus } from '@prisma/client';
import { optionalInteger } from './product-dto.util';

export class ListMyProductsDto {
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
}

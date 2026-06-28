import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { optionalInteger, trimString } from './product-dto.util';

export const PRODUCT_SORT_VALUES = ['latest', 'priceAsc', 'priceDesc'] as const;
export type ProductSort = (typeof PRODUCT_SORT_VALUES)[number];

export class ListProductsDto {
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
  @IsIn(PRODUCT_SORT_VALUES)
  sort: ProductSort = 'latest';

  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Transform(trimString)
  category?: string;

  @IsOptional()
  @Transform(optionalInteger)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  min?: number;

  @IsOptional()
  @Transform(optionalInteger)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  max?: number;
}

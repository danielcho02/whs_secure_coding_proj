import { ProductStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export const SELLER_PRODUCT_STATUS_VALUES = [
  ProductStatus.ON_SALE,
  ProductStatus.RESERVED,
  ProductStatus.SOLD,
] as const;

export class UpdateProductStatusDto {
  @IsIn(SELLER_PRODUCT_STATUS_VALUES)
  status!: ProductStatus;
}

import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { CreateProductDto } from './create-product.dto';
import { FavoriteProductDto } from './favorite-product.dto';
import { SearchProductsDto } from './search-products.dto';
import { UpdateProductStatusDto } from './update-product-status.dto';
import { UpdateProductDto } from './update-product.dto';

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

describe('Product DTO validation', () => {
  it('accepts a valid product creation payload', async () => {
    await expect(
      validateDto(CreateProductDto, {
        title: '아이폰 15',
        price: 300000,
        description: '상태 좋습니다',
        category: '디지털',
        region: '서울',
      }),
    ).resolves.toBeInstanceOf(CreateProductDto);
  });

  it('rejects sellerId injection on product creation', async () => {
    await expect(
      validateDto(CreateProductDto, {
        title: '아이폰 15',
        price: 300000,
        description: '상태 좋습니다',
        category: '디지털',
        sellerId: 'attacker',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects status and isHidden injection on product creation', async () => {
    await expect(
      validateDto(CreateProductDto, {
        title: '아이폰 15',
        price: 300000,
        description: '상태 좋습니다',
        category: '디지털',
        status: ProductStatus.SOLD,
        isHidden: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects negative and over-limit prices', async () => {
    await expect(
      validateDto(CreateProductDto, {
        title: '아이폰 15',
        price: -1,
        description: '상태 좋습니다',
        category: '디지털',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      validateDto(CreateProductDto, {
        title: '아이폰 15',
        price: 100000001,
        description: '상태 좋습니다',
        category: '디지털',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects protected fields on product update', async () => {
    await expect(
      validateDto(UpdateProductDto, {
        title: '수정 제목',
        sellerId: 'attacker',
        status: ProductStatus.SOLD,
        isHidden: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts only user-changeable product statuses', async () => {
    await expect(
      validateDto(UpdateProductStatusDto, {
        status: ProductStatus.RESERVED,
      }),
    ).resolves.toBeInstanceOf(UpdateProductStatusDto);

    await expect(
      validateDto(UpdateProductStatusDto, {
        status: ProductStatus.HIDDEN,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty search queries after trimming', async () => {
    await expect(
      validateDto(SearchProductsDto, { q: '   ' }, 'query'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects userId injection on favorite toggle', async () => {
    await expect(
      validateDto(FavoriteProductDto, { userId: 'attacker' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

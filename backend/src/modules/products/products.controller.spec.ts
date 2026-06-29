import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProductsController } from './products.controller';

function getMethodGuards(methodName: keyof ProductsController): unknown[] {
  return (
    Reflect.getMetadata(
      GUARDS_METADATA,
      ProductsController.prototype[methodName],
    ) as unknown[] | undefined
  ) ?? [];
}

describe('ProductsController guards', () => {
  it('requires JWT auth for product creation', () => {
    expect(getMethodGuards('createProduct')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for the current seller product list', () => {
    expect(getMethodGuards('listMyProducts')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for product update', () => {
    expect(getMethodGuards('updateProduct')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for product deletion', () => {
    expect(getMethodGuards('deleteProduct')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for status changes', () => {
    expect(getMethodGuards('updateProductStatus')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for image uploads', () => {
    expect(getMethodGuards('uploadProductImages')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for favorite toggles', () => {
    expect(getMethodGuards('toggleFavorite')).toContain(JwtAuthGuard);
  });
});

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductStatus, UserStatus } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));

function createPrismaMock(): PrismaService {
  return {
    product: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    favorite: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    productImage: {
      count: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  } as unknown as PrismaService;
}

function createConfigService(): ConfigService<AppConfig, true> {
  const values = {
    'security.uploadDir': '/tmp/secure-market-products-test',
    'security.maxUploadSize': 5_242_880,
  } as const;

  return {
    get: vi.fn((key: keyof typeof values) => values[key]),
  } as unknown as ConfigService<AppConfig, true>;
}

const publicSeller = {
  id: 'seller-1',
  nickname: 'alice',
  avatarUrl: null,
  trustScore: 10,
  completedTx: 3,
};

const publicProduct = {
  id: 'product-1',
  title: '아이폰 15',
  description: '상태 좋습니다',
  price: 300000,
  category: '디지털',
  region: '서울',
  status: ProductStatus.ON_SALE,
  viewCount: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  seller: publicSeller,
  images: [],
};

const hiddenProduct = {
  ...publicProduct,
  id: 'hidden-product-1',
  status: ProductStatus.HIDDEN,
};

const ownedProduct = {
  id: 'product-1',
  sellerId: 'seller-1',
  isHidden: false,
  status: ProductStatus.ON_SALE,
};

function jpegBuffer(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
}

function pngBuffer(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

describe('ProductsService', () => {
  let prisma: PrismaService;
  let service: ProductsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'seller-1',
      status: UserStatus.ACTIVE,
    });
    service = new ProductsService(prisma, createConfigService());
  });

  it('creates a product using only the authenticated seller id', async () => {
    vi.mocked(prisma.product.create).mockResolvedValue(publicProduct);

    const result = await service.createProduct('seller-1', {
      title: '아이폰 15',
      price: 300000,
      description: '상태 좋습니다',
      category: '디지털',
      region: '서울',
    });

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId: 'seller-1',
          status: ProductStatus.ON_SALE,
          isHidden: false,
        }),
      }),
    );
    expect(result.seller).toEqual(publicSeller);
    expect(result).not.toHaveProperty('sellerId');
    expect(result).not.toHaveProperty('isHidden');
  });

  it('rejects product creation by a suspended user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'seller-1',
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.createProduct('seller-1', {
        title: '아이폰 15',
        price: 300000,
        description: '상태 좋습니다',
        category: '디지털',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('lists products with hidden products excluded', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([publicProduct]);
    vi.mocked(prisma.product.count).mockResolvedValue(1);

    const result = await service.listProducts({
      page: 1,
      limit: 20,
      sort: 'latest',
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isHidden: false }),
      }),
    );
    expect(result.items).toEqual([publicProduct]);
    expect(result.total).toBe(1);
  });

  it('lists only products owned by the authenticated seller, including hidden products', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      publicProduct,
      hiddenProduct,
    ]);
    vi.mocked(prisma.product.count).mockResolvedValue(2);

    const result = await service.listMyProducts('seller-1', {
      page: 1,
      limit: 20,
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sellerId: 'seller-1' },
      }),
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[1].status).toBe(ProductStatus.HIDDEN);
  });

  it('applies status filters to the authenticated seller product list', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([publicProduct]);
    vi.mocked(prisma.product.count).mockResolvedValue(1);

    await service.listMyProducts('seller-1', {
      page: 1,
      limit: 20,
      status: ProductStatus.ON_SALE,
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sellerId: 'seller-1',
          status: ProductStatus.ON_SALE,
        },
      }),
    );
  });

  it('ignores userId and sellerId query injection for the authenticated seller product list', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(prisma.product.count).mockResolvedValue(0);

    await service.listMyProducts('seller-1', {
      page: 1,
      limit: 20,
      sellerId: 'seller-2',
      userId: 'user-2',
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sellerId: 'seller-1' },
      }),
    );
  });

  it('searches products using Prisma findMany conditions', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([publicProduct]);
    vi.mocked(prisma.product.count).mockResolvedValue(1);

    await service.searchProducts({
      q: '아이폰',
      page: 1,
      limit: 20,
      sort: 'latest',
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isHidden: false,
          OR: expect.arrayContaining([
            { title: { contains: '아이폰', mode: 'insensitive' } },
          ]),
        }),
      }),
    );
  });

  it('handles search injection payloads without raw query APIs', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(prisma.product.count).mockResolvedValue(0);

    await service.searchProducts({
      q: "' OR '1'='1",
      page: 1,
      limit: 20,
      sort: 'latest',
    });

    expect(prisma.product.findMany).toHaveBeenCalled();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('returns detail responses without seller passwordHash, email, or phone', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(publicProduct);
    vi.mocked(prisma.product.update).mockResolvedValue({
      ...publicProduct,
      viewCount: 1,
    });

    const result = await service.getProduct('product-1');

    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          seller: expect.objectContaining({
            select: expect.not.objectContaining({
              passwordHash: true,
              email: true,
              phone: true,
            }),
          }),
        }),
      }),
    );
    expect(result.seller).not.toHaveProperty('passwordHash');
    expect(result.seller).not.toHaveProperty('email');
    expect(result.seller).not.toHaveProperty('phone');
  });

  it('updates a product for its seller', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(ownedProduct);
    vi.mocked(prisma.product.update).mockResolvedValue({
      ...publicProduct,
      title: '수정 제목',
    });

    const result = await service.updateProduct('product-1', 'seller-1', {
      title: '수정 제목',
    });

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'product-1' },
        data: { title: '수정 제목' },
      }),
    );
    expect(result.title).toBe('수정 제목');
  });

  it('rejects product updates by a suspended seller', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'seller-1',
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.updateProduct('product-1', 'seller-1', { title: '수정 제목' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('blocks other users from updating a product', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      ...ownedProduct,
      sellerId: 'seller-2',
    });

    await expect(
      service.updateProduct('product-1', 'seller-1', { title: '수정 제목' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft deletes a product for its seller', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(ownedProduct);
    vi.mocked(prisma.product.update).mockResolvedValue({
      ...publicProduct,
      status: ProductStatus.HIDDEN,
    });

    const result = await service.deleteProduct('product-1', 'seller-1');

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'product-1' },
        data: { isHidden: true, status: ProductStatus.HIDDEN },
      }),
    );
    expect(result).toEqual({ id: 'product-1', deleted: true });
  });

  it('blocks other users from deleting a product', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      ...ownedProduct,
      sellerId: 'seller-2',
    });

    await expect(
      service.deleteProduct('product-1', 'seller-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('changes product status for its seller', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(ownedProduct);
    vi.mocked(prisma.product.update).mockResolvedValue({
      ...publicProduct,
      status: ProductStatus.SOLD,
    });

    const result = await service.updateProductStatus('product-1', 'seller-1', {
      status: ProductStatus.SOLD,
    });

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: ProductStatus.SOLD },
      }),
    );
    expect(result.status).toBe(ProductStatus.SOLD);
  });

  it('blocks other users from changing product status', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      ...ownedProduct,
      sellerId: 'seller-2',
    });

    await expect(
      service.updateProductStatus('product-1', 'seller-1', {
        status: ProductStatus.SOLD,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects HIDDEN status changes from the product status API', async () => {
    await expect(
      service.updateProductStatus('product-1', 'seller-1', {
        status: ProductStatus.HIDDEN,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a favorite toggle using only the authenticated user id', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'buyer-1',
      status: UserStatus.ACTIVE,
    });
    vi.mocked(prisma.product.findFirst).mockResolvedValue({
      id: 'product-1',
      sellerId: 'seller-1',
    });
    vi.mocked(prisma.favorite.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.favorite.create).mockResolvedValue({
      id: 'favorite-1',
      userId: 'buyer-1',
      productId: 'product-1',
    });

    const result = await service.toggleFavorite('product-1', 'buyer-1');

    expect(prisma.favorite.create).toHaveBeenCalledWith({
      data: { productId: 'product-1', userId: 'buyer-1' },
      select: { id: true },
    });
    expect(result).toEqual({ favorited: true });
  });

  it('rejects favorite toggles by a suspended user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'buyer-1',
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.toggleFavorite('product-1', 'buyer-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.favorite.create).not.toHaveBeenCalled();
  });

  it('removes an existing favorite on duplicate toggle', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue({
      id: 'product-1',
      sellerId: 'seller-1',
    });
    vi.mocked(prisma.favorite.findUnique).mockResolvedValue({
      id: 'favorite-1',
      userId: 'buyer-1',
      productId: 'product-1',
    });

    const result = await service.toggleFavorite('product-1', 'buyer-1');

    expect(prisma.favorite.delete).toHaveBeenCalledWith({
      where: {
        userId_productId: { userId: 'buyer-1', productId: 'product-1' },
      },
      select: { id: true },
    });
    expect(result).toEqual({ favorited: false });
  });

  it('uploads an image for the product seller using a UUID file name', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(ownedProduct);
    vi.mocked(prisma.productImage.count).mockResolvedValue(1);
    vi.mocked(prisma.productImage.create).mockResolvedValue({
      id: 'image-1',
      productId: 'product-1',
      url: 'products/generated.jpg',
      order: 1,
    });

    const result = await service.uploadProductImages('product-1', 'seller-1', [
      {
        originalName: 'original.jpg',
        mimeType: 'image/jpeg',
        buffer: jpegBuffer(),
      },
    ]);

    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringMatching(
        /products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/,
      ),
      jpegBuffer(),
    );
    expect(prisma.productImage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: 'product-1',
          url: expect.stringMatching(
            /^\/uploads\/products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/,
          ),
          order: 1,
        }),
      }),
    );
    expect(result[0].url).not.toContain('original');
  });

  it('blocks other users from uploading product images', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      ...ownedProduct,
      sellerId: 'seller-2',
    });

    await expect(
      service.uploadProductImages('product-1', 'seller-1', [
        {
          originalName: 'image.jpg',
          mimeType: 'image/jpeg',
          buffer: jpegBuffer(),
        },
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects SVG uploads', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(ownedProduct);

    await expect(
      service.uploadProductImages('product-1', 'seller-1', [
        {
          originalName: 'vector.svg',
          mimeType: 'image/svg+xml',
          buffer: Buffer.from('<svg></svg>'),
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects double-extension PHP image disguises', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(ownedProduct);

    await expect(
      service.uploadProductImages('product-1', 'seller-1', [
        {
          originalName: 'shell.php.jpg',
          mimeType: 'image/jpeg',
          buffer: jpegBuffer(),
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects MIME and magic-byte mismatches', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(ownedProduct);

    await expect(
      service.uploadProductImages('product-1', 'seller-1', [
        {
          originalName: 'image.png',
          mimeType: 'image/png',
          buffer: jpegBuffer(),
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.uploadProductImages('product-1', 'seller-1', [
        {
          originalName: 'image.jpg',
          mimeType: 'image/jpeg',
          buffer: pngBuffer(),
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found for hidden products before ownership checks', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      ...ownedProduct,
      isHidden: true,
    });

    await expect(
      service.updateProduct('product-1', 'seller-1', { title: '수정 제목' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

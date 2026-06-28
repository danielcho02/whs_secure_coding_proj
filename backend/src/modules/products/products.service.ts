import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProductStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto, ProductSort } from './dto/list-products.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { SELLER_PRODUCT_STATUS_VALUES } from './dto/update-product-status.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductImageUpload } from './types/product-image-upload.type';
import {
  PaginatedProductsResponse,
  ProductImageResponse,
  ProductResponse,
} from './types/product-response.type';

const PUBLIC_SELLER_SELECT = {
  id: true,
  nickname: true,
  avatarUrl: true,
  trustScore: true,
  completedTx: true,
} satisfies Prisma.UserSelect;

const PRODUCT_IMAGE_SELECT = {
  id: true,
  url: true,
  order: true,
} satisfies Prisma.ProductImageSelect;

const PRODUCT_RESPONSE_SELECT = {
  id: true,
  title: true,
  description: true,
  price: true,
  category: true,
  region: true,
  status: true,
  viewCount: true,
  createdAt: true,
  seller: { select: PUBLIC_SELLER_SELECT },
  images: {
    select: PRODUCT_IMAGE_SELECT,
    orderBy: { order: 'asc' },
  },
} satisfies Prisma.ProductSelect;

const PRODUCT_OWNER_SELECT = {
  id: true,
  sellerId: true,
  isHidden: true,
  status: true,
} satisfies Prisma.ProductSelect;

const FAVORITE_PRODUCT_SELECT = {
  id: true,
  sellerId: true,
} satisfies Prisma.ProductSelect;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const DANGEROUS_EXTENSIONS = new Set([
  'asp',
  'aspx',
  'exe',
  'html',
  'htm',
  'js',
  'jsp',
  'jspx',
  'mjs',
  'php',
  'phtml',
  'sh',
  'svg',
]);
const MAX_FILES_PER_REQUEST = 10;

type ProductOwner = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_OWNER_SELECT;
}>;
type FavoriteProduct = Prisma.ProductGetPayload<{
  select: typeof FAVORITE_PRODUCT_SELECT;
}>;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
type ImageExtension = 'jpg' | 'jpeg' | 'png' | 'webp';

interface ValidatedImage {
  extension: Exclude<ImageExtension, 'jpeg'>;
}

@Injectable()
export class ProductsService {
  private readonly uploadDir: string;
  private readonly maxUploadSize: number;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConfigService)
    configService: ConfigService<AppConfig, true>,
  ) {
    this.uploadDir = configService.get('security.uploadDir', { infer: true });
    this.maxUploadSize = configService.get('security.maxUploadSize', {
      infer: true,
    });
  }

  async createProduct(
    sellerId: string,
    dto: CreateProductDto,
  ): Promise<ProductResponse> {
    return this.prisma.product.create({
      data: {
        sellerId,
        title: dto.title,
        price: dto.price,
        description: dto.description,
        category: dto.category,
        region: dto.region,
        status: ProductStatus.ON_SALE,
        isHidden: false,
      },
      select: PRODUCT_RESPONSE_SELECT,
    });
  }

  async listProducts(
    query: ListProductsDto,
  ): Promise<PaginatedProductsResponse> {
    this.assertValidPriceRange(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildProductWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: this.toOrderBy(query.sort ?? 'latest'),
        skip: (page - 1) * limit,
        take: limit,
        select: PRODUCT_RESPONSE_SELECT,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async searchProducts(
    query: SearchProductsDto,
  ): Promise<PaginatedProductsResponse> {
    this.assertValidPriceRange(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildProductWhere(query, query.q);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: this.toOrderBy(query.sort ?? 'latest'),
        skip: (page - 1) * limit,
        take: limit,
        select: PRODUCT_RESPONSE_SELECT,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async getProduct(productId: string): Promise<ProductResponse> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isHidden: false },
      select: PRODUCT_RESPONSE_SELECT,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: { viewCount: { increment: 1 } },
      select: PRODUCT_RESPONSE_SELECT,
    });
  }

  async updateProduct(
    productId: string,
    sellerId: string,
    dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    await this.assertProductSeller(productId, sellerId);
    const data = this.toProductUpdateData(dto);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one product field is required');
    }

    return this.prisma.product.update({
      where: { id: productId },
      data,
      select: PRODUCT_RESPONSE_SELECT,
    });
  }

  async deleteProduct(
    productId: string,
    sellerId: string,
  ): Promise<{ id: string; deleted: true }> {
    await this.assertProductSeller(productId, sellerId);
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        isHidden: true,
        status: ProductStatus.HIDDEN,
      },
      select: PRODUCT_RESPONSE_SELECT,
    });

    return { id: productId, deleted: true };
  }

  async updateProductStatus(
    productId: string,
    sellerId: string,
    dto: UpdateProductStatusDto,
  ): Promise<ProductResponse> {
    if (!this.isSellerProductStatus(dto.status)) {
      throw new BadRequestException('Unsupported product status');
    }

    await this.assertProductSeller(productId, sellerId);

    return this.prisma.product.update({
      where: { id: productId },
      data: { status: dto.status },
      select: PRODUCT_RESPONSE_SELECT,
    });
  }

  async toggleFavorite(
    productId: string,
    userId: string,
  ): Promise<{ favorited: boolean }> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isHidden: false },
      select: FAVORITE_PRODUCT_SELECT,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    this.assertNotOwnProduct(product, userId);

    const where = { userId_productId: { userId, productId } };
    const existingFavorite = await this.prisma.favorite.findUnique({
      where,
      select: { id: true },
    });

    if (existingFavorite) {
      await this.prisma.favorite.delete({
        where,
        select: { id: true },
      });
      return { favorited: false };
    }

    await this.prisma.favorite.create({
      data: { productId, userId },
      select: { id: true },
    });
    return { favorited: true };
  }

  async uploadProductImages(
    productId: string,
    sellerId: string,
    files: ProductImageUpload[],
  ): Promise<ProductImageResponse[]> {
    await this.assertProductSeller(productId, sellerId);

    if (files.length === 0) {
      throw new BadRequestException('At least one image file is required');
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      throw new BadRequestException('Too many image files');
    }

    const validatedFiles = files.map((file) => ({
      file,
      image: this.validateImage(file),
    }));
    const uploadDirectory = path.join(this.uploadDir, 'products');
    const existingCount = await this.prisma.productImage.count({
      where: { productId },
    });
    const createdImages: ProductImageResponse[] = [];

    await mkdir(uploadDirectory, { recursive: true });

    for (const [index, validated] of validatedFiles.entries()) {
      const filename = `${randomUUID()}.${validated.image.extension}`;
      const relativeUrl = `products/${filename}`;
      const absolutePath = path.join(uploadDirectory, filename);

      await writeFile(absolutePath, validated.file.buffer);

      try {
        const image = await this.prisma.productImage.create({
          data: {
            productId,
            url: relativeUrl,
            order: existingCount + index,
          },
          select: PRODUCT_IMAGE_SELECT,
        });
        createdImages.push(image);
      } catch (error) {
        await this.removeWrittenFile(absolutePath);
        throw error;
      }
    }

    return createdImages;
  }

  private buildProductWhere(
    query: ListProductsDto,
    searchTerm?: string,
  ): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = { isHidden: false };

    if (query.category !== undefined) {
      where.category = query.category;
    }

    if (query.min !== undefined || query.max !== undefined) {
      where.price = {
        ...(query.min !== undefined ? { gte: query.min } : {}),
        ...(query.max !== undefined ? { lte: query.max } : {}),
      };
    }

    if (searchTerm !== undefined) {
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { category: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private toOrderBy(sort: ProductSort): Prisma.ProductOrderByWithRelationInput {
    if (sort === 'priceAsc') {
      return { price: 'asc' };
    }

    if (sort === 'priceDesc') {
      return { price: 'desc' };
    }

    return { createdAt: 'desc' };
  }

  private async assertProductSeller(
    productId: string,
    sellerId: string,
  ): Promise<ProductOwner> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: PRODUCT_OWNER_SELECT,
    });

    if (!product || product.isHidden) {
      throw new NotFoundException('Product not found');
    }

    if (product.sellerId !== sellerId) {
      throw new ForbiddenException('Access denied');
    }

    return product;
  }

  private assertNotOwnProduct(product: FavoriteProduct, userId: string): void {
    if (product.sellerId === userId) {
      throw new BadRequestException('Cannot favorite your own product');
    }
  }

  private toProductUpdateData(dto: UpdateProductDto): Prisma.ProductUpdateInput {
    return {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.region !== undefined ? { region: dto.region } : {}),
    };
  }

  private assertValidPriceRange(query: ListProductsDto): void {
    if (
      query.min !== undefined &&
      query.max !== undefined &&
      query.min > query.max
    ) {
      throw new BadRequestException('Invalid price range');
    }
  }

  private isSellerProductStatus(status: ProductStatus): boolean {
    return SELLER_PRODUCT_STATUS_VALUES.includes(
      status as (typeof SELLER_PRODUCT_STATUS_VALUES)[number],
    );
  }

  private validateImage(file: ProductImageUpload): ValidatedImage {
    if (file.buffer.length === 0) {
      throw new BadRequestException('Empty image files are not allowed');
    }

    if (file.buffer.length > this.maxUploadSize) {
      throw new BadRequestException('Image file is too large');
    }

    const extension = this.getSafeExtension(file.originalName);
    const normalizedMimeType = this.normalizeMimeType(file.mimeType);
    const detected = this.detectImageType(file.buffer);

    if (!detected) {
      throw new BadRequestException('Invalid image signature');
    }

    if (normalizedMimeType !== detected.mimeType) {
      throw new BadRequestException('Image MIME type does not match content');
    }

    if (!detected.extensions.includes(extension)) {
      throw new BadRequestException('Image extension does not match content');
    }

    return { extension: detected.extension };
  }

  private getSafeExtension(originalName: string): ImageExtension {
    const basename = path.basename(originalName).toLowerCase();
    const segments = basename.split('.').filter((segment) => segment.length > 0);

    if (segments.length < 2) {
      throw new BadRequestException('Image file extension is required');
    }

    if (segments.some((segment) => DANGEROUS_EXTENSIONS.has(segment))) {
      throw new BadRequestException('Executable file extensions are not allowed');
    }

    const extension = segments[segments.length - 1];

    if (
      extension !== 'jpg' &&
      extension !== 'jpeg' &&
      extension !== 'png' &&
      extension !== 'webp'
    ) {
      throw new BadRequestException('Unsupported image extension');
    }

    return extension;
  }

  private normalizeMimeType(mimeType: string): AllowedMimeType {
    const normalized = mimeType.toLowerCase().split(';')[0].trim();

    if (!this.isAllowedMimeType(normalized)) {
      throw new BadRequestException('Unsupported image MIME type');
    }

    return normalized;
  }

  private isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
    return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
  }

  private detectImageType(
    buffer: Buffer,
  ):
    | {
        mimeType: AllowedMimeType;
        extension: Exclude<ImageExtension, 'jpeg'>;
        extensions: ImageExtension[];
      }
    | undefined {
    if (this.hasJpegSignature(buffer)) {
      return {
        mimeType: 'image/jpeg',
        extension: 'jpg',
        extensions: ['jpg', 'jpeg'],
      };
    }

    if (this.hasPngSignature(buffer)) {
      return {
        mimeType: 'image/png',
        extension: 'png',
        extensions: ['png'],
      };
    }

    if (this.hasWebpSignature(buffer)) {
      return {
        mimeType: 'image/webp',
        extension: 'webp',
        extensions: ['webp'],
      };
    }

    return undefined;
  }

  private hasJpegSignature(buffer: Buffer): boolean {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  private hasPngSignature(buffer: Buffer): boolean {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return (
      buffer.length >= signature.length &&
      signature.every((byte, index) => buffer[index] === byte)
    );
  }

  private hasWebpSignature(buffer: Buffer): boolean {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  private async removeWrittenFile(absolutePath: string): Promise<void> {
    try {
      await unlink(absolutePath);
    } catch {
      return;
    }
  }
}

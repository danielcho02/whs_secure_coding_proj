import { ProductStatus } from '@prisma/client';

export interface PublicProductSeller {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  trustScore: number;
  completedTx: number;
}

export interface ProductImageResponse {
  id: string;
  url: string;
  order: number;
}

export interface ProductResponse {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  region: string | null;
  status: ProductStatus;
  viewCount: number;
  createdAt: Date;
  seller: PublicProductSeller;
  images: ProductImageResponse[];
}

export interface PaginatedProductsResponse {
  items: ProductResponse[];
  page: number;
  limit: number;
  total: number;
}

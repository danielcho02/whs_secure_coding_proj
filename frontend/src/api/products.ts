import { apiClient } from './client';

export type ProductStatus = 'ON_SALE' | 'RESERVED' | 'SOLD' | 'HIDDEN';
export type SellerProductStatus = Exclude<ProductStatus, 'HIDDEN'>;
export type ProductSort = 'latest' | 'priceAsc' | 'priceDesc';

export interface ProductSeller {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  trustScore: number;
  completedTx: number;
}

export interface ProductImage {
  id: string;
  url: string;
  order: number;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  region: string | null;
  status: ProductStatus;
  viewCount: number;
  createdAt: string;
  seller: ProductSeller;
  images: ProductImage[];
}

export interface ProductListParams {
  page?: number;
  limit?: number;
  sort?: ProductSort;
  category?: string;
  min?: number;
  max?: number;
}

export interface ProductSearchParams extends ProductListParams {
  q: string;
}

export interface ProductPage {
  items: Product[];
  page: number;
  limit: number;
  total: number;
}

export interface CreateProductPayload {
  title: string;
  price: number;
  description: string;
  category: string;
  region?: string;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export interface ProductImageUploadResult {
  id: string;
  url: string;
  order: number;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function listProducts(
  params: ProductListParams = {},
): Promise<ProductPage> {
  const response = await apiClient.get<ApiSuccess<ProductPage>>('/products', {
    params,
  });
  return response.data.data;
}

export async function searchProducts(
  params: ProductSearchParams,
): Promise<ProductPage> {
  const response = await apiClient.get<ApiSuccess<ProductPage>>(
    '/products/search',
    { params },
  );
  return response.data.data;
}

export async function getProduct(productId: string): Promise<Product> {
  const response = await apiClient.get<ApiSuccess<Product>>(
    `/products/${productId}`,
  );
  return response.data.data;
}

export async function createProduct(
  payload: CreateProductPayload,
): Promise<Product> {
  const response = await apiClient.post<ApiSuccess<Product>>('/products', payload);
  return response.data.data;
}

export async function updateProduct(
  productId: string,
  payload: UpdateProductPayload,
): Promise<Product> {
  const response = await apiClient.patch<ApiSuccess<Product>>(
    `/products/${productId}`,
    payload,
  );
  return response.data.data;
}

export async function deleteProduct(
  productId: string,
): Promise<{ id: string; deleted: true }> {
  const response = await apiClient.delete<ApiSuccess<{ id: string; deleted: true }>>(
    `/products/${productId}`,
  );
  return response.data.data;
}

export async function updateProductStatus(
  productId: string,
  status: SellerProductStatus,
): Promise<Product> {
  const response = await apiClient.patch<ApiSuccess<Product>>(
    `/products/${productId}/status`,
    { status },
  );
  return response.data.data;
}

export async function uploadProductImages(
  productId: string,
  files: File[],
): Promise<ProductImageUploadResult[]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('images', file);
  });

  const response = await apiClient.post<ApiSuccess<ProductImageUploadResult[]>>(
    `/products/${productId}/images`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return response.data.data;
}

export async function toggleFavorite(
  productId: string,
): Promise<{ favorited: boolean }> {
  const response = await apiClient.post<ApiSuccess<{ favorited: boolean }>>(
    `/products/${productId}/favorite`,
    {},
  );
  return response.data.data;
}

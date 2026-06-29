import { apiClient } from './client';
import type { ProductStatus } from './products';
import type { PaymentStatus } from './payments';

export type TransactionStatus =
  | 'REQUESTED'
  | 'RESERVED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'SHIPPING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export type TransactionRole = 'buyer' | 'seller' | 'all';

export interface PublicTransactionUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  trustScore: number;
  completedTx: number;
}

export interface TransactionProductSummary {
  id: string;
  title: string;
  price: number;
  status: ProductStatus;
  thumbnailUrl: string | null;
}

export interface TransactionPaymentSummary {
  id: string;
  status: PaymentStatus;
  escrowReleased: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  status: TransactionStatus;
  amount: number;
  createdAt: string;
  updatedAt: string;
  product: TransactionProductSummary;
  buyer: PublicTransactionUser;
  seller: PublicTransactionUser;
  payment: TransactionPaymentSummary | null;
}

export interface TransactionPage {
  items: Transaction[];
  page: number;
  limit: number;
  total: number;
}

export interface Review {
  id: string;
  transactionId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: PublicTransactionUser;
  target: PublicTransactionUser;
}

export interface CreateTransactionPayload {
  productId: string;
}

export interface ListTransactionsParams {
  role?: TransactionRole;
  status?: TransactionStatus;
  page?: number;
  limit?: number;
}

export interface CreateReviewPayload {
  rating: number;
  comment?: string;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function createTransaction(
  payload: CreateTransactionPayload,
): Promise<Transaction> {
  const response = await apiClient.post<ApiSuccess<Transaction>>(
    '/transactions',
    payload,
  );
  return response.data.data;
}

export async function reserveTransaction(
  transactionId: string,
): Promise<Transaction> {
  const response = await apiClient.patch<ApiSuccess<Transaction>>(
    `/transactions/${transactionId}/reserve`,
    {},
  );
  return response.data.data;
}

export async function cancelTransaction(
  transactionId: string,
): Promise<Transaction> {
  const response = await apiClient.patch<ApiSuccess<Transaction>>(
    `/transactions/${transactionId}/cancel`,
    {},
  );
  return response.data.data;
}

export async function completeTransaction(
  transactionId: string,
): Promise<Transaction> {
  const response = await apiClient.patch<ApiSuccess<Transaction>>(
    `/transactions/${transactionId}/complete`,
    {},
  );
  return response.data.data;
}

export async function listTransactions(
  params: ListTransactionsParams = {},
): Promise<TransactionPage> {
  const response = await apiClient.get<ApiSuccess<TransactionPage>>(
    '/transactions',
    { params },
  );
  return response.data.data;
}

export async function getTransaction(transactionId: string): Promise<Transaction> {
  const response = await apiClient.get<ApiSuccess<Transaction>>(
    `/transactions/${transactionId}`,
  );
  return response.data.data;
}

export async function createReview(
  transactionId: string,
  payload: CreateReviewPayload,
): Promise<Review> {
  const response = await apiClient.post<ApiSuccess<Review>>(
    `/transactions/${transactionId}/reviews`,
    payload,
  );
  return response.data.data;
}

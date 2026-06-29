import { apiClient } from './client';
import type { ProductStatus } from './products';
import type {
  PublicTransactionUser,
  TransactionStatus,
} from './transactions';

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED';

export interface PaymentProductSummary {
  id: string;
  title: string;
  price: number;
  status: ProductStatus;
  thumbnailUrl: string | null;
}

export interface PaymentTransactionSummary {
  id: string;
  status: TransactionStatus;
  amount: number;
  product: PaymentProductSummary;
}

export interface PaymentCheckout {
  clientKey: string;
  customerKey: string;
  orderId: string;
  orderName: string;
  amount: number;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
}

export interface Payment {
  id: string;
  transactionId: string;
  amount: number;
  status: PaymentStatus;
  idempotencyKey: string;
  escrowReleased: boolean;
  pgTxId: string | null;
  orderId: string;
  orderName: string;
  receiptUrl: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  transaction: PaymentTransactionSummary;
  buyer: PublicTransactionUser;
  seller: PublicTransactionUser;
  checkout: PaymentCheckout;
}

export type PaymentReceipt = Omit<Payment, 'idempotencyKey' | 'checkout'>;

export interface CreatePaymentPayload {
  transactionId: string;
  idempotencyKey: string;
}

export interface ApprovePaymentPayload {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface RefundPaymentPayload {
  reason?: string;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function createPayment(
  payload: CreatePaymentPayload,
): Promise<Payment> {
  const response = await apiClient.post<ApiSuccess<Payment>>(
    '/payments',
    payload,
  );
  return response.data.data;
}

export async function approvePayment(
  paymentId: string,
  payload: ApprovePaymentPayload,
): Promise<Payment> {
  const response = await apiClient.post<ApiSuccess<Payment>>(
    `/payments/${paymentId}/approve`,
    payload,
  );
  return response.data.data;
}

export async function confirmPayment(paymentId: string): Promise<Payment> {
  const response = await apiClient.post<ApiSuccess<Payment>>(
    `/payments/${paymentId}/confirm`,
    {},
  );
  return response.data.data;
}

export async function requestRefund(
  paymentId: string,
  payload: RefundPaymentPayload = {},
): Promise<Payment> {
  const response = await apiClient.post<ApiSuccess<Payment>>(
    `/payments/${paymentId}/refund`,
    payload,
  );
  return response.data.data;
}

export async function getReceipt(paymentId: string): Promise<PaymentReceipt> {
  const response = await apiClient.get<ApiSuccess<PaymentReceipt>>(
    `/payments/${paymentId}/receipt`,
  );
  return response.data.data;
}

import { PaymentStatus, ProductStatus, TxStatus } from '@prisma/client';

export interface PaymentPublicUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  trustScore: number;
  completedTx: number;
}

export interface PaymentProductSummary {
  id: string;
  title: string;
  price: number;
  status: ProductStatus;
  thumbnailUrl: string | null;
}

export interface PaymentTransactionSummary {
  id: string;
  status: TxStatus;
  amount: number;
  product: PaymentProductSummary;
}

export interface PaymentCheckoutResponse {
  providerMode: 'mock' | 'toss';
  clientKey: string;
  customerKey: string;
  orderId: string;
  orderName: string;
  amount: number;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
}

export interface PaymentResponse {
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
  paidAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  transaction: PaymentTransactionSummary;
  buyer: PaymentPublicUser;
  seller: PaymentPublicUser;
  checkout: PaymentCheckoutResponse;
}

export interface PaymentReceiptResponse {
  id: string;
  transactionId: string;
  amount: number;
  status: PaymentStatus;
  escrowReleased: boolean;
  pgTxId: string | null;
  orderId: string;
  orderName: string;
  receiptUrl: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  transaction: PaymentTransactionSummary;
  buyer: PaymentPublicUser;
  seller: PaymentPublicUser;
}

export interface PaymentWebhookResult {
  status: 'processed' | 'ignored';
}

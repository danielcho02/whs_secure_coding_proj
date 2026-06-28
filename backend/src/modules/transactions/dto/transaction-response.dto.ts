import { ProductStatus, TxStatus } from '@prisma/client';

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

export interface TransactionResponse {
  id: string;
  status: TxStatus;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
  product: TransactionProductSummary;
  buyer: PublicTransactionUser;
  seller: PublicTransactionUser;
}

export interface PaginatedTransactionsResponse {
  items: TransactionResponse[];
  page: number;
  limit: number;
  total: number;
}

export interface ReviewResponse {
  id: string;
  transactionId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  author: PublicTransactionUser;
  target: PublicTransactionUser;
}

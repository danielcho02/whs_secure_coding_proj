/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus, TxStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

type PrismaTxMock = ReturnType<typeof createPrismaMock>;

function createPrismaMock(): PrismaService {
  const delegates = {
    product: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    transaction: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    review: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      updateMany: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  };

  return {
    ...delegates,
    $transaction: vi.fn((callback: (tx: PrismaTxMock) => unknown) =>
      Promise.resolve(callback(delegates as unknown as PrismaTxMock)),
    ),
  } as unknown as PrismaService;
}

const buyer = {
  id: 'buyer-1',
  nickname: 'buyer',
  avatarUrl: null,
  trustScore: 5,
  completedTx: 1,
};

const seller = {
  id: 'seller-1',
  nickname: 'seller',
  avatarUrl: null,
  trustScore: 20,
  completedTx: 4,
};

const productForTransaction = {
  id: 'product-1',
  sellerId: seller.id,
  price: 300000,
  status: ProductStatus.ON_SALE,
  isHidden: false,
};

const productSummary = {
  id: productForTransaction.id,
  title: '아이폰 15',
  price: productForTransaction.price,
  status: ProductStatus.ON_SALE,
  images: [{ url: 'products/phone.jpg', order: 0 }],
};

const transactionResponse = {
  id: 'transaction-1',
  status: TxStatus.REQUESTED,
  amount: productForTransaction.price,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  product: productSummary,
  buyer,
  seller,
};

const transactionState = {
  id: transactionResponse.id,
  productId: productForTransaction.id,
  buyerId: buyer.id,
  sellerId: seller.id,
  status: TxStatus.REQUESTED,
};

const reviewResponse = {
  id: 'review-1',
  transactionId: transactionResponse.id,
  rating: 5,
  comment: '좋은 거래였습니다',
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  author: buyer,
  target: seller,
};

describe('TransactionsService', () => {
  let prisma: PrismaService;
  let service: TransactionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
    service = new TransactionsService(prisma);
  });

  it('creates a requested transaction using authenticated buyer, product seller, and product price', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(productForTransaction);
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.transaction.create).mockResolvedValue(transactionResponse);

    const result = await service.createTransaction(buyer.id, {
      productId: productForTransaction.id,
    });

    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          productId: productForTransaction.id,
          buyerId: buyer.id,
          sellerId: seller.id,
          amount: productForTransaction.price,
          status: TxStatus.REQUESTED,
        },
      }),
    );
    expect(result.amount).toBe(productForTransaction.price);
    expect(result.buyer).toEqual(buyer);
    expect(result.seller).toEqual(seller);
  });

  it('rejects creating a transaction for the authenticated user own product', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue({
      ...productForTransaction,
      sellerId: buyer.id,
    });

    await expect(
      service.createTransaction(buyer.id, { productId: productForTransaction.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('rejects creating a transaction for a hidden or missing product', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null);

    await expect(
      service.createTransaction(buyer.id, { productId: productForTransaction.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('rejects creating a transaction for a sold product', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue({
      ...productForTransaction,
      status: ProductStatus.SOLD,
    });

    await expect(
      service.createTransaction(buyer.id, { productId: productForTransaction.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate active transactions for the same buyer and product', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(productForTransaction);
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'existing-transaction',
    });

    await expect(
      service.createTransaction(buyer.id, { productId: productForTransaction.id }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('reserves a requested transaction for the seller and synchronizes product status', async () => {
    vi.mocked(prisma.transaction.findUnique)
      .mockResolvedValueOnce(transactionState)
      .mockResolvedValueOnce({
        ...transactionResponse,
        status: TxStatus.RESERVED,
        product: { ...productSummary, status: ProductStatus.RESERVED },
      });
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.transaction.updateMany).mockResolvedValue({ count: 1 });

    const result = await service.reserveTransaction(transactionState.id, seller.id);

    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: transactionState.productId,
        isHidden: false,
        status: ProductStatus.ON_SALE,
      },
      data: { status: ProductStatus.RESERVED },
    });
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: transactionState.id, status: TxStatus.REQUESTED },
      data: { status: TxStatus.RESERVED },
    });
    expect(result.status).toBe(TxStatus.RESERVED);
  });

  it('rejects reservation by buyer or other user', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(transactionState);

    await expect(
      service.reserveTransaction(transactionState.id, buyer.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('rejects reservation unless the transaction is requested', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      ...transactionState,
      status: TxStatus.RESERVED,
    });

    await expect(
      service.reserveTransaction(transactionState.id, seller.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects reservation when the product is already reserved or sold', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(transactionState);
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 0 });

    await expect(
      service.reserveTransaction(transactionState.id, seller.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects reservation when another transaction already reserved the product', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(transactionState);
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'other-reserved-transaction',
    });

    await expect(
      service.reserveTransaction(transactionState.id, seller.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cancels a cancellable transaction for a participant', async () => {
    vi.mocked(prisma.transaction.findUnique)
      .mockResolvedValueOnce(transactionState)
      .mockResolvedValueOnce({
        ...transactionResponse,
        status: TxStatus.CANCELLED,
      });
    vi.mocked(prisma.transaction.updateMany).mockResolvedValue({ count: 1 });

    const result = await service.cancelTransaction(transactionState.id, buyer.id);

    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        id: transactionState.id,
        status: { in: [TxStatus.REQUESTED, TxStatus.RESERVED, TxStatus.PAYMENT_PENDING] },
      },
      data: { status: TxStatus.CANCELLED },
    });
    expect(result.status).toBe(TxStatus.CANCELLED);
  });

  it('rejects cancellation by other users', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(transactionState);

    await expect(
      service.cancelTransaction(transactionState.id, 'other-user'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('restores product status when a reserved transaction is cancelled', async () => {
    vi.mocked(prisma.transaction.findUnique)
      .mockResolvedValueOnce({
        ...transactionState,
        status: TxStatus.RESERVED,
      })
      .mockResolvedValueOnce({
        ...transactionResponse,
        status: TxStatus.CANCELLED,
        product: { ...productSummary, status: ProductStatus.ON_SALE },
      });
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.transaction.updateMany).mockResolvedValue({ count: 1 });

    await service.cancelTransaction(transactionState.id, seller.id);

    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: transactionState.productId, status: ProductStatus.RESERVED },
      data: { status: ProductStatus.ON_SALE },
    });
  });

  it('rejects cancellation for completed or refunded transactions', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      ...transactionState,
      status: TxStatus.COMPLETED,
    });

    await expect(
      service.cancelTransaction(transactionState.id, buyer.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('completes a reserved transaction for the seller and synchronizes product status', async () => {
    vi.mocked(prisma.transaction.findUnique)
      .mockResolvedValueOnce({
        ...transactionState,
        status: TxStatus.RESERVED,
      })
      .mockResolvedValueOnce({
        ...transactionResponse,
        status: TxStatus.COMPLETED,
        product: { ...productSummary, status: ProductStatus.SOLD },
      });
    vi.mocked(prisma.transaction.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 });

    const result = await service.completeTransaction(transactionState.id, seller.id);

    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        id: transactionState.id,
        status: { in: [TxStatus.RESERVED, TxStatus.SHIPPING] },
      },
      data: { status: TxStatus.COMPLETED },
    });
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: transactionState.productId,
        isHidden: false,
        status: ProductStatus.RESERVED,
      },
      data: { status: ProductStatus.SOLD },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: buyer.id },
      data: {
        completedTx: { increment: 1 },
        trustScore: { increment: 1 },
      },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: seller.id },
      data: {
        completedTx: { increment: 1 },
        trustScore: { increment: 1 },
      },
    });
    expect(result.status).toBe(TxStatus.COMPLETED);
  });

  it('rejects completion by buyer or other user', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      ...transactionState,
      status: TxStatus.RESERVED,
    });

    await expect(
      service.completeTransaction(transactionState.id, buyer.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('lists only transactions where the current user is a party', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([transactionResponse]);
    vi.mocked(prisma.transaction.count).mockResolvedValue(1);

    const result = await service.listTransactions(buyer.id, {
      role: 'all',
      page: 1,
      limit: 20,
    });

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ buyerId: buyer.id }, { sellerId: buyer.id }],
        },
      }),
    );
    expect(result.items).toHaveLength(1);
  });

  it('applies buyer and seller role filters to transaction lists', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);

    await service.listTransactions(buyer.id, {
      role: 'buyer',
      page: 1,
      limit: 20,
    });
    expect(prisma.transaction.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { buyerId: buyer.id } }),
    );

    await service.listTransactions(seller.id, {
      role: 'seller',
      page: 1,
      limit: 20,
    });
    expect(prisma.transaction.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { sellerId: seller.id } }),
    );
  });

  it('creates a review for a completed transaction participant and calculates target user', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      ...transactionState,
      status: TxStatus.COMPLETED,
    });
    vi.mocked(prisma.review.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.review.create).mockResolvedValue(reviewResponse);

    const result = await service.createReview(transactionState.id, buyer.id, {
      rating: 5,
      comment: '좋은 거래였습니다',
    });

    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          transactionId: transactionState.id,
          authorId: buyer.id,
          targetId: seller.id,
          rating: 5,
          comment: '좋은 거래였습니다',
        },
      }),
    );
    expect(result.target).toEqual(seller);
  });

  it('rejects reviews for incomplete transactions', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(transactionState);

    await expect(
      service.createReview(transactionState.id, buyer.id, { rating: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects reviews by non-participants', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      ...transactionState,
      status: TxStatus.COMPLETED,
    });

    await expect(
      service.createReview(transactionState.id, 'other-user', { rating: 5 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects duplicate reviews by the same author for a transaction', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      ...transactionState,
      status: TxStatus.COMPLETED,
    });
    vi.mocked(prisma.review.findFirst).mockResolvedValue({ id: 'review-1' });

    await expect(
      service.createReview(transactionState.id, buyer.id, { rating: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not select or return passwordHash, email, or phone in transaction responses', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(transactionResponse);

    const result = await service.getTransactionForParticipant(
      transactionState.id,
      buyer.id,
    );

    expect(prisma.transaction.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          buyer: expect.objectContaining({
            select: expect.not.objectContaining({
              passwordHash: true,
              email: true,
              phone: true,
            }),
          }),
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
    expect(result.buyer).not.toHaveProperty('passwordHash');
    expect(result.buyer).not.toHaveProperty('email');
    expect(result.buyer).not.toHaveProperty('phone');
    expect(result.seller).not.toHaveProperty('passwordHash');
    expect(result.seller).not.toHaveProperty('email');
    expect(result.seller).not.toHaveProperty('phone');
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('maps unique review constraint failures to conflict responses', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      ...transactionState,
      status: TxStatus.COMPLETED,
    });
    vi.mocked(prisma.review.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.review.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.createReview(transactionState.id, buyer.id, { rating: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

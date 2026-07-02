import { ConflictException } from '@nestjs/common';
import { PaymentStatus, ProductStatus, TxStatus, UserStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

const productId = 'product-race-1';
const sellerId = 'seller-race-1';
const buyerAId = 'buyer-race-1';
const buyerBId = 'buyer-race-2';

const seller = {
  id: sellerId,
  nickname: 'seller',
  avatarUrl: null,
  trustScore: 20,
  completedTx: 4,
};

const buyerA = {
  id: buyerAId,
  nickname: 'buyer-a',
  avatarUrl: null,
  trustScore: 5,
  completedTx: 1,
};

const buyerB = {
  id: buyerBId,
  nickname: 'buyer-b',
  avatarUrl: null,
  trustScore: 3,
  completedTx: 0,
};

const productSummary = {
  id: productId,
  title: '동시 예약 방어 상품',
  price: 300000,
  status: ProductStatus.ON_SALE,
  images: [{ url: 'products/race.jpg', order: 0 }],
};

const transactionAId = 'transaction-race-1';
const transactionBId = 'transaction-race-2';

describe('TransactionsService race condition evidence', () => {
  it('allows only one concurrent reservation for the same product to prevent duplicate sale', async () => {
    const concurrencyGate = createConcurrencyGate(2);
    const transactionStatuses = new Map<string, TxStatus>([
      [transactionAId, TxStatus.REQUESTED],
      [transactionBId, TxStatus.REQUESTED],
    ]);
    let productStatus = ProductStatus.ON_SALE;
    const productUpdateMany = vi.fn(async () => {
      await concurrencyGate.wait();

      if (productStatus !== ProductStatus.ON_SALE) {
        return { count: 0 };
      }

      productStatus = ProductStatus.RESERVED;
      return { count: 1 };
    });
    const transactionUpdateMany = vi.fn((args: UpdateManyArgs) => {
      const id = args.where.id;

      if (transactionStatuses.get(id) !== TxStatus.REQUESTED) {
        return { count: 0 };
      }

      transactionStatuses.set(id, TxStatus.RESERVED);
      return { count: 1 };
    });
    const transactionCreate = vi.fn();
    const paymentCreate = vi.fn();
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: sellerId,
          status: UserStatus.ACTIVE,
        }),
        updateMany: vi.fn(),
      },
      product: {
        updateMany: productUpdateMany,
      },
      transaction: {
        create: transactionCreate,
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn((args: FindUniqueArgs) =>
          buildTransactionRecord(args.where.id, transactionStatuses),
        ),
        updateMany: transactionUpdateMany,
      },
      payment: {
        create: paymentCreate,
      },
      $transaction: vi.fn((callback: (tx: unknown) => unknown) =>
        Promise.resolve(callback(prisma)),
      ),
    } as unknown as PrismaService;
    const service = new TransactionsService(prisma);

    const results = await Promise.allSettled([
      service.reserveTransaction(transactionAId, sellerId),
      service.reserveTransaction(transactionBId, sellerId),
    ]);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<unknown> =>
        result.status === 'fulfilled',
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    expect(productStatus).toBe(ProductStatus.RESERVED);
    expect(
      Array.from(transactionStatuses.values()).filter(
        (status) => status === TxStatus.RESERVED,
      ),
    ).toHaveLength(1);
    expect(productUpdateMany).toHaveBeenCalledTimes(2);
    expect(productUpdateMany).toHaveBeenCalledWith({
      where: {
        id: productId,
        isHidden: false,
        status: ProductStatus.ON_SALE,
      },
      data: { status: ProductStatus.RESERVED },
    });
    expect(transactionUpdateMany).toHaveBeenCalledTimes(1);
    expect(transactionCreate).not.toHaveBeenCalled();
    expect(paymentCreate).not.toHaveBeenCalled();
  });
});

interface FindUniqueArgs {
  where: {
    id: string;
  };
}

interface UpdateManyArgs {
  where: {
    id: string;
  };
}

function buildTransactionRecord(
  transactionId: string,
  statuses: Map<string, TxStatus>,
) {
  const buyer = transactionId === transactionAId ? buyerA : buyerB;
  const status = statuses.get(transactionId) ?? TxStatus.REQUESTED;

  return {
    id: transactionId,
    productId,
    buyerId: buyer.id,
    sellerId,
    status,
    amount: productSummary.price,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    product: {
      ...productSummary,
      status:
        status === TxStatus.RESERVED
          ? ProductStatus.RESERVED
          : ProductStatus.ON_SALE,
    },
    buyer,
    seller,
    payment:
      status === TxStatus.RESERVED
        ? {
            id: 'payment-race-summary',
            status: PaymentStatus.PENDING,
            escrowReleased: false,
            createdAt: new Date('2026-07-01T00:01:00.000Z'),
          }
        : null,
  };
}

function createConcurrencyGate(targetCount: number): {
  wait: () => Promise<void>;
} {
  let waiting = 0;
  let release: (() => void) | undefined;
  const allArrived = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    async wait(): Promise<void> {
      waiting += 1;

      if (waiting >= targetCount) {
        release?.();
      }

      await allArrived;
    },
  };
}

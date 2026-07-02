/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PaymentStatus,
  ProductStatus,
  TxStatus,
  UserStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProvider } from './providers/payment-provider.interface';
import { PaymentsService } from './payments.service';
import { TossWebhookVerifier } from './toss-webhook-verifier';

type PrismaTxMock = ReturnType<typeof createPrismaMock>;

function createPrismaMock(): PrismaService {
  const delegates = {
    payment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    product: {
      updateMany: vi.fn(),
    },
    transaction: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
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

const product = {
  id: 'product-1',
  title: '아이폰 15',
  price: 300000,
  status: ProductStatus.RESERVED,
  images: [{ url: 'products/phone.jpg', order: 0 }],
};

const transaction = {
  id: 'transaction-1',
  productId: product.id,
  buyerId: buyer.id,
  sellerId: seller.id,
  status: TxStatus.RESERVED,
  amount: product.price,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  product,
  buyer,
  seller,
};

const payment = {
  id: 'payment-1',
  transactionId: transaction.id,
  amount: product.price,
  status: PaymentStatus.PENDING,
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
  escrowReleased: false,
  pgTxId: null,
  orderId: 'order_11111111-1111-4111-8111-111111111111',
  orderName: '아이폰 15',
  receiptUrl: null,
  paidAt: null,
  refundedAt: null,
  createdAt: new Date('2026-01-01T00:01:00.000Z'),
  updatedAt: new Date('2026-01-01T00:01:00.000Z'),
  transaction,
};

function createProviderMock(): PaymentProvider {
  return {
    confirmPayment: vi.fn(),
    cancelPayment: vi.fn(),
    getPayment: vi.fn(),
  };
}

describe('PaymentsService', () => {
  let prisma: PrismaService;
  let provider: PaymentProvider;
  let verifier: TossWebhookVerifier;
  let service: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: buyer.id,
      status: UserStatus.ACTIVE,
    });
    provider = createProviderMock();
    verifier = new TossWebhookVerifier('webhook-secret');
    service = new PaymentsService(prisma, provider, verifier, {
      providerMode: 'toss',
      tossClientKey: 'test_ck',
      successUrl: 'http://localhost:5173/payments/success',
      failUrl: 'http://localhost:5173/payments/fail',
      cancelUrl: 'http://localhost:5173/payments/cancel',
    });
  });

  it('creates a pending payment for the transaction buyer using the server amount', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      ...transaction,
      payment: null,
    });
    vi.mocked(prisma.payment.create).mockResolvedValue(payment);
    vi.mocked(prisma.transaction.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.auditLog.create).mockResolvedValue({
      id: 'audit-1',
      userId: buyer.id,
      event: 'PAYMENT_CREATED',
      ip: null,
      detail: '{}',
      createdAt: new Date(),
    });

    const result = await service.createPayment(buyer.id, {
      transactionId: transaction.id,
      idempotencyKey: payment.idempotencyKey,
    });

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionId: transaction.id,
          amount: transaction.amount,
          status: PaymentStatus.PENDING,
          idempotencyKey: payment.idempotencyKey,
        }) as unknown,
      }),
    );
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        id: transaction.id,
        status: { in: [TxStatus.RESERVED, TxStatus.PAYMENT_PENDING] },
      },
      data: { status: TxStatus.PAYMENT_PENDING },
    });
    expect(result.amount).toBe(product.price);
    expect(result.checkout.clientKey).toBe('test_ck');
  });

  it('marks checkout responses as mock when the local provider mode is enabled', async () => {
    service = new PaymentsService(prisma, provider, verifier, {
      tossClientKey: 'mock_checkout',
      providerMode: 'mock',
      successUrl: 'http://localhost:5173/payments/success',
      failUrl: 'http://localhost:5173/payments/fail',
      cancelUrl: 'http://localhost:5173/payments/cancel',
    } as never);
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      ...transaction,
      payment: null,
    });
    vi.mocked(prisma.payment.create).mockResolvedValue(payment);
    vi.mocked(prisma.transaction.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.auditLog.create).mockResolvedValue({
      id: 'audit-1',
      userId: buyer.id,
      event: 'PAYMENT_CREATED',
      ip: null,
      detail: '{}',
      createdAt: new Date(),
    });

    const result = await service.createPayment(buyer.id, {
      transactionId: transaction.id,
      idempotencyKey: payment.idempotencyKey,
    });

    expect(result.checkout.providerMode).toBe('mock');
  });

  it('rejects payment creation by a non-buyer', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      ...transaction,
      payment: null,
    });

    await expect(
      service.createPayment(seller.id, {
        transactionId: transaction.id,
        idempotencyKey: payment.idempotencyKey,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('rejects payment creation by a suspended user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: buyer.id,
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.createPayment(buyer.id, {
        transactionId: transaction.id,
        idempotencyKey: payment.idempotencyKey,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('reuses the existing payment for the same idempotency key', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      ...transaction,
      payment,
    });

    const result = await service.createPayment(buyer.id, {
      transactionId: transaction.id,
      idempotencyKey: payment.idempotencyKey,
    });

    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(result.id).toBe(payment.id);
  });

  it('rejects another idempotency key for the same active transaction payment', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      ...transaction,
      payment,
    });

    await expect(
      service.createPayment(buyer.id, {
        transactionId: transaction.id,
        idempotencyKey: '33333333-3333-4333-8333-333333333333',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects Toss approval when amount mismatches the server amount', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(payment);

    await expect(
      service.approvePayment(buyer.id, payment.id, {
        paymentKey: 'tgen_20260628123456',
        orderId: payment.orderId,
        amount: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(provider.confirmPayment).not.toHaveBeenCalled();
  });

  it('rejects Toss approval by a suspended user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: buyer.id,
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.approvePayment(buyer.id, payment.id, {
        paymentKey: 'tgen_20260628123456',
        orderId: payment.orderId,
        amount: payment.amount,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(provider.confirmPayment).not.toHaveBeenCalled();
  });

  it('marks payment and transaction paid after a successful Toss approval', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(payment);
    vi.mocked(provider.confirmPayment).mockResolvedValue({
      paymentKey: 'tgen_20260628123456',
      orderId: payment.orderId,
      status: 'DONE',
      amount: payment.amount,
      receiptUrl: 'https://dashboard.tosspayments.com/receipt/test',
    });
    vi.mocked(prisma.payment.update).mockResolvedValue({
      ...payment,
      status: PaymentStatus.PAID,
      pgTxId: 'tgen_20260628123456',
      paidAt: new Date('2026-01-01T00:02:00.000Z'),
      receiptUrl: 'https://dashboard.tosspayments.com/receipt/test',
    });
    vi.mocked(prisma.transaction.updateMany).mockResolvedValue({ count: 1 });

    const result = await service.approvePayment(buyer.id, payment.id, {
      paymentKey: 'tgen_20260628123456',
      orderId: payment.orderId,
      amount: payment.amount,
    });

    expect(provider.confirmPayment).toHaveBeenCalledWith({
      paymentKey: 'tgen_20260628123456',
      orderId: payment.orderId,
      amount: payment.amount,
    });
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PaymentStatus.PAID,
          pgTxId: 'tgen_20260628123456',
          receiptUrl: 'https://dashboard.tosspayments.com/receipt/test',
        }) as unknown,
      }),
    );
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        id: transaction.id,
        status: {
          in: expect.arrayContaining([
            TxStatus.PAYMENT_PENDING,
            TxStatus.RESERVED,
          ]),
        },
      },
      data: { status: TxStatus.PAID },
    });
    expect(result.status).toBe(PaymentStatus.PAID);
  });

  it('rejects a webhook with an invalid signature before touching payment state', async () => {
    await expect(
      service.handleWebhook(
        Buffer.from('{"eventType":"PAYMENT_STATUS_CHANGED"}'),
        {
          signature: 'v1=invalid',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
        { orderId: payment.orderId, status: 'DONE', amount: payment.amount },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
  });

  it('treats a duplicate paid webhook as idempotent', async () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        orderId: payment.orderId,
        status: 'DONE',
        amount: payment.amount,
      }),
    );
    const headers = verifier.createSignedHeadersForTest(rawBody);
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      ...payment,
      status: PaymentStatus.PAID,
      pgTxId: 'tgen_20260628123456',
    });

    const result = await service.handleWebhook(rawBody, headers, {
      orderId: payment.orderId,
      status: 'DONE',
      amount: payment.amount,
    });

    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(result.status).toBe('ignored');
  });

  it('releases escrow and completes the transaction on buyer purchase confirmation', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      ...payment,
      status: PaymentStatus.PAID,
      transaction: { ...transaction, status: TxStatus.PAID },
    });
    vi.mocked(prisma.payment.update).mockResolvedValue({
      ...payment,
      status: PaymentStatus.PAID,
      escrowReleased: true,
      transaction: { ...transaction, status: TxStatus.COMPLETED },
    });
    vi.mocked(prisma.transaction.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 });

    const result = await service.confirmPurchase(buyer.id, payment.id);

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { escrowReleased: true },
      }),
    );
    expect(result.escrowReleased).toBe(true);
  });

  it('rejects purchase confirmation by a suspended user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: buyer.id,
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.confirmPurchase(buyer.id, payment.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('rejects normal refunds after escrow has been released', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      ...payment,
      status: PaymentStatus.PAID,
      escrowReleased: true,
    });

    await expect(
      service.refundPayment(buyer.id, payment.id, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(provider.cancelPayment).not.toHaveBeenCalled();
  });

  it('rejects refund requests by a suspended user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: buyer.id,
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.refundPayment(buyer.id, payment.id, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(provider.cancelPayment).not.toHaveBeenCalled();
  });

  it('restricts receipt lookup to transaction participants and omits sensitive user fields', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(payment);

    const receipt = await service.getReceipt(buyer.id, payment.id);

    expect(receipt.buyer).toEqual(buyer);
    expect(receipt.seller).toEqual(seller);
    expect('email' in receipt.buyer).toBe(false);
    expect('phone' in receipt.seller).toBe(false);

    await expect(
      service.getReceipt('stranger', payment.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

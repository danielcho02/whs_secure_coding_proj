import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PaymentStatus,
  ProductStatus,
  Role,
  TxStatus,
  UserStatus,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './common/guards/roles.guard';
import { CreatePaymentDto } from './modules/payments/dto/create-payment.dto';
import { PaymentsService } from './modules/payments/payments.service';
import { PaymentProvider } from './modules/payments/providers/payment-provider.interface';
import { TossWebhookVerifier } from './modules/payments/toss-webhook-verifier';
import { PrismaService } from './modules/prisma/prisma.service';
import { CreateTransactionDto } from './modules/transactions/dto/create-transaction.dto';
import { TransactionsService } from './modules/transactions/transactions.service';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function validateBody<T extends object>(
  metatype: new () => T,
  value: Record<string, unknown>,
): Promise<T> {
  return validationPipe.transform(value, {
    type: 'body',
    metatype,
  }) as Promise<T>;
}

function createExecutionContext(user: {
  role: Role;
  status: UserStatus;
}): ExecutionContext {
  return {
    getHandler: () => vi.fn(),
    getClass: () => class AdminController {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function createAdminReflector(): Reflector {
  return {
    getAllAndOverride: vi.fn(() => [Role.ADMIN]),
  } as unknown as Reflector;
}

function createPaymentProviderMock(): PaymentProvider {
  return {
    confirmPayment: vi.fn(),
    cancelPayment: vi.fn(),
    getPayment: vi.fn(),
  };
}

const publicBuyer = {
  id: '11111111-1111-4111-8111-111111111111',
  nickname: 'buyer',
  avatarUrl: null,
  trustScore: 1,
  completedTx: 0,
};

const publicSeller = {
  id: '22222222-2222-4222-8222-222222222222',
  nickname: 'seller',
  avatarUrl: null,
  trustScore: 10,
  completedTx: 3,
};

const productSummary = {
  id: '33333333-3333-4333-8333-333333333333',
  title: '안전거래 상품',
  price: 300000,
  status: ProductStatus.RESERVED,
  images: [{ url: 'products/safe.jpg', order: 0 }],
};

const baseTransactionForPayment = {
  id: '44444444-4444-4444-8444-444444444444',
  productId: productSummary.id,
  buyerId: publicBuyer.id,
  sellerId: publicSeller.id,
  status: TxStatus.RESERVED,
  amount: productSummary.price,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  product: productSummary,
  buyer: publicBuyer,
  seller: publicSeller,
  payment: null,
};

describe('security smoke evidence', () => {
  it('rejects mass assignment of authority-bearing transaction and payment fields', async () => {
    await expect(
      validateBody(CreateTransactionDto, {
        productId: productSummary.id,
        buyerId: publicBuyer.id,
        sellerId: publicSeller.id,
        amount: 1,
        price: 1,
        status: TxStatus.COMPLETED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      validateBody(CreatePaymentDto, {
        transactionId: baseTransactionForPayment.id,
        idempotencyKey: '55555555-5555-4555-8555-555555555555',
        amount: 1,
        userId: publicSeller.id,
        role: Role.ADMIN,
        status: PaymentStatus.PAID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks admin bypass attempts from normal users and inactive admins', () => {
    const guard = new RolesGuard(createAdminReflector());

    expect(() =>
      guard.canActivate(
        createExecutionContext({
          role: Role.USER,
          status: UserStatus.ACTIVE,
        }),
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      guard.canActivate(
        createExecutionContext({
          role: Role.ADMIN,
          status: UserStatus.SUSPENDED,
        }),
      ),
    ).toThrow(ForbiddenException);

    expect(
      guard.canActivate(
        createExecutionContext({
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
        }),
      ),
    ).toBe(true);
  });

  it('hides transactions from non-participants to prevent BOLA/IDOR', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: baseTransactionForPayment.id,
      status: TxStatus.PAID,
      amount: productSummary.price,
      createdAt: baseTransactionForPayment.createdAt,
      updatedAt: baseTransactionForPayment.updatedAt,
      product: productSummary,
      buyer: publicBuyer,
      seller: publicSeller,
      payment: {
        id: '66666666-6666-4666-8666-666666666666',
        status: PaymentStatus.PAID,
        escrowReleased: false,
        createdAt: new Date('2026-07-01T00:05:00.000Z'),
      },
    });
    const prisma = {
      transaction: { findUnique },
    } as unknown as PrismaService;
    const service = new TransactionsService(prisma);

    await expect(
      service.getTransactionForParticipant(
        baseTransactionForPayment.id,
        '77777777-7777-4777-8777-777777777777',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: baseTransactionForPayment.id },
      }),
    );
  });

  it('uses only the server transaction amount when creating a payment', async () => {
    const paymentCreate = vi.fn().mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
      transactionId: baseTransactionForPayment.id,
      amount: baseTransactionForPayment.amount,
      status: PaymentStatus.PENDING,
      idempotencyKey: '55555555-5555-4555-8555-555555555555',
      escrowReleased: false,
      pgTxId: null,
      orderId: 'order_88888888-8888-4888-8888-888888888888',
      orderName: productSummary.title,
      receiptUrl: null,
      paidAt: null,
      refundedAt: null,
      createdAt: new Date('2026-07-01T00:01:00.000Z'),
      updatedAt: new Date('2026-07-01T00:01:00.000Z'),
    });
    const transactionUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const auditLogCreate = vi.fn().mockResolvedValue({ id: 'audit-1' });
    const delegates = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: publicBuyer.id,
          status: UserStatus.ACTIVE,
        }),
      },
      transaction: {
        findUnique: vi.fn().mockResolvedValue(baseTransactionForPayment),
        updateMany: transactionUpdateMany,
      },
      payment: {
        create: paymentCreate,
      },
      auditLog: {
        create: auditLogCreate,
      },
    };
    const prisma = {
      ...delegates,
      $transaction: vi.fn((callback: (tx: typeof delegates) => unknown) =>
        Promise.resolve(callback(delegates)),
      ),
    } as unknown as PrismaService;
    const service = new PaymentsService(
      prisma,
      createPaymentProviderMock(),
      new TossWebhookVerifier('webhook-secret'),
      {
        providerMode: 'toss',
        tossClientKey: 'test_ck',
        successUrl: 'http://localhost:5173/payments/success',
        failUrl: 'http://localhost:5173/payments/fail',
        cancelUrl: 'http://localhost:5173/payments/cancel',
      },
    );

    const result = await service.createPayment(publicBuyer.id, {
      transactionId: baseTransactionForPayment.id,
      idempotencyKey: '55555555-5555-4555-8555-555555555555',
      amount: 1,
      price: 1,
      status: PaymentStatus.PAID,
    } as unknown as CreatePaymentDto);

    expect(paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: baseTransactionForPayment.amount,
          status: PaymentStatus.PENDING,
        }) as unknown,
      }),
    );
    expect(result.amount).toBe(baseTransactionForPayment.amount);
    expect(result.checkout.amount).toBe(baseTransactionForPayment.amount);
  });

  it('rejects payment creation when stored transaction amount diverges from product price', async () => {
    const paymentCreate = vi.fn();
    const inconsistentTransaction = {
      ...baseTransactionForPayment,
      amount: 1,
    };
    const delegates = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: publicBuyer.id,
          status: UserStatus.ACTIVE,
        }),
      },
      transaction: {
        findUnique: vi.fn().mockResolvedValue(inconsistentTransaction),
      },
      payment: {
        create: paymentCreate,
      },
    };
    const prisma = {
      ...delegates,
      $transaction: vi.fn((callback: (tx: typeof delegates) => unknown) =>
        Promise.resolve(callback(delegates)),
      ),
    } as unknown as PrismaService;
    const service = new PaymentsService(
      prisma,
      createPaymentProviderMock(),
      new TossWebhookVerifier('webhook-secret'),
      {
        providerMode: 'toss',
        tossClientKey: 'test_ck',
        successUrl: 'http://localhost:5173/payments/success',
        failUrl: 'http://localhost:5173/payments/fail',
        cancelUrl: 'http://localhost:5173/payments/cancel',
      },
    );

    await expect(
      service.createPayment(publicBuyer.id, {
        transactionId: inconsistentTransaction.id,
        idempotencyKey: '55555555-5555-4555-8555-555555555555',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(paymentCreate).not.toHaveBeenCalled();
  });
});

import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { TxStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { CancelTransactionDto } from './cancel-transaction.dto';
import { CompleteTransactionDto } from './complete-transaction.dto';
import { CreateReviewDto } from './create-review.dto';
import { CreateTransactionDto } from './create-transaction.dto';
import { ListTransactionsDto } from './list-transactions.dto';
import { ReserveTransactionDto } from './reserve-transaction.dto';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function validateDto<T extends object>(
  metatype: new () => T,
  value: Record<string, unknown>,
  type: 'body' | 'query' = 'body',
): Promise<T> {
  return validationPipe.transform(value, {
    type,
    metatype,
  }) as Promise<T>;
}

describe('Transaction DTO validation', () => {
  it('accepts a valid transaction creation payload', async () => {
    await expect(
      validateDto(CreateTransactionDto, {
        productId: '11111111-1111-4111-8111-111111111111',
      }),
    ).resolves.toBeInstanceOf(CreateTransactionDto);
  });

  it('rejects authority and amount injection on transaction creation', async () => {
    await expect(
      validateDto(CreateTransactionDto, {
        productId: '11111111-1111-4111-8111-111111111111',
        buyerId: '22222222-2222-4222-8222-222222222222',
        sellerId: '33333333-3333-4333-8333-333333333333',
        amount: 100,
        status: TxStatus.COMPLETED,
        productPrice: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects status injection on transition endpoints', async () => {
    await expect(
      validateDto(ReserveTransactionDto, { status: TxStatus.RESERVED }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      validateDto(CancelTransactionDto, { status: TxStatus.CANCELLED }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      validateDto(CompleteTransactionDto, { status: TxStatus.COMPLETED }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('transforms and validates transaction list query values', async () => {
    const dto = await validateDto(
      ListTransactionsDto,
      {
        role: 'buyer',
        status: TxStatus.REQUESTED,
        page: '2',
        limit: '10',
      },
      'query',
    );

    expect(dto.role).toBe('buyer');
    expect(dto.status).toBe(TxStatus.REQUESTED);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(10);
  });

  it('rejects invalid list role, status, and pagination values', async () => {
    await expect(
      validateDto(ListTransactionsDto, { role: 'admin' }, 'query'),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      validateDto(ListTransactionsDto, { status: 'HACKED' }, 'query'),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      validateDto(ListTransactionsDto, { page: '0', limit: '101' }, 'query'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a valid review payload', async () => {
    const dto = await validateDto(CreateReviewDto, {
      rating: 5,
      comment: '좋은 거래였습니다',
    });

    expect(dto.rating).toBe(5);
    expect(dto.comment).toBe('좋은 거래였습니다');
  });

  it('rejects review identity injection', async () => {
    await expect(
      validateDto(CreateReviewDto, {
        rating: 5,
        comment: '권한 필드 주입',
        authorId: '22222222-2222-4222-8222-222222222222',
        targetId: '33333333-3333-4333-8333-333333333333',
        transactionId: '44444444-4444-4444-8444-444444444444',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects review rating outside 1..5 and over-limit comments', async () => {
    await expect(
      validateDto(CreateReviewDto, { rating: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      validateDto(CreateReviewDto, { rating: 6 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      validateDto(CreateReviewDto, {
        rating: 5,
        comment: 'a'.repeat(1001),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

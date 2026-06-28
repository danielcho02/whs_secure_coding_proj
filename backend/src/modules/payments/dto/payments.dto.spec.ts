import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ApprovePaymentDto } from './approve-payment.dto';
import { ConfirmPurchaseDto } from './confirm-purchase.dto';
import { CreatePaymentDto } from './create-payment.dto';
import { RefundPaymentDto } from './refund-payment.dto';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function validateDto<T extends object>(
  metatype: new () => T,
  value: Record<string, unknown>,
): Promise<T> {
  return validationPipe.transform(value, {
    type: 'body',
    metatype,
  }) as Promise<T>;
}

describe('Payment DTO validation', () => {
  it('accepts a valid payment creation payload', async () => {
    const dto = await validateDto(CreatePaymentDto, {
      transactionId: '11111111-1111-4111-8111-111111111111',
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
    });

    expect(dto.transactionId).toBe('11111111-1111-4111-8111-111111111111');
    expect(dto.idempotencyKey).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('rejects amount, user, and status injection on payment creation', async () => {
    await expect(
      validateDto(CreatePaymentDto, {
        transactionId: '11111111-1111-4111-8111-111111111111',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
        amount: 100,
        buyerId: '33333333-3333-4333-8333-333333333333',
        userId: '33333333-3333-4333-8333-333333333333',
        status: 'PAID',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts Toss approve callback fields', async () => {
    const dto = await validateDto(ApprovePaymentDto, {
      paymentKey: 'tgen_20260628123456',
      orderId: 'order_11111111-1111-4111-8111-111111111111',
      amount: 300000,
    });

    expect(dto.paymentKey).toBe('tgen_20260628123456');
    expect(dto.orderId).toBe('order_11111111-1111-4111-8111-111111111111');
    expect(dto.amount).toBe(300000);
  });

  it('rejects amount or status injection on buyer purchase confirmation', async () => {
    await expect(
      validateDto(ConfirmPurchaseDto, {
        amount: 100,
        status: 'COMPLETED',
        escrowReleased: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts an empty refund body and rejects status injection', async () => {
    await expect(validateDto(RefundPaymentDto, {})).resolves.toBeInstanceOf(
      RefundPaymentDto,
    );

    await expect(
      validateDto(RefundPaymentDto, {
        status: 'REFUNDED',
        escrowReleased: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

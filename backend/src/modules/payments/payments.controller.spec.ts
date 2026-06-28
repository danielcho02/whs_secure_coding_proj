import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaymentsController } from './payments.controller';

function getMethodGuards(methodName: keyof PaymentsController): unknown[] {
  return (
    Reflect.getMetadata(
      GUARDS_METADATA,
      PaymentsController.prototype[methodName],
    ) as unknown[] | undefined
  ) ?? [];
}

describe('PaymentsController guards', () => {
  it('requires JWT auth for payment creation', () => {
    expect(getMethodGuards('createPayment')).toContain(JwtAuthGuard);
  });

  it('does not require JWT auth for Toss webhook', () => {
    expect(getMethodGuards('handleWebhook')).not.toContain(JwtAuthGuard);
  });

  it('requires JWT auth for Toss approve callback', () => {
    expect(getMethodGuards('approvePayment')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for purchase confirmation', () => {
    expect(getMethodGuards('confirmPurchase')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for refund requests', () => {
    expect(getMethodGuards('refundPayment')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for receipt lookup', () => {
    expect(getMethodGuards('getReceipt')).toContain(JwtAuthGuard);
  });
});

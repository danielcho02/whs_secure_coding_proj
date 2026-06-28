import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TransactionsController } from './transactions.controller';

function getMethodGuards(methodName: keyof TransactionsController): unknown[] {
  return (
    Reflect.getMetadata(
      GUARDS_METADATA,
      TransactionsController.prototype[methodName],
    ) as unknown[] | undefined
  ) ?? [];
}

describe('TransactionsController guards', () => {
  it('requires JWT auth for transaction creation', () => {
    expect(getMethodGuards('createTransaction')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for reservation', () => {
    expect(getMethodGuards('reserveTransaction')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for cancellation', () => {
    expect(getMethodGuards('cancelTransaction')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for completion', () => {
    expect(getMethodGuards('completeTransaction')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for transaction list', () => {
    expect(getMethodGuards('listTransactions')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for review creation', () => {
    expect(getMethodGuards('createReview')).toContain(JwtAuthGuard);
  });
});

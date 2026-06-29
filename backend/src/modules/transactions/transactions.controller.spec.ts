import { ParseUUIDPipe } from '@nestjs/common';
import {
  GUARDS_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TransactionsController } from './transactions.controller';

interface RouteArgMetadata {
  data?: unknown;
  pipes?: unknown[];
}

function getMethodGuards(methodName: keyof TransactionsController): unknown[] {
  return (
    Reflect.getMetadata(
      GUARDS_METADATA,
      TransactionsController.prototype[methodName],
    ) as unknown[] | undefined
  ) ?? [];
}

function getIdParamPipes(methodName: keyof TransactionsController): unknown[] {
  const metadata =
    (Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      TransactionsController,
      methodName,
    ) as Record<string, RouteArgMetadata> | undefined) ?? {};

  return Object.values(metadata)
    .filter((routeArg) => routeArg.data === 'id')
    .flatMap((routeArg) => routeArg.pipes ?? []);
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

  it('requires JWT auth for transaction detail', () => {
    expect(getMethodGuards('getTransaction')).toContain(JwtAuthGuard);
  });

  it('validates transaction detail ids as UUIDs', () => {
    expect(getIdParamPipes('getTransaction')).toContain(ParseUUIDPipe);
  });

  it('requires JWT auth for review creation', () => {
    expect(getMethodGuards('createReview')).toContain(JwtAuthGuard);
  });
});

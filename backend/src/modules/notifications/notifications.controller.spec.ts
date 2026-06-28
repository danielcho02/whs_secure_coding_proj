import { ParseUUIDPipe } from '@nestjs/common';
import {
  GUARDS_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationsController } from './notifications.controller';

interface RouteArgMetadata {
  data?: unknown;
  pipes?: unknown[];
}

function getMethodGuards(methodName: keyof NotificationsController): unknown[] {
  return (
    Reflect.getMetadata(
      GUARDS_METADATA,
      NotificationsController.prototype[methodName],
    ) as unknown[] | undefined
  ) ?? [];
}

function getIdParamPipes(methodName: keyof NotificationsController): unknown[] {
  const metadata =
    (Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      NotificationsController,
      methodName,
    ) as Record<string, RouteArgMetadata> | undefined) ?? {};

  return Object.values(metadata)
    .filter((routeArg) => routeArg.data === 'id')
    .flatMap((routeArg) => routeArg.pipes ?? []);
}

describe('NotificationsController guards', () => {
  it('requires JWT auth for notification list', () => {
    expect(getMethodGuards('listNotifications')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for read marking', () => {
    expect(getMethodGuards('markAsRead')).toContain(JwtAuthGuard);
  });

  it('validates notification ids as UUIDs', () => {
    expect(getIdParamPipes('markAsRead')).toContain(ParseUUIDPipe);
  });
});

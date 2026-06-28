import { ParseUUIDPipe } from '@nestjs/common';
import {
  GUARDS_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersController } from './users.controller';

interface RouteArgMetadata {
  data?: unknown;
  pipes?: unknown[];
}

function getMethodGuards(methodName: keyof UsersController): unknown[] {
  return (
    Reflect.getMetadata(
      GUARDS_METADATA,
      UsersController.prototype[methodName],
    ) as unknown[] | undefined
  ) ?? [];
}

function getIdParamPipes(methodName: keyof UsersController): unknown[] {
  const metadata =
    (Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      UsersController,
      methodName,
    ) as Record<string, RouteArgMetadata> | undefined) ?? {};

  return Object.values(metadata)
    .filter((routeArg) => routeArg.data === 'id')
    .flatMap((routeArg) => routeArg.pipes ?? []);
}

describe('UsersController guards', () => {
  it('requires JWT auth for GET /users/me', () => {
    expect(getMethodGuards('getMe')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for PATCH /users/me', () => {
    expect(getMethodGuards('updateMe')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for GET /users/:id/private', () => {
    expect(getMethodGuards('getPrivateProfile')).toContain(JwtAuthGuard);
  });

  it('validates public profile ids as UUIDs', () => {
    expect(getIdParamPipes('getPublicProfile')).toContain(ParseUUIDPipe);
  });
});

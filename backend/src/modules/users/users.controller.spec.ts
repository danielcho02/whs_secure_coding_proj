import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersController } from './users.controller';

function getMethodGuards(methodName: keyof UsersController): unknown[] {
  return (
    Reflect.getMetadata(
      GUARDS_METADATA,
      UsersController.prototype[methodName],
    ) as unknown[] | undefined
  ) ?? [];
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
});

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './roles.guard';

type RequestUser = {
  role: Role;
  status: UserStatus;
};

function createContext(user: RequestUser): ExecutionContext {
  return {
    getHandler: () => vi.fn(),
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function createReflector(requiredRoles: Role[]): Reflector {
  return {
    getAllAndOverride: vi.fn(() => requiredRoles),
  } as unknown as Reflector;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(() => {
    guard = new RolesGuard(createReflector([Role.ADMIN]));
  });

  it('rejects an ADMIN user when status is SUSPENDED', () => {
    expect(() =>
      guard.canActivate(
        createContext({ role: Role.ADMIN, status: UserStatus.SUSPENDED }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows an ACTIVE ADMIN user', () => {
    expect(
      guard.canActivate(
        createContext({ role: Role.ADMIN, status: UserStatus.ACTIVE }),
      ),
    ).toBe(true);
  });

  it('rejects an ACTIVE USER for admin-only routes', () => {
    expect(() =>
      guard.canActivate(
        createContext({ role: Role.USER, status: UserStatus.ACTIVE }),
      ),
    ).toThrow(ForbiddenException);
  });
});

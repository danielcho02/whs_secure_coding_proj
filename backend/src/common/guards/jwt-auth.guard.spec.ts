import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../../config/configuration';
import { JwtAuthGuard } from './jwt-auth.guard';

type RequestLike = {
  headers: {
    authorization?: string;
  };
  user?: unknown;
};

function createContext(request: RequestLike): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function createConfigService(): ConfigService<AppConfig, true> {
  return {
    get: vi.fn((key: 'auth.jwtAccessSecret') => {
      if (key === 'auth.jwtAccessSecret') {
        return 'test-access-secret';
      }
      return undefined;
    }),
  } as unknown as ConfigService<AppConfig, true>;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard(new JwtService(), createConfigService());
  });

  it('rejects requests without a Bearer token', async () => {
    await expect(guard.canActivate(createContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('verifies a Bearer access token and sets request.user', async () => {
    const token = await new JwtService().signAsync(
      { sub: 'user-1', email: 'alice@example.com', role: Role.USER },
      { secret: 'test-access-secret', expiresIn: '15m' },
    );
    const request: RequestLike = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(request.user).toEqual({
      id: 'user-1',
      email: 'alice@example.com',
      role: Role.USER,
    });
  });
});

/* eslint-disable @typescript-eslint/unbound-method */

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../modules/prisma/prisma.service';
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

function createPrismaMock(): PrismaService {
  return {
    user: {
      findUnique: vi.fn(),
    },
  } as unknown as PrismaService;
}

type JwtAuthGuardConstructor = new (
  jwtService: JwtService,
  configService: ConfigService<AppConfig, true>,
  prisma: PrismaService,
) => JwtAuthGuard;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = createPrismaMock();
    guard = new (JwtAuthGuard as unknown as JwtAuthGuardConstructor)(
      new JwtService(),
      createConfigService(),
      prisma,
    );
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
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      role: Role.USER,
      status: UserStatus.ACTIVE,
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(request.user).toEqual({
      id: 'user-1',
      email: 'alice@example.com',
      role: Role.USER,
      status: UserStatus.ACTIVE,
    });
  });

  it('rejects a valid token when the DB user is suspended', async () => {
    const token = await new JwtService().signAsync(
      { sub: 'user-1', email: 'alice@example.com', role: Role.USER },
      { secret: 'test-access-secret', expiresIn: '15m' },
    );
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      role: Role.USER,
      status: UserStatus.SUSPENDED,
    });

    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: `Bearer ${token}` } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses DB role and status instead of JWT payload role', async () => {
    const token = await new JwtService().signAsync(
      { sub: 'user-1', email: 'stale@example.com', role: Role.ADMIN },
      { secret: 'test-access-secret', expiresIn: '15m' },
    );
    const request: RequestLike = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      role: Role.USER,
      status: UserStatus.ACTIVE,
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(request.user).toEqual({
      id: 'user-1',
      email: 'alice@example.com',
      role: Role.USER,
      status: UserStatus.ACTIVE,
    });
  });
});

/* eslint-disable @typescript-eslint/unbound-method */

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuthService } from './auth.service';

const authConfig = {
  'app.nodeEnv': 'test',
  'auth.jwtAccessSecret': 'test-access-secret',
  'auth.jwtAccessExpires': '15m',
  'auth.jwtRefreshSecret': 'test-refresh-secret',
  'auth.jwtRefreshExpires': '7d',
  'auth.loginMaxAttempts': 5,
} as const;

type ConfigKey = keyof typeof authConfig;

function createConfigService(): ConfigService<AppConfig, true> {
  return {
    get: vi.fn((key: ConfigKey) => authConfig[key]),
  } as unknown as ConfigService<AppConfig, true>;
}

function createPrismaMock(): PrismaService {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as PrismaService;
}

function createRedisMock(): RedisService {
  return {
    storeRefreshSession: vi.fn(),
    hasRefreshSession: vi.fn(),
    removeRefreshSession: vi.fn(),
    removeAllRefreshSessions: vi.fn(),
    incrementLoginFailure: vi.fn(),
    clearLoginFailures: vi.fn(),
  } as unknown as RedisService;
}

function createSafeUser(overrides: Partial<AuthSafeUser> = {}): AuthSafeUser {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    nickname: 'alice',
    role: Role.USER,
    status: UserStatus.ACTIVE,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

type AuthSafeUser = {
  id: string;
  email: string;
  nickname: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
};

type LoginUser = AuthSafeUser & {
  passwordHash: string;
  loginFails: number;
  lockedUntil: Date | null;
};

describe('AuthService', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let service: AuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    redis = createRedisMock();
    service = new AuthService(
      prisma,
      redis,
      new JwtService(),
      createConfigService(),
    );
  });

  it('registers a user with a bcrypt hash and safe default role/status', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockResolvedValue(createSafeUser());

    const result = await service.register({
      email: 'Alice@Example.COM',
      password: 'Str0ng!pass',
      nickname: 'alice',
    });

    expect(result).toEqual(createSafeUser());
    expect(result).not.toHaveProperty('passwordHash');
    const createArgs = vi.mocked(prisma.user.create).mock.calls[0]?.[0];
    expect(createArgs?.data.email).toBe('alice@example.com');
    expect(createArgs?.data.role).toBe(Role.USER);
    expect(createArgs?.data.status).toBe(UserStatus.ACTIVE);
    await expect(bcrypt.compare('Str0ng!pass', createArgs?.data.passwordHash ?? '')).resolves.toBe(
      true,
    );
  });

  it('rejects duplicate email registration', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'existing' });

    await expect(
      service.register({
        email: 'alice@example.com',
        password: 'Str0ng!pass',
        nickname: 'alice',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects duplicate nickname registration', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'existing',
    });

    await expect(
      service.register({
        email: 'alice@example.com',
        password: 'Str0ng!pass',
        nickname: 'alice',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with an access token, refresh token, safe user, and refresh whitelist entry', async () => {
    const passwordHash = await bcrypt.hash('Str0ng!pass', 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...createSafeUser(),
      passwordHash,
      loginFails: 0,
      lockedUntil: null,
    } satisfies LoginUser);
    vi.mocked(prisma.user.update).mockResolvedValue(createSafeUser());

    const result = await service.login({
      email: 'alice@example.com',
      password: 'Str0ng!pass',
    });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(redis.clearLoginFailures).toHaveBeenCalledWith('alice@example.com');
    expect(redis.storeRefreshSession).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      expect.any(Number),
    );
  });

  it('fails login with a generic error for a wrong password and increments failure counters', async () => {
    const passwordHash = await bcrypt.hash('Str0ng!pass', 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...createSafeUser(),
      passwordHash,
      loginFails: 0,
      lockedUntil: null,
    } satisfies LoginUser);
    vi.mocked(redis.incrementLoginFailure).mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    await expect(
      service.login({ email: 'alice@example.com', password: 'Wrong!pass1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login({ email: 'alice@example.com', password: 'Wrong!pass1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(redis.incrementLoginFailure).toHaveBeenCalledTimes(2);
  });

  it('locks the account when login failures reach LOGIN_MAX_ATTEMPTS', async () => {
    const passwordHash = await bcrypt.hash('Str0ng!pass', 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...createSafeUser(),
      passwordHash,
      loginFails: 4,
      lockedUntil: null,
    } satisfies LoginUser);
    vi.mocked(redis.incrementLoginFailure).mockResolvedValue(5);

    await expect(
      service.login({ email: 'alice@example.com', password: 'Wrong!pass1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const updateArgs = vi.mocked(prisma.user.update).mock.calls[0]?.[0];
    expect(updateArgs?.where).toEqual({ id: 'user-1' });
    expect(updateArgs?.data.loginFails).toBe(5);
    expect(updateArgs?.data.lockedUntil).toBeInstanceOf(Date);
  });

  it('rejects login while the account is locked', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...createSafeUser(),
      passwordHash: await bcrypt.hash('Str0ng!pass', 10),
      loginFails: 5,
      lockedUntil: new Date(Date.now() + 60_000),
    } satisfies LoginUser);

    await expect(
      service.login({ email: 'alice@example.com', password: 'Str0ng!pass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(redis.incrementLoginFailure).not.toHaveBeenCalled();
  });

  it('refreshes tokens only when the refresh jti is whitelisted and rotates the jti', async () => {
    const passwordHash = await bcrypt.hash('Str0ng!pass', 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      ...createSafeUser(),
      passwordHash,
      loginFails: 0,
      lockedUntil: null,
    } satisfies LoginUser);
    vi.mocked(prisma.user.update).mockResolvedValue(createSafeUser());
    const loginResult = await service.login({
      email: 'alice@example.com',
      password: 'Str0ng!pass',
    });

    vi.mocked(redis.hasRefreshSession).mockResolvedValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(createSafeUser());

    const refreshResult = await service.refresh(loginResult.refreshToken);

    expect(refreshResult.accessToken).toEqual(expect.any(String));
    expect(refreshResult.refreshToken).not.toBe(loginResult.refreshToken);
    expect(redis.removeRefreshSession).toHaveBeenCalledWith('user-1', expect.any(String));
    expect(redis.storeRefreshSession).toHaveBeenCalledTimes(2);
  });

  it('rejects reused refresh tokens and invalidates all refresh sessions for that user', async () => {
    const refreshToken = await new JwtService().signAsync(
      { sub: 'user-1', jti: 'old-jti' },
      { secret: 'test-refresh-secret', expiresIn: '7d' },
    );
    vi.mocked(redis.hasRefreshSession).mockResolvedValue(false);

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(redis.removeAllRefreshSessions).toHaveBeenCalledWith('user-1');
  });

  it('removes the refresh session on logout so the token cannot be refreshed again', async () => {
    const refreshToken = await new JwtService().signAsync(
      { sub: 'user-1', jti: 'logout-jti' },
      { secret: 'test-refresh-secret', expiresIn: '7d' },
    );

    await service.logout(refreshToken);
    vi.mocked(redis.hasRefreshSession).mockResolvedValue(false);

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(redis.removeRefreshSession).toHaveBeenCalledWith('user-1', 'logout-jti');
  });
});

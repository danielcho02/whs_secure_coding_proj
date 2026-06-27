/* eslint-disable @typescript-eslint/unbound-method */

import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../../config/configuration';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { REFRESH_COOKIE_NAME } from './constants/auth.constants';

const configValues = {
  'app.nodeEnv': 'test',
} as const;

function createConfigService(): ConfigService<AppConfig, true> {
  return {
    get: vi.fn((key: keyof typeof configValues) => configValues[key]),
  } as unknown as ConfigService<AppConfig, true>;
}

function createAuthServiceMock(): AuthService {
  return {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    clearRefreshCookieOptions: vi.fn(),
    refreshCookieOptions: vi.fn(),
  } as unknown as AuthService;
}

function createReplyMock(): CookieReply {
  return {
    setCookie: vi.fn(),
    clearCookie: vi.fn(),
  };
}

type CookieReply = {
  setCookie: ReturnType<typeof vi.fn>;
  clearCookie: ReturnType<typeof vi.fn>;
};

describe('AuthController', () => {
  let authService: AuthService;
  let controller: AuthController;

  beforeEach(() => {
    authService = createAuthServiceMock();
    controller = new AuthController(authService, createConfigService());
  });

  it('sets an httpOnly strict refresh cookie on login and returns only accessToken plus safe user', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshExpiresInSeconds: 604_800,
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        nickname: 'alice',
        role: Role.USER,
        status: UserStatus.ACTIVE,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    const reply = createReplyMock();

    const result = await controller.login(
      { email: 'alice@example.com', password: 'Str0ng!pass' },
      reply,
    );

    expect(reply.setCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'refresh-token',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: 604_800,
      }),
    );
    expect(result.accessToken).toBe('access-token');
    expect(result.user.id).toBe('user-1');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('rotates the refresh cookie on refresh', async () => {
    vi.mocked(authService.refresh).mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      refreshExpiresInSeconds: 604_800,
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        nickname: 'alice',
        role: Role.USER,
        status: UserStatus.ACTIVE,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    const reply = createReplyMock();

    const result = await controller.refresh(
      { cookies: { [REFRESH_COOKIE_NAME]: 'old-refresh-token' } },
      reply,
    );

    expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
    expect(reply.setCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'new-refresh-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
    expect(result.accessToken).toBe('new-access-token');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('clears the refresh cookie on logout', async () => {
    const reply = createReplyMock();

    await expect(
      controller.logout({ cookies: { [REFRESH_COOKIE_NAME]: 'refresh-token' } }, reply),
    ).resolves.toEqual({ loggedOut: true });

    expect(authService.logout).toHaveBeenCalledWith('refresh-token');
    expect(reply.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({ path: '/api/auth' }),
    );
  });
});

/* eslint-disable @typescript-eslint/unbound-method */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

function createPrismaMock(): PrismaService {
  return {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as PrismaService;
}

const baseUser = {
  id: 'user-1',
  email: 'alice@example.com',
  nickname: 'alice',
  bio: 'hello',
  avatarUrl: 'https://example.com/a.png',
  phone: '010-0000-0000',
  role: Role.USER,
  status: UserStatus.ACTIVE,
  trustScore: 10,
  completedTx: 3,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const selfUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'alice@example.com',
  role: Role.USER,
  status: UserStatus.ACTIVE,
};

describe('UsersService', () => {
  let prisma: PrismaService;
  let service: UsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UsersService(prisma);
  });

  it('returns the authenticated user profile without passwordHash', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser);

    const result = await service.getMe('user-1');

    expect(result).toEqual(baseUser);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('updates only allowed profile fields for the authenticated user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser);
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...baseUser,
      nickname: 'alice2',
      bio: 'updated',
    });

    const result = await service.updateMe('user-1', {
      nickname: 'alice2',
      bio: 'updated',
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
      where: { id: 'user-1' },
      data: { nickname: 'alice2', bio: 'updated' },
      }),
    );
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('loginFails');
  });

  it('returns only public profile fields from getPublicProfile', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: baseUser.id,
      nickname: baseUser.nickname,
      bio: baseUser.bio,
      avatarUrl: baseUser.avatarUrl,
      trustScore: baseUser.trustScore,
      completedTx: baseUser.completedTx,
      createdAt: baseUser.createdAt,
      status: baseUser.status,
    });

    const result = await service.getPublicProfile('user-1');

    expect(result).toEqual({
      id: 'user-1',
      nickname: 'alice',
      bio: 'hello',
      avatarUrl: 'https://example.com/a.png',
      trustScore: 10,
      completedTx: 3,
      createdAt: baseUser.createdAt,
    });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('phone');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('allows the user to read their own private profile', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser);

    await expect(service.getPrivateProfile('user-1', selfUser)).resolves.toEqual(baseUser);
  });

  it('blocks other users from private profile access', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser);

    await expect(
      service.getPrivateProfile('user-1', {
        id: 'user-2',
        email: 'bob@example.com',
        role: Role.USER,
        status: UserStatus.ACTIVE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows ADMIN role to read private profile data', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser);

    await expect(
      service.getPrivateProfile('user-1', {
        id: 'admin-1',
        email: 'admin@example.com',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      }),
    ).resolves.toEqual(baseUser);
  });

  it('does not expose withdrawn users as public profiles', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: baseUser.id,
      nickname: baseUser.nickname,
      bio: baseUser.bio,
      avatarUrl: baseUser.avatarUrl,
      trustScore: baseUser.trustScore,
      completedTx: baseUser.completedTx,
      createdAt: baseUser.createdAt,
      status: UserStatus.WITHDRAWN,
    });

    await expect(service.getPublicProfile('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

/* eslint-disable @typescript-eslint/unbound-method */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { BlocksService } from './blocks.service';

function createPrismaMock(): PrismaService {
  return {
    block: {
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  } as unknown as PrismaService;
}

const blockerId = '11111111-1111-4111-8111-111111111111';
const blockedId = '22222222-2222-4222-8222-222222222222';
const blockRecord = {
  id: '33333333-3333-4333-8333-333333333333',
  blockerId,
  blockedId,
  blocked: {
    id: blockedId,
    nickname: 'blocked-user',
    avatarUrl: null,
    trustScore: 0,
    completedTx: 0,
  },
};

describe('BlocksService', () => {
  let prisma: PrismaService;
  let service: BlocksService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
    service = new BlocksService(prisma);
  });

  it('creates a block using the authenticated blocker id', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: blockedId,
      status: UserStatus.ACTIVE,
    });
    vi.mocked(prisma.block.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.block.create).mockResolvedValue(blockRecord);

    const result = await service.createBlock(blockerId, {
      blockedUserId: blockedId,
    });

    expect(prisma.block.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { blockerId, blockedId },
      }),
    );
    expect(result.blockerId).toBe(blockerId);
    expect(result.blockedId).toBe(blockedId);
  });

  it('rejects blocking yourself', async () => {
    await expect(
      service.createBlock(blockerId, { blockedUserId: blockerId }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects blocking a missing user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(
      service.createBlock(blockerId, { blockedUserId: blockedId }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the existing block idempotently', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: blockedId,
      status: UserStatus.ACTIVE,
    });
    vi.mocked(prisma.block.findUnique).mockResolvedValue(blockRecord);

    const result = await service.createBlock(blockerId, {
      blockedUserId: blockedId,
    });

    expect(prisma.block.create).not.toHaveBeenCalled();
    expect(result.id).toBe(blockRecord.id);
  });

  it('deletes only the authenticated user block relationship', async () => {
    vi.mocked(prisma.block.findUnique).mockResolvedValue(blockRecord);
    vi.mocked(prisma.block.delete).mockResolvedValue(blockRecord);

    const result = await service.deleteBlock(blockerId, blockedId);

    expect(prisma.block.delete).toHaveBeenCalledWith({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
      select: { id: true },
    });
    expect(result).toEqual({ deleted: true });
  });

  it('lists only blocks created by the authenticated user', async () => {
    vi.mocked(prisma.block.findMany).mockResolvedValue([blockRecord]);
    vi.mocked(prisma.block.count).mockResolvedValue(1);

    const result = await service.listBlocks(blockerId, { page: 1, limit: 20 });

    expect(prisma.block.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { blockerId } }),
    );
    expect(result.items).toHaveLength(1);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});

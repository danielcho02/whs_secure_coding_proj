import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CreateBlockDto } from './create-block.dto';
import { ListBlocksDto } from './list-blocks.dto';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function validateDto<T extends object>(
  metatype: new () => T,
  value: Record<string, unknown>,
  type: 'body' | 'query' = 'body',
): Promise<T> {
  return validationPipe.transform(value, {
    type,
    metatype,
  }) as Promise<T>;
}

describe('Blocks DTO validation', () => {
  it('accepts a valid block payload', async () => {
    await expect(
      validateDto(CreateBlockDto, {
        blockedUserId: '11111111-1111-4111-8111-111111111111',
      }),
    ).resolves.toBeInstanceOf(CreateBlockDto);
  });

  it('rejects blockerId/status/role injection', async () => {
    await expect(
      validateDto(CreateBlockDto, {
        blockedUserId: '11111111-1111-4111-8111-111111111111',
        blockerId: 'attacker',
        status: 'ACTIVE',
        role: 'ADMIN',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces pagination limit for blocks', async () => {
    await expect(
      validateDto(ListBlocksDto, { page: '1', limit: '101' }, 'query'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ListNotificationsDto } from './list-notifications.dto';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function validateDto<T extends object>(
  metatype: new () => T,
  value: Record<string, unknown>,
): Promise<T> {
  return validationPipe.transform(value, {
    type: 'query',
    metatype,
  }) as Promise<T>;
}

describe('Notifications DTO validation', () => {
  it('accepts pagination and unreadOnly filters', async () => {
    const result = await validateDto(ListNotificationsDto, {
      page: '2',
      limit: '50',
      unreadOnly: 'true',
    });

    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
    expect(result.unreadOnly).toBe(true);
  });

  it('rejects over-limit pagination', async () => {
    await expect(
      validateDto(ListNotificationsDto, { limit: '101' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects userId injection', async () => {
    await expect(
      validateDto(ListNotificationsDto, { userId: 'attacker' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

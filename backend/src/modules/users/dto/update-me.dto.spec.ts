import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { UpdateMeDto } from './update-me.dto';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

describe('UpdateMeDto', () => {
  it('accepts only editable profile fields', async () => {
    await expect(
      validationPipe.transform(
        {
          nickname: 'alice2',
          bio: 'updated',
          avatarUrl: 'https://example.com/avatar.png',
        },
        { type: 'body', metatype: UpdateMeDto },
      ),
    ).resolves.toBeInstanceOf(UpdateMeDto);
  });

  it('rejects role/status/passwordHash and other protected field injection', async () => {
    await expect(
      validationPipe.transform(
        {
          nickname: 'alice2',
          role: 'ADMIN',
          status: 'BANNED',
          trustScore: 999,
          completedTx: 999,
          passwordHash: 'hash',
          loginFails: 0,
          lockedUntil: null,
        },
        { type: 'body', metatype: UpdateMeDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

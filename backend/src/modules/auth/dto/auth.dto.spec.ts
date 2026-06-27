import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

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
    type: 'body',
    metatype,
  }) as Promise<T>;
}

describe('Auth DTO validation', () => {
  it('accepts a valid register request', async () => {
    await expect(
      validateDto(RegisterDto, {
        email: 'alice@example.com',
        password: 'Str0ng!pass',
        nickname: 'alice',
      }),
    ).resolves.toBeInstanceOf(RegisterDto);
  });

  it('rejects role/status/userId injection on register instead of trusting client authority fields', async () => {
    await expect(
      validateDto(RegisterDto, {
        email: 'alice@example.com',
        password: 'Str0ng!pass',
        nickname: 'alice',
        role: 'ADMIN',
        status: 'BANNED',
        userId: 'attacker',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects weak passwords', async () => {
    await expect(
      validateDto(RegisterDto, {
        email: 'alice@example.com',
        password: 'password',
        nickname: 'alice',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates login requests without accepting extra fields', async () => {
    await expect(
      validateDto(LoginDto, {
        email: 'alice@example.com',
        password: 'Str0ng!pass',
        role: 'ADMIN',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

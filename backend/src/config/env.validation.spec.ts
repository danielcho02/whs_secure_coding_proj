import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation';

const baseEnv = {
  PORT: '3000',
  DATABASE_URL: 'postgresql://market_user:market_password@localhost:5432/market',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_ACCESS_EXPIRES: '15m',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_REFRESH_EXPIRES: '7d',
  CORS_ORIGIN: 'http://localhost:5173',
  UPLOAD_DIR: '/secure/uploads',
  MAX_UPLOAD_SIZE: '5242880',
  PG_WEBHOOK_SECRET: 'test-webhook-secret',
  TOSS_CLIENT_KEY: 'test_ck_development',
  TOSS_SECRET_KEY: 'test_sk_development',
  TOSS_WEBHOOK_SECRET: 'test-webhook-secret',
  PAYMENT_SUCCESS_URL: 'http://localhost:5173/payments/success',
  PAYMENT_FAIL_URL: 'http://localhost:5173/payments/fail',
  PAYMENT_CANCEL_URL: 'http://localhost:5173/payments/cancel',
  LOGIN_MAX_ATTEMPTS: '5',
  RATE_LIMIT_WINDOW: '60',
  RATE_LIMIT_MAX: '100',
};

describe('environment validation', () => {
  it('rejects mock payments in production', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        PAYMENT_PROVIDER_MODE: 'mock',
      }),
    ).toThrow('PAYMENT_PROVIDER_MODE');
  });

  it('allows toss payments in production', () => {
    const env = validateEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      PAYMENT_PROVIDER_MODE: 'toss',
    });

    expect(env.PAYMENT_PROVIDER_MODE).toBe('toss');
  });

  it('allows mock payments outside production', () => {
    const env = validateEnv({
      ...baseEnv,
      NODE_ENV: 'development',
      PAYMENT_PROVIDER_MODE: 'mock',
    });

    expect(env.PAYMENT_PROVIDER_MODE).toBe('mock');
  });
});

import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from './app.module';

describe('AppModule', () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...env,
      NODE_ENV: 'test',
      PORT: '3000',
      DATABASE_URL: 'postgresql://market_user:market_password@localhost:5432/market',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_ACCESS_EXPIRES: '15m',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_REFRESH_EXPIRES: '7d',
      CORS_ORIGIN: 'http://localhost:5173',
      UPLOAD_DIR: '/var/app/uploads',
      MAX_UPLOAD_SIZE: '5242880',
      PG_WEBHOOK_SECRET: 'test-webhook-secret',
      LOGIN_MAX_ATTEMPTS: '5',
      RATE_LIMIT_WINDOW: '60',
      RATE_LIMIT_MAX: '100',
    };
  });

  afterEach(() => {
    process.env = env;
  });

  it('compiles the application module', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
  });
});

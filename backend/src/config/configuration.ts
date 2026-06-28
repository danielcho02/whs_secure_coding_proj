export interface AppConfig {
  app: {
    nodeEnv: string;
    port: number;
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  auth: {
    jwtAccessSecret: string;
    jwtAccessExpires: string;
    jwtRefreshSecret: string;
    jwtRefreshExpires: string;
    loginMaxAttempts: number;
  };
  security: {
    corsOrigin: string;
    uploadDir: string;
    maxUploadSize: number;
    pgWebhookSecret: string;
    rateLimitWindow: number;
    rateLimitMax: number;
  };
  payments: {
    tossClientKey: string;
    tossSecretKey: string;
    webhookSecret: string;
    successUrl: string;
    failUrl: string;
    cancelUrl: string;
  };
}

export default (): AppConfig => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  redis: {
    url: process.env.REDIS_URL ?? '',
  },
  auth: {
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
    loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5),
  },
  security: {
    corsOrigin:
      process.env.CORS_ORIGIN ??
      process.env.FRONTEND_ORIGIN ??
      'http://localhost:5173',
    uploadDir: process.env.UPLOAD_DIR ?? '/var/app/uploads',
    maxUploadSize: Number(process.env.MAX_UPLOAD_SIZE ?? 5_242_880),
    pgWebhookSecret: process.env.PG_WEBHOOK_SECRET ?? '',
    rateLimitWindow: Number(process.env.RATE_LIMIT_WINDOW ?? 60),
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
  },
  payments: {
    tossClientKey: process.env.TOSS_CLIENT_KEY ?? 'test_ck_development',
    tossSecretKey: process.env.TOSS_SECRET_KEY ?? 'test_sk_development',
    webhookSecret:
      process.env.TOSS_WEBHOOK_SECRET ?? process.env.PG_WEBHOOK_SECRET ?? '',
    successUrl:
      process.env.PAYMENT_SUCCESS_URL ??
      'http://localhost:5173/payments/success',
    failUrl:
      process.env.PAYMENT_FAIL_URL ?? 'http://localhost:5173/payments/fail',
    cancelUrl:
      process.env.PAYMENT_CANCEL_URL ??
      'http://localhost:5173/payments/cancel',
  },
});

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
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    uploadDir: process.env.UPLOAD_DIR ?? '/var/app/uploads',
    maxUploadSize: Number(process.env.MAX_UPLOAD_SIZE ?? 5_242_880),
    pgWebhookSecret: process.env.PG_WEBHOOK_SECRET ?? '',
    rateLimitWindow: Number(process.env.RATE_LIMIT_WINDOW ?? 60),
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
  },
});

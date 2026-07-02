import { constants, accessSync } from 'fs';
import path from 'path';

const DEFAULT_UPLOAD_DIR = '/var/app/uploads';

interface UploadDirEnv {
  NODE_ENV?: string;
  UPLOAD_DIR?: string;
}

interface UploadDirDeps {
  cwd: string;
  canWrite: (targetPath: string) => boolean;
}

const defaultUploadDirDeps: UploadDirDeps = {
  cwd: process.cwd(),
  canWrite: (targetPath: string) => {
    try {
      accessSync(targetPath, constants.W_OK);
      return true;
    } catch {
      return false;
    }
  },
};

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
    providerMode: 'mock' | 'toss';
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
    uploadDir: resolveUploadDir(),
    maxUploadSize: Number(process.env.MAX_UPLOAD_SIZE ?? 5_242_880),
    pgWebhookSecret: process.env.PG_WEBHOOK_SECRET ?? '',
    rateLimitWindow: Number(process.env.RATE_LIMIT_WINDOW ?? 60),
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
  },
  payments: {
    providerMode:
      process.env.PAYMENT_PROVIDER_MODE === 'toss' ||
      process.env.PAYMENT_PROVIDER_MODE === 'mock'
        ? process.env.PAYMENT_PROVIDER_MODE
        : process.env.NODE_ENV === 'production'
          ? 'toss'
          : 'mock',
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
      process.env.PAYMENT_CANCEL_URL ?? 'http://localhost:5173/payments/cancel',
  },
});

export function resolveUploadDir(
  env: UploadDirEnv = process.env,
  deps: UploadDirDeps = defaultUploadDirDeps,
): string {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const rawUploadDir = env.UPLOAD_DIR?.trim() ?? '';
  const hasExplicitUploadDir = rawUploadDir.length > 0;

  if (nodeEnv === 'production') {
    if (!hasExplicitUploadDir) {
      throw new Error('UPLOAD_DIR is required in production');
    }

    const productionUploadDir = toAbsolutePath(rawUploadDir, deps.cwd);

    if (
      !deps.canWrite(productionUploadDir) &&
      !deps.canWrite(path.dirname(productionUploadDir))
    ) {
      throw new Error('UPLOAD_DIR is not writable');
    }

    return productionUploadDir;
  }

  const configuredUploadDir = hasExplicitUploadDir
    ? toAbsolutePath(rawUploadDir, deps.cwd)
    : DEFAULT_UPLOAD_DIR;

  if (hasExplicitUploadDir) {
    return configuredUploadDir;
  }

  if (
    deps.canWrite(DEFAULT_UPLOAD_DIR) ||
    deps.canWrite(path.dirname(DEFAULT_UPLOAD_DIR))
  ) {
    return DEFAULT_UPLOAD_DIR;
  }

  const fallbackDir = path.join(deps.cwd, 'uploads');
  console.warn('dev/test upload dir fallback');
  return fallbackDir;
}

function toAbsolutePath(targetPath: string, cwd: string): string {
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(cwd, targetPath);
}

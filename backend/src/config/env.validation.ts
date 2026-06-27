import * as Joi from 'joi';

interface EnvVars {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_EXPIRES: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES: string;
  CORS_ORIGIN: string;
  UPLOAD_DIR: string;
  MAX_UPLOAD_SIZE: number;
  PG_WEBHOOK_SECRET: string;
  LOGIN_MAX_ATTEMPTS: number;
  RATE_LIMIT_WINDOW: number;
  RATE_LIMIT_MAX: number;
}

const schema = Joi.object<EnvVars>({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql'] }).required(),
  REDIS_URL: Joi.string().uri({ scheme: ['redis'] }).required(),
  JWT_ACCESS_SECRET: Joi.string().min(8).required(),
  JWT_ACCESS_EXPIRES: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().min(8).required(),
  JWT_REFRESH_EXPIRES: Joi.string().required(),
  CORS_ORIGIN: Joi.string().uri().required(),
  UPLOAD_DIR: Joi.string().required(),
  MAX_UPLOAD_SIZE: Joi.number().integer().positive().required(),
  PG_WEBHOOK_SECRET: Joi.string().min(8).required(),
  LOGIN_MAX_ATTEMPTS: Joi.number().integer().positive().required(),
  RATE_LIMIT_WINDOW: Joi.number().integer().positive().required(),
  RATE_LIMIT_MAX: Joi.number().integer().positive().required(),
});

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const validationResult: Joi.ValidationResult<EnvVars> = schema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
  });

  if (validationResult.error) {
    throw new Error(`Environment validation failed: ${validationResult.error.message}`);
  }

  return validationResult.value;
}

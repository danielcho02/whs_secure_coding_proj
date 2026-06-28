import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseFormatInterceptor } from './common/interceptors/response-format.interceptor';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const configService = app.get(ConfigService<AppConfig, true>);
  const appConfig = configService.get('app', { infer: true });
  const corsOrigin = configService.get('security.corsOrigin', { infer: true });
  const maxUploadSize = configService.get('security.maxUploadSize', {
    infer: true,
  });

  app.setGlobalPrefix('api');
  await app.register(helmet);
  await app.register(cookie);
  await app.register(multipart, {
    limits: {
      fileSize: maxUploadSize,
      files: 10,
      fields: 0,
    },
  });
  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseFormatInterceptor());

  await app.listen(appConfig.port);
}

void bootstrap();

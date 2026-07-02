import helmet from '@fastify/helmet';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerUploadRoutes } from './upload-routes';

const imageFilename = '11111111-1111-4111-8111-111111111111.jpg';
const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]);

describe('upload file routes', () => {
  let app: NestFastifyApplication;
  let uploadDir: string;

  beforeEach(async () => {
    uploadDir = await mkdtemp(path.join(tmpdir(), 'secure-market-static-'));
    await mkdir(path.join(uploadDir, 'products'), { recursive: true });
    await writeFile(path.join(uploadDir, 'products', imageFilename), jpegBuffer);

    const moduleRef = await Test.createTestingModule({}).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.register(helmet);
    registerUploadRoutes(app, uploadDir);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(uploadDir, { force: true, recursive: true });
  });

  it('serves uploaded product images across frontend and API origins', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/uploads/products/${imageFilename}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/jpeg');
    expect(response.headers['cross-origin-resource-policy']).toBe(
      'cross-origin',
    );
    expect(response.rawPayload).toEqual(jpegBuffer);
  });

  it('does not expose arbitrary upload paths', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/uploads/products/not-safe.jpg',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'File not found',
      },
    });
  });
});

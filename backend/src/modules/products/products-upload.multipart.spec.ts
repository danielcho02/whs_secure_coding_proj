import { BadRequestException, CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { ProductStatus, Role, UserStatus } from '@prisma/client';
import { mkdtemp, readdir, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

interface RequestWithUser {
  user?: {
    id: string;
    email: string;
    role: Role;
    status: UserStatus;
  };
}

type ProductImageCreateArgs = {
  data: {
    productId: string;
    url: string;
    order: number;
  };
};

const productId = '11111111-1111-4111-8111-111111111111';
const sellerId = '22222222-2222-4222-8222-222222222222';
const otherUserId = '33333333-3333-4333-8333-333333333333';

const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]);
const textBuffer = Buffer.from('not an image');
const svgBuffer = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);
const phpBuffer = Buffer.from('<?php echo "owned"; ?>');
const jspBuffer = Buffer.from('<% Runtime.getRuntime().exec("id"); %>');
const htmlBuffer = Buffer.from('<html><script>alert(1)</script></html>');

describe('Products image upload multipart security', () => {
  let app: NestFastifyApplication;
  let moduleRef: TestingModule;
  let uploadDir: string;
  let prisma: ReturnType<typeof createPrismaMock>;
  let currentUserId: string;

  beforeEach(async () => {
    uploadDir = await mkdtemp(path.join(tmpdir(), 'secure-market-upload-'));
    prisma = createPrismaMock();
    currentUserId = sellerId;

    moduleRef = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: ConfigService,
          useValue: createConfigMock(uploadDir),
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(createAuthGuard(() => currentUserId))
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix('api');
    await app.register(multipart, {
      limits: {
        fileSize: 1024 * 1024,
        files: 10,
        fields: 0,
      },
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
    await moduleRef.close();
    await rm(uploadDir, { force: true, recursive: true });
    vi.restoreAllMocks();
  });

  it('uploads a valid PNG using a UUID file name instead of the original name', async () => {
    const response = await uploadFile({
      buffer: pngBuffer,
      filename: 'original.png',
      mimeType: 'image/png',
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<Array<{ url: string; order: number }>>();
    expect(body[0]?.url).toMatch(
      /^\/uploads\/products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    );
    expect(body[0]?.url).not.toContain('original');
    expect(prisma.productImage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId,
          url: body[0]?.url,
          order: 0,
        }) as ProductImageCreateArgs['data'],
      }),
    );

    const writtenFiles = await readdir(path.join(uploadDir, 'products'));
    expect(writtenFiles).toHaveLength(1);
    expect(writtenFiles[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    );
    await expect(
      readFile(path.join(uploadDir, 'products', writtenFiles[0])),
    ).resolves.toEqual(pngBuffer);
  });

  it('rejects SVG uploads before persisting files or image records', async () => {
    const response = await uploadFile({
      buffer: svgBuffer,
      filename: 'xss.svg',
      mimeType: 'image/svg+xml',
    });

    expect(response.statusCode).toBe(400);
    expect(prisma.productImage.create).not.toHaveBeenCalled();
    await expect(readdir(path.join(uploadDir, 'products'))).rejects.toThrow();
  });

  it.each([
    ['PHP', 'shell.php', 'application/x-php', phpBuffer],
    ['JSP', 'shell.jsp', 'application/octet-stream', jspBuffer],
    ['HTML', 'x.html', 'text/html', htmlBuffer],
  ])(
    'rejects %s uploads by extension or MIME type',
    async (_label, filename, mimeType, buffer) => {
      const response = await uploadFile({ buffer, filename, mimeType });

      expect(response.statusCode).toBe(400);
      expect(prisma.productImage.create).not.toHaveBeenCalled();
      await expect(readdir(path.join(uploadDir, 'products'))).rejects.toThrow();
    },
  );

  it('rejects double-extension executable image disguises', async () => {
    const response = await uploadFile({
      buffer: jpegBuffer,
      filename: 'shell.php.jpg',
      mimeType: 'image/jpeg',
    });

    expect(response.statusCode).toBe(400);
    expect(prisma.productImage.create).not.toHaveBeenCalled();
    await expect(readdir(path.join(uploadDir, 'products'))).rejects.toThrow();
  });

  it.each([
    ['fake image extension with plain text content', 'fake.png', 'image/png', textBuffer],
    ['fake image MIME with mismatched extension', 'fake.jpg', 'text/plain', jpegBuffer],
  ])('rejects %s', async (_label, filename, mimeType, buffer) => {
    const response = await uploadFile({ buffer, filename, mimeType });

    expect(response.statusCode).toBe(400);
    expect(prisma.productImage.create).not.toHaveBeenCalled();
    await expect(readdir(path.join(uploadDir, 'products'))).rejects.toThrow();
  });

  it('rejects image uploads from users who do not own the product', async () => {
    currentUserId = otherUserId;

    const response = await uploadFile({
      buffer: pngBuffer,
      filename: 'original.png',
      mimeType: 'image/png',
    });

    expect(response.statusCode).toBe(403);
    expect(prisma.productImage.create).not.toHaveBeenCalled();
    await expect(readdir(path.join(uploadDir, 'products'))).rejects.toThrow();
  });

  async function uploadFile(input: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }) {
    const boundary = `----secure-market-${Math.random().toString(16).slice(2)}`;
    const payload = buildMultipartPayload(boundary, input);

    return app.inject({
      method: 'POST',
      url: `/api/products/${productId}/images`,
      headers: {
        authorization: 'Bearer test-token',
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': payload.length,
      },
      payload,
    });
  }
});

function createPrismaMock() {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({ status: UserStatus.ACTIVE }),
    },
    product: {
      findUnique: vi.fn().mockResolvedValue({
        id: productId,
        sellerId,
        isHidden: false,
        status: ProductStatus.ON_SALE,
      }),
    },
    productImage: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn((args: ProductImageCreateArgs) =>
        Promise.resolve({
          id: 'image-1',
          url: args.data.url,
          order: args.data.order,
        }),
      ),
    },
  };
}

function createConfigMock(uploadDir: string): Partial<ConfigService> {
  return {
    get: vi.fn((key: string) => {
      if (key === 'security.uploadDir') {
        return uploadDir;
      }

      if (key === 'security.maxUploadSize') {
        return 1024 * 1024;
      }

      throw new BadRequestException(`Unexpected config key: ${key}`);
    }),
  };
}

function createAuthGuard(getUserId: () => string): CanActivate {
  return {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest<RequestWithUser>();
      request.user = {
        id: getUserId(),
        email: `${getUserId()}@example.com`,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      };
      return true;
    },
  };
}

function buildMultipartPayload(
  boundary: string,
  input: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  },
): Buffer {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(
      `Content-Disposition: form-data; name="images"; filename="${input.filename}"\r\n`,
    ),
    Buffer.from(`Content-Type: ${input.mimeType}\r\n\r\n`),
    input.buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { FastifyReply, FastifyRequest } from 'fastify';
import path from 'path';

export function registerUploadRoutes(
  app: NestFastifyApplication,
  uploadDir: string,
): void {
  const fastify = app.getHttpAdapter().getInstance();
  const uploadRoot = path.resolve(uploadDir);

  fastify.get(
    '/uploads/products/:filename',
    async (
      request: FastifyRequest<{ Params: { filename: string } }>,
      reply: FastifyReply,
    ) => {
      const { filename } = request.params;

      if (!isSafeProductImageFilename(filename)) {
        return sendUploadNotFound(reply);
      }

      const absolutePath = path.join(uploadRoot, 'products', filename);

      try {
        const fileStat = await stat(absolutePath);

        if (!fileStat.isFile()) {
          return sendUploadNotFound(reply);
        }
      } catch {
        return sendUploadNotFound(reply);
      }

      return reply
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .type(toImageContentType(filename))
        .send(createReadStream(absolutePath));
    },
  );
}

function sendUploadNotFound(reply: FastifyReply): FastifyReply {
  return reply.code(404).send({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'File not found',
    },
  });
}

function isSafeProductImageFilename(filename: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(
    filename,
  );
}

function toImageContentType(filename: string): string {
  if (filename.endsWith('.png')) {
    return 'image/png';
  }

  if (filename.endsWith('.webp')) {
    return 'image/webp';
  }

  return 'image/jpeg';
}

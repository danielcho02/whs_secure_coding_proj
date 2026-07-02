import { describe, expect, it, vi } from 'vitest';
import { resolveUploadDir } from './configuration';

const defaultUploadDir = '/var/app/uploads';

describe('configuration upload directory resolution', () => {
  it('falls back in development when the default upload dir is not writable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = resolveUploadDir(
      {
        NODE_ENV: 'development',
      },
      {
        cwd: '/repo/backend',
        canWrite: (path) => path !== defaultUploadDir && path !== '/var/app',
      },
    );

    expect(result).toBe('/repo/backend/uploads');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('dev/test upload dir fallback'),
    );

    warn.mockRestore();
  });

  it('keeps an explicitly configured writable upload dir', () => {
    const result = resolveUploadDir(
      {
        NODE_ENV: 'development',
        UPLOAD_DIR: '/tmp/custom-uploads',
      },
      {
        cwd: '/repo/backend',
        canWrite: () => true,
      },
    );

    expect(result).toBe('/tmp/custom-uploads');
  });

  it('does not override an explicitly configured default upload dir', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = resolveUploadDir(
      {
        NODE_ENV: 'development',
        UPLOAD_DIR: defaultUploadDir,
      },
      {
        cwd: '/repo/backend',
        canWrite: () => false,
      },
    );

    expect(result).toBe(defaultUploadDir);
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it('does not fall back in production', () => {
    expect(() =>
      resolveUploadDir(
        {
          NODE_ENV: 'production',
        },
        {
          cwd: '/repo/backend',
          canWrite: () => false,
        },
      ),
    ).toThrow('UPLOAD_DIR is required in production');
  });

  it('fails production startup when the configured upload dir is not writable', () => {
    expect(() =>
      resolveUploadDir(
        {
          NODE_ENV: 'production',
          UPLOAD_DIR: '/secure/uploads',
        },
        {
          cwd: '/repo/backend',
          canWrite: () => false,
        },
      ),
    ).toThrow('UPLOAD_DIR is not writable');
  });
});

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminLogsController } from './admin-logs.controller';
import { AdminProductsController } from './admin-products.controller';
import { AdminReportsController } from './admin-reports.controller';
import { AdminUsersController } from './admin-users.controller';

function getClassGuards(
  controller: new (...args: never[]) => unknown,
): unknown[] {
  return (
    (Reflect.getMetadata(GUARDS_METADATA, controller) as
      | unknown[]
      | undefined) ?? []
  );
}

function getClassRoles(
  controller: new (...args: never[]) => unknown,
): unknown[] {
  return (
    (Reflect.getMetadata(ROLES_KEY, controller) as unknown[] | undefined) ?? []
  );
}

describe('Admin controllers guards', () => {
  const controllers = [
    AdminReportsController,
    AdminProductsController,
    AdminUsersController,
    AdminLogsController,
  ];

  it('protects every admin controller with JwtAuthGuard and RolesGuard', () => {
    for (const controller of controllers) {
      expect(getClassGuards(controller)).toEqual(
        expect.arrayContaining([JwtAuthGuard, RolesGuard]),
      );
    }
  });

  it('requires ADMIN role for every admin controller', () => {
    for (const controller of controllers) {
      expect(getClassRoles(controller)).toContain(Role.ADMIN);
    }
  });
});

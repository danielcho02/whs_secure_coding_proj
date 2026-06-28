import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, UserStatus } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface RequestWithUser {
  user?: {
    role?: Role;
    status?: UserStatus;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userStatus = request.user?.status;

    if (userStatus !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Active user status is required');
    }

    const userRole = request.user?.role;

    if (userRole && requiredRoles.includes(userRole)) {
      return true;
    }

    throw new ForbiddenException('Required role is missing');
  }
}

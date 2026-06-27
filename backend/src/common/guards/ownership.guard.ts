import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class OwnershipGuard implements CanActivate {
  canActivate(): boolean {
    throw new ForbiddenException('Resource ownership must be verified');
  }
}

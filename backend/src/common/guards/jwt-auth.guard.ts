import { CanActivate, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(): boolean {
    throw new UnauthorizedException('Authentication is required');
  }
}

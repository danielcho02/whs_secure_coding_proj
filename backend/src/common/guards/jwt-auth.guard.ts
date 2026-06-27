import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { AppConfig } from '../../config/configuration';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

interface RequestWithUser {
  headers: {
    authorization?: string | string[];
  };
  user?: AuthenticatedUser;
}

interface AccessPayload {
  sub: string;
  email: string;
  role: Role;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly accessSecret: string;

  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(ConfigService)
    configService: ConfigService<AppConfig, true>,
  ) {
    this.accessSecret = configService.get('auth.jwtAccessSecret', { infer: true });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Authentication is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<Record<string, unknown>>(token, {
        secret: this.accessSecret,
      });

      if (!this.isAccessPayload(payload)) {
        throw new UnauthorizedException('Authentication is required');
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Authentication is required');
    }
  }

  private extractBearerToken(authorization: string | string[] | undefined): string | undefined {
    const header = Array.isArray(authorization) ? authorization[0] : authorization;

    if (!header || !header.startsWith('Bearer ')) {
      return undefined;
    }

    const token = header.slice('Bearer '.length).trim();
    return token.length > 0 ? token : undefined;
  }

  private isAccessPayload(payload: unknown): payload is AccessPayload {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'sub' in payload &&
      'email' in payload &&
      'role' in payload &&
      typeof payload.sub === 'string' &&
      typeof payload.email === 'string' &&
      this.isRole(payload.role)
    );
  }

  private isRole(role: unknown): role is Role {
    return role === Role.USER || role === Role.ADMIN;
  }
}

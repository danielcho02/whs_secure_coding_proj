import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

interface RequestWithUser {
  headers: {
    authorization?: string | string[];
  };
  user?: AuthenticatedUser;
}

interface AccessPayloadSubject {
  sub: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly accessSecret: string;

  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(ConfigService)
    configService: ConfigService<AppConfig, true>,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
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

      if (!this.isAccessPayloadSubject(payload)) {
        throw new UnauthorizedException('Authentication is required');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
        },
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Authentication is required');
      }

      request.user = user;

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

  private isAccessPayloadSubject(payload: unknown): payload is AccessPayloadSubject {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'sub' in payload &&
      typeof payload.sub === 'string'
    );
  }
}

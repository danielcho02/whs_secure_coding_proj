import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Prisma, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  AUTH_FAILURE_MESSAGE,
  BCRYPT_SALT_ROUNDS,
  DUMMY_PASSWORD_HASH,
  LOGIN_FAIL_TTL_SECONDS,
  LOGIN_LOCK_SECONDS,
  REFRESH_FAILURE_MESSAGE,
} from './constants/auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AccessTokenPayload,
  AuthResult,
  RefreshTokenPayload,
  SafeAuthUser,
} from './types/auth-user.type';
import { parseDurationToSeconds } from './utils/token.util';

const SAFE_AUTH_USER_SELECT = {
  id: true,
  email: true,
  nickname: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const LOGIN_USER_SELECT = {
  ...SAFE_AUTH_USER_SELECT,
  passwordHash: true,
  loginFails: true,
  lockedUntil: true,
} satisfies Prisma.UserSelect;

type LoginUser = Prisma.UserGetPayload<{ select: typeof LOGIN_USER_SELECT }>;

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessExpires: string;
  private readonly refreshSecret: string;
  private readonly refreshExpires: string;
  private readonly refreshExpiresInSeconds: number;
  private readonly loginMaxAttempts: number;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RedisService)
    private readonly redis: RedisService,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(ConfigService)
    configService: ConfigService<AppConfig, true>,
  ) {
    this.accessSecret = configService.get('auth.jwtAccessSecret', { infer: true });
    this.accessExpires = configService.get('auth.jwtAccessExpires', { infer: true });
    this.refreshSecret = configService.get('auth.jwtRefreshSecret', { infer: true });
    this.refreshExpires = configService.get('auth.jwtRefreshExpires', { infer: true });
    this.refreshExpiresInSeconds = parseDurationToSeconds(this.refreshExpires);
    this.loginMaxAttempts = configService.get('auth.loginMaxAttempts', {
      infer: true,
    });
  }

  async register(dto: RegisterDto): Promise<SafeAuthUser> {
    const email = this.normalizeEmail(dto.email);
    const nickname = dto.nickname.trim();

    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    const existingNickname = await this.prisma.user.findUnique({
      where: { nickname },
      select: { id: true },
    });

    if (existingNickname) {
      throw new ConflictException('Nickname already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    try {
      return await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          nickname,
          role: Role.USER,
          status: UserStatus.ACTIVE,
        },
        select: SAFE_AUTH_USER_SELECT,
      });
    } catch (error) {
      this.throwConflictForUniqueViolation(error);
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: LOGIN_USER_SELECT,
    });

    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH);
      await this.recordFailedLogin(email);
      throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    }

    if (this.isLocked(user)) {
      throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      await this.recordFailedLogin(email, user.id);
      throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    }

    await this.redis.clearLoginFailures(email);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        loginFails: 0,
        lockedUntil: null,
      },
      select: { id: true },
    });

    return this.issueAuthResult(this.toSafeUser(user));
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const isWhitelisted = await this.redis.hasRefreshSession(payload.sub, payload.jti);

    if (!isWhitelisted) {
      await this.redis.removeAllRefreshSessions(payload.sub);
      throw new UnauthorizedException(REFRESH_FAILURE_MESSAGE);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: SAFE_AUTH_USER_SELECT,
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.redis.removeAllRefreshSessions(payload.sub);
      throw new UnauthorizedException(REFRESH_FAILURE_MESSAGE);
    }

    await this.redis.removeRefreshSession(payload.sub, payload.jti);
    return this.issueAuthResult(user);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      await this.redis.removeRefreshSession(payload.sub, payload.jti);
    } catch {
      return;
    }
  }

  private async issueAuthResult(user: SafeAuthUser): Promise<AuthResult> {
    const jti = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user),
      this.signRefreshToken(user.id, jti),
    ]);

    await this.redis.storeRefreshSession(user.id, jti, this.refreshExpiresInSeconds);

    return {
      accessToken,
      refreshToken,
      refreshExpiresInSeconds: this.refreshExpiresInSeconds,
      user,
    };
  }

  private async signAccessToken(user: SafeAuthUser): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpires as JwtSignOptions['expiresIn'],
    });
  }

  private async signRefreshToken(userId: string, jti: string): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: userId,
      jti,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpires as JwtSignOptions['expiresIn'],
    });
  }

  private async verifyRefreshToken(
    refreshToken: string | undefined,
  ): Promise<RefreshTokenPayload> {
    if (!refreshToken) {
      throw new UnauthorizedException(REFRESH_FAILURE_MESSAGE);
    }

    try {
      const payload = await this.jwtService.verifyAsync<Record<string, unknown>>(refreshToken, {
        secret: this.refreshSecret,
      });

      if (!this.isRefreshTokenPayload(payload)) {
        throw new UnauthorizedException(REFRESH_FAILURE_MESSAGE);
      }

      return payload;
    } catch {
      throw new UnauthorizedException(REFRESH_FAILURE_MESSAGE);
    }
  }

  private async recordFailedLogin(email: string, userId?: string): Promise<void> {
    const failureCount = await this.redis.incrementLoginFailure(
      email,
      LOGIN_FAIL_TTL_SECONDS,
    );
    const shouldLock = failureCount >= this.loginMaxAttempts;

    if (!userId) {
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        loginFails: failureCount,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOGIN_LOCK_SECONDS * 1000)
          : null,
      },
      select: { id: true },
    });
  }

  private isLocked(user: LoginUser): boolean {
    return user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now();
  }

  private isRefreshTokenPayload(payload: unknown): payload is RefreshTokenPayload {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'sub' in payload &&
      'jti' in payload &&
      typeof payload.sub === 'string' &&
      typeof payload.jti === 'string'
    );
  }

  private toSafeUser(user: LoginUser): SafeAuthUser {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private throwConflictForUniqueViolation(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('User already exists');
    }
  }
}

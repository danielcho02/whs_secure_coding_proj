import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
} from './constants/auth.constants';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { AuthResult, PublicAuthResult, SafeAuthUser } from './types/auth-user.type';

interface CookieRequest {
  cookies?: Record<string, string | undefined>;
}

interface CookieReply {
  setCookie: (name: string, value: string, options: RefreshCookieOptions) => void;
  clearCookie: (name: string, options: ClearCookieOptions) => void;
}

interface RefreshCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'strict';
  path: string;
  maxAge: number;
}

interface ClearCookieOptions {
  path: string;
}

@Controller('auth')
export class AuthController {
  private readonly nodeEnv: string;

  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(ConfigService)
    configService: ConfigService<AppConfig, true>,
  ) {
    this.nodeEnv = configService.get('app.nodeEnv', { infer: true });
  }

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<SafeAuthUser> {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(reply, result);
    return this.toPublicAuthResult(result);
  }

  @Post('refresh')
  async refresh(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.refresh(
      request.cookies?.[REFRESH_COOKIE_NAME],
    );
    this.setRefreshCookie(reply, result);
    return this.toPublicAuthResult(result);
  }

  @Post('logout')
  async logout(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<{ loggedOut: true }> {
    await this.authService.logout(request.cookies?.[REFRESH_COOKIE_NAME]);
    reply.clearCookie(REFRESH_COOKIE_NAME, {
      path: REFRESH_COOKIE_PATH,
    });
    return { loggedOut: true };
  }

  private setRefreshCookie(reply: CookieReply, result: AuthResult): void {
    reply.setCookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      httpOnly: true,
      secure: this.nodeEnv === 'production',
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      maxAge: result.refreshExpiresInSeconds,
    });
  }

  private toPublicAuthResult(result: AuthResult): PublicAuthResult {
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }
}

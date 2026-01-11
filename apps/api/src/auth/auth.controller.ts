import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  LoginRequestSchema,
  RefreshRequestSchema,
  LogoutRequestSchema,
  type LoginRequest,
  type RefreshRequest,
  type LogoutRequest,
} from '@taller/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './guards/access-token.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AccessTokenPayload } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
  ) {
    return this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  refresh(
    @Body(new ZodValidationPipe(RefreshRequestSchema)) body: RefreshRequest,
  ) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  async logout(
    @Body(new ZodValidationPipe(LogoutRequestSchema)) body: LogoutRequest,
  ) {
    await this.authService.logout(body.refreshToken);
    return { ok: true };
  }

  @UseGuards(AccessTokenGuard)
  @Get('me')
  me(@CurrentUser() user: AccessTokenPayload | undefined) {
    return { user };
  }
}

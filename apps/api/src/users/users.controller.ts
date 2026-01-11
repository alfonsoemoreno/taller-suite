import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  UserCreateSchema,
  UserResetPasswordSchema,
  UserUpdateSchema,
  type UserCreate,
  type UserResetPassword,
  type UserUpdate,
} from '@taller/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.types';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.usersService.list(user);
  }

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(UserCreateSchema)) body: UserCreate,
  ) {
    return this.usersService.create(user, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UserUpdateSchema)) body: UserUpdate,
  ) {
    return this.usersService.update(user, id, body);
  }

  @Post(':id/reset-password')
  resetPassword(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UserResetPasswordSchema))
    body: UserResetPassword,
  ) {
    return this.usersService.resetPassword(user, id, body);
  }
}

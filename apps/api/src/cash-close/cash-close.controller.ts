import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CashCloseCreateSchema, type CashCloseCreate } from '@taller/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.types';
import { CashCloseService } from './cash-close.service';

@Controller('cash-close')
export class CashCloseController {
  constructor(private readonly cashCloseService: CashCloseService) {}

  @Get('today')
  getToday(@CurrentUser() user: AccessTokenPayload) {
    return this.cashCloseService.getToday(user);
  }

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.cashCloseService.list(user, from, to);
  }

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(CashCloseCreateSchema)) body: CashCloseCreate,
  ) {
    return this.cashCloseService.create(user, body);
  }
}

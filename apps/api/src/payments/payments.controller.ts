import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { PaymentCreateSchema, type PaymentCreate } from '@taller/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.types';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('work-orders/:id/payments')
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ) {
    return this.paymentsService.listByWorkOrder(user, id);
  }

  @Post('work-orders/:id/payments')
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PaymentCreateSchema)) body: PaymentCreate,
  ) {
    return this.paymentsService.create(user, id, body);
  }

  @Delete('payments/:id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.paymentsService.remove(user, id);
  }
}

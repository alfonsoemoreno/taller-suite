import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  PurchaseCreateSchema,
  PurchaseItemCreateSchema,
  PurchaseUpdateSchema,
  type PurchaseCreate,
  type PurchaseItemCreate,
  type PurchaseUpdate,
} from '@taller/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.types';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.purchasesService.list(user);
  }

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(PurchaseCreateSchema)) body: PurchaseCreate,
  ) {
    return this.purchasesService.create(user, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.purchasesService.get(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PurchaseUpdateSchema)) body: PurchaseUpdate,
  ) {
    return this.purchasesService.update(user, id, body);
  }

  @Post(':id/items')
  addItem(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PurchaseItemCreateSchema))
    body: PurchaseItemCreate,
  ) {
    return this.purchasesService.addItem(user, id, body);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.purchasesService.removeItem(user, id, itemId);
  }

  @Post(':id/receive')
  receive(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.purchasesService.receive(user, id);
  }
}

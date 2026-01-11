import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InventoryAdjustSchema, type InventoryAdjust } from '@taller/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.types';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.inventoryService.list(user);
  }

  @Get(':catalogItemId/movements')
  listMovements(
    @CurrentUser() user: AccessTokenPayload,
    @Param('catalogItemId') catalogItemId: string,
  ) {
    return this.inventoryService.listMovements(user, catalogItemId);
  }

  @Post('adjust')
  adjust(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(InventoryAdjustSchema)) body: InventoryAdjust,
  ) {
    return this.inventoryService.adjust(user, body);
  }
}

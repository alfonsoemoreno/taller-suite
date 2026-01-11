import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  WorkOrderCreateSchema,
  WorkOrderItemCreateSchema,
  WorkOrderItemUpdateSchema,
  WorkOrderNoteCreateSchema,
  WorkOrderUpdateSchema,
  type WorkOrderCreate,
  type WorkOrderItemCreate,
  type WorkOrderItemUpdate,
  type WorkOrderNoteCreate,
  type WorkOrderUpdate,
  WorkOrderStatusSchema,
} from '@taller/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.types';
import { WorkOrdersService } from './work-orders.service';

@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    const parsedStatus = status
      ? WorkOrderStatusSchema.safeParse(status)
      : undefined;
    if (status && !parsedStatus?.success) {
      throw new BadRequestException('Estado invalido');
    }
    return this.workOrdersService.list(user, {
      status: parsedStatus?.success ? parsedStatus.data : undefined,
      customerId: customerId || undefined,
      vehicleId: vehicleId || undefined,
    });
  }

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(WorkOrderCreateSchema)) body: WorkOrderCreate,
  ) {
    return this.workOrdersService.create(user, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.workOrdersService.get(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(WorkOrderUpdateSchema)) body: WorkOrderUpdate,
  ) {
    return this.workOrdersService.update(user, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.workOrdersService.remove(user, id);
  }

  @Post(':id/items')
  addItem(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(WorkOrderItemCreateSchema))
    body: WorkOrderItemCreate,
  ) {
    return this.workOrdersService.addItem(user, id, body);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(WorkOrderItemUpdateSchema))
    body: WorkOrderItemUpdate,
  ) {
    return this.workOrdersService.updateItem(user, id, itemId, body);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.workOrdersService.removeItem(user, id, itemId);
  }

  @Get(':id/notes')
  listNotes(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.workOrdersService.listNotes(user, id);
  }

  @Post(':id/notes')
  addNote(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(WorkOrderNoteCreateSchema))
    body: WorkOrderNoteCreate,
  ) {
    return this.workOrdersService.addNote(user, id, body);
  }

  @Delete(':id/notes/:noteId')
  removeNote(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('noteId') noteId: string,
  ) {
    return this.workOrdersService.removeNote(user, id, noteId);
  }
}

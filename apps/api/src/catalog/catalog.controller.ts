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
  CatalogItemCreateSchema,
  CatalogItemUpdateSchema,
  type CatalogItemCreate,
  type CatalogItemUpdate,
} from '@taller/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.types';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.catalogService.list(user);
  }

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(CatalogItemCreateSchema))
    body: CatalogItemCreate,
  ) {
    return this.catalogService.create(user, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CatalogItemUpdateSchema))
    body: CatalogItemUpdate,
  ) {
    return this.catalogService.update(user, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.catalogService.remove(user, id);
  }
}

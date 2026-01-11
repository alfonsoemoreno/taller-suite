import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import {
  VehicleLookupRequestSchema,
  VehicleUpdateSchema,
  type VehicleUpdate,
  type VehicleLookupRequest,
} from '@taller/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.types';
import { VehiclesService } from './vehicles.service';
import { GetApiService } from '../getapi/getapi.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly getApiService: GetApiService,
  ) {}

  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(VehicleUpdateSchema)) body: VehicleUpdate,
  ) {
    return this.vehiclesService.update(user, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.vehiclesService.remove(user, id);
  }

  @Post('lookup')
  lookup(
    @Body(new ZodValidationPipe(VehicleLookupRequestSchema))
    body: VehicleLookupRequest,
  ) {
    return this.getApiService.lookupPlate(body.plate);
  }
}

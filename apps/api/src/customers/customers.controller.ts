import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  CustomerCreateSchema,
  CustomerUpdateSchema,
  type CustomerCreate,
  type CustomerUpdate,
} from '@taller/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.types';
import { CustomersService } from './customers.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { VehicleCreateSchema, type VehicleCreate } from '@taller/shared';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.customersService.list(user);
  }

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(CustomerCreateSchema)) body: CustomerCreate,
  ) {
    return this.customersService.create(user, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.customersService.get(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CustomerUpdateSchema)) body: CustomerUpdate,
  ) {
    return this.customersService.update(user, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.customersService.remove(user, id);
  }

  @Get(':id/vehicles')
  listVehicles(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') customerId: string,
  ) {
    return this.vehiclesService.listByCustomer(user, customerId);
  }

  @Post(':id/vehicles')
  createVehicle(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') customerId: string,
    @Body(new ZodValidationPipe(VehicleCreateSchema)) body: VehicleCreate,
  ) {
    return this.vehiclesService.createForCustomer(user, customerId, body);
  }
}

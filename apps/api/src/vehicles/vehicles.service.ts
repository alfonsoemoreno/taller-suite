import { Injectable, NotFoundException } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.types';
import type { VehicleCreate, VehicleUpdate } from '@taller/shared';
import { normalizePlate } from '@taller/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async listByCustomer(user: AccessTokenPayload, customerId: string) {
    await this.ensureCustomer(user, customerId);
    return this.prisma.vehicle.findMany({
      where: {
        customerId,
        tenantId: user.tenantId,
        ownerId: user.sub,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createForCustomer(
    user: AccessTokenPayload,
    customerId: string,
    data: VehicleCreate,
  ) {
    await this.ensureCustomer(user, customerId);
    const plate = normalizePlate(data.plate);
    return this.prisma.vehicle.create({
      data: {
        ...data,
        plate,
        tenantId: user.tenantId,
        ownerId: user.sub,
        customerId,
      },
    });
  }

  async update(
    user: AccessTokenPayload,
    vehicleId: string,
    data: VehicleUpdate,
  ) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId: user.tenantId,
        ownerId: user.sub,
      },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehiculo no encontrado');
    }
    const payload = {
      ...data,
      plate: data.plate ? normalizePlate(data.plate) : undefined,
    };
    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: payload,
    });
  }

  async remove(user: AccessTokenPayload, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId: user.tenantId,
        ownerId: user.sub,
      },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehiculo no encontrado');
    }
    await this.prisma.vehicle.delete({ where: { id: vehicleId } });
    return { ok: true };
  }

  private async ensureCustomer(user: AccessTokenPayload, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId: user.tenantId,
        ownerId: user.sub,
      },
    });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }
  }
}

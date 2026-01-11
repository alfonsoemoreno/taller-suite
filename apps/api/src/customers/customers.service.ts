import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';
import type { CustomerCreate, CustomerUpdate } from '@taller/shared';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AccessTokenPayload) {
    return this.prisma.customer.findMany({
      where: {
        tenantId: user.tenantId,
        ownerId: user.sub,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(user: AccessTokenPayload, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ownerId: user.sub,
      },
    });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return customer;
  }

  create(user: AccessTokenPayload, data: CustomerCreate) {
    return this.prisma.customer.create({
      data: {
        ...data,
        tenantId: user.tenantId,
        ownerId: user.sub,
      },
    });
  }

  async update(user: AccessTokenPayload, id: string, data: CustomerUpdate) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ownerId: user.sub,
      },
    });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  async remove(user: AccessTokenPayload, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ownerId: user.sub,
      },
    });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }
    await this.prisma.customer.delete({ where: { id } });
    return { ok: true };
  }
}

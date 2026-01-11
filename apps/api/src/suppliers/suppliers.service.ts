import { Injectable, NotFoundException } from '@nestjs/common';
import type { SupplierCreate, SupplierUpdate } from '@taller/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AccessTokenPayload) {
    return this.prisma.supplier.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: AccessTokenPayload, data: SupplierCreate) {
    return this.prisma.supplier.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        notes: data.notes || null,
      },
    });
  }

  async update(user: AccessTokenPayload, id: string, data: SupplierUpdate) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }
    return this.prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        name: data.name ?? supplier.name,
        email: data.email === '' ? null : data.email ?? supplier.email,
        phone: data.phone === '' ? null : data.phone ?? supplier.phone,
        notes: data.notes === '' ? null : data.notes ?? supplier.notes,
      },
    });
  }

  async remove(user: AccessTokenPayload, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }
    await this.prisma.supplier.delete({ where: { id: supplier.id } });
    return { ok: true };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CatalogItemCreate, CatalogItemUpdate } from '@taller/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AccessTokenPayload) {
    return this.prisma.catalogItem.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: AccessTokenPayload, data: CatalogItemCreate) {
    return this.prisma.catalogItem.create({
      data: {
        tenantId: user.tenantId,
        type: data.type,
        sku: data.sku || null,
        name: data.name,
        brand: data.brand || null,
        unit: data.unit,
        salePriceCents: data.salePriceCents,
        costCents: data.costCents,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(user: AccessTokenPayload, id: string, data: CatalogItemUpdate) {
    const item = await this.prisma.catalogItem.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }
    if (data.salePriceCents !== undefined && data.salePriceCents < 0) {
      throw new BadRequestException('Precio inválido');
    }
    if (data.costCents !== undefined && data.costCents < 0) {
      throw new BadRequestException('Costo inválido');
    }
    return this.prisma.catalogItem.update({
      where: { id: item.id },
      data: {
        type: data.type ?? item.type,
        sku: data.sku === '' ? null : (data.sku ?? item.sku),
        name: data.name ?? item.name,
        brand: data.brand === '' ? null : (data.brand ?? item.brand),
        unit: data.unit ?? item.unit,
        salePriceCents: data.salePriceCents ?? item.salePriceCents,
        costCents: data.costCents ?? item.costCents,
        isActive: data.isActive ?? item.isActive,
      },
    });
  }

  async remove(user: AccessTokenPayload, id: string) {
    const item = await this.prisma.catalogItem.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }
    return this.prisma.catalogItem.update({
      where: { id: item.id },
      data: { isActive: false },
    });
  }
}

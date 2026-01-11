import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { InventoryAdjust } from '@taller/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AccessTokenPayload) {
    const items = await this.prisma.catalogItem.findMany({
      where: { tenantId: user.tenantId, type: 'PART' },
      orderBy: { name: 'asc' },
    });

    const movements = await this.prisma.inventoryMovement.groupBy({
      by: ['catalogItemId'],
      where: { tenantId: user.tenantId },
      _sum: { qty: true },
    });

    const movementMap = new Map<string, number>();
    for (const move of movements) {
      movementMap.set(move.catalogItemId, move._sum.qty ?? 0);
    }

    return items.map((item) => ({
      ...item,
      qtyOnHand: movementMap.get(item.id) ?? 0,
    }));
  }

  async listMovements(user: AccessTokenPayload, catalogItemId: string) {
    const item = await this.prisma.catalogItem.findFirst({
      where: { id: catalogItemId, tenantId: user.tenantId },
    });
    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }
    return this.prisma.inventoryMovement.findMany({
      where: { catalogItemId, tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adjust(user: AccessTokenPayload, data: InventoryAdjust) {
    const item = await this.prisma.catalogItem.findFirst({
      where: { id: data.catalogItemId, tenantId: user.tenantId },
    });
    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }
    if (item.type !== 'PART') {
      throw new BadRequestException('Solo repuestos pueden ajustar stock');
    }
    if (data.qty === 0) {
      throw new BadRequestException('Cantidad inválida');
    }

    const current = await this.prisma.inventoryMovement.aggregate({
      where: { tenantId: user.tenantId, catalogItemId: item.id },
      _sum: { qty: true },
    });
    const currentQty = current._sum.qty ?? 0;
    const nextQty = currentQty + data.qty;
    if (nextQty < 0) {
      throw new BadRequestException('Stock insuficiente para ajuste');
    }

    return this.prisma.inventoryMovement.create({
      data: {
        tenantId: user.tenantId,
        catalogItemId: item.id,
        type: 'ADJUST',
        qty: data.qty,
        unitCostCents: data.unitCostCents ?? null,
        referenceType: 'MANUAL',
        referenceId: data.reason,
        createdByUserId: user.sub,
      },
    });
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  PurchaseCreate,
  PurchaseItemCreate,
  PurchaseUpdate,
} from '@taller/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AccessTokenPayload) {
    return this.prisma.purchase.findMany({
      where: { tenantId: user.tenantId },
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(user: AccessTokenPayload, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { supplier: true, items: { include: { catalogItem: true } } },
    });
    if (!purchase) {
      throw new NotFoundException('Compra no encontrada');
    }
    return purchase;
  }

  async create(user: AccessTokenPayload, data: PurchaseCreate) {
    await this.ensureSupplier(user, data.supplierId);
    return this.prisma.purchase.create({
      data: {
        tenantId: user.tenantId,
        supplierId: data.supplierId,
        status: 'DRAFT',
      },
    });
  }

  async update(user: AccessTokenPayload, id: string, data: PurchaseUpdate) {
    const purchase = await this.get(user, id);
    if (purchase.status === 'RECEIVED') {
      throw new BadRequestException('Compra recibida no es editable');
    }
    return this.prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        status: data.status ?? purchase.status,
      },
      include: { supplier: true, items: { include: { catalogItem: true } } },
    });
  }

  async addItem(
    user: AccessTokenPayload,
    id: string,
    data: PurchaseItemCreate,
  ) {
    const purchase = await this.get(user, id);
    if (purchase.status === 'RECEIVED') {
      throw new BadRequestException('Compra recibida no es editable');
    }
    const item = await this.prisma.catalogItem.findFirst({
      where: { id: data.catalogItemId, tenantId: user.tenantId, type: 'PART' },
    });
    if (!item) {
      throw new NotFoundException('Repuesto no encontrado');
    }
    const lineTotalCents = data.qty * data.unitCostCents;
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          catalogItemId: item.id,
          qty: data.qty,
          unitCostCents: data.unitCostCents,
          lineTotalCents,
        },
      });
      await this.recalculateTotal(tx, purchase.id);
      return created;
    });
  }

  async removeItem(user: AccessTokenPayload, id: string, itemId: string) {
    const purchase = await this.get(user, id);
    if (purchase.status === 'RECEIVED') {
      throw new BadRequestException('Compra recibida no es editable');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.purchaseItem.deleteMany({
        where: { id: itemId, purchaseId: id },
      });
      await this.recalculateTotal(tx, purchase.id);
    });
    return { ok: true };
  }

  async receive(user: AccessTokenPayload, id: string) {
    const purchase = await this.get(user, id);
    if (purchase.status === 'RECEIVED') {
      throw new BadRequestException('Compra ya recibida');
    }
    const items = await this.prisma.purchaseItem.findMany({
      where: { purchaseId: purchase.id },
    });
    if (items.length === 0) {
      throw new BadRequestException('Compra sin items');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: 'RECEIVED' },
      });

      for (const item of items) {
        await tx.inventoryMovement.create({
          data: {
            tenantId: user.tenantId,
            catalogItemId: item.catalogItemId,
            type: 'IN',
            qty: item.qty,
            unitCostCents: item.unitCostCents,
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            createdByUserId: user.sub,
          },
        });
      }

      return { ok: true };
    });
  }

  private async recalculateTotal(
    tx: Prisma.TransactionClient,
    purchaseId: string,
  ) {
    const totals = await tx.purchaseItem.aggregate({
      where: { purchaseId },
      _sum: { lineTotalCents: true },
    });
    const totalCents = totals._sum.lineTotalCents ?? 0;
    await tx.purchase.update({
      where: { id: purchaseId },
      data: { totalCents },
    });
  }

  private async ensureSupplier(user: AccessTokenPayload, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId: user.tenantId },
    });
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }
  }
}

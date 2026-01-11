import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  WorkOrderCreate,
  WorkOrderItemCreate,
  WorkOrderItemUpdate,
  WorkOrderNoteCreate,
  WorkOrderUpdate,
} from '@taller/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';
import type { WorkOrderStatus } from '@taller/shared';
import { PaymentStatusSchema } from '@taller/shared';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: AccessTokenPayload,
    filters: {
      status?: WorkOrderStatus;
      customerId?: string;
      vehicleId?: string;
    },
  ) {
    return this.prisma.workOrder.findMany({
      where: {
        tenantId: user.tenantId,
        ownerId: user.sub,
        status: filters.status,
        customerId: filters.customerId,
        vehicleId: filters.vehicleId,
      },
      include: {
        customer: true,
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: AccessTokenPayload, data: WorkOrderCreate) {
    await this.ensureCustomer(user, data.customerId);
    if (data.vehicleId) {
      await this.ensureVehicle(user, data.vehicleId, data.customerId);
    }

    return this.prisma.workOrder.create({
      data: {
        tenantId: user.tenantId,
        ownerId: user.sub,
        customerId: data.customerId,
        vehicleId: data.vehicleId,
        title: data.title || null,
        description: data.description || null,
        odometer: data.odometer ?? null,
        status: data.status ?? 'OPEN',
      },
      include: {
        customer: true,
        vehicle: true,
      },
    });
  }

  async get(user: AccessTokenPayload, id: string) {
    const order = await this.prisma.workOrder.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ownerId: user.sub,
      },
      include: {
        customer: true,
        vehicle: true,
        items: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }
    return order;
  }

  async update(user: AccessTokenPayload, id: string, data: WorkOrderUpdate) {
    const order = await this.getWorkOrder(user, id);
    if (data.customerId && data.customerId !== order.customerId) {
      await this.ensureCustomer(user, data.customerId);
    }
    if (data.vehicleId) {
      await this.ensureVehicle(
        user,
        data.vehicleId,
        data.customerId ?? order.customerId,
      );
    }

    return this.prisma.workOrder.update({
      where: { id: order.id },
      data: {
        customerId: data.customerId,
        vehicleId: data.vehicleId || null,
        title: data.title === '' ? null : data.title,
        description: data.description === '' ? null : data.description,
        odometer: data.odometer ?? null,
        status: data.status,
      },
      include: {
        customer: true,
        vehicle: true,
        items: true,
      },
    });
  }

  async remove(user: AccessTokenPayload, id: string) {
    const order = await this.getWorkOrder(user, id);
    if (order.status !== 'OPEN') {
      throw new BadRequestException('Solo puedes eliminar ordenes abiertas');
    }
    await this.prisma.workOrder.delete({ where: { id: order.id } });
    return { ok: true };
  }

  async listNotes(user: AccessTokenPayload, id: string) {
    await this.getWorkOrder(user, id);
    return this.prisma.workOrderNote.findMany({
      where: {
        workOrderId: id,
        tenantId: user.tenantId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addNote(
    user: AccessTokenPayload,
    id: string,
    data: WorkOrderNoteCreate,
  ) {
    await this.getWorkOrder(user, id);
    return this.prisma.workOrderNote.create({
      data: {
        tenantId: user.tenantId,
        workOrderId: id,
        note: data.note,
        createdByUserId: user.sub,
      },
    });
  }

  async removeNote(user: AccessTokenPayload, id: string, noteId: string) {
    await this.getWorkOrder(user, id);
    await this.prisma.workOrderNote.deleteMany({
      where: { id: noteId, workOrderId: id, tenantId: user.tenantId },
    });
    return { ok: true };
  }

  async addItem(
    user: AccessTokenPayload,
    id: string,
    data: WorkOrderItemCreate,
  ) {
    const order = await this.getWorkOrder(user, id);
    this.ensureItemEditable(user, order.status);
    if (data.catalogItemId && data.type !== 'PART') {
      throw new BadRequestException('Solo repuestos pueden usar catálogo');
    }
    const lineTotal = data.qty * data.unitPriceCents;
    if (lineTotal < 0) {
      throw new BadRequestException('Montos invalidos');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (data.catalogItemId) {
        await this.ensureCatalogItem(user, data.catalogItemId);
        await this.ensureStockAvailable(tx, user, data.catalogItemId, data.qty);
      }
      const item = await tx.workOrderItem.create({
        data: {
          tenantId: user.tenantId,
          workOrderId: order.id,
          catalogItemId: data.catalogItemId ?? null,
          type: data.type,
          name: data.name,
          qty: data.qty,
          unitPriceCents: data.unitPriceCents,
          lineTotalCents: lineTotal,
        },
      });
      if (data.catalogItemId) {
        await tx.inventoryMovement.create({
          data: {
            tenantId: user.tenantId,
            catalogItemId: data.catalogItemId,
            type: 'OUT',
            qty: -data.qty,
            referenceType: 'WORK_ORDER',
            referenceId: order.id,
            createdByUserId: user.sub,
          },
        });
      }
      const totalCents = await this.recalculateTotal(tx, order.id, user);
      return { item, totalCents };
    });

    return result.item;
  }

  async updateItem(
    user: AccessTokenPayload,
    id: string,
    itemId: string,
    data: WorkOrderItemUpdate,
  ) {
    const order = await this.getWorkOrder(user, id);
    this.ensureItemEditable(user, order.status);

    const existing = await this.prisma.workOrderItem.findFirst({
      where: {
        id: itemId,
        workOrderId: id,
        tenantId: user.tenantId,
      },
    });
    if (!existing) {
      throw new NotFoundException('Item no encontrado');
    }

    const qty = data.qty ?? existing.qty;
    const unitPriceCents = data.unitPriceCents ?? existing.unitPriceCents;
    const lineTotal = qty * unitPriceCents;
    if (lineTotal < 0) {
      throw new BadRequestException('Montos invalidos');
    }
    const nextCatalogItemId =
      data.catalogItemId ?? existing.catalogItemId ?? undefined;
    const nextType = data.type ?? existing.type;
    if (nextCatalogItemId && nextType !== 'PART') {
      throw new BadRequestException('Solo repuestos pueden usar catálogo');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (existing.catalogItemId) {
        if (nextCatalogItemId && nextCatalogItemId === existing.catalogItemId) {
          const delta = qty - existing.qty;
          if (delta > 0) {
            await this.ensureStockAvailable(tx, user, nextCatalogItemId, delta);
            await tx.inventoryMovement.create({
              data: {
                tenantId: user.tenantId,
                catalogItemId: nextCatalogItemId,
                type: 'OUT',
                qty: -delta,
                referenceType: 'WORK_ORDER',
                referenceId: order.id,
                createdByUserId: user.sub,
              },
            });
          } else if (delta < 0) {
            await tx.inventoryMovement.create({
              data: {
                tenantId: user.tenantId,
                catalogItemId: nextCatalogItemId,
                type: 'IN',
                qty: Math.abs(delta),
                referenceType: 'WORK_ORDER',
                referenceId: order.id,
                createdByUserId: user.sub,
              },
            });
          }
        } else {
          await tx.inventoryMovement.create({
            data: {
              tenantId: user.tenantId,
              catalogItemId: existing.catalogItemId,
              type: 'IN',
              qty: existing.qty,
              referenceType: 'WORK_ORDER',
              referenceId: order.id,
              createdByUserId: user.sub,
            },
          });
          if (nextCatalogItemId) {
            await this.ensureCatalogItem(user, nextCatalogItemId);
            await this.ensureStockAvailable(tx, user, nextCatalogItemId, qty);
            await tx.inventoryMovement.create({
              data: {
                tenantId: user.tenantId,
                catalogItemId: nextCatalogItemId,
                type: 'OUT',
                qty: -qty,
                referenceType: 'WORK_ORDER',
                referenceId: order.id,
                createdByUserId: user.sub,
              },
            });
          }
        }
      } else if (nextCatalogItemId) {
        await this.ensureCatalogItem(user, nextCatalogItemId);
        await this.ensureStockAvailable(tx, user, nextCatalogItemId, qty);
        await tx.inventoryMovement.create({
          data: {
            tenantId: user.tenantId,
            catalogItemId: nextCatalogItemId,
            type: 'OUT',
            qty: -qty,
            referenceType: 'WORK_ORDER',
            referenceId: order.id,
            createdByUserId: user.sub,
          },
        });
      }
      const item = await tx.workOrderItem.update({
        where: { id: existing.id },
        data: {
          catalogItemId: data.catalogItemId ?? existing.catalogItemId,
          type: nextType,
          name: data.name ?? existing.name,
          qty,
          unitPriceCents,
          lineTotalCents: lineTotal,
        },
      });
      await this.recalculateTotal(tx, order.id, user);
      return item;
    });

    return result;
  }

  async removeItem(user: AccessTokenPayload, id: string, itemId: string) {
    const order = await this.getWorkOrder(user, id);
    this.ensureItemEditable(user, order.status);

    await this.prisma.$transaction(async (tx) => {
      const item = await tx.workOrderItem.findFirst({
        where: { id: itemId, workOrderId: id, tenantId: user.tenantId },
      });
      if (item?.catalogItemId) {
        await tx.inventoryMovement.create({
          data: {
            tenantId: user.tenantId,
            catalogItemId: item.catalogItemId,
            type: 'IN',
            qty: item.qty,
            referenceType: 'WORK_ORDER',
            referenceId: order.id,
            createdByUserId: user.sub,
          },
        });
      }
      await tx.workOrderItem.deleteMany({
        where: { id: itemId, workOrderId: id, tenantId: user.tenantId },
      });
      await this.recalculateTotal(tx, order.id, user);
    });

    return { ok: true };
  }

  private ensureItemEditable(
    user: AccessTokenPayload,
    status: WorkOrderStatus,
  ) {
    if (status === 'DONE' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Orden cerrada, no editable');
    }
  }

  private async recalculateTotal(
    tx: Prisma.TransactionClient,
    workOrderId: string,
    user: AccessTokenPayload,
  ) {
    const items = await tx.workOrderItem.findMany({
      where: {
        workOrderId,
        tenantId: user.tenantId,
      },
      include: {
        catalogItem: true,
      },
    });
    const totalCents = items.reduce(
      (acc, item) => acc + item.lineTotalCents,
      0,
    );
    const costTotalCents = items.reduce((acc, item) => {
      if (item.type === 'PART' && item.catalogItem?.costCents) {
        return acc + item.qty * item.catalogItem.costCents;
      }
      return acc;
    }, 0);
    const payments = await tx.payment.aggregate({
      where: { workOrderId, tenantId: user.tenantId },
      _sum: { amountCents: true },
    });
    const paidTotalCents = payments._sum.amountCents ?? 0;
    const balanceCents = Math.max(totalCents - paidTotalCents, 0);
    const nextStatus =
      paidTotalCents <= 0
        ? PaymentStatusSchema.enum.UNPAID
        : balanceCents === 0
          ? PaymentStatusSchema.enum.PAID
          : PaymentStatusSchema.enum.PARTIAL;
    const marginCents = totalCents - costTotalCents;

    await tx.workOrder.update({
      where: { id: workOrderId },
      data: {
        totalCents,
        paidTotalCents,
        balanceCents,
        paymentStatus: nextStatus,
        costTotalCents,
        marginCents,
      },
    });
    return totalCents;
  }

  private async getWorkOrder(user: AccessTokenPayload, id: string) {
    const order = await this.prisma.workOrder.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ownerId: user.sub,
      },
    });
    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }
    return order;
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

  private async ensureVehicle(
    user: AccessTokenPayload,
    vehicleId: string,
    customerId: string,
  ) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        customerId,
        tenantId: user.tenantId,
        ownerId: user.sub,
      },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehiculo no encontrado');
    }
  }

  private async ensureCatalogItem(
    user: AccessTokenPayload,
    catalogItemId: string,
  ) {
    const item = await this.prisma.catalogItem.findFirst({
      where: { id: catalogItemId, tenantId: user.tenantId, type: 'PART' },
    });
    if (!item) {
      throw new NotFoundException('Repuesto no encontrado');
    }
  }

  private async ensureStockAvailable(
    tx: Prisma.TransactionClient,
    user: AccessTokenPayload,
    catalogItemId: string,
    qty: number,
  ) {
    const current = await tx.inventoryMovement.aggregate({
      where: { tenantId: user.tenantId, catalogItemId },
      _sum: { qty: true },
    });
    const currentQty = current._sum.qty ?? 0;
    if (currentQty - qty < 0) {
      throw new BadRequestException('Stock insuficiente');
    }
  }
}

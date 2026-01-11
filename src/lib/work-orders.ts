import type { Prisma } from '@/lib/prisma';
import type { WorkOrderStatus } from '@/shared';
import { PaymentStatusSchema } from '@/shared';
import { prisma } from './prisma';

export type SessionUser = {
  id: string;
  role: string;
  tenantId: string;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function findWorkOrder(user: SessionUser, id: string) {
  return prisma.workOrder.findFirst({
    where: { id, tenantId: user.tenantId, ownerId: user.id },
  });
}

export async function ensureCustomer(user: SessionUser, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId: user.tenantId, ownerId: user.id },
  });
  if (!customer) {
    throw new ApiError(404, 'Cliente no encontrado.');
  }
}

export async function ensureVehicle(
  user: SessionUser,
  vehicleId: string,
  customerId: string,
) {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      customerId,
      tenantId: user.tenantId,
      ownerId: user.id,
    },
  });
  if (!vehicle) {
    throw new ApiError(404, 'Vehiculo no encontrado.');
  }
}

export function ensureItemEditable(user: SessionUser, status: WorkOrderStatus) {
  if (status === 'DONE' && user.role !== 'ADMIN') {
    throw new ApiError(403, 'Orden cerrada, no editable.');
  }
}

export async function ensureCatalogItem(user: SessionUser, catalogItemId: string) {
  const item = await prisma.catalogItem.findFirst({
    where: { id: catalogItemId, tenantId: user.tenantId, type: 'PART' },
  });
  if (!item) {
    throw new ApiError(404, 'Repuesto no encontrado.');
  }
}

export async function ensureStockAvailable(
  tx: Prisma.TransactionClient,
  user: SessionUser,
  catalogItemId: string,
  qty: number,
) {
  const current = await tx.inventoryMovement.aggregate({
    where: { tenantId: user.tenantId, catalogItemId },
    _sum: { qty: true },
  });
  const currentQty = current._sum.qty ?? 0;
  if (currentQty - qty < 0) {
    throw new ApiError(400, 'Stock insuficiente.');
  }
}

export async function recalculateTotals(
  tx: Prisma.TransactionClient,
  workOrderId: string,
  user: SessionUser,
) {
  const items = await tx.workOrderItem.findMany({
    where: { workOrderId, tenantId: user.tenantId },
    include: { catalogItem: true },
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

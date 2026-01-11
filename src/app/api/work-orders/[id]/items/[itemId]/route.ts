import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  ApiError,
  ensureCatalogItem,
  ensureItemEditable,
  ensureStockAvailable,
  findWorkOrder,
  recalculateTotals,
  type SessionUser,
} from '@/lib/work-orders';
import { WorkOrderItemUpdateSchema } from '@/shared';

function requireSession(sessionUser: SessionUser | undefined) {
  if (!sessionUser) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }
  if (!sessionUser.tenantId) {
    return NextResponse.json(
      { message: 'Tenant no configurado.' },
      { status: 400 },
    );
  }
  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; itemId: string } },
) {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  try {
    const payload = await request.json();
    const parsed = WorkOrderItemUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
        { status: 400 },
      );
    }

    const order = await findWorkOrder(session.user, params.id);
    if (!order) {
      return NextResponse.json(
        { message: 'Orden no encontrada.' },
        { status: 404 },
      );
    }

    ensureItemEditable(session.user, order.status);

    const existing = await prisma.workOrderItem.findFirst({
      where: {
        id: params.itemId,
        workOrderId: params.id,
        tenantId: session.user.tenantId,
      },
    });
    if (!existing) {
      return NextResponse.json({ message: 'Item no encontrado.' }, { status: 404 });
    }

    const qty = parsed.data.qty ?? existing.qty;
    const unitPriceCents = parsed.data.unitPriceCents ?? existing.unitPriceCents;
    const lineTotal = qty * unitPriceCents;
    if (lineTotal < 0) {
      return NextResponse.json({ message: 'Montos invalidos.' }, { status: 400 });
    }

    const nextCatalogItemId =
      parsed.data.catalogItemId ?? existing.catalogItemId ?? undefined;
    const nextType = parsed.data.type ?? existing.type;
    if (nextCatalogItemId && nextType !== 'PART') {
      return NextResponse.json(
        { message: 'Solo repuestos pueden usar catálogo.' },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      if (existing.catalogItemId) {
        if (nextCatalogItemId && nextCatalogItemId === existing.catalogItemId) {
          const delta = qty - existing.qty;
          if (delta > 0) {
            await ensureStockAvailable(tx, session.user, nextCatalogItemId, delta);
            await tx.inventoryMovement.create({
              data: {
                tenantId: session.user.tenantId,
                catalogItemId: nextCatalogItemId,
                type: 'OUT',
                qty: -delta,
                referenceType: 'WORK_ORDER',
                referenceId: order.id,
                createdByUserId: session.user.id,
              },
            });
          } else if (delta < 0) {
            await tx.inventoryMovement.create({
              data: {
                tenantId: session.user.tenantId,
                catalogItemId: nextCatalogItemId,
                type: 'IN',
                qty: Math.abs(delta),
                referenceType: 'WORK_ORDER',
                referenceId: order.id,
                createdByUserId: session.user.id,
              },
            });
          }
        } else {
          await tx.inventoryMovement.create({
            data: {
              tenantId: session.user.tenantId,
              catalogItemId: existing.catalogItemId,
              type: 'IN',
              qty: existing.qty,
              referenceType: 'WORK_ORDER',
              referenceId: order.id,
              createdByUserId: session.user.id,
            },
          });
          if (nextCatalogItemId) {
            await ensureCatalogItem(session.user, nextCatalogItemId);
            await ensureStockAvailable(tx, session.user, nextCatalogItemId, qty);
            await tx.inventoryMovement.create({
              data: {
                tenantId: session.user.tenantId,
                catalogItemId: nextCatalogItemId,
                type: 'OUT',
                qty: -qty,
                referenceType: 'WORK_ORDER',
                referenceId: order.id,
                createdByUserId: session.user.id,
              },
            });
          }
        }
      } else if (nextCatalogItemId) {
        await ensureCatalogItem(session.user, nextCatalogItemId);
        await ensureStockAvailable(tx, session.user, nextCatalogItemId, qty);
        await tx.inventoryMovement.create({
          data: {
            tenantId: session.user.tenantId,
            catalogItemId: nextCatalogItemId,
            type: 'OUT',
            qty: -qty,
            referenceType: 'WORK_ORDER',
            referenceId: order.id,
            createdByUserId: session.user.id,
          },
        });
      }

      const item = await tx.workOrderItem.update({
        where: { id: existing.id },
        data: {
          catalogItemId: parsed.data.catalogItemId ?? existing.catalogItemId,
          type: nextType,
          name: parsed.data.name ?? existing.name,
          qty,
          unitPriceCents,
          lineTotalCents: lineTotal,
        },
      });

      await recalculateTotals(tx, order.id, session.user);
      return item;
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; itemId: string } },
) {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const order = await findWorkOrder(session.user, params.id);
  if (!order) {
    return NextResponse.json({ message: 'Orden no encontrada.' }, { status: 404 });
  }

  try {
    ensureItemEditable(session.user, order.status);

    await prisma.$transaction(async (tx) => {
      const item = await tx.workOrderItem.findFirst({
        where: {
          id: params.itemId,
          workOrderId: params.id,
          tenantId: session.user.tenantId,
        },
      });
      if (item?.catalogItemId) {
        await tx.inventoryMovement.create({
          data: {
            tenantId: session.user.tenantId,
            catalogItemId: item.catalogItemId,
            type: 'IN',
            qty: item.qty,
            referenceType: 'WORK_ORDER',
            referenceId: order.id,
            createdByUserId: session.user.id,
          },
        });
      }
      await tx.workOrderItem.deleteMany({
        where: {
          id: params.itemId,
          workOrderId: params.id,
          tenantId: session.user.tenantId,
        },
      });
      await recalculateTotals(tx, order.id, session.user);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}

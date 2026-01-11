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
import { WorkOrderItemCreateSchema } from '@/shared';

export const runtime = 'nodejs';

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{id: string}> },
) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }
  const user = session.user;
  const guard = requireSession(user);
  if (guard) {
    return guard;
  }

  try {
    const payload = await request.json();
    const parsed = WorkOrderItemCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
        { status: 400 },
      );
    }

    const order = await findWorkOrder(user, (await params).id);
    if (!order) {
      return NextResponse.json(
        { message: 'Orden no encontrada.' },
        { status: 404 },
      );
    }

    ensureItemEditable(user, order.status);
    if (parsed.data.catalogItemId && parsed.data.type !== 'PART') {
      return NextResponse.json(
        { message: 'Solo repuestos pueden usar catálogo.' },
        { status: 400 },
      );
    }
    const lineTotal = parsed.data.qty * parsed.data.unitPriceCents;
    if (lineTotal < 0) {
      return NextResponse.json({ message: 'Montos invalidos.' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      if (parsed.data.catalogItemId) {
        await ensureCatalogItem(user, parsed.data.catalogItemId);
        await ensureStockAvailable(
          tx,
          user,
          parsed.data.catalogItemId,
          parsed.data.qty,
        );
      }

      const item = await tx.workOrderItem.create({
        data: {
          tenantId: user.tenantId,
          workOrderId: order.id,
          catalogItemId: parsed.data.catalogItemId ?? null,
          type: parsed.data.type,
          name: parsed.data.name,
          qty: parsed.data.qty,
          unitPriceCents: parsed.data.unitPriceCents,
          lineTotalCents: lineTotal,
        },
      });

      if (parsed.data.catalogItemId) {
        await tx.inventoryMovement.create({
          data: {
            tenantId: user.tenantId,
            catalogItemId: parsed.data.catalogItemId,
            type: 'OUT',
            qty: -parsed.data.qty,
            referenceType: 'WORK_ORDER',
            referenceId: order.id,
            createdByUserId: user.id,
          },
        });
      }

      await recalculateTotals(tx, order.id, user);
      return item;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}

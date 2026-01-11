import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { InventoryAdjustSchema } from '@taller/shared';

type SessionUser = { id: string; role: string; tenantId: string | null };

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

export async function POST(request: Request) {
  const session = await auth();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const payload = await request.json();
  const parsed = InventoryAdjustSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const item = await prisma.catalogItem.findFirst({
    where: { id: parsed.data.catalogItemId, tenantId: session.user.tenantId },
  });
  if (!item) {
    return NextResponse.json({ message: 'Item no encontrado.' }, { status: 404 });
  }
  if (item.type !== 'PART') {
    return NextResponse.json(
      { message: 'Solo repuestos pueden ajustar stock.' },
      { status: 400 },
    );
  }
  if (parsed.data.qty === 0) {
    return NextResponse.json({ message: 'Cantidad inválida.' }, { status: 400 });
  }

  const current = await prisma.inventoryMovement.aggregate({
    where: { tenantId: session.user.tenantId, catalogItemId: item.id },
    _sum: { qty: true },
  });
  const currentQty = current._sum.qty ?? 0;
  const nextQty = currentQty + parsed.data.qty;
  if (nextQty < 0) {
    return NextResponse.json(
      { message: 'Stock insuficiente para ajuste.' },
      { status: 400 },
    );
  }

  const movement = await prisma.inventoryMovement.create({
    data: {
      tenantId: session.user.tenantId,
      catalogItemId: item.id,
      type: 'ADJUST',
      qty: parsed.data.qty,
      unitCostCents: parsed.data.unitCostCents ?? null,
      referenceType: 'MANUAL',
      referenceId: parsed.data.reason,
      createdByUserId: session.user.id,
    },
  });

  return NextResponse.json(movement, { status: 201 });
}

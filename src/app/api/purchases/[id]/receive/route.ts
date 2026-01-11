import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';

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

async function getPurchase(user: SessionUser, id: string) {
  return prisma.purchase.findFirst({
    where: { id, tenantId: user.tenantId },
  });
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const purchase = await getPurchase(session.user, params.id);
  if (!purchase) {
    return NextResponse.json({ message: 'Compra no encontrada.' }, { status: 404 });
  }
  if (purchase.status === 'RECEIVED') {
    return NextResponse.json(
      { message: 'Compra ya recibida.' },
      { status: 400 },
    );
  }

  const items = await prisma.purchaseItem.findMany({
    where: { purchaseId: purchase.id },
  });
  if (items.length === 0) {
    return NextResponse.json({ message: 'Compra sin items.' }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchase.update({
      where: { id: purchase.id },
      data: { status: 'RECEIVED' },
    });

    for (const item of items) {
      await tx.inventoryMovement.create({
        data: {
          tenantId: session.user.tenantId,
          catalogItemId: item.catalogItemId,
          type: 'IN',
          qty: item.qty,
          unitCostCents: item.unitCostCents,
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
          createdByUserId: session.user.id,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

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

async function recalculateTotal(tx: Prisma.TransactionClient, purchaseId: string) {
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

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; itemId: string } },
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
      { message: 'Compra recibida no es editable.' },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseItem.deleteMany({
      where: { id: params.itemId, purchaseId: params.id },
    });
    await recalculateTotal(tx, purchase.id);
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
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

export async function GET() {
  const session = await auth();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const items = await prisma.catalogItem.findMany({
    where: { tenantId: session.user.tenantId, type: 'PART' },
    orderBy: { name: 'asc' },
  });

  const movements = await prisma.inventoryMovement.groupBy({
    by: ['catalogItemId'],
    where: { tenantId: session.user.tenantId },
    _sum: { qty: true },
  });

  const movementMap = new Map<string, number>();
  for (const move of movements) {
    movementMap.set(move.catalogItemId, move._sum.qty ?? 0);
  }

  const rows = items.map((item) => ({
    ...item,
    qtyOnHand: movementMap.get(item.id) ?? 0,
  }));

  return NextResponse.json(rows);
}

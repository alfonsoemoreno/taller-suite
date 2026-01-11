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

export async function GET(
  _request: Request,
  { params }: { params: { catalogItemId: string } },
) {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const item = await prisma.catalogItem.findFirst({
    where: { id: params.catalogItemId, tenantId: session.user.tenantId },
  });
  if (!item) {
    return NextResponse.json({ message: 'Item no encontrado.' }, { status: 404 });
  }

  const movements = await prisma.inventoryMovement.findMany({
    where: { catalogItemId: params.catalogItemId, tenantId: session.user.tenantId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(movements);
}

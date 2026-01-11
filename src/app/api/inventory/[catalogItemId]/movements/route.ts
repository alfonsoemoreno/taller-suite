import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type SessionUser = { id: string; role: string; tenantId: string };

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
  { params }: { params: Promise<{catalogItemId: string}> },
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

  const item = await prisma.catalogItem.findFirst({
    where: { id: (await params).catalogItemId, tenantId: user.tenantId },
  });
  if (!item) {
    return NextResponse.json({ message: 'Item no encontrado.' }, { status: 404 });
  }

  const movements = await prisma.inventoryMovement.findMany({
    where: { catalogItemId: (await params).catalogItemId, tenantId: user.tenantId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(movements);
}

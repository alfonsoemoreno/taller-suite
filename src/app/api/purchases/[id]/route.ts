import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PurchaseUpdateSchema } from '@/shared';

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

async function getPurchase(user: SessionUser, id: string) {
  return prisma.purchase.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { supplier: true, items: { include: { catalogItem: true } } },
  });
}

export async function GET(
  _request: Request,
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

  const purchase = await getPurchase(user, (await params).id);
  if (!purchase) {
    return NextResponse.json({ message: 'Compra no encontrada.' }, { status: 404 });
  }

  return NextResponse.json(purchase);
}

export async function PATCH(
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

  const payload = await request.json();
  const parsed = PurchaseUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const purchase = await getPurchase(user, (await params).id);
  if (!purchase) {
    return NextResponse.json({ message: 'Compra no encontrada.' }, { status: 404 });
  }
  if (purchase.status === 'RECEIVED') {
    return NextResponse.json(
      { message: 'Compra recibida no es editable.' },
      { status: 400 },
    );
  }

  const updated = await prisma.purchase.update({
    where: { id: purchase.id },
    data: {
      status: parsed.data.status ?? purchase.status,
    },
    include: { supplier: true, items: { include: { catalogItem: true } } },
  });

  return NextResponse.json(updated);
}

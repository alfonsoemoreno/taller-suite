import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { findWorkOrder, type SessionUser } from '@/lib/work-orders';

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{id: string; noteId: string}> },
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

  const order = await findWorkOrder(user, (await params).id);
  if (!order) {
    return NextResponse.json({ message: 'Orden no encontrada.' }, { status: 404 });
  }

  await prisma.workOrderNote.deleteMany({
    where: {
      id: (await params).noteId,
      workOrderId: (await params).id,
      tenantId: user.tenantId,
    },
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { findWorkOrder, type SessionUser } from '@/lib/work-orders';

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
  { params }: { params: { id: string; noteId: string } },
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

  await prisma.workOrderNote.deleteMany({
    where: {
      id: params.noteId,
      workOrderId: params.id,
      tenantId: session.user.tenantId,
    },
  });

  return NextResponse.json({ ok: true });
}

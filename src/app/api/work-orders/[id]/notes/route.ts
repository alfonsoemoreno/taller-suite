import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { findWorkOrder, type SessionUser } from '@/lib/work-orders';
import { WorkOrderNoteCreateSchema } from '@/shared';

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
  { params }: { params: { id: string } },
) {
  const session = await auth();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const order = await findWorkOrder(session.user, params.id);
  if (!order) {
    return NextResponse.json({ message: 'Orden no encontrada.' }, { status: 404 });
  }

  const notes = await prisma.workOrderNote.findMany({
    where: { workOrderId: params.id, tenantId: session.user.tenantId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(notes);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const order = await findWorkOrder(session.user, params.id);
  if (!order) {
    return NextResponse.json({ message: 'Orden no encontrada.' }, { status: 404 });
  }

  const payload = await request.json();
  const parsed = WorkOrderNoteCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const note = await prisma.workOrderNote.create({
    data: {
      tenantId: session.user.tenantId,
      workOrderId: params.id,
      note: parsed.data.note,
      createdByUserId: session.user.id,
    },
  });

  return NextResponse.json(note, { status: 201 });
}

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { findWorkOrder, type SessionUser } from '@/lib/work-orders';
import { WorkOrderNoteCreateSchema } from '@/shared';

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

  const order = await findWorkOrder(user, (await params).id);
  if (!order) {
    return NextResponse.json({ message: 'Orden no encontrada.' }, { status: 404 });
  }

  const notes = await prisma.workOrderNote.findMany({
    where: { workOrderId: (await params).id, tenantId: user.tenantId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(notes);
}

export async function POST(
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

  const order = await findWorkOrder(user, (await params).id);
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
      tenantId: user.tenantId,
      workOrderId: (await params).id,
      note: parsed.data.note,
      createdByUserId: user.id,
    },
  });

  return NextResponse.json(note, { status: 201 });
}

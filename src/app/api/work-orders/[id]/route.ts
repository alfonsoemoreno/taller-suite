import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  ApiError,
  ensureCustomer,
  ensureVehicle,
  findWorkOrder,
  type SessionUser,
} from '@/lib/work-orders';
import { WorkOrderUpdateSchema } from '@/shared';

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
  { params }: { params: { id: string } },
) {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const order = await prisma.workOrder.findFirst({
    where: {
      id: params.id,
      tenantId: session.user.tenantId,
      ownerId: session.user.id,
    },
    include: {
      customer: true,
      vehicle: true,
      items: true,
    },
  });

  if (!order) {
    return NextResponse.json({ message: 'Orden no encontrada.' }, { status: 404 });
  }

  return NextResponse.json(order);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  try {
    const payload = await request.json();
    const parsed = WorkOrderUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
        { status: 400 },
      );
    }

    const order = await findWorkOrder(session.user, params.id);
    if (!order) {
      return NextResponse.json(
        { message: 'Orden no encontrada.' },
        { status: 404 },
      );
    }

    if (parsed.data.customerId && parsed.data.customerId !== order.customerId) {
      await ensureCustomer(session.user, parsed.data.customerId);
    }
    if (parsed.data.vehicleId) {
      await ensureVehicle(
        session.user,
        parsed.data.vehicleId,
        parsed.data.customerId ?? order.customerId,
      );
    }

    const updated = await prisma.workOrder.update({
      where: { id: order.id },
      data: {
        customerId: parsed.data.customerId,
        vehicleId: parsed.data.vehicleId || null,
        title: parsed.data.title === '' ? null : parsed.data.title,
        description: parsed.data.description === '' ? null : parsed.data.description,
        odometer: parsed.data.odometer ?? null,
        status: parsed.data.status,
      },
      include: {
        customer: true,
        vehicle: true,
        items: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
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

  if (order.status !== 'OPEN') {
    return NextResponse.json(
      { message: 'Solo puedes eliminar ordenes abiertas.' },
      { status: 400 },
    );
  }

  await prisma.workOrder.delete({ where: { id: order.id } });

  return NextResponse.json({ ok: true });
}

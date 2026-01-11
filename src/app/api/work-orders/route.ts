import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  ApiError,
  ensureCustomer,
  ensureVehicle,
  type SessionUser,
} from '@/lib/work-orders';
import {
  WorkOrderCreateSchema,
  WorkOrderStatusSchema,
} from '@/shared';

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

export async function GET(request: Request) {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? undefined;
  const customerId = searchParams.get('customerId') ?? undefined;
  const vehicleId = searchParams.get('vehicleId') ?? undefined;

  const parsedStatus = status
    ? WorkOrderStatusSchema.safeParse(status)
    : undefined;
  if (status && !parsedStatus?.success) {
    return NextResponse.json({ message: 'Estado invalido.' }, { status: 400 });
  }

  const orders = await prisma.workOrder.findMany({
    where: {
      tenantId: session.user.tenantId,
      ownerId: session.user.id,
      status: parsedStatus?.success ? parsedStatus.data : undefined,
      customerId,
      vehicleId,
    },
    include: {
      customer: true,
      vehicle: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  try {
    const payload = await request.json();
    const parsed = WorkOrderCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
        { status: 400 },
      );
    }

    await ensureCustomer(session.user, parsed.data.customerId);
    if (parsed.data.vehicleId) {
      await ensureVehicle(
        session.user,
        parsed.data.vehicleId,
        parsed.data.customerId,
      );
    }

    const order = await prisma.workOrder.create({
      data: {
        tenantId: session.user.tenantId,
        ownerId: session.user.id,
        customerId: parsed.data.customerId,
        vehicleId: parsed.data.vehicleId ?? null,
        title: parsed.data.title || null,
        description: parsed.data.description || null,
        odometer: parsed.data.odometer ?? null,
        status: parsed.data.status ?? 'OPEN',
      },
      include: {
        customer: true,
        vehicle: true,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}

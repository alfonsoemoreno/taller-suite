import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { VehicleCreateSchema, normalizePlate } from '@/shared';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }
  const user = session.user;
  if (!user.tenantId) {
    return NextResponse.json(
      { message: 'Tenant no configurado.' },
      { status: 400 },
    );
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id,
      tenantId: user.tenantId,
      ownerId: user.id,
    },
  });
  if (!customer) {
    return NextResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: {
      customerId: id,
      tenantId: user.tenantId,
      ownerId: user.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(vehicles);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }
  const user = session.user;
  if (!user.tenantId) {
    return NextResponse.json(
      { message: 'Tenant no configurado.' },
      { status: 400 },
    );
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id,
      tenantId: user.tenantId,
      ownerId: user.id,
    },
  });
  if (!customer) {
    return NextResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 });
  }

  const payload = await request.json();
  const parsed = VehicleCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const plate = normalizePlate(parsed.data.plate);
  const vehicle = await prisma.vehicle.create({
    data: {
      ...parsed.data,
      plate,
      tenantId: user.tenantId,
      ownerId: user.id,
      customerId: id,
    },
  });

  return NextResponse.json(vehicle, { status: 201 });
}

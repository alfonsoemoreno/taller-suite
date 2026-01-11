import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { VehicleCreateSchema, normalizePlate } from '@taller/shared';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { message: 'Tenant no configurado.' },
      { status: 400 },
    );
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: params.id,
      tenantId: session.user.tenantId,
      ownerId: session.user.id,
    },
  });
  if (!customer) {
    return NextResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: {
      customerId: params.id,
      tenantId: session.user.tenantId,
      ownerId: session.user.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(vehicles);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { message: 'Tenant no configurado.' },
      { status: 400 },
    );
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: params.id,
      tenantId: session.user.tenantId,
      ownerId: session.user.id,
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
      tenantId: session.user.tenantId,
      ownerId: session.user.id,
      customerId: params.id,
    },
  });

  return NextResponse.json(vehicle, { status: 201 });
}

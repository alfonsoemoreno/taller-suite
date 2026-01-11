import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { VehicleUpdateSchema, normalizePlate } from '@taller/shared';

export async function PATCH(
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

  const payload = await request.json();
  const parsed = VehicleUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: params.id,
      tenantId: session.user.tenantId,
      ownerId: session.user.id,
    },
  });
  if (!vehicle) {
    return NextResponse.json({ message: 'Vehiculo no encontrado.' }, { status: 404 });
  }

  const data = {
    ...parsed.data,
    plate: parsed.data.plate ? normalizePlate(parsed.data.plate) : undefined,
  };

  const updated = await prisma.vehicle.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
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

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: params.id,
      tenantId: session.user.tenantId,
      ownerId: session.user.id,
    },
  });
  if (!vehicle) {
    return NextResponse.json({ message: 'Vehiculo no encontrado.' }, { status: 404 });
  }

  await prisma.vehicle.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}

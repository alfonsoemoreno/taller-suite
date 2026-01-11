import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { VehicleUpdateSchema, normalizePlate } from '@/shared';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{id: string}> },
) {
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
      id: (await params).id,
      tenantId: user.tenantId,
      ownerId: user.id,
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
    where: { id: (await params).id },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{id: string}> },
) {
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

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: (await params).id,
      tenantId: user.tenantId,
      ownerId: user.id,
    },
  });
  if (!vehicle) {
    return NextResponse.json({ message: 'Vehiculo no encontrado.' }, { status: 404 });
  }

  await prisma.vehicle.delete({ where: { id: (await params).id } });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CustomerUpdateSchema } from '@/shared';

export const runtime = 'nodejs';

export async function GET(
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

  const customer = await prisma.customer.findFirst({
    where: {
      id: (await params).id,
      tenantId: user.tenantId,
      ownerId: user.id,
    },
  });
  if (!customer) {
    return NextResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 });
  }

  return NextResponse.json(customer);
}

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
  const parsed = CustomerUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const existing = await prisma.customer.findFirst({
    where: {
      id: (await params).id,
      tenantId: user.tenantId,
      ownerId: user.id,
    },
  });
  if (!existing) {
    return NextResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 });
  }

  const customer = await prisma.customer.update({
    where: { id: (await params).id },
    data: parsed.data,
  });

  return NextResponse.json(customer);
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

  const existing = await prisma.customer.findFirst({
    where: {
      id: (await params).id,
      tenantId: user.tenantId,
      ownerId: user.id,
    },
  });
  if (!existing) {
    return NextResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 });
  }

  await prisma.customer.delete({ where: { id: (await params).id } });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CustomerUpdateSchema } from '@/shared';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getAuthSession();
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

  return NextResponse.json(customer);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getAuthSession();
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
  const parsed = CustomerUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const existing = await prisma.customer.findFirst({
    where: {
      id: params.id,
      tenantId: session.user.tenantId,
      ownerId: session.user.id,
    },
  });
  if (!existing) {
    return NextResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 });
  }

  const customer = await prisma.customer.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json(customer);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { message: 'Tenant no configurado.' },
      { status: 400 },
    );
  }

  const existing = await prisma.customer.findFirst({
    where: {
      id: params.id,
      tenantId: session.user.tenantId,
      ownerId: session.user.id,
    },
  });
  if (!existing) {
    return NextResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 });
  }

  await prisma.customer.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CustomerCreateSchema } from '@/shared';

export const runtime = 'nodejs';

export async function GET() {
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

  const customers = await prisma.customer.findMany({
    where: {
      tenantId: user.tenantId,
      ownerId: user.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(customers);
}

export async function POST(request: Request) {
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
  const parsed = CustomerCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const customer = await prisma.customer.create({
    data: {
      ...parsed.data,
      tenantId: user.tenantId,
      ownerId: user.id,
    },
  });

  return NextResponse.json(customer, { status: 201 });
}

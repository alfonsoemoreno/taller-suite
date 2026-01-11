import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { SupplierCreateSchema } from '@/shared';

export const runtime = 'nodejs';

type SessionUser = { id: string; role: string; tenantId: string };

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

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }
  const user = session.user;
  const guard = requireSession(user);
  if (guard) {
    return guard;
  }

  const suppliers = await prisma.supplier.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(suppliers);
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }
  const user = session.user;
  const guard = requireSession(user);
  if (guard) {
    return guard;
  }

  const payload = await request.json();
  const parsed = SupplierCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const supplier = await prisma.supplier.create({
    data: {
      tenantId: user.tenantId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
    },
  });

  return NextResponse.json(supplier, { status: 201 });
}

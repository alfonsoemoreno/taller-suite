import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CatalogItemCreateSchema } from '@/shared';

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

  const items = await prisma.catalogItem.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(items);
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
  const parsed = CatalogItemCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const item = await prisma.catalogItem.create({
    data: {
      tenantId: user.tenantId,
      type: parsed.data.type,
      sku: parsed.data.sku || null,
      name: parsed.data.name,
      brand: parsed.data.brand || null,
      unit: parsed.data.unit,
      salePriceCents: parsed.data.salePriceCents,
      costCents: parsed.data.costCents,
      isActive: parsed.data.isActive ?? true,
    },
  });

  return NextResponse.json(item, { status: 201 });
}

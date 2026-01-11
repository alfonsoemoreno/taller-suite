import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CatalogItemUpdateSchema } from '@/shared';

export const runtime = 'nodejs';

type SessionUser = { id: string; role: string; tenantId: string | null };

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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const payload = await request.json();
  const parsed = CatalogItemUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const item = await prisma.catalogItem.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId },
  });
  if (!item) {
    return NextResponse.json({ message: 'Item no encontrado.' }, { status: 404 });
  }

  if (
    parsed.data.salePriceCents !== undefined &&
    parsed.data.salePriceCents < 0
  ) {
    return NextResponse.json({ message: 'Precio inválido.' }, { status: 400 });
  }
  if (parsed.data.costCents !== undefined && parsed.data.costCents < 0) {
    return NextResponse.json({ message: 'Costo inválido.' }, { status: 400 });
  }

  const updated = await prisma.catalogItem.update({
    where: { id: item.id },
    data: {
      type: parsed.data.type ?? item.type,
      sku: parsed.data.sku === '' ? null : (parsed.data.sku ?? item.sku),
      name: parsed.data.name ?? item.name,
      brand: parsed.data.brand === '' ? null : (parsed.data.brand ?? item.brand),
      unit: parsed.data.unit ?? item.unit,
      salePriceCents: parsed.data.salePriceCents ?? item.salePriceCents,
      costCents: parsed.data.costCents ?? item.costCents,
      isActive: parsed.data.isActive ?? item.isActive,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const item = await prisma.catalogItem.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId },
  });
  if (!item) {
    return NextResponse.json({ message: 'Item no encontrado.' }, { status: 404 });
  }

  const updated = await prisma.catalogItem.update({
    where: { id: item.id },
    data: { isActive: false },
  });

  return NextResponse.json(updated);
}

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { SupplierUpdateSchema } from '@/shared';

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
  const parsed = SupplierUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId },
  });
  if (!supplier) {
    return NextResponse.json(
      { message: 'Proveedor no encontrado.' },
      { status: 404 },
    );
  }

  const updated = await prisma.supplier.update({
    where: { id: supplier.id },
    data: {
      name: parsed.data.name ?? supplier.name,
      email: parsed.data.email === '' ? null : (parsed.data.email ?? supplier.email),
      phone: parsed.data.phone === '' ? null : (parsed.data.phone ?? supplier.phone),
      notes: parsed.data.notes === '' ? null : (parsed.data.notes ?? supplier.notes),
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

  const supplier = await prisma.supplier.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId },
  });
  if (!supplier) {
    return NextResponse.json(
      { message: 'Proveedor no encontrado.' },
      { status: 404 },
    );
  }

  await prisma.supplier.delete({ where: { id: supplier.id } });

  return NextResponse.json({ ok: true });
}

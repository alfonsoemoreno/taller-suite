import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PurchaseCreateSchema } from '@/shared';

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

async function ensureSupplier(user: SessionUser, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId: user.tenantId },
  });
  if (!supplier) {
    return NextResponse.json(
      { message: 'Proveedor no encontrado.' },
      { status: 404 },
    );
  }
  return null;
}

export async function GET() {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const purchases = await prisma.purchase.findMany({
    where: { tenantId: session.user.tenantId },
    include: { supplier: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(purchases);
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const payload = await request.json();
  const parsed = PurchaseCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const supplierGuard = await ensureSupplier(session.user, parsed.data.supplierId);
  if (supplierGuard) {
    return supplierGuard;
  }

  const purchase = await prisma.purchase.create({
    data: {
      tenantId: session.user.tenantId,
      supplierId: parsed.data.supplierId,
      status: 'DRAFT',
    },
  });

  return NextResponse.json(purchase, { status: 201 });
}

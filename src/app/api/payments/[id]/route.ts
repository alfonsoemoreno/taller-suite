import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PaymentStatusSchema } from '@/shared';

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{id: string}> },
) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }
  const user = session.user;
  const guard = requireSession(user);
  if (guard) {
    return guard;
  }

  if (user.role === 'STAFF') {
    return NextResponse.json({ message: 'Sin permisos.' }, { status: 403 });
  }

  const payment = await prisma.payment.findFirst({
    where: { id: (await params).id, tenantId: user.tenantId },
  });
  if (!payment) {
    return NextResponse.json({ message: 'Pago no encontrado.' }, { status: 404 });
  }

  const order = await prisma.workOrder.findFirst({
    where: { id: payment.workOrderId, tenantId: user.tenantId },
  });
  if (!order) {
    return NextResponse.json({ message: 'Orden no encontrada.' }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: payment.id } });

    const totals = await tx.payment.aggregate({
      where: { workOrderId: payment.workOrderId, tenantId: user.tenantId },
      _sum: { amountCents: true },
    });
    const paidTotalCents = totals._sum.amountCents ?? 0;

    const balanceCents = Math.max(order.totalCents - paidTotalCents, 0);
    const paymentStatus =
      paidTotalCents <= 0
        ? PaymentStatusSchema.enum.UNPAID
        : balanceCents === 0
          ? PaymentStatusSchema.enum.PAID
          : PaymentStatusSchema.enum.PARTIAL;

    await tx.workOrder.update({
      where: { id: order.id },
      data: {
        paidTotalCents,
        balanceCents,
        paymentStatus,
      },
    });
  });

  return NextResponse.json({ ok: true });
}

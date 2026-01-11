import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PaymentCreateSchema, PaymentStatusSchema } from '@/shared';
import { findWorkOrder, type SessionUser } from '@/lib/work-orders';

export const runtime = 'nodejs';

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

export async function GET(
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

  const order = await findWorkOrder(user, (await params).id);
  if (!order) {
    return NextResponse.json({ message: 'Orden no encontrada.' }, { status: 404 });
  }

  const payments = await prisma.payment.findMany({
    where: { workOrderId: (await params).id, tenantId: user.tenantId },
    orderBy: { paidAt: 'desc' },
  });

  return NextResponse.json(payments);
}

export async function POST(
  request: Request,
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

  const order = await findWorkOrder(user, (await params).id);
  if (!order) {
    return NextResponse.json({ message: 'Orden no encontrada.' }, { status: 404 });
  }

  const payload = await request.json();
  const parsed = PaymentCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  if (parsed.data.amountCents <= 0) {
    return NextResponse.json({ message: 'Monto inválido.' }, { status: 400 });
  }
  if (parsed.data.amountCents > order.balanceCents) {
    return NextResponse.json(
      { message: 'El pago excede el saldo pendiente.' },
      { status: 400 },
    );
  }

  const paidAt = new Date();

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        tenantId: user.tenantId,
        workOrderId: order.id,
        amountCents: parsed.data.amountCents,
        method: parsed.data.method,
        reference: parsed.data.reference || null,
        paidAt,
        createdByUserId: user.id,
      },
    });

    const totals = await tx.payment.aggregate({
      where: { workOrderId: order.id, tenantId: user.tenantId },
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

    await tx.workOrderEvent.create({
      data: {
        tenantId: user.tenantId,
        workOrderId: order.id,
        type: 'PAYMENT_ADDED',
        payload: {
          paymentId: created.id,
          amountCents: created.amountCents,
          method: created.method,
        },
        createdByUserId: user.id,
      },
    });

    return created;
  });

  return NextResponse.json(payment, { status: 201 });
}

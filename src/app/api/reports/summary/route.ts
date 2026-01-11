import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PaymentMethodSchema } from '@/shared';

export const runtime = 'nodejs';

type SessionUser = { id: string; role: string; tenantId: string };

type Summary = {
  range: { from: string; to: string };
  totals: {
    salesCents: number;
    averageTicketCents: number;
  };
  statusCounts: Array<{ status: string; count: number }>;
  salesByDay: Array<{ date: string; totalCents: number }>;
  salesByMethod: Array<{ method: string; totalCents: number }>;
};

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
  if (sessionUser.role === 'STAFF') {
    return NextResponse.json({ message: 'Sin permisos.' }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }
  const user = session.user;
  const guard = requireSession(user);
  if (guard) {
    return guard;
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;
  const method = searchParams.get('method') ?? undefined;

  try {
    const range = resolveRange(from, to);
    const { start, end } = dateRange(range.from, range.to);
    const parsedMethod = method
      ? PaymentMethodSchema.safeParse(method)
      : undefined;
    if (method && !parsedMethod?.success) {
      return NextResponse.json({ message: 'Método inválido.' }, { status: 400 });
    }

    const payments = await prisma.payment.findMany({
      where: {
        tenantId: user.tenantId,
        method: parsedMethod?.success ? parsedMethod.data : undefined,
        paidAt: {
          gte: start,
          lt: end,
        },
      },
      select: {
        amountCents: true,
        paidAt: true,
        method: true,
      },
    });

    const salesCents = payments.reduce(
      (acc, payment) => acc + payment.amountCents,
      0,
    );

    const orders = await prisma.workOrder.findMany({
      where: {
        tenantId: user.tenantId,
        createdAt: {
          gte: start,
          lt: end,
        },
        OR: [{ paymentStatus: 'PAID' }, { status: 'DONE' }],
      },
      select: {
        totalCents: true,
      },
    });

    const averageTicketCents =
      orders.length === 0
        ? 0
        : Math.round(
            orders.reduce((acc, order) => acc + order.totalCents, 0) /
              orders.length,
          );

    const groupedStatus = await prisma.workOrder.groupBy({
      by: ['status'],
      where: {
        tenantId: user.tenantId,
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      _count: { status: true },
    });

    const statusCounts = groupedStatus.map((row) => ({
      status: row.status,
      count: row._count.status,
    }));

    const salesByDay = groupPaymentsByDay(payments, range.from, range.to);
    const salesByMethod = groupPaymentsByMethod(payments);

    const summary: Summary = {
      range,
      totals: {
        salesCents,
        averageTicketCents,
      },
      statusCounts,
      salesByDay,
      salesByMethod,
    };

    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    throw error;
  }
}

function resolveRange(from?: string, to?: string) {
  const today = formatDate(new Date());
  if (from && !isDate(from)) {
    throw new Error('Fecha inválida');
  }
  if (to && !isDate(to)) {
    throw new Error('Fecha inválida');
  }
  if (from && to && from > to) {
    throw new Error('Rango inválido');
  }
  const end = to ?? today;
  const startDate =
    from ?? formatDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  return { from: startDate, to: end };
}

function dateRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T23:59:59.999Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function groupPaymentsByDay(
  payments: Array<{ amountCents: number; paidAt: Date }>,
  from: string,
  to: string,
) {
  const map = new Map<string, number>();
  const dates = dateRange(from, to);

  for (
    let day = new Date(dates.start.getTime());
    day < dates.end;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const key = formatDate(day);
    map.set(key, 0);
  }

  for (const payment of payments) {
    const key = formatDate(payment.paidAt);
    map.set(key, (map.get(key) ?? 0) + payment.amountCents);
  }

  return Array.from(map.entries()).map(([date, totalCents]) => ({
    date,
    totalCents,
  }));
}

function groupPaymentsByMethod(
  payments: Array<{ amountCents: number; method: string }>,
) {
  const map = new Map<string, number>();
  for (const payment of payments) {
    map.set(payment.method, (map.get(payment.method) ?? 0) + payment.amountCents);
  }
  return Array.from(map.entries()).map(([method, totalCents]) => ({
    method,
    totalCents,
  }));
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

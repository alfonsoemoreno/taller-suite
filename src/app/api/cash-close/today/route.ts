import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';

type SessionUser = { id: string; role: string; tenantId: string | null };

type Totals = {
  cashInCents: number;
  cardInCents: number;
  transferInCents: number;
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

export async function GET() {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const today = formatDate(new Date());
  const close = await prisma.cashClose.findFirst({
    where: { tenantId: session.user.tenantId, date: today },
  });
  const totals = await computeTotals(session.user, today);

  return NextResponse.json({ date: today, close, totals });
}

async function computeTotals(user: SessionUser, date: string): Promise<Totals> {
  const { start, end } = dateRange(date);
  const payments = await prisma.payment.findMany({
    where: {
      tenantId: user.tenantId,
      paidAt: {
        gte: start,
        lt: end,
      },
    },
    select: {
      amountCents: true,
      method: true,
    },
  });

  const totals: Totals = {
    cashInCents: 0,
    cardInCents: 0,
    transferInCents: 0,
  };

  for (const payment of payments) {
    if (payment.method === 'CASH') totals.cashInCents += payment.amountCents;
    if (payment.method === 'CARD') totals.cardInCents += payment.amountCents;
    if (payment.method === 'TRANSFER') {
      totals.transferInCents += payment.amountCents;
    }
  }

  return totals;
}

function dateRange(date: string) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

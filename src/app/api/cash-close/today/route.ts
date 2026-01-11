import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type SessionUser = { id: string; role: string; tenantId: string };

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
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }
  const user = session.user;
  const guard = requireSession(user);
  if (guard) {
    return guard;
  }
  if (!user.tenantId) {
    return NextResponse.json(
      { message: 'Tenant no configurado.' },
      { status: 400 },
    );
  }
  const tenantId = user.tenantId;

  const today = formatDate(new Date());
  const close = await prisma.cashClose.findFirst({
    where: { tenantId, date: today },
  });
  const totals = await computeTotals({ ...user, tenantId }, today);

  return NextResponse.json({ date: today, close, totals });
}

async function computeTotals(
  user: SessionUser & { tenantId: string },
  date: string,
): Promise<Totals> {
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

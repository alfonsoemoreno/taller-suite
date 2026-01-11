import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CashCloseCreateSchema } from '@/shared';

export const runtime = 'nodejs';

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

export async function GET(request: Request) {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;

  if ((from && !isDate(from)) || (to && !isDate(to))) {
    return NextResponse.json(
      { message: 'Rango de fechas inválido.' },
      { status: 400 },
    );
  }

  const closes = await prisma.cashClose.findMany({
    where: {
      tenantId: session.user.tenantId,
      date: {
        gte: from,
        lte: to,
      },
    },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(closes);
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  const guard = requireSession(session?.user as SessionUser | undefined);
  if (guard) {
    return guard;
  }

  const payload = await request.json();
  const parsed = CashCloseCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const date = parsed.data.date ?? formatDate(new Date());
  if (!isDate(date)) {
    return NextResponse.json({ message: 'Fecha inválida.' }, { status: 400 });
  }

  const existing = await prisma.cashClose.findFirst({
    where: { tenantId: session.user.tenantId, date },
  });
  if (existing) {
    return NextResponse.json(
      { message: 'Ya existe cierre para ese día.' },
      { status: 400 },
    );
  }

  const totals = await computeTotals(session.user, date);

  const close = await prisma.cashClose.create({
    data: {
      tenantId: session.user.tenantId,
      date,
      cashInCents: totals.cashInCents,
      cardInCents: totals.cardInCents,
      transferInCents: totals.transferInCents,
      notes: parsed.data.notes || null,
      createdByUserId: session.user.id,
    },
  });

  return NextResponse.json(close, { status: 201 });
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

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

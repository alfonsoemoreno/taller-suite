import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { CashCloseCreate } from '@taller/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';

type Totals = {
  cashInCents: number;
  cardInCents: number;
  transferInCents: number;
};

@Injectable()
export class CashCloseService {
  constructor(private readonly prisma: PrismaService) {}

  async getToday(user: AccessTokenPayload) {
    this.ensureCashAccess(user);
    const today = this.formatDate(new Date());
    const close = await this.prisma.cashClose.findFirst({
      where: { tenantId: user.tenantId, date: today },
    });
    const totals = await this.computeTotals(user, today);
    return { date: today, close, totals };
  }

  async list(user: AccessTokenPayload, from?: string, to?: string) {
    this.ensureCashAccess(user);
    if ((from && !this.isDate(from)) || (to && !this.isDate(to))) {
      throw new BadRequestException('Rango de fechas inválido');
    }
    return this.prisma.cashClose.findMany({
      where: {
        tenantId: user.tenantId,
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async create(user: AccessTokenPayload, data: CashCloseCreate) {
    this.ensureCashAccess(user);
    const date = data.date ?? this.formatDate(new Date());
    if (!this.isDate(date)) {
      throw new BadRequestException('Fecha inválida');
    }
    const existing = await this.prisma.cashClose.findFirst({
      where: { tenantId: user.tenantId, date },
    });
    if (existing) {
      throw new BadRequestException('Ya existe cierre para ese día');
    }
    const totals = await this.computeTotals(user, date);
    return this.prisma.cashClose.create({
      data: {
        tenantId: user.tenantId,
        date,
        cashInCents: totals.cashInCents,
        cardInCents: totals.cardInCents,
        transferInCents: totals.transferInCents,
        notes: data.notes || null,
        createdByUserId: user.sub,
      },
    });
  }

  private async computeTotals(
    user: AccessTokenPayload,
    date: string,
  ): Promise<Totals> {
    const { start, end } = this.dateRange(date);
    const payments = await this.prisma.payment.findMany({
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
      if (payment.method === 'TRANSFER')
        totals.transferInCents += payment.amountCents;
    }

    return totals;
  }

  private dateRange(date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  }

  private formatDate(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private isDate(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  private ensureCashAccess(user: AccessTokenPayload) {
    if (user.role === 'STAFF') {
      throw new ForbiddenException('Sin permisos');
    }
  }
}

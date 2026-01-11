import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';
import { PaymentMethodSchema } from '@taller/shared';

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

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    user: AccessTokenPayload,
    from?: string,
    to?: string,
    method?: string,
  ): Promise<Summary> {
    this.ensureReportsAccess(user);
    const range = this.resolveRange(from, to);
    const { start, end } = this.dateRange(range.from, range.to);
    const parsedMethod = method ? PaymentMethodSchema.safeParse(method) : undefined;
    if (method && !parsedMethod?.success) {
      throw new BadRequestException('Método inválido');
    }

    const payments = await this.prisma.payment.findMany({
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

    const salesCents = payments.reduce((acc, payment) => acc + payment.amountCents, 0);

    const orders = await this.prisma.workOrder.findMany({
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
            orders.reduce((acc, order) => acc + order.totalCents, 0) / orders.length,
          );

    const groupedStatus = await this.prisma.workOrder.groupBy({
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

    const salesByDay = this.groupPaymentsByDay(payments, range.from, range.to);
    const salesByMethod = this.groupPaymentsByMethod(payments);

    return {
      range,
      totals: {
        salesCents,
        averageTicketCents,
      },
      statusCounts,
      salesByDay,
      salesByMethod,
    };
  }

  private resolveRange(from?: string, to?: string) {
    const today = this.formatDate(new Date());
    if (from && !this.isDate(from)) {
      throw new BadRequestException('Fecha inválida');
    }
    if (to && !this.isDate(to)) {
      throw new BadRequestException('Fecha inválida');
    }
    if (from && to && from > to) {
      throw new BadRequestException('Rango inválido');
    }
    const end = to ?? today;
    const startDate = from ?? this.formatDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
    return { from: startDate, to: end };
  }

  private dateRange(from: string, to: string) {
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T23:59:59.999Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  private groupPaymentsByDay(
    payments: Array<{ amountCents: number; paidAt: Date }>,
    from: string,
    to: string,
  ) {
    const map = new Map<string, number>();
    const dates = this.dateRange(from, to);

    for (
      let day = new Date(dates.start.getTime());
      day < dates.end;
      day.setUTCDate(day.getUTCDate() + 1)
    ) {
      const key = this.formatDate(day);
      map.set(key, 0);
    }

    for (const payment of payments) {
      const key = this.formatDate(payment.paidAt);
      map.set(key, (map.get(key) ?? 0) + payment.amountCents);
    }

    return Array.from(map.entries()).map(([date, totalCents]) => ({
      date,
      totalCents,
    }));
  }

  private groupPaymentsByMethod(
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

  private formatDate(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private isDate(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  private ensureReportsAccess(user: AccessTokenPayload) {
    if (user.role === 'STAFF') {
      throw new ForbiddenException('Sin permisos');
    }
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaymentCreate } from '@taller/shared';
import { PaymentStatusSchema } from '@taller/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByWorkOrder(user: AccessTokenPayload, workOrderId: string) {
    await this.getWorkOrder(user, workOrderId);
    return this.prisma.payment.findMany({
      where: {
        workOrderId,
        tenantId: user.tenantId,
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  async create(
    user: AccessTokenPayload,
    workOrderId: string,
    data: PaymentCreate,
  ) {
    const order = await this.getWorkOrder(user, workOrderId);
    if (data.amountCents <= 0) {
      throw new BadRequestException('Monto inválido');
    }
    if (data.amountCents > order.balanceCents) {
      throw new BadRequestException('El pago excede el saldo pendiente');
    }

    const paidAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId: user.tenantId,
          workOrderId: order.id,
          amountCents: data.amountCents,
          method: data.method,
          reference: data.reference || null,
          paidAt,
          createdByUserId: user.sub,
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
            paymentId: payment.id,
            amountCents: payment.amountCents,
            method: payment.method,
          },
          createdByUserId: user.sub,
        },
      });

      return payment;
    });
  }

  async remove(user: AccessTokenPayload, paymentId: string) {
    if (user.role === 'STAFF') {
      throw new ForbiddenException('Sin permisos');
    }
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId: user.tenantId },
    });
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: payment.id } });

      const totals = await tx.payment.aggregate({
        where: { workOrderId: payment.workOrderId, tenantId: user.tenantId },
        _sum: { amountCents: true },
      });
      const paidTotalCents = totals._sum.amountCents ?? 0;

      const order = await tx.workOrder.findFirst({
        where: { id: payment.workOrderId, tenantId: user.tenantId },
      });
      if (!order) {
        throw new NotFoundException('Orden no encontrada');
      }

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

      return { ok: true };
    });
  }

  private async getWorkOrder(user: AccessTokenPayload, id: string) {
    const order = await this.prisma.workOrder.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ownerId: user.sub,
      },
    });
    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }
    return order;
  }
}

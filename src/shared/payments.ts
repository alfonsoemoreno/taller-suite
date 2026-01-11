import { z } from 'zod';

export const PaymentMethodSchema = z.enum(['CASH', 'CARD', 'TRANSFER']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentStatusSchema = z.enum(['UNPAID', 'PARTIAL', 'PAID']);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const PaymentCreateSchema = z.object({
  amountCents: z.number().int().min(1),
  method: PaymentMethodSchema,
  reference: z.string().optional().or(z.literal('')),
});
export type PaymentCreate = z.infer<typeof PaymentCreateSchema>;

export const CashCloseCreateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().optional().or(z.literal('')),
});
export type CashCloseCreate = z.infer<typeof CashCloseCreateSchema>;

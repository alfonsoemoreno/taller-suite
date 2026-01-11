import { z } from 'zod';

export const PurchaseStatusSchema = z.enum([
  'DRAFT',
  'ORDERED',
  'RECEIVED',
  'CANCELED',
]);
export type PurchaseStatus = z.infer<typeof PurchaseStatusSchema>;

export const PurchaseCreateSchema = z.object({
  supplierId: z.string().min(1),
});
export type PurchaseCreate = z.infer<typeof PurchaseCreateSchema>;

export const PurchaseUpdateSchema = z.object({
  status: PurchaseStatusSchema.optional(),
});
export type PurchaseUpdate = z.infer<typeof PurchaseUpdateSchema>;

export const PurchaseItemCreateSchema = z.object({
  catalogItemId: z.string().min(1),
  qty: z.number().int().min(1),
  unitCostCents: z.number().int().min(0),
});
export type PurchaseItemCreate = z.infer<typeof PurchaseItemCreateSchema>;

export const PurchaseReceiveSchema = z.object({
  notes: z.string().optional().or(z.literal('')),
});
export type PurchaseReceive = z.infer<typeof PurchaseReceiveSchema>;

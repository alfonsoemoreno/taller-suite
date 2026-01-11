import { z } from 'zod';

export const InventoryAdjustSchema = z.object({
  catalogItemId: z.string().min(1),
  qty: z.number().int(),
  unitCostCents: z.number().int().min(0).optional(),
  reason: z.string().min(1),
});
export type InventoryAdjust = z.infer<typeof InventoryAdjustSchema>;

import { z } from 'zod';

export const CatalogItemTypeSchema = z.enum(['PART', 'SERVICE']);
export type CatalogItemType = z.infer<typeof CatalogItemTypeSchema>;

export const CatalogItemCreateSchema = z.object({
  type: CatalogItemTypeSchema,
  sku: z.string().optional().or(z.literal('')),
  name: z.string().min(1),
  brand: z.string().optional().or(z.literal('')),
  unit: z.string().min(1),
  salePriceCents: z.number().int().min(0),
  costCents: z.number().int().min(0),
  isActive: z.boolean().optional(),
});
export type CatalogItemCreate = z.infer<typeof CatalogItemCreateSchema>;

export const CatalogItemUpdateSchema = CatalogItemCreateSchema.partial();
export type CatalogItemUpdate = z.infer<typeof CatalogItemUpdateSchema>;

import { z } from 'zod';

export const SupplierCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});
export type SupplierCreate = z.infer<typeof SupplierCreateSchema>;

export const SupplierUpdateSchema = SupplierCreateSchema.partial();
export type SupplierUpdate = z.infer<typeof SupplierUpdateSchema>;

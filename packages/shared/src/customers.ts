import { z } from 'zod';

export const CustomerBaseSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  email: z.string().email('Email invalido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export const CustomerCreateSchema = CustomerBaseSchema;
export const CustomerUpdateSchema = CustomerBaseSchema.partial();

export type CustomerCreate = z.infer<typeof CustomerCreateSchema>;
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;

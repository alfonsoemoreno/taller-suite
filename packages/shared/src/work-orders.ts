import { z } from 'zod';

export const WorkOrderStatusSchema = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'DONE',
  'CANCELED',
]);
export type WorkOrderStatus = z.infer<typeof WorkOrderStatusSchema>;

export const WorkOrderItemTypeSchema = z.enum(['LABOR', 'PART']);
export type WorkOrderItemType = z.infer<typeof WorkOrderItemTypeSchema>;

export const WorkOrderCreateSchema = z.object({
  customerId: z.string().min(1),
  vehicleId: z.string().min(1).optional(),
  title: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  odometer: z.number().int().min(0).optional(),
  status: WorkOrderStatusSchema.optional(),
});
export type WorkOrderCreate = z.infer<typeof WorkOrderCreateSchema>;

export const WorkOrderUpdateSchema = z.object({
  customerId: z.string().min(1).optional(),
  vehicleId: z.string().min(1).optional().or(z.literal('')),
  title: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  odometer: z.number().int().min(0).optional(),
  status: WorkOrderStatusSchema.optional(),
});
export type WorkOrderUpdate = z.infer<typeof WorkOrderUpdateSchema>;

export const WorkOrderItemCreateSchema = z.object({
  type: WorkOrderItemTypeSchema,
  name: z.string().min(1),
  qty: z.number().int().min(1),
  unitPriceCents: z.number().int().min(0),
});
export type WorkOrderItemCreate = z.infer<typeof WorkOrderItemCreateSchema>;

export const WorkOrderItemUpdateSchema = WorkOrderItemCreateSchema.partial();
export type WorkOrderItemUpdate = z.infer<typeof WorkOrderItemUpdateSchema>;

export const WorkOrderNoteCreateSchema = z.object({
  note: z.string().min(1),
});
export type WorkOrderNoteCreate = z.infer<typeof WorkOrderNoteCreateSchema>;

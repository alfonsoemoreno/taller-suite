import { z } from 'zod';
import { isValidChileanPlate } from './plate.js';

const MAX_YEAR = new Date().getFullYear() + 1;
const YearSchema = z
  .number()
  .int()
  .min(1900, 'Ano invalido')
  .max(MAX_YEAR, 'Ano invalido');

const DoorsSchema = z
  .number()
  .int()
  .min(1, 'Numero de puertas invalido')
  .max(10, 'Numero de puertas invalido');

const MileageSchema = z
  .number()
  .int()
  .min(0, 'Kilometraje invalido')
  .max(2_000_000, 'Kilometraje invalido');

export const VehicleBaseSchema = z.object({
  plate: z
    .string()
    .min(1, 'Patente requerida')
    .refine((value) => isValidChileanPlate(value), 'Patente invalida'),
  brand: z.string().optional().or(z.literal('')),
  model: z.string().optional().or(z.literal('')),
  year: YearSchema.optional(),
  fuel: z.string().optional().or(z.literal('')),
  transmission: z.string().optional().or(z.literal('')),
  typeVehicle: z.string().optional().or(z.literal('')),
  doors: DoorsSchema.optional(),
  version: z.string().optional().or(z.literal('')),
  mileage: MileageSchema.optional(),
  vin: z.string().optional().or(z.literal('')),
  engineNo: z.string().optional().or(z.literal('')),
  color: z.string().optional().or(z.literal('')),
});

export const VehicleCreateSchema = VehicleBaseSchema;
export const VehicleUpdateSchema = VehicleBaseSchema.partial();

export type VehicleCreate = z.infer<typeof VehicleCreateSchema>;
export type VehicleUpdate = z.infer<typeof VehicleUpdateSchema>;

export const VehicleLookupRequestSchema = z.object({
  plate: z.string().min(1, 'Patente requerida'),
});
export type VehicleLookupRequest = z.infer<typeof VehicleLookupRequestSchema>;

import { z } from 'zod';
import { UserRoleSchema } from './auth.js';

export const UserCreateSchema = z.object({
  email: z.string().email(),
  role: UserRoleSchema,
  password: z.string().min(6),
});
export type UserCreate = z.infer<typeof UserCreateSchema>;

export const UserUpdateSchema = z.object({
  role: UserRoleSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UserUpdate = z.infer<typeof UserUpdateSchema>;

export const UserResetPasswordSchema = z.object({
  password: z.string().min(6),
});
export type UserResetPassword = z.infer<typeof UserResetPasswordSchema>;

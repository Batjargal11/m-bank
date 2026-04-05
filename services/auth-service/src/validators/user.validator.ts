import { z } from 'zod';
import { UserRole } from '@m-bank/shared-types';

export const createUserSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(1, 'Full name is required'),
  role: z.nativeEnum(UserRole, { errorMap: () => ({ message: 'Invalid role' }) }),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  full_name: z.string().min(1).optional(),
  role: z.nativeEnum(UserRole).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

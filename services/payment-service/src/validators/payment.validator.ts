import { z } from 'zod';
import { PaymentStatus } from '@m-bank/shared-types';

export const createPaymentSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  payer_account: z.string().min(1, 'Payer account is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.string().length(3, 'Currency must be a 3-letter code').default('MNT'),
});

export const paymentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(PaymentStatus).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const rejectPaymentSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(1000),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentQueryInput = z.infer<typeof paymentQuerySchema>;
export type RejectPaymentInput = z.infer<typeof rejectPaymentSchema>;

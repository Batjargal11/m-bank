import { z } from 'zod';
import { InvoiceStatus } from '@m-bank/shared-types';

const invoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit_price: z.number().positive('Unit price must be greater than 0'),
  tax_amount: z.number().min(0, 'Tax amount must be non-negative'),
});

export const createInvoiceSchema = z.object({
  invoice_no: z.string().min(1).max(50),
  receiver_org_id: z.string().uuid('Invalid receiver organization ID'),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Issue date must be YYYY-MM-DD format'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD format'),
  currency: z.string().length(3, 'Currency must be a 3-letter code').default('MNT'),
  vat_amount: z.number().min(0, 'VAT amount must be non-negative'),
  notes: z.string().max(2000).optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
});

export const updateInvoiceSchema = z.object({
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD format').optional(),
  currency: z.string().length(3, 'Currency must be a 3-letter code').optional(),
  vat_amount: z.number().min(0, 'VAT amount must be non-negative').optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required').optional(),
});

export const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(InvoiceStatus).optional(),
  direction: z.enum(['sent', 'received']).default('sent'),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const cancelRequestSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(1000),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceQueryInput = z.infer<typeof invoiceQuerySchema>;

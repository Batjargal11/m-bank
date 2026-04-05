export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  VERIFIED = 'VERIFIED',
  SENT = 'SENT',
  RECEIVED = 'RECEIVED',
  VIEWED = 'VIEWED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}

export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.VERIFIED, InvoiceStatus.CANCELLED],
  [InvoiceStatus.VERIFIED]: [InvoiceStatus.SENT],
  [InvoiceStatus.SENT]: [InvoiceStatus.RECEIVED, InvoiceStatus.CANCEL_REQUESTED],
  [InvoiceStatus.RECEIVED]: [InvoiceStatus.VIEWED, InvoiceStatus.CANCEL_REQUESTED],
  [InvoiceStatus.VIEWED]: [InvoiceStatus.PAYMENT_PENDING, InvoiceStatus.CANCEL_REQUESTED],
  [InvoiceStatus.PAYMENT_PENDING]: [InvoiceStatus.PAYMENT_PROCESSING],
  [InvoiceStatus.PAYMENT_PROCESSING]: [InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.FAILED],
  [InvoiceStatus.PARTIALLY_PAID]: [InvoiceStatus.PAYMENT_PENDING, InvoiceStatus.PAID, InvoiceStatus.CANCEL_REQUESTED],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.CANCEL_REQUESTED]: [InvoiceStatus.CANCELLED, InvoiceStatus.RECEIVED, InvoiceStatus.VIEWED],
  [InvoiceStatus.CANCELLED]: [],
  [InvoiceStatus.EXPIRED]: [],
  [InvoiceStatus.FAILED]: [InvoiceStatus.PAYMENT_PENDING],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return INVOICE_STATUS_TRANSITIONS[from].includes(to);
}

export interface Invoice {
  invoice_id: string;
  invoice_no: string;
  sender_org_id: string;
  receiver_org_id: string;
  sender_org_name: string;
  receiver_org_name: string;
  issue_date: string;
  due_date: string;
  currency: string;
  total_amount: number;
  vat_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: InvoiceStatus;
  external_einvoice_ref: string | null;
  notes: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  item_id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_amount: number;
  total_price: number;
  sort_order: number;
}

export interface CreateInvoiceDto {
  invoice_no: string;
  receiver_org_id: string;
  issue_date: string;
  due_date: string;
  currency: string;
  vat_amount: number;
  notes?: string;
  items: CreateInvoiceItemDto[];
}

export interface CreateInvoiceItemDto {
  description: string;
  quantity: number;
  unit_price: number;
  tax_amount: number;
}

export interface UpdateInvoiceDto {
  due_date?: string;
  currency?: string;
  vat_amount?: number;
  notes?: string;
  items?: CreateInvoiceItemDto[];
}

export interface InvoiceStatusHistory {
  id: string;
  invoice_id: string;
  from_status: InvoiceStatus | null;
  to_status: InvoiceStatus;
  changed_by: string;
  reason: string | null;
  created_at: string;
}

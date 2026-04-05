export type EinvoiceStatus = 'REGISTERED' | 'ACTIVE' | 'CANCELLED';

export interface EinvoiceRecord {
  readonly einvoice_ref: string;
  readonly invoice_no: string;
  readonly sender_name: string;
  readonly sender_tin: string;
  readonly receiver_name: string;
  readonly receiver_tin: string;
  readonly amount: number;
  readonly currency: string;
  readonly description: string;
  status: EinvoiceStatus;
  readonly registered_at: string;
  cancelled_at: string | null;
}

// In-memory e-invoice registry (starts empty)
export const invoiceRegistry: Map<string, EinvoiceRecord> = new Map();

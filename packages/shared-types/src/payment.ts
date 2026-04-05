export enum PaymentStatus {
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  PAID = 'PAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
}

export interface Payment {
  payment_id: string;
  invoice_id: string;
  invoice_no: string;
  payer_org_id: string;
  payer_account: string;
  beneficiary_org_id: string;
  beneficiary_account: string;
  amount: number;
  currency: string;
  payment_status: PaymentStatus;
  finacle_txn_ref: string | null;
  initiated_by: string;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentDto {
  invoice_id: string;
  payer_account: string;
  amount: number;
  currency: string;
}

export interface ApprovePaymentDto {
  approved_by: string;
}

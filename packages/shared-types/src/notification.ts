export enum NotificationType {
  INVOICE_RECEIVED = 'INVOICE_RECEIVED',
  INVOICE_VIEWED = 'INVOICE_VIEWED',
  INVOICE_CANCELLED = 'INVOICE_CANCELLED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_APPROVED = 'PAYMENT_APPROVED',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export interface Notification {
  id: string;
  org_id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

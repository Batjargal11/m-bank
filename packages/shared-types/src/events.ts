import { InvoiceStatus } from './invoice';
import { PaymentStatus } from './payment';

export enum EventType {
  INVOICE_CREATED = 'invoice.created',
  INVOICE_UPDATED = 'invoice.updated',
  INVOICE_SENT = 'invoice.sent',
  INVOICE_STATUS_CHANGED = 'invoice.status-changed',
  PAYMENT_INITIATED = 'payment.initiated',
  PAYMENT_STATUS_CHANGED = 'payment.status-changed',
  FINACLE_RESULT = 'integration.finacle-result',
  EINVOICE_RESULT = 'integration.einvoice-result',
  AUDIT_LOG = 'audit.log',
  NOTIFICATION_SEND = 'notification.send',
}

export const QUEUE_NAMES = {
  INVOICE_STATUS_CHANGED: 'invoice.status-changed',
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_STATUS_CHANGED: 'payment.status-changed',
  FINACLE_RESULT: 'integration.finacle-result',
  EINVOICE_RESULT: 'integration.einvoice-result',
  AUDIT_LOG: 'audit.log',
  NOTIFICATION_SEND: 'notification.send',
  INTEGRATION_RETRY: 'integration.retry',
} as const;

export interface BaseEvent {
  eventId: string;
  eventType: EventType;
  correlationId: string;
  timestamp: string;
  source: string;
}

export interface InvoiceStatusChangedEvent extends BaseEvent {
  eventType: EventType.INVOICE_STATUS_CHANGED;
  payload: {
    invoiceId: string;
    invoiceNo: string;
    fromStatus: InvoiceStatus | null;
    toStatus: InvoiceStatus;
    senderOrgId: string;
    receiverOrgId: string;
    changedBy: string;
    amount: number;
    currency: string;
  };
}

export interface PaymentInitiatedEvent extends BaseEvent {
  eventType: EventType.PAYMENT_INITIATED;
  payload: {
    paymentId: string;
    invoiceId: string;
    invoiceNo: string;
    payerAccount: string;
    beneficiaryAccount: string;
    amount: number;
    currency: string;
  };
}

export interface PaymentStatusChangedEvent extends BaseEvent {
  eventType: EventType.PAYMENT_STATUS_CHANGED;
  payload: {
    paymentId: string;
    invoiceId: string;
    invoiceNo: string;
    fromStatus: PaymentStatus | null;
    toStatus: PaymentStatus;
    amount: number;
    currency: string;
    finacleTxnRef: string | null;
    payerOrgId: string;
    beneficiaryOrgId: string;
  };
}

export interface FinacleResultEvent extends BaseEvent {
  eventType: EventType.FINACLE_RESULT;
  payload: {
    paymentId: string;
    success: boolean;
    txnRef: string | null;
    errorMessage: string | null;
  };
}

export interface EinvoiceResultEvent extends BaseEvent {
  eventType: EventType.EINVOICE_RESULT;
  payload: {
    invoiceId: string;
    success: boolean;
    einvoiceRef: string | null;
    errorMessage: string | null;
  };
}

export type DomainEvent =
  | InvoiceStatusChangedEvent
  | PaymentInitiatedEvent
  | PaymentStatusChangedEvent
  | FinacleResultEvent
  | EinvoiceResultEvent;

import { invoiceRegistry, EinvoiceRecord, EinvoiceStatus } from '../data/seed';

let sequenceCounter = 0;

function generateEinvoiceRef(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  sequenceCounter++;
  const seq = String(sequenceCounter).padStart(4, '0');
  return `EINV-${dateStr}-${seq}`;
}

export interface RegisterInvoiceData {
  invoice_no: string;
  sender_name: string;
  sender_tin: string;
  receiver_name: string;
  receiver_tin: string;
  amount: number;
  currency: string;
  description: string;
}

export interface RegisterResult {
  einvoice_ref: string;
  status: EinvoiceStatus;
  registered_at: string;
}

export function registerInvoice(data: RegisterInvoiceData): RegisterResult {
  const einvoiceRef = generateEinvoiceRef();
  const registeredAt = new Date().toISOString();

  const record: EinvoiceRecord = {
    einvoice_ref: einvoiceRef,
    invoice_no: data.invoice_no,
    sender_name: data.sender_name,
    sender_tin: data.sender_tin,
    receiver_name: data.receiver_name,
    receiver_tin: data.receiver_tin,
    amount: data.amount,
    currency: data.currency,
    description: data.description,
    status: 'REGISTERED',
    registered_at: registeredAt,
    cancelled_at: null,
  };

  invoiceRegistry.set(einvoiceRef, record);

  return {
    einvoice_ref: einvoiceRef,
    status: 'REGISTERED',
    registered_at: registeredAt,
  };
}

export function getInvoice(ref: string): EinvoiceRecord | null {
  return invoiceRegistry.get(ref) || null;
}

export function cancelInvoice(ref: string): EinvoiceRecord | null {
  const record = invoiceRegistry.get(ref);

  if (!record) {
    return null;
  }

  if (record.status === 'CANCELLED') {
    return record;
  }

  // Mutating in-memory mock state
  record.status = 'CANCELLED';
  record.cancelled_at = new Date().toISOString();

  return record;
}

export function getInvoiceStatus(ref: string): { einvoice_ref: string; status: EinvoiceStatus } | null {
  const record = invoiceRegistry.get(ref);

  if (!record) {
    return null;
  }

  return {
    einvoice_ref: record.einvoice_ref,
    status: record.status,
  };
}

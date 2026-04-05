import { v4 as uuidv4 } from 'uuid';
import {
  Invoice,
  InvoiceStatus,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceStatusHistory,
  InvoiceStatusChangedEvent,
  EventType,
} from '@m-bank/shared-types';
import {
  NotFoundError,
  ForbiddenError,
  AppError,
  createLogger,
  parsePagination,
  buildPaginationMeta,
  PaginationParams,
  getCorrelationId,
} from '@m-bank/shared-utils';
import * as invoiceRepo from '../repositories/invoice.repository';
import { validateTransition } from './invoice-status.service';
import { publishInvoiceStatusChanged, publishAuditLog } from '../events/publishers';
import { config } from '../config';

const logger = createLogger('invoice-service');

function verifyOrgAccess(invoice: Invoice, orgId: string): void {
  if (invoice.sender_org_id !== orgId && invoice.receiver_org_id !== orgId) {
    throw new ForbiddenError('You do not have access to this invoice');
  }
}

async function fetchOrgFromAuthService(orgId: string): Promise<{ org_id: string; name: string }> {
  const url = `${config.authServiceUrl}/internal/orgs/${orgId}`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new NotFoundError('Organization', orgId);
    }
    throw new AppError(
      `Failed to fetch organization ${orgId} from auth service`,
      502,
      'EXTERNAL_SERVICE_ERROR',
    );
  }

  const body = await response.json() as { success: boolean; data: { org_id: string; name: string } };
  return body.data;
}

async function publishStatusChangeEvent(
  invoice: Invoice,
  fromStatus: InvoiceStatus | null,
  toStatus: InvoiceStatus,
  changedBy: string,
  correlationId: string,
): Promise<void> {
  const event: InvoiceStatusChangedEvent = {
    eventId: uuidv4(),
    eventType: EventType.INVOICE_STATUS_CHANGED,
    correlationId,
    timestamp: new Date().toISOString(),
    source: 'invoice-service',
    payload: {
      invoiceId: invoice.invoice_id,
      invoiceNo: invoice.invoice_no,
      fromStatus,
      toStatus,
      senderOrgId: invoice.sender_org_id,
      receiverOrgId: invoice.receiver_org_id,
      changedBy,
      amount: Number(invoice.total_amount),
      currency: invoice.currency,
    },
  };

  await publishInvoiceStatusChanged(event);
}

export async function getInvoices(
  orgId: string,
  filters: {
    direction: 'sent' | 'received';
    status?: InvoiceStatus;
    dateFrom?: string;
    dateTo?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
  },
  paginationQuery: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
): Promise<{
  invoices: Invoice[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}> {
  const pagination = parsePagination(paginationQuery);
  const { invoices, total } = await invoiceRepo.findAll(
    { orgId, ...filters },
    pagination,
  );

  const page = Math.max(1, paginationQuery.page || 1);
  const limit = Math.min(100, Math.max(1, paginationQuery.limit || 20));
  const meta = buildPaginationMeta(total, page, limit);

  return { invoices, meta };
}

export async function getInvoiceById(
  id: string,
  orgId: string,
): Promise<invoiceRepo.InvoiceWithItems> {
  const invoice = await invoiceRepo.findById(id);
  if (!invoice) {
    throw new NotFoundError('Invoice', id);
  }

  verifyOrgAccess(invoice, orgId);
  return invoice;
}

export async function createInvoice(
  dto: CreateInvoiceDto,
  userId: string,
  orgId: string,
  orgName: string,
  correlationId: string,
): Promise<invoiceRepo.InvoiceWithItems> {
  const receiverOrg = await fetchOrgFromAuthService(dto.receiver_org_id);

  const invoice = await invoiceRepo.create(
    {
      invoice_no: dto.invoice_no,
      sender_org_id: orgId,
      receiver_org_id: dto.receiver_org_id,
      sender_org_name: orgName,
      receiver_org_name: receiverOrg.name,
      issue_date: dto.issue_date,
      due_date: dto.due_date,
      currency: dto.currency,
      vat_amount: dto.vat_amount,
      notes: dto.notes,
      created_by: userId,
    },
    dto.items,
  );

  await publishAuditLog({
    eventId: uuidv4(),
    correlationId,
    action: 'INVOICE_CREATED',
    entityType: 'invoice',
    entityId: invoice.invoice_id,
    userId,
    orgId,
    details: { invoiceNo: invoice.invoice_no },
    timestamp: new Date().toISOString(),
  });

  return invoice;
}

export async function updateInvoice(
  id: string,
  dto: UpdateInvoiceDto,
  userId: string,
  orgId: string,
): Promise<invoiceRepo.InvoiceWithItems> {
  const existing = await invoiceRepo.findById(id);
  if (!existing) {
    throw new NotFoundError('Invoice', id);
  }

  verifyOrgAccess(existing, orgId);

  if (existing.sender_org_id !== orgId) {
    throw new ForbiddenError('Only the sender can update an invoice');
  }

  if (existing.status !== InvoiceStatus.DRAFT) {
    throw new AppError('Only DRAFT invoices can be updated', 400, 'INVALID_STATUS');
  }

  const result = await invoiceRepo.update(
    id,
    {
      due_date: dto.due_date,
      currency: dto.currency,
      vat_amount: dto.vat_amount,
      notes: dto.notes,
      updated_by: userId,
    },
    dto.items,
  );

  if (!result) {
    throw new AppError('Failed to update invoice. It may no longer be in DRAFT status.', 409, 'UPDATE_FAILED');
  }

  return result;
}

export async function deleteInvoice(id: string, orgId: string): Promise<void> {
  const existing = await invoiceRepo.findById(id);
  if (!existing) {
    throw new NotFoundError('Invoice', id);
  }

  verifyOrgAccess(existing, orgId);

  if (existing.sender_org_id !== orgId) {
    throw new ForbiddenError('Only the sender can delete an invoice');
  }

  if (existing.status !== InvoiceStatus.DRAFT) {
    throw new AppError('Only DRAFT invoices can be deleted', 400, 'INVALID_STATUS');
  }

  const deleted = await invoiceRepo.deleteInvoice(id);
  if (!deleted) {
    throw new AppError('Failed to delete invoice', 409, 'DELETE_FAILED');
  }
}

export async function sendInvoice(
  id: string,
  userId: string,
  orgId: string,
  correlationId: string,
): Promise<Invoice> {
  const existing = await invoiceRepo.findById(id);
  if (!existing) {
    throw new NotFoundError('Invoice', id);
  }

  verifyOrgAccess(existing, orgId);

  if (existing.sender_org_id !== orgId) {
    throw new ForbiddenError('Only the sender can send an invoice');
  }

  validateTransition(existing.status as InvoiceStatus, InvoiceStatus.VERIFIED);

  await invoiceRepo.updateStatus(id, InvoiceStatus.VERIFIED, userId, 'Invoice verified for sending');

  validateTransition(InvoiceStatus.VERIFIED, InvoiceStatus.SENT);

  const sentInvoice = await invoiceRepo.updateStatus(id, InvoiceStatus.SENT, userId, 'Invoice sent to receiver');

  if (!sentInvoice) {
    throw new AppError('Failed to send invoice', 500, 'SEND_FAILED');
  }

  // Auto-transition to RECEIVED for the receiver
  const receivedInvoice = await invoiceRepo.updateStatus(id, InvoiceStatus.RECEIVED, '00000000-0000-0000-0000-000000000000', 'Auto-received');

  const finalInvoice = receivedInvoice || sentInvoice;

  // Publish events async - don't fail the request if queue is down
  try {
    await publishStatusChangeEvent(finalInvoice, existing.status as InvoiceStatus, InvoiceStatus.SENT, userId, correlationId);
  } catch (err) {
    logger.error({ err }, 'Failed to publish invoice status change event');
  }

  return finalInvoice;
}

export async function viewInvoice(
  id: string,
  userId: string,
  orgId: string,
  correlationId: string,
): Promise<Invoice> {
  const existing = await invoiceRepo.findById(id);
  if (!existing) {
    throw new NotFoundError('Invoice', id);
  }

  verifyOrgAccess(existing, orgId);

  if (existing.receiver_org_id !== orgId) {
    throw new ForbiddenError('Only the receiver can mark an invoice as viewed');
  }

  if (existing.status !== InvoiceStatus.RECEIVED && existing.status !== InvoiceStatus.SENT) {
    throw new AppError(
      'Invoice must be in SENT or RECEIVED status to be marked as viewed',
      400,
      'INVALID_STATUS',
    );
  }

  // If SENT, first transition to RECEIVED
  if (existing.status === InvoiceStatus.SENT) {
    await invoiceRepo.updateStatus(id, InvoiceStatus.RECEIVED, '00000000-0000-0000-0000-000000000000', 'Auto-received on view');
  }

  const viewedInvoice = await invoiceRepo.updateStatus(id, InvoiceStatus.VIEWED, userId, 'Invoice viewed by receiver');

  if (!viewedInvoice) {
    throw new AppError('Failed to update invoice status', 500, 'UPDATE_FAILED');
  }

  await publishStatusChangeEvent(viewedInvoice, existing.status as InvoiceStatus, InvoiceStatus.VIEWED, userId, correlationId);

  return viewedInvoice;
}

export async function requestCancel(
  id: string,
  userId: string,
  orgId: string,
  reason: string,
  correlationId: string,
): Promise<Invoice> {
  const existing = await invoiceRepo.findById(id);
  if (!existing) {
    throw new NotFoundError('Invoice', id);
  }

  verifyOrgAccess(existing, orgId);

  validateTransition(existing.status as InvoiceStatus, InvoiceStatus.CANCEL_REQUESTED);

  const updatedInvoice = await invoiceRepo.updateStatus(
    id,
    InvoiceStatus.CANCEL_REQUESTED,
    userId,
    reason,
  );

  if (!updatedInvoice) {
    throw new AppError('Failed to request cancellation', 500, 'UPDATE_FAILED');
  }

  await publishStatusChangeEvent(
    updatedInvoice,
    existing.status as InvoiceStatus,
    InvoiceStatus.CANCEL_REQUESTED,
    userId,
    correlationId,
  );

  return updatedInvoice;
}

export async function cancelInvoice(
  id: string,
  userId: string,
  correlationId: string,
): Promise<Invoice> {
  const existing = await invoiceRepo.findById(id);
  if (!existing) {
    throw new NotFoundError('Invoice', id);
  }

  validateTransition(existing.status as InvoiceStatus, InvoiceStatus.CANCELLED);

  const cancelledInvoice = await invoiceRepo.updateStatus(
    id,
    InvoiceStatus.CANCELLED,
    userId,
    'Invoice cancelled',
  );

  if (!cancelledInvoice) {
    throw new AppError('Failed to cancel invoice', 500, 'UPDATE_FAILED');
  }

  await publishStatusChangeEvent(
    cancelledInvoice,
    existing.status as InvoiceStatus,
    InvoiceStatus.CANCELLED,
    userId,
    correlationId,
  );

  return cancelledInvoice;
}

export async function getStatusHistory(invoiceId: string): Promise<InvoiceStatusHistory[]> {
  return invoiceRepo.getStatusHistory(invoiceId);
}

export async function getDashboardStats(
  orgId: string,
): Promise<invoiceRepo.InvoiceStats[]> {
  return invoiceRepo.getStats(orgId);
}

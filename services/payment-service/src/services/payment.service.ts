import { v4 as uuidv4 } from 'uuid';
import {
  Payment,
  PaymentStatus,
  CreatePaymentDto,
  EventType,
  PaymentInitiatedEvent,
  successResponse,
} from '@m-bank/shared-types';
import {
  NotFoundError,
  ForbiddenError,
  AppError,
  createLogger,
  parsePagination,
  buildPaginationMeta,
} from '@m-bank/shared-utils';
import * as paymentRepo from '../repositories/payment.repository';
import { checkIdempotencyKey, storeIdempotencyKey } from './idempotency.service';
import { publishPaymentInitiated, publishPaymentStatusChanged, publishAuditLog } from '../events/publishers';
import { config } from '../config';

const logger = createLogger('payment-service');

function verifyOrgAccess(payment: Payment, orgId: string): void {
  if (payment.payer_org_id !== orgId && payment.beneficiary_org_id !== orgId) {
    throw new ForbiddenError('You do not have access to this payment');
  }
}

async function validateAccountViaIntegration(accountNo: string): Promise<{
  valid: boolean;
  account_no: string;
  org_name: string;
  currency: string;
}> {
  const url = `${config.integrationServiceUrl}/internal/finacle/validate-account`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_no: accountNo }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new AppError(`Account ${accountNo} not found`, 400, 'INVALID_ACCOUNT');
    }
    throw new AppError(
      `Failed to validate account ${accountNo} via integration service`,
      502,
      'EXTERNAL_SERVICE_ERROR',
    );
  }

  const body = await response.json() as {
    success: boolean;
    data: { valid: boolean; account_no: string; org_name: string; currency: string };
  };
  return body.data;
}

export async function getPayments(
  orgId: string,
  filters: {
    status?: PaymentStatus;
    dateFrom?: string;
    dateTo?: string;
  },
  paginationQuery: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
): Promise<{
  payments: Payment[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}> {
  const pagination = parsePagination(paginationQuery);
  const { payments, total } = await paymentRepo.findAll(
    { orgId, ...filters },
    pagination,
  );

  const page = Math.max(1, paginationQuery.page || 1);
  const limit = Math.min(100, Math.max(1, paginationQuery.limit || 20));
  const meta = buildPaginationMeta(total, page, limit);

  return { payments, meta };
}

export async function getPaymentById(
  id: string,
  orgId: string,
): Promise<Payment> {
  const payment = await paymentRepo.findById(id);
  if (!payment) {
    throw new NotFoundError('Payment', id);
  }

  verifyOrgAccess(payment, orgId);
  return payment;
}

export async function getPaymentsByInvoice(
  invoiceId: string,
): Promise<Payment[]> {
  return paymentRepo.findByInvoiceId(invoiceId);
}

export async function initiatePayment(
  dto: CreatePaymentDto,
  userId: string,
  orgId: string,
  idempotencyKey?: string,
): Promise<{ payment: Payment; cached: boolean }> {
  // Check idempotency key first
  if (idempotencyKey) {
    const cached = await checkIdempotencyKey(idempotencyKey);
    if (cached) {
      return {
        payment: (cached.body as { data: Payment }).data,
        cached: true,
      };
    }
  }

  // Validate payer account via integration service
  const payerAccount = await validateAccountViaIntegration(dto.payer_account);
  if (!payerAccount.valid) {
    throw new AppError('Payer account is not valid or inactive', 400, 'INVALID_ACCOUNT');
  }

  // For demo: determine beneficiary from org context
  // In production, this would be fetched from invoice-service
  const isOrgA = orgId === 'a0000000-0000-0000-0000-000000000001';
  const senderOrgId = isOrgA
    ? 'b0000000-0000-0000-0000-000000000002'
    : 'a0000000-0000-0000-0000-000000000001';
  const beneficiaryAccount = isOrgA ? '2001000001' : '1001000001';
  const invoiceNo = `PAY-${Date.now()}`;

  const payment = await paymentRepo.create({
    invoice_id: dto.invoice_id,
    invoice_no: invoiceNo,
    payer_org_id: orgId,
    payer_account: dto.payer_account,
    beneficiary_org_id: senderOrgId,
    beneficiary_account: beneficiaryAccount,
    amount: dto.amount,
    currency: dto.currency,
    initiated_by: userId,
    idempotency_key: idempotencyKey,
  });

  // Publish payment initiated event
  const event: PaymentInitiatedEvent = {
    eventId: uuidv4(),
    eventType: EventType.PAYMENT_INITIATED,
    correlationId: uuidv4(),
    timestamp: new Date().toISOString(),
    source: 'payment-service',
    payload: {
      paymentId: payment.payment_id,
      invoiceId: payment.invoice_id,
      invoiceNo: payment.invoice_no,
      payerAccount: payment.payer_account,
      beneficiaryAccount: payment.beneficiary_account,
      amount: Number(payment.amount),
      currency: payment.currency,
    },
  };

  await publishPaymentInitiated(event);

  // Publish audit log
  await publishAuditLog({
    eventId: uuidv4(),
    correlationId: event.correlationId,
    action: 'PAYMENT_INITIATED',
    entityType: 'payment',
    entityId: payment.payment_id,
    userId,
    orgId,
    details: {
      invoiceId: dto.invoice_id,
      amount: dto.amount,
      currency: dto.currency,
    },
    timestamp: new Date().toISOString(),
  });

  // Store idempotency key
  if (idempotencyKey) {
    const responseBody = successResponse(payment);
    await storeIdempotencyKey(
      idempotencyKey,
      payment.payment_id,
      201,
      responseBody as unknown as Record<string, unknown>,
    );
  }

  logger.info(
    { paymentId: payment.payment_id, invoiceId: dto.invoice_id },
    'Payment initiated',
  );

  return { payment, cached: false };
}

export async function approvePayment(
  id: string,
  userId: string,
  orgId: string,
): Promise<Payment> {
  const payment = await paymentRepo.findById(id);
  if (!payment) {
    throw new NotFoundError('Payment', id);
  }

  verifyOrgAccess(payment, orgId);

  if (payment.payment_status !== PaymentStatus.PAYMENT_PENDING) {
    throw new AppError(
      'Only PAYMENT_PENDING payments can be approved',
      400,
      'INVALID_STATUS',
    );
  }

  if (payment.initiated_by === userId) {
    throw new ForbiddenError('The initiator cannot approve their own payment');
  }

  await paymentRepo.setApprover(id, userId);
  const updatedPayment = await paymentRepo.updateStatus(id, PaymentStatus.PAYMENT_PROCESSING);

  if (!updatedPayment) {
    throw new AppError('Failed to approve payment', 500, 'UPDATE_FAILED');
  }

  await publishPaymentStatusChanged({
    eventId: uuidv4(),
    eventType: EventType.PAYMENT_STATUS_CHANGED,
    correlationId: uuidv4(),
    timestamp: new Date().toISOString(),
    source: 'payment-service',
    payload: {
      paymentId: updatedPayment.payment_id,
      invoiceId: updatedPayment.invoice_id,
      invoiceNo: updatedPayment.invoice_no,
      fromStatus: PaymentStatus.PAYMENT_PENDING,
      toStatus: PaymentStatus.PAYMENT_PROCESSING,
      amount: Number(updatedPayment.amount),
      currency: updatedPayment.currency,
      finacleTxnRef: null,
      payerOrgId: updatedPayment.payer_org_id,
      beneficiaryOrgId: updatedPayment.beneficiary_org_id,
    },
  });

  await publishAuditLog({
    eventId: uuidv4(),
    correlationId: uuidv4(),
    action: 'PAYMENT_APPROVED',
    entityType: 'payment',
    entityId: id,
    userId,
    orgId,
    details: { previousStatus: PaymentStatus.PAYMENT_PENDING },
    timestamp: new Date().toISOString(),
  });

  logger.info({ paymentId: id, approvedBy: userId }, 'Payment approved');

  return updatedPayment;
}

export async function rejectPayment(
  id: string,
  userId: string,
  orgId: string,
  reason: string,
): Promise<Payment> {
  const payment = await paymentRepo.findById(id);
  if (!payment) {
    throw new NotFoundError('Payment', id);
  }

  verifyOrgAccess(payment, orgId);

  if (payment.payment_status !== PaymentStatus.PAYMENT_PENDING) {
    throw new AppError(
      'Only PAYMENT_PENDING payments can be rejected',
      400,
      'INVALID_STATUS',
    );
  }

  const updatedPayment = await paymentRepo.setRejection(id, reason);

  if (!updatedPayment) {
    throw new AppError('Failed to reject payment', 500, 'UPDATE_FAILED');
  }

  await publishPaymentStatusChanged({
    eventId: uuidv4(),
    eventType: EventType.PAYMENT_STATUS_CHANGED,
    correlationId: uuidv4(),
    timestamp: new Date().toISOString(),
    source: 'payment-service',
    payload: {
      paymentId: updatedPayment.payment_id,
      invoiceId: updatedPayment.invoice_id,
      invoiceNo: updatedPayment.invoice_no,
      fromStatus: PaymentStatus.PAYMENT_PENDING,
      toStatus: PaymentStatus.PAYMENT_FAILED,
      amount: Number(updatedPayment.amount),
      currency: updatedPayment.currency,
      finacleTxnRef: null,
      payerOrgId: updatedPayment.payer_org_id,
      beneficiaryOrgId: updatedPayment.beneficiary_org_id,
    },
  });

  await publishAuditLog({
    eventId: uuidv4(),
    correlationId: uuidv4(),
    action: 'PAYMENT_REJECTED',
    entityType: 'payment',
    entityId: id,
    userId,
    orgId,
    details: { reason },
    timestamp: new Date().toISOString(),
  });

  logger.info({ paymentId: id, rejectedBy: userId, reason }, 'Payment rejected');

  return updatedPayment;
}

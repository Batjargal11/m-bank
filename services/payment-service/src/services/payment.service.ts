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

  // Process payment synchronously via Integration Service → Finacle
  processPaymentAsync(payment.payment_id, payment.invoice_id, dto.payer_account, payment.beneficiary_account, dto.amount, dto.currency).catch((err) => {
    logger.error({ err, paymentId: payment.payment_id }, 'Async payment processing failed');
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

  logger.info({ paymentId: payment.payment_id, invoiceId: dto.invoice_id }, 'Payment initiated');
  return { payment, cached: false };
}

async function processPaymentAsync(
  paymentId: string,
  invoiceId: string,
  payerAccount: string,
  beneficiaryAccount: string,
  amount: number,
  currency: string,
): Promise<void> {
  try {
    // 1. Call Integration Service → Finacle transfer
    const transferUrl = `${config.integrationServiceUrl}/internal/finacle/validate-account`;
    const validateResp = await fetch(transferUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_no: payerAccount }),
    });

    if (!validateResp.ok) {
      await paymentRepo.updateStatus(paymentId, PaymentStatus.PAYMENT_FAILED);
      logger.error({ paymentId }, 'Account validation failed');
      return;
    }

    // 2. Execute Finacle transfer via mock
    const transferResp = await fetch(`${config.finacleUrl}/finacle/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        debit_account: payerAccount,
        credit_account: beneficiaryAccount,
        amount,
        currency,
        reference: `PAY-${paymentId.slice(0, 8)}`,
      }),
    });

    const transferResult = await transferResp.json() as any;

    if (!transferResp.ok || !transferResult.success) {
      await paymentRepo.updateStatus(paymentId, PaymentStatus.PAYMENT_FAILED);
      logger.error({ paymentId, error: transferResult.error }, 'Finacle transfer failed');
      return;
    }

    const txnRef = transferResult.data?.txn_ref || `FIN-${Date.now()}`;

    // 3. Update payment → PAID
    await paymentRepo.updateStatus(paymentId, PaymentStatus.PAID, txnRef);
    logger.info({ paymentId, txnRef }, 'Payment PAID');

    // 4. Update invoice paid_amount + status directly via invoice DB
    const { Pool } = await import('pg');
    const invoiceDbUrl = config.invoiceDatabaseUrl || config.databaseUrl.replace('payment_db', 'invoice_db');
    const invoicePool = new Pool({ connectionString: invoiceDbUrl, max: 2 });

    try {
      const client = await invoicePool.connect();
      try {
        await client.query('BEGIN');

        const invResult = await client.query('SELECT * FROM invoices WHERE invoice_id = $1 FOR UPDATE', [invoiceId]);
        if (invResult.rows.length > 0) {
          const inv = invResult.rows[0];
          const newPaid = Number(inv.paid_amount) + amount;
          const total = Number(inv.total_amount);
          const newOutstanding = Math.max(0, total - newPaid);
          const newStatus = newPaid >= total ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : inv.status;

          await client.query(
            'UPDATE invoices SET paid_amount = $1, outstanding_amount = $2, status = $3, updated_at = NOW() WHERE invoice_id = $4',
            [newPaid, newOutstanding, newStatus, invoiceId],
          );

          if (newStatus !== inv.status) {
            await client.query(
              "INSERT INTO invoice_status_history (invoice_id, from_status, to_status, changed_by, reason) VALUES ($1, $2, $3, '00000000-0000-0000-0000-000000000000', 'Payment received')",
              [invoiceId, inv.status, newStatus],
            );
          }

          logger.info({ invoiceId, newPaid, newStatus, txnRef }, 'Invoice updated after payment');
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } finally {
      await invoicePool.end();
    }
  } catch (err) {
    logger.error({ err, paymentId }, 'Payment processing error');
    await paymentRepo.updateStatus(paymentId, PaymentStatus.PAYMENT_FAILED).catch(() => {});
  }
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

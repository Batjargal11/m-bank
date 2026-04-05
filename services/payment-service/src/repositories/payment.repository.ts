import { Payment, PaymentStatus } from '@m-bank/shared-types';
import { PaginationParams } from '@m-bank/shared-utils';
import { query, pool } from '../db/connection';

export interface PaymentFilters {
  orgId: string;
  status?: PaymentStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface IdempotencyRecord {
  idempotency_key: string;
  payment_id: string;
  response_body: Record<string, unknown> | null;
  status_code: number | null;
  created_at: string;
  expires_at: string;
}

export async function findAll(
  filters: PaymentFilters,
  pagination: PaginationParams,
): Promise<{ payments: Payment[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  conditions.push(`(payer_org_id = $${paramIndex} OR beneficiary_org_id = $${paramIndex})`);
  params.push(filters.orgId);
  paramIndex++;

  if (filters.status) {
    conditions.push(`payment_status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters.dateFrom) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.dateTo);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const allowedSortColumns = ['created_at', 'amount', 'payment_status'];
  const sortBy = allowedSortColumns.includes(pagination.sortBy) ? pagination.sortBy : 'created_at';
  const sortOrder = pagination.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM payments ${whereClause}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await query<Payment>(
    `SELECT * FROM payments ${whereClause}
     ORDER BY ${sortBy} ${sortOrder}
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, pagination.limit, pagination.offset],
  );

  return { payments: dataResult.rows, total };
}

export async function findById(id: string): Promise<Payment | null> {
  const result = await query<Payment>(
    'SELECT * FROM payments WHERE payment_id = $1',
    [id],
  );
  return result.rows[0] || null;
}

export async function findByInvoiceId(invoiceId: string): Promise<Payment[]> {
  const result = await query<Payment>(
    'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC',
    [invoiceId],
  );
  return result.rows;
}

export async function create(payment: {
  invoice_id: string;
  invoice_no: string;
  payer_org_id: string;
  payer_account: string;
  beneficiary_org_id: string;
  beneficiary_account: string;
  amount: number;
  currency: string;
  initiated_by: string;
  idempotency_key?: string;
}): Promise<Payment> {
  const result = await query<Payment>(
    `INSERT INTO payments (
      invoice_id, invoice_no, payer_org_id, payer_account,
      beneficiary_org_id, beneficiary_account, amount, currency,
      payment_status, initiated_by, idempotency_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      payment.invoice_id,
      payment.invoice_no,
      payment.payer_org_id,
      payment.payer_account,
      payment.beneficiary_org_id,
      payment.beneficiary_account,
      payment.amount,
      payment.currency,
      PaymentStatus.PAYMENT_PENDING,
      payment.initiated_by,
      payment.idempotency_key || null,
    ],
  );
  return result.rows[0];
}

export async function updateStatus(
  id: string,
  status: PaymentStatus,
  finacleTxnRef?: string,
): Promise<Payment | null> {
  const setClauses = ['payment_status = $1', 'updated_at = NOW()'];
  const params: unknown[] = [status];
  let paramIndex = 2;

  if (finacleTxnRef !== undefined) {
    setClauses.push(`finacle_txn_ref = $${paramIndex++}`);
    params.push(finacleTxnRef);
  }

  params.push(id);
  const result = await query<Payment>(
    `UPDATE payments SET ${setClauses.join(', ')} WHERE payment_id = $${paramIndex} RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

export async function setApprover(
  id: string,
  approvedBy: string,
): Promise<Payment | null> {
  const result = await query<Payment>(
    `UPDATE payments SET approved_by = $1, updated_at = NOW()
     WHERE payment_id = $2 RETURNING *`,
    [approvedBy, id],
  );
  return result.rows[0] || null;
}

export async function setRejection(
  id: string,
  rejectionReason: string,
): Promise<Payment | null> {
  const result = await query<Payment>(
    `UPDATE payments SET rejection_reason = $1, payment_status = $2, updated_at = NOW()
     WHERE payment_id = $3 RETURNING *`,
    [rejectionReason, PaymentStatus.PAYMENT_FAILED, id],
  );
  return result.rows[0] || null;
}

export async function findByIdempotencyKey(
  key: string,
): Promise<IdempotencyRecord | null> {
  const result = await query<IdempotencyRecord>(
    'SELECT * FROM idempotency_keys WHERE idempotency_key = $1 AND expires_at > NOW()',
    [key],
  );
  return result.rows[0] || null;
}

export async function saveIdempotencyKey(record: {
  idempotency_key: string;
  payment_id: string;
  response_body: Record<string, unknown>;
  status_code: number;
  expires_at: string;
}): Promise<void> {
  await query(
    `INSERT INTO idempotency_keys (idempotency_key, payment_id, response_body, status_code, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (idempotency_key) DO UPDATE SET
       response_body = EXCLUDED.response_body,
       status_code = EXCLUDED.status_code`,
    [
      record.idempotency_key,
      record.payment_id,
      JSON.stringify(record.response_body),
      record.status_code,
      record.expires_at,
    ],
  );
}

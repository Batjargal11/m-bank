import { Invoice, InvoiceItem, InvoiceStatus, InvoiceStatusHistory, CreateInvoiceItemDto } from '@m-bank/shared-types';
import { PaginationParams } from '@m-bank/shared-utils';
import { pool, query } from '../db/connection';

export interface InvoiceFilters {
  orgId: string;
  direction: 'sent' | 'received';
  status?: InvoiceStatus;
  dateFrom?: string;
  dateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
}

export interface InvoiceStats {
  status: InvoiceStatus;
  count: number;
  total_amount: number;
}

export async function findAll(
  filters: InvoiceFilters,
  pagination: PaginationParams,
): Promise<{ invoices: Invoice[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.direction === 'sent') {
    conditions.push(`sender_org_id = $${paramIndex++}`);
  } else {
    conditions.push(`receiver_org_id = $${paramIndex++}`);
    // Хүлээн авагчид зөвхөн илгээгдсэн нэхэмжлэх харагдана (DRAFT, VERIFIED хасах)
    conditions.push(`status NOT IN ('DRAFT', 'VERIFIED')`);
  }
  params.push(filters.orgId);

  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters.dateFrom) {
    conditions.push(`issue_date >= $${paramIndex++}`);
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push(`issue_date <= $${paramIndex++}`);
    params.push(filters.dateTo);
  }

  if (filters.dueDateFrom) {
    conditions.push(`due_date >= $${paramIndex++}`);
    params.push(filters.dueDateFrom);
  }

  if (filters.dueDateTo) {
    conditions.push(`due_date <= $${paramIndex++}`);
    params.push(filters.dueDateTo);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const allowedSortColumns = ['created_at', 'due_date', 'issue_date', 'total_amount', 'invoice_no'];
  const sortBy = allowedSortColumns.includes(pagination.sortBy) ? pagination.sortBy : 'created_at';
  const sortOrder = pagination.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM invoices ${whereClause}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await query<Invoice>(
    `SELECT * FROM invoices ${whereClause}
     ORDER BY ${sortBy} ${sortOrder}
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, pagination.limit, pagination.offset],
  );

  return { invoices: dataResult.rows, total };
}

export async function findById(id: string): Promise<InvoiceWithItems | null> {
  const invoiceResult = await query<Invoice>(
    'SELECT * FROM invoices WHERE invoice_id = $1',
    [id],
  );

  if (invoiceResult.rows.length === 0) {
    return null;
  }

  const itemsResult = await query<InvoiceItem>(
    'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order ASC',
    [id],
  );

  return {
    ...invoiceResult.rows[0],
    items: itemsResult.rows,
  };
}

export async function create(
  invoice: {
    invoice_no: string;
    sender_org_id: string;
    receiver_org_id: string;
    sender_org_name: string;
    receiver_org_name: string;
    issue_date: string;
    due_date: string;
    currency: string;
    vat_amount: number;
    notes?: string;
    created_by: string;
  },
  items: CreateInvoiceItemDto[],
): Promise<InvoiceWithItems> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const totalAmount = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price + item.tax_amount,
      0,
    );
    const outstandingAmount = totalAmount + invoice.vat_amount;

    const invoiceResult = await client.query<Invoice>(
      `INSERT INTO invoices (
        invoice_no, sender_org_id, receiver_org_id, sender_org_name, receiver_org_name,
        issue_date, due_date, currency, total_amount, vat_amount, paid_amount,
        outstanding_amount, status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        invoice.invoice_no,
        invoice.sender_org_id,
        invoice.receiver_org_id,
        invoice.sender_org_name,
        invoice.receiver_org_name,
        invoice.issue_date,
        invoice.due_date,
        invoice.currency,
        totalAmount + invoice.vat_amount,
        invoice.vat_amount,
        0,
        outstandingAmount,
        InvoiceStatus.DRAFT,
        invoice.notes || null,
        invoice.created_by,
      ],
    );

    const createdInvoice = invoiceResult.rows[0];
    const createdItems: InvoiceItem[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const totalPrice = item.quantity * item.unit_price + item.tax_amount;

      const itemResult = await client.query<InvoiceItem>(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, tax_amount, total_price, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          createdInvoice.invoice_id,
          item.description,
          item.quantity,
          item.unit_price,
          item.tax_amount,
          totalPrice,
          i,
        ],
      );

      createdItems.push(itemResult.rows[0]);
    }

    await client.query(
      `INSERT INTO invoice_status_history (invoice_id, from_status, to_status, changed_by)
       VALUES ($1, NULL, $2, $3)`,
      [createdInvoice.invoice_id, InvoiceStatus.DRAFT, invoice.created_by],
    );

    await client.query('COMMIT');

    return { ...createdInvoice, items: createdItems };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function update(
  id: string,
  data: {
    due_date?: string;
    currency?: string;
    vat_amount?: number;
    notes?: string;
    updated_by: string;
  },
  items?: CreateInvoiceItemDto[],
): Promise<InvoiceWithItems | null> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.due_date !== undefined) {
      setClauses.push(`due_date = $${paramIndex++}`);
      params.push(data.due_date);
    }

    if (data.currency !== undefined) {
      setClauses.push(`currency = $${paramIndex++}`);
      params.push(data.currency);
    }

    if (data.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      params.push(data.notes);
    }

    setClauses.push(`updated_by = $${paramIndex++}`);
    params.push(data.updated_by);

    if (items) {
      const totalAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price + item.tax_amount,
        0,
      );
      const vatAmount = data.vat_amount !== undefined ? data.vat_amount : 0;
      const fullTotal = totalAmount + vatAmount;

      setClauses.push(`total_amount = $${paramIndex++}`);
      params.push(fullTotal);

      if (data.vat_amount !== undefined) {
        setClauses.push(`vat_amount = $${paramIndex++}`);
        params.push(data.vat_amount);
      }

      setClauses.push(`outstanding_amount = $${paramIndex++}`);
      params.push(fullTotal);

      await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const totalPrice = item.quantity * item.unit_price + item.tax_amount;

        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, tax_amount, total_price, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, item.description, item.quantity, item.unit_price, item.tax_amount, totalPrice, i],
        );
      }
    } else if (data.vat_amount !== undefined) {
      setClauses.push(`vat_amount = $${paramIndex++}`);
      params.push(data.vat_amount);
    }

    params.push(id);
    const invoiceResult = await client.query<Invoice>(
      `UPDATE invoices SET ${setClauses.join(', ')} WHERE invoice_id = $${paramIndex} AND status = 'DRAFT' RETURNING *`,
      params,
    );

    if (invoiceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query('COMMIT');

    return findById(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateStatus(
  id: string,
  status: InvoiceStatus,
  changedBy: string,
  reason?: string,
): Promise<Invoice | null> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentResult = await client.query<Invoice>(
      'SELECT * FROM invoices WHERE invoice_id = $1 FOR UPDATE',
      [id],
    );

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const currentInvoice = currentResult.rows[0];

    const updateResult = await client.query<Invoice>(
      `UPDATE invoices SET status = $1, updated_by = $2, updated_at = NOW()
       WHERE invoice_id = $3 RETURNING *`,
      [status, changedBy, id],
    );

    await client.query(
      `INSERT INTO invoice_status_history (invoice_id, from_status, to_status, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, currentInvoice.status, status, changedBy, reason || null],
    );

    await client.query('COMMIT');

    return updateResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updatePayment(
  id: string,
  paidAmount: number,
): Promise<Invoice | null> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentResult = await client.query<Invoice>(
      'SELECT * FROM invoices WHERE invoice_id = $1 FOR UPDATE',
      [id],
    );

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const currentInvoice = currentResult.rows[0];
    const newPaidAmount = Number(currentInvoice.paid_amount) + paidAmount;
    const totalAmount = Number(currentInvoice.total_amount);
    const newOutstanding = Math.max(0, totalAmount - newPaidAmount);

    let newStatus: InvoiceStatus;
    if (newPaidAmount >= totalAmount) {
      newStatus = InvoiceStatus.PAID;
    } else if (newPaidAmount > 0) {
      newStatus = InvoiceStatus.PARTIALLY_PAID;
    } else {
      newStatus = currentInvoice.status;
    }

    const updateResult = await client.query<Invoice>(
      `UPDATE invoices SET paid_amount = $1, outstanding_amount = $2, status = $3, updated_at = NOW()
       WHERE invoice_id = $4 RETURNING *`,
      [newPaidAmount, newOutstanding, newStatus, id],
    );

    if (newStatus !== currentInvoice.status) {
      await client.query(
        `INSERT INTO invoice_status_history (invoice_id, from_status, to_status, changed_by, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, currentInvoice.status, newStatus, 'SYSTEM', 'Payment received'],
      );
    }

    await client.query('COMMIT');

    return updateResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteInvoice(id: string): Promise<boolean> {
  const result = await query(
    "DELETE FROM invoices WHERE invoice_id = $1 AND status = 'DRAFT' RETURNING invoice_id",
    [id],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function getStatusHistory(invoiceId: string): Promise<InvoiceStatusHistory[]> {
  const result = await query<InvoiceStatusHistory>(
    'SELECT * FROM invoice_status_history WHERE invoice_id = $1 ORDER BY created_at ASC',
    [invoiceId],
  );
  return result.rows;
}

export async function getStats(orgId: string): Promise<InvoiceStats[]> {
  const result = await query<InvoiceStats>(
    `SELECT status, COUNT(*)::int as count, COALESCE(SUM(total_amount), 0)::numeric as total_amount
     FROM invoices
     WHERE sender_org_id = $1 OR receiver_org_id = $1
     GROUP BY status`,
    [orgId],
  );
  return result.rows;
}

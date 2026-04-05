import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createLogger, correlationMiddleware, AppError } from '@m-bank/shared-utils';
import { successResponse, errorResponse, InvoiceStatus, canTransition } from '@m-bank/shared-types';

const logger = createLogger('m-bank-unified');

// ─── Config ───────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/mbank';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─── Database ─────────────────────────────────────────
const pool = new Pool({ connectionString: DATABASE_URL, max: 20 });

async function query(sql: string, params?: unknown[]): Promise<{ rows: any[] }> {
  const result = await pool.query(sql, params);
  return result;
}

// ─── Migrations ───────────────────────────────────────
async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Organizations
      CREATE TABLE IF NOT EXISTS organizations (
        org_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        registration_no VARCHAR(100) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS accounts (
        account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(org_id),
        account_no VARCHAR(50) UNIQUE NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'MNT',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      -- Users
      CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(org_id),
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      -- Invoices
      DO $$ BEGIN
        CREATE TYPE invoice_status AS ENUM (
          'DRAFT','VERIFIED','SENT','RECEIVED','VIEWED',
          'PAYMENT_PENDING','PAYMENT_PROCESSING','PARTIALLY_PAID',
          'PAID','CANCEL_REQUESTED','CANCELLED','EXPIRED','FAILED'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      CREATE TABLE IF NOT EXISTS invoices (
        invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_no VARCHAR(50) UNIQUE NOT NULL,
        sender_org_id UUID NOT NULL,
        receiver_org_id UUID NOT NULL,
        sender_org_name VARCHAR(255) NOT NULL DEFAULT '',
        receiver_org_name VARCHAR(255) NOT NULL DEFAULT '',
        issue_date DATE NOT NULL,
        due_date DATE NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'MNT',
        total_amount DECIMAL(18,2) NOT NULL,
        vat_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        paid_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        outstanding_amount DECIMAL(18,2) NOT NULL,
        status invoice_status NOT NULL DEFAULT 'DRAFT',
        external_einvoice_ref VARCHAR(100),
        notes TEXT,
        created_by UUID NOT NULL,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS invoice_items (
        item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
        description VARCHAR(500) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        unit_price DECIMAL(18,2) NOT NULL,
        tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        total_price DECIMAL(18,2) NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS invoice_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES invoices(invoice_id),
        from_status invoice_status,
        to_status invoice_status NOT NULL,
        changed_by UUID NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      -- Payments
      DO $$ BEGIN
        CREATE TYPE payment_status AS ENUM ('PAYMENT_PENDING','PAYMENT_PROCESSING','PAID','PARTIALLY_PAID','PAYMENT_FAILED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      CREATE TABLE IF NOT EXISTS payments (
        payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL,
        invoice_no VARCHAR(50) NOT NULL,
        payer_org_id UUID NOT NULL,
        payer_account VARCHAR(50) NOT NULL,
        beneficiary_org_id UUID NOT NULL,
        beneficiary_account VARCHAR(50) NOT NULL,
        amount DECIMAL(18,2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'MNT',
        payment_status payment_status NOT NULL DEFAULT 'PAYMENT_PENDING',
        finacle_txn_ref VARCHAR(100),
        initiated_by UUID NOT NULL,
        approved_by UUID,
        rejection_reason TEXT,
        idempotency_key VARCHAR(255) UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      -- Notifications
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        user_id UUID,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        entity_type VARCHAR(50),
        entity_id UUID,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    logger.info('Migrations completed');
  } finally {
    client.release();
  }
}

// ─── Mock Finacle (in-memory) ─────────────────────────
const finacleAccounts = new Map([
  ['1001000001', { org_name: 'Монгол Технологи ХХК', currency: 'MNT', balance: 50000000, is_active: true }],
  ['1001000002', { org_name: 'Монгол Технологи ХХК', currency: 'USD', balance: 100000, is_active: true }],
  ['2001000001', { org_name: 'Улаанбаатар Худалдаа ХХК', currency: 'MNT', balance: 30000000, is_active: true }],
  ['2001000002', { org_name: 'Улаанбаатар Худалдаа ХХК', currency: 'USD', balance: 50000, is_active: true }],
]);
const finacleTransactions = new Map<string, any>();

// ─── Auth Middleware ──────────────────────────────────
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const publicPaths = ['/api/auth/login', '/api/auth/refresh', '/health', '/api/finacle', '/api/einvoice'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json(errorResponse('Missing authorization'));
  }
  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json(errorResponse('Invalid token'));
  }
}

function getUser(req: express.Request) {
  return (req as any).user as { userId: string; orgId: string; role: string; username: string };
}

// ─── App Setup ────────────────────────────────────────
const app = express();
app.use(helmet());
app.use(cors({ origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:4173'], credentials: true }));
app.use(express.json());
app.use(correlationMiddleware);
app.use(authMiddleware);

// ─── Health ───────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'm-bank-unified' }));

// ─── AUTH ROUTES ──────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { rows } = await query('SELECT * FROM users WHERE username = $1 AND is_active = true', [username]);
    if (rows.length === 0) return res.status(401).json(errorResponse('Invalid credentials'));
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json(errorResponse('Invalid credentials'));
    const payload = { userId: user.user_id, orgId: user.org_id, role: user.role, username: user.username };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' } as jwt.SignOptions);
    const refreshToken = uuidv4();
    await query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [user.user_id]);
    res.json(successResponse({ tokens: { accessToken, refreshToken }, user: payload }));
  } catch (err) { res.status(500).json(errorResponse('Login failed')); }
});

// ─── ORGANIZATIONS ────────────────────────────────────
app.get('/api/organizations', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM organizations ORDER BY name');
    res.json(successResponse(rows));
  } catch { res.status(500).json(errorResponse('Failed to fetch organizations')); }
});

app.get('/api/organizations/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM organizations WHERE org_id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json(errorResponse('Organization not found'));
    res.json(successResponse(rows[0]));
  } catch { res.status(500).json(errorResponse('Failed')); }
});

app.get('/api/organizations/:id/accounts', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM accounts WHERE org_id = $1', [req.params.id]);
    res.json(successResponse(rows));
  } catch { res.status(500).json(errorResponse('Failed')); }
});

// ─── USERS ────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
  try {
    const user = getUser(req);
    const isAdmin = user.role === 'SYSTEM_ADMIN' || user.role === 'BANK_OPERATOR';
    const sql = isAdmin
      ? 'SELECT user_id, org_id, username, email, full_name, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
      : 'SELECT user_id, org_id, username, email, full_name, role, is_active, last_login, created_at FROM users WHERE org_id = $1 ORDER BY created_at DESC';
    const { rows } = isAdmin ? await query(sql) : await query(sql, [user.orgId]);
    res.json(successResponse(rows));
  } catch { res.status(500).json(errorResponse('Failed')); }
});

// ─── INVOICES ─────────────────────────────────────────
app.get('/api/invoices', async (req, res) => {
  try {
    const user = getUser(req);
    const direction = req.query.direction as string || 'sent';
    const status = req.query.status as string;
    const limit = Math.min(100, parseInt(req.query.limit as string || '20', 10));
    const page = parseInt(req.query.page as string || '1', 10);
    const offset = (page - 1) * limit;

    let where = direction === 'sent' ? 'sender_org_id = $1' : 'receiver_org_id = $1';
    const params: unknown[] = [user.orgId];
    let paramIdx = 2;

    if (direction === 'received') where += " AND status NOT IN ('DRAFT', 'VERIFIED')";
    if (status) { where += ` AND status = $${paramIdx++}`; params.push(status); }

    const countRes = await query(`SELECT COUNT(*) as count FROM invoices WHERE ${where}`, params);
    const total = parseInt(countRes.rows[0].count, 10);
    const { rows } = await query(
      `SELECT * FROM invoices WHERE ${where} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limit, offset],
    );
    res.json({ success: true, data: rows, error: null, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) { logger.error({ err }, 'List invoices failed'); res.status(500).json(errorResponse('Failed')); }
});

app.get('/api/invoices/stats', async (req, res) => {
  try {
    const user = getUser(req);
    const { rows } = await query(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total_amount
       FROM invoices WHERE sender_org_id = $1 OR receiver_org_id = $1 GROUP BY status`,
      [user.orgId],
    );
    res.json(successResponse(rows));
  } catch { res.status(500).json(errorResponse('Failed')); }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const user = getUser(req);
    const { invoice_no, receiver_org_id, issue_date, due_date, currency, vat_amount, notes, items } = req.body;

    // Get org names
    const senderOrg = await query('SELECT name FROM organizations WHERE org_id = $1', [user.orgId]);
    const receiverOrg = await query('SELECT name FROM organizations WHERE org_id = $1', [receiver_org_id]);
    if (receiverOrg.rows.length === 0) return res.status(404).json(errorResponse('Receiver organization not found'));

    const senderName = senderOrg.rows[0]?.name || 'Unknown';
    const receiverName = receiverOrg.rows[0].name;

    // Calculate totals
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.unit_price + item.tax_amount;
    }
    totalAmount += vat_amount || 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const invResult = await client.query(
        `INSERT INTO invoices (invoice_no, sender_org_id, receiver_org_id, sender_org_name, receiver_org_name,
          issue_date, due_date, currency, total_amount, vat_amount, paid_amount, outstanding_amount, status, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$9,'DRAFT',$11,$12) RETURNING *`,
        [invoice_no, user.orgId, receiver_org_id, senderName, receiverName, issue_date, due_date, currency, totalAmount, vat_amount || 0, notes, user.userId],
      );
      const invoice = invResult.rows[0];

      // Insert items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const lineTotal = item.quantity * item.unit_price + item.tax_amount;
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, tax_amount, total_price, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [invoice.invoice_id, item.description, item.quantity, item.unit_price, item.tax_amount, lineTotal, i],
        );
      }

      // Status history
      await client.query(
        'INSERT INTO invoice_status_history (invoice_id, to_status, changed_by, reason) VALUES ($1,$2,$3,$4)',
        [invoice.invoice_id, 'DRAFT', user.userId, 'Invoice created'],
      );

      await client.query('COMMIT');

      // Fetch with items
      const itemsResult = await query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order', [invoice.invoice_id]);
      res.status(201).json(successResponse({ ...invoice, items: itemsResult.rows }));
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    if (err.constraint === 'invoices_invoice_no_key') return res.status(409).json(errorResponse('Invoice number already exists'));
    logger.error({ err }, 'Create invoice failed');
    res.status(500).json(errorResponse('Failed to create invoice'));
  }
});

app.get('/api/invoices/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM invoices WHERE invoice_id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json(errorResponse('Invoice not found'));
    const items = await query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order', [req.params.id]);
    res.json(successResponse({ ...rows[0], items: items.rows }));
  } catch { res.status(500).json(errorResponse('Failed')); }
});

app.delete('/api/invoices/:id', async (req, res) => {
  try {
    const user = getUser(req);
    const { rows } = await query('SELECT * FROM invoices WHERE invoice_id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json(errorResponse('Not found'));
    if (rows[0].sender_org_id !== user.orgId) return res.status(403).json(errorResponse('Forbidden'));
    if (rows[0].status !== 'DRAFT') return res.status(400).json(errorResponse('Only DRAFT can be deleted'));
    await query('DELETE FROM invoices WHERE invoice_id = $1', [req.params.id]);
    res.json(successResponse({ deleted: true }));
  } catch { res.status(500).json(errorResponse('Failed')); }
});

async function updateInvoiceStatus(invoiceId: string, newStatus: string, changedBy: string, reason: string) {
  const { rows } = await query('SELECT status FROM invoices WHERE invoice_id = $1', [invoiceId]);
  const oldStatus = rows[0]?.status;
  await query('UPDATE invoices SET status = $1, updated_by = $2, updated_at = NOW() WHERE invoice_id = $3', [newStatus, changedBy, invoiceId]);
  await query('INSERT INTO invoice_status_history (invoice_id, from_status, to_status, changed_by, reason) VALUES ($1,$2,$3,$4,$5)',
    [invoiceId, oldStatus, newStatus, changedBy, reason]);
}

app.post('/api/invoices/:id/send', async (req, res) => {
  try {
    const user = getUser(req);
    const { rows } = await query('SELECT * FROM invoices WHERE invoice_id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json(errorResponse('Not found'));
    if (rows[0].sender_org_id !== user.orgId) return res.status(403).json(errorResponse('Only sender can send'));
    if (rows[0].status !== 'DRAFT') return res.status(400).json(errorResponse('Only DRAFT can be sent'));

    await updateInvoiceStatus(req.params.id, 'VERIFIED', user.userId, 'Verified');
    await updateInvoiceStatus(req.params.id, 'SENT', user.userId, 'Sent');
    await updateInvoiceStatus(req.params.id, 'RECEIVED', '00000000-0000-0000-0000-000000000000', 'Auto-received');

    // Create notification
    await query('INSERT INTO notifications (org_id, type, title, message, entity_type, entity_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [rows[0].receiver_org_id, 'INVOICE_RECEIVED', 'Нэхэмжлэх ирлээ', `${rows[0].invoice_no} нэхэмжлэх ирлээ. Дүн: ${rows[0].total_amount} ${rows[0].currency}`, 'invoice', req.params.id]);

    const updated = await query('SELECT * FROM invoices WHERE invoice_id = $1', [req.params.id]);
    res.json(successResponse(updated.rows[0]));
  } catch (err) { logger.error({ err }, 'Send failed'); res.status(500).json(errorResponse('Failed')); }
});

app.post('/api/invoices/:id/view', async (req, res) => {
  try {
    const user = getUser(req);
    const { rows } = await query('SELECT * FROM invoices WHERE invoice_id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json(errorResponse('Not found'));
    if (rows[0].receiver_org_id !== user.orgId) return res.status(403).json(errorResponse('Only receiver can view'));
    if (!['SENT', 'RECEIVED'].includes(rows[0].status)) return res.status(400).json(errorResponse('Invalid status'));
    if (rows[0].status === 'SENT') await updateInvoiceStatus(req.params.id, 'RECEIVED', '00000000-0000-0000-0000-000000000000', 'Auto');
    await updateInvoiceStatus(req.params.id, 'VIEWED', user.userId, 'Viewed by receiver');
    const updated = await query('SELECT * FROM invoices WHERE invoice_id = $1', [req.params.id]);
    res.json(successResponse(updated.rows[0]));
  } catch (err) { logger.error({ err }, 'View failed'); res.status(500).json(errorResponse('Failed')); }
});

app.post('/api/invoices/:id/cancel', async (req, res) => {
  try {
    const user = getUser(req);
    const { reason } = req.body;
    const { rows } = await query('SELECT * FROM invoices WHERE invoice_id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json(errorResponse('Not found'));
    if (!['SENT', 'RECEIVED', 'VIEWED'].includes(rows[0].status)) return res.status(400).json(errorResponse('Cannot cancel'));
    await updateInvoiceStatus(req.params.id, 'CANCEL_REQUESTED', user.userId, reason || 'Cancelled');
    const updated = await query('SELECT * FROM invoices WHERE invoice_id = $1', [req.params.id]);
    res.json(successResponse(updated.rows[0]));
  } catch { res.status(500).json(errorResponse('Failed')); }
});

app.get('/api/invoices/:id/history', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM invoice_status_history WHERE invoice_id = $1 ORDER BY created_at', [req.params.id]);
    res.json(successResponse(rows));
  } catch { res.status(500).json(errorResponse('Failed')); }
});

// ─── PAYMENTS ─────────────────────────────────────────
app.get('/api/payments', async (req, res) => {
  try {
    const user = getUser(req);
    const limit = Math.min(100, parseInt(req.query.limit as string || '20', 10));
    const page = parseInt(req.query.page as string || '1', 10);
    const { rows } = await query(
      'SELECT * FROM payments WHERE payer_org_id = $1 OR beneficiary_org_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [user.orgId, limit, (page - 1) * limit],
    );
    const countRes = await query('SELECT COUNT(*) as count FROM payments WHERE payer_org_id = $1 OR beneficiary_org_id = $1', [user.orgId]);
    const total = parseInt(countRes.rows[0].count, 10);
    res.json({ success: true, data: rows, error: null, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch { res.status(500).json(errorResponse('Failed')); }
});

app.post('/api/payments', async (req, res) => {
  try {
    const user = getUser(req);
    const { invoice_id, payer_account, amount, currency } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] as string;

    // Idempotency check
    if (idempotencyKey) {
      const existing = await query('SELECT * FROM payments WHERE idempotency_key = $1', [idempotencyKey]);
      if (existing.rows.length > 0) return res.json(successResponse(existing.rows[0]));
    }

    // Validate account via mock finacle
    const acc = finacleAccounts.get(payer_account);
    if (!acc) return res.status(400).json(errorResponse('Invalid payer account'));

    // Get invoice info
    const invRes = await query('SELECT * FROM invoices WHERE invoice_id = $1', [invoice_id]);
    if (invRes.rows.length === 0) return res.status(404).json(errorResponse('Invoice not found'));
    const invoice = invRes.rows[0];

    const beneficiaryAccount = invoice.sender_org_id === user.orgId ? '2001000001' : '1001000001';

    const { rows } = await query(
      `INSERT INTO payments (invoice_id, invoice_no, payer_org_id, payer_account, beneficiary_org_id, beneficiary_account,
        amount, currency, payment_status, initiated_by, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PAYMENT_PENDING',$9,$10) RETURNING *`,
      [invoice_id, invoice.invoice_no, user.orgId, payer_account, invoice.sender_org_id, beneficiaryAccount, amount, currency, user.userId, idempotencyKey],
    );

    // Process payment synchronously (mock finacle transfer)
    const payment = rows[0];
    setTimeout(async () => {
      try {
        const payerAcc = finacleAccounts.get(payer_account);
        const beneAcc = finacleAccounts.get(beneficiaryAccount);
        if (!payerAcc || !beneAcc) {
          await query("UPDATE payments SET payment_status = 'PAYMENT_FAILED', updated_at = NOW() WHERE payment_id = $1", [payment.payment_id]);
          return;
        }
        if (payerAcc.balance < amount) {
          await query("UPDATE payments SET payment_status = 'PAYMENT_FAILED', updated_at = NOW() WHERE payment_id = $1", [payment.payment_id]);
          return;
        }
        // Execute transfer
        payerAcc.balance -= amount;
        beneAcc.balance += amount;
        const txnRef = `FIN-${Date.now()}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
        finacleTransactions.set(txnRef, { debit_account: payer_account, credit_account: beneficiaryAccount, amount, currency, status: 'SUCCESS' });

        await query("UPDATE payments SET payment_status = 'PAID', finacle_txn_ref = $1, updated_at = NOW() WHERE payment_id = $2", [txnRef, payment.payment_id]);

        // Update invoice paid amount + status
        const invRes = await query('SELECT total_amount, paid_amount, status FROM invoices WHERE invoice_id = $1', [invoice_id]);
        if (invRes.rows.length > 0) {
          const inv = invRes.rows[0];
          const newPaid = Number(inv.paid_amount) + amount;
          const total = Number(inv.total_amount);
          const newOutstanding = Math.max(0, total - newPaid);
          const newStatus = newPaid >= total ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : inv.status;
          await query('UPDATE invoices SET paid_amount = $1, outstanding_amount = $2, status = $3, updated_at = NOW() WHERE invoice_id = $4', [newPaid, newOutstanding, newStatus, invoice_id]);
          if (newStatus !== inv.status) {
            await query("INSERT INTO invoice_status_history (invoice_id, from_status, to_status, changed_by, reason) VALUES ($1,$2,$3,'00000000-0000-0000-0000-000000000000','Payment received')", [invoice_id, inv.status, newStatus]);
          }
        }

        // Notification
        await query('INSERT INTO notifications (org_id, type, title, message, entity_type, entity_id) VALUES ($1,$2,$3,$4,$5,$6)',
          [invoice.sender_org_id, 'PAYMENT_RECEIVED', 'Төлбөр хүлээн авлаа', `${invoice.invoice_no} нэхэмжлэхийн ${amount} ${currency} төлбөр хүлээн авлаа`, 'payment', payment.payment_id]);

        logger.info({ paymentId: payment.payment_id, txnRef }, 'Payment completed');
      } catch (err) {
        logger.error({ err, paymentId: payment.payment_id }, 'Payment processing failed');
        await query("UPDATE payments SET payment_status = 'PAYMENT_FAILED', updated_at = NOW() WHERE payment_id = $1", [payment.payment_id]).catch(() => {});
      }
    }, 500);

    res.status(201).json(successResponse(payment));
  } catch (err) { logger.error({ err }, 'Create payment failed'); res.status(500).json(errorResponse('Failed')); }
});

app.get('/api/payments/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM payments WHERE payment_id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json(errorResponse('Not found'));
    res.json(successResponse(rows[0]));
  } catch { res.status(500).json(errorResponse('Failed')); }
});

app.get('/api/payments/by-invoice/:invoiceId', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC', [req.params.invoiceId]);
    res.json(successResponse(rows));
  } catch { res.status(500).json(errorResponse('Failed')); }
});

// ─── NOTIFICATIONS ────────────────────────────────────
app.get('/api/notifications', async (req, res) => {
  try {
    const user = getUser(req);
    const { rows } = await query('SELECT * FROM notifications WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50', [user.orgId]);
    res.json({ success: true, data: rows, error: null, meta: { total: rows.length, page: 1, limit: 50, totalPages: 1 } });
  } catch { res.status(500).json(errorResponse('Failed')); }
});

app.get('/api/notifications/unread-count', async (req, res) => {
  try {
    const user = getUser(req);
    const { rows } = await query('SELECT COUNT(*) as count FROM notifications WHERE org_id = $1 AND is_read = false', [user.orgId]);
    res.json(successResponse({ unreadCount: parseInt(rows[0].count, 10) }));
  } catch { res.status(500).json(errorResponse('Failed')); }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1', [req.params.id]);
    res.json(successResponse({ success: true }));
  } catch { res.status(500).json(errorResponse('Failed')); }
});

app.post('/api/notifications/mark-all-read', async (req, res) => {
  try {
    const user = getUser(req);
    await query('UPDATE notifications SET is_read = true, read_at = NOW() WHERE org_id = $1', [user.orgId]);
    res.json(successResponse({ success: true }));
  } catch { res.status(500).json(errorResponse('Failed')); }
});

// ─── MOCK FINACLE API ─────────────────────────────────
app.post('/api/finacle/accounts/validate', (req, res) => {
  const acc = finacleAccounts.get(req.body.account_no);
  if (!acc) return res.status(404).json({ success: false, error: 'Account not found' });
  res.json({ success: true, data: { valid: true, account_no: req.body.account_no, ...acc } });
});

app.post('/api/finacle/accounts/balance', (req, res) => {
  const acc = finacleAccounts.get(req.body.account_no);
  if (!acc) return res.status(404).json({ success: false, error: 'Account not found' });
  res.json({ success: true, data: { account_no: req.body.account_no, balance: acc.balance, currency: acc.currency } });
});

// ─── Error Handler ────────────────────────────────────
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json(errorResponse('Route not found'));
});

// ─── Start ────────────────────────────────────────────
async function start() {
  await runMigrations();

  // Seed data
  const orgCheck = await query('SELECT COUNT(*) as count FROM organizations');
  if (parseInt(orgCheck.rows[0].count, 10) === 0) {
    logger.info('Seeding initial data...');
    await query("INSERT INTO organizations (org_id, name, registration_no) VALUES ('a0000000-0000-0000-0000-000000000001', 'Монгол Технологи ХХК', 'REG-001') ON CONFLICT DO NOTHING");
    await query("INSERT INTO organizations (org_id, name, registration_no) VALUES ('b0000000-0000-0000-0000-000000000002', 'Улаанбаатар Худалдаа ХХК', 'REG-002') ON CONFLICT DO NOTHING");
    await query("INSERT INTO accounts (org_id, account_no, currency) VALUES ('a0000000-0000-0000-0000-000000000001', '1001000001', 'MNT') ON CONFLICT DO NOTHING");
    await query("INSERT INTO accounts (org_id, account_no, currency) VALUES ('a0000000-0000-0000-0000-000000000001', '1001000002', 'USD') ON CONFLICT DO NOTHING");
    await query("INSERT INTO accounts (org_id, account_no, currency) VALUES ('b0000000-0000-0000-0000-000000000002', '2001000001', 'MNT') ON CONFLICT DO NOTHING");
    await query("INSERT INTO accounts (org_id, account_no, currency) VALUES ('b0000000-0000-0000-0000-000000000002', '2001000002', 'USD') ON CONFLICT DO NOTHING");
    const hash = await bcrypt.hash('password123', 10);
    const users = [
      ['c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'maker_a', 'maker@orgA.mn', 'Бат Болд', 'CORPORATE_MAKER'],
      ['c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'approver_a', 'approver@orgA.mn', 'Дорж Сүхбат', 'CORPORATE_APPROVER'],
      ['c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'user_a', 'user@orgA.mn', 'Оюунаа Бямба', 'CORPORATE_USER'],
      ['c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'maker_b', 'maker@orgB.mn', 'Ганбаатар Эрдэнэ', 'CORPORATE_MAKER'],
      ['c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'approver_b', 'approver@orgB.mn', 'Мөнхбат Тэмүүлэн', 'CORPORATE_APPROVER'],
      ['c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'user_b', 'user@orgB.mn', 'Сарнай Энхтуяа', 'CORPORATE_USER'],
      ['c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'admin', 'admin@bank.mn', 'Систем Админ', 'SYSTEM_ADMIN'],
      ['c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'operator', 'operator@bank.mn', 'Банк Оператор', 'BANK_OPERATOR'],
    ];
    for (const [id, orgId, username, email, fullName, role] of users) {
      await query('INSERT INTO users (user_id, org_id, username, email, password_hash, full_name, role) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',
        [id, orgId, username, email, hash, fullName, role]);
    }
    logger.info('Seed data inserted');
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`M-Bank unified server listening on port ${PORT}`);
  });
}

start().catch((err) => { logger.error({ err }, 'Failed to start'); process.exit(1); });

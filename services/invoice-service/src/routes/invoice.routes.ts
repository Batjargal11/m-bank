import { Router } from 'express';
import { authMiddleware, requirePermission } from '@m-bank/shared-middleware';
import { config } from '../config';
import * as controller from '../controllers/invoice.controller';

const router = Router();
const auth = authMiddleware(config.jwtSecret);

// All routes require authentication
router.use(auth);

// GET /invoices - list invoices
router.get('/', controller.getInvoices);

// POST /invoices - create invoice
router.post('/', requirePermission('invoice:create'), controller.createInvoice);

// GET /invoices/stats - dashboard stats
router.get('/stats', controller.getDashboardStats);

// GET /invoices/:id - get invoice detail
router.get('/:id', requirePermission('invoice:view'), controller.getInvoiceById);

// PUT /invoices/:id - update draft invoice
router.put('/:id', requirePermission('invoice:create'), controller.updateInvoice);

// DELETE /invoices/:id - delete draft invoice
router.delete('/:id', requirePermission('invoice:create'), controller.deleteInvoice);

// POST /invoices/:id/send - send invoice
router.post('/:id/send', requirePermission('invoice:send'), controller.sendInvoice);

// POST /invoices/:id/view - mark invoice as viewed
router.post('/:id/view', requirePermission('invoice:view'), controller.viewInvoice);

// POST /invoices/:id/cancel - request cancellation
router.post('/:id/cancel', controller.requestCancel);

// GET /invoices/:id/history - get status history
router.get('/:id/history', requirePermission('invoice:view'), controller.getStatusHistory);

export default router;

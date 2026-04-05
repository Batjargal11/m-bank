import { Router } from 'express';
import { authMiddleware, requirePermission } from '@m-bank/shared-middleware';
import { config } from '../config';
import * as controller from '../controllers/payment.controller';

const router = Router();
const auth = authMiddleware(config.jwtSecret);

// All routes require authentication
router.use(auth);

// GET /payments - list payments
router.get('/', controller.getPayments);

// POST /payments - initiate payment
router.post('/', requirePermission('invoice:pay'), controller.initiatePayment);

// GET /payments/by-invoice/:invoiceId - get payments for an invoice
router.get('/by-invoice/:invoiceId', controller.getPaymentsByInvoice);

// GET /payments/:id - get payment detail
router.get('/:id', controller.getPaymentById);

// POST /payments/:id/approve - approve payment
router.post('/:id/approve', requirePermission('payment:approve'), controller.approvePayment);

// POST /payments/:id/reject - reject payment
router.post('/:id/reject', requirePermission('payment:approve'), controller.rejectPayment);

export default router;

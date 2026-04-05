import { Router } from 'express';
import * as controller from '../controllers/einvoice.controller';

const router = Router();

// POST /einvoice/invoices - Register a new e-invoice
router.post('/invoices', controller.registerInvoice);

// GET /einvoice/invoices/:ref - Get e-invoice details
router.get('/invoices/:ref', controller.getInvoice);

// PUT /einvoice/invoices/:ref/cancel - Cancel an e-invoice
router.put('/invoices/:ref/cancel', controller.cancelInvoice);

// GET /einvoice/invoices/:ref/status - Get e-invoice status
router.get('/invoices/:ref/status', controller.getInvoiceStatus);

export default router;

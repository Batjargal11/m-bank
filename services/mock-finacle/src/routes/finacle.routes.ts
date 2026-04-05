import { Router } from 'express';
import * as controller from '../controllers/finacle.controller';

const router = Router();

// POST /finacle/accounts/validate - Validate an account
router.post('/accounts/validate', controller.validateAccount);

// POST /finacle/accounts/balance - Get account balance
router.post('/accounts/balance', controller.getBalance);

// POST /finacle/transfer - Perform a transfer
router.post('/transfer', controller.performTransfer);

// GET /finacle/transactions/:ref - Get transaction by reference
router.get('/transactions/:ref', controller.getTransaction);

export default router;

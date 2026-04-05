import { Router } from 'express';
import { validateAccount, checkBalance } from '../controllers/internal.controller';

const router = Router();

router.post('/finacle/validate-account', validateAccount);
router.post('/finacle/check-balance', checkBalance);

export default router;

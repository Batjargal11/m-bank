import { Router } from 'express';
import { authMiddleware } from '@m-bank/shared-middleware';
import * as authController from '../controllers/auth.controller';
import { config } from '../config';

const router = Router();

router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authMiddleware(config.jwtSecret), authController.logout);
router.post('/verify-token', authController.verifyToken);

export default router;

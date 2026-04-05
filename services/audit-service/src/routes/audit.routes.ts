import { Router } from 'express';
import { authMiddleware, requirePermission } from '@m-bank/shared-middleware';
import { config } from '../config';
import * as controller from '../controllers/audit.controller';

const router = Router();
const auth = authMiddleware(config.jwtSecret);

// All routes require authentication + report:view permission
router.use(auth);

// GET /audit/logs - list audit logs
router.get('/logs', requirePermission('report:view'), controller.getAuditLogs);

// GET /audit/logs/correlation/:correlationId - get logs by correlation ID
router.get('/logs/correlation/:correlationId', requirePermission('report:view'), controller.getByCorrelationId);

export default router;

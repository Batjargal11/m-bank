import { Router } from 'express';
import { authMiddleware, requirePermission } from '@m-bank/shared-middleware';
import { config } from '../config';
import * as controller from '../controllers/integration-log.controller';

const router = Router();
const auth = authMiddleware(config.jwtSecret);

// All routes require authentication + report:view permission
router.use(auth);

// GET /audit/integration-logs - list integration logs
router.get('/', requirePermission('report:view'), controller.getIntegrationLogs);

// GET /audit/integration-logs/:id - get integration log by ID
router.get('/:id', requirePermission('report:view'), controller.getById);

export default router;

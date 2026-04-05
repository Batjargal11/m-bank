import { Router } from 'express';
import { authMiddleware, requirePermission } from '@m-bank/shared-middleware';
import * as orgController from '../controllers/org.controller';
import { config } from '../config';

const router = Router();
const auth = authMiddleware(config.jwtSecret);

router.get('/', auth, orgController.getOrganizations);
router.post('/', auth, requirePermission('org:manage'), orgController.createOrganization);
router.get('/:id', auth, orgController.getOrganizationById);
router.put('/:id', auth, requirePermission('org:manage'), orgController.updateOrganization);
router.get('/:id/accounts', auth, orgController.getAccounts);
router.post('/:id/accounts', auth, requirePermission('org:manage'), orgController.addAccount);

export default router;

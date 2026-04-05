import { Router } from 'express';
import { authMiddleware, requirePermission } from '@m-bank/shared-middleware';
import * as userController from '../controllers/user.controller';
import { config } from '../config';

const router = Router();
const auth = authMiddleware(config.jwtSecret);

router.get('/', auth, userController.getUsers);
router.post('/', auth, requirePermission('user:manage'), userController.createUser);
router.get('/:id', auth, userController.getUserById);
router.put('/:id', auth, requirePermission('user:manage'), userController.updateUser);
router.patch('/:id/status', auth, requirePermission('user:manage'), userController.toggleUserStatus);

export default router;

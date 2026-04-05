import { Router } from 'express';
import { authMiddleware } from '@m-bank/shared-middleware';
import { config } from '../config';
import * as controller from '../controllers/notification.controller';

const router = Router();
const auth = authMiddleware(config.jwtSecret);

// All routes require authentication
router.use(auth);

// GET /notifications - list notifications
router.get('/', controller.getNotifications);

// GET /notifications/unread-count - get unread count
router.get('/unread-count', controller.getUnreadCount);

// PATCH /notifications/:id/read - mark as read
router.patch('/:id/read', controller.markAsRead);

// POST /notifications/mark-all-read - mark all as read
router.post('/mark-all-read', controller.markAllAsRead);

export default router;

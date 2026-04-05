import { Request, Response, NextFunction } from 'express';
import { successResponse } from '@m-bank/shared-types';
import { ValidationError, parsePagination } from '@m-bank/shared-utils';
import * as notificationService from '../services/notification.service';

function getUserInfo(req: Request): { userId: string; orgId: string } {
  const userId = req.user?.userId || (req.headers['x-user-id'] as string);
  const orgId = req.user?.orgId || (req.headers['x-org-id'] as string);

  if (!userId || !orgId) {
    throw new ValidationError('Missing user or organization context');
  }

  return { userId, orgId };
}

export async function getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, orgId } = getUserInfo(req);
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const pagination = parsePagination({ page, limit });

    const result = await notificationService.getNotifications(userId, orgId, pagination, page);

    res.json(successResponse(result.notifications, result.meta));
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = getUserInfo(req);
    const count = await notificationService.getUnreadCount(userId);

    res.json(successResponse({ unreadCount: count }));
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = getUserInfo(req);
    const notification = await notificationService.markAsRead(req.params.id, userId);

    res.json(successResponse(notification));
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = getUserInfo(req);
    const count = await notificationService.markAllAsRead(userId);

    res.json(successResponse({ markedCount: count }));
  } catch (err) {
    next(err);
  }
}

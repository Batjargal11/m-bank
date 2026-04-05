import { Notification, PaginationMeta } from '@m-bank/shared-types';
import { PaginationParams, buildPaginationMeta, NotFoundError } from '@m-bank/shared-utils';
import * as notificationRepo from '../repositories/notification.repository';
import { CreateNotificationDto } from '../repositories/notification.repository';

export async function getNotifications(
  userId: string,
  orgId: string,
  pagination: PaginationParams,
  page: number,
): Promise<{ notifications: Notification[]; meta: PaginationMeta }> {
  const result = userId
    ? await notificationRepo.findByUserId(userId, pagination)
    : await notificationRepo.findByOrgId(orgId, pagination);

  const meta = buildPaginationMeta(result.total, page, pagination.limit);
  return { notifications: result.notifications, meta };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return notificationRepo.getUnreadCount(userId);
}

export async function markAsRead(id: string, userId: string): Promise<Notification> {
  const notification = await notificationRepo.markAsRead(id);

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  if (notification.user_id && notification.user_id !== userId) {
    throw new NotFoundError('Notification not found');
  }

  return notification;
}

export async function markAllAsRead(userId: string): Promise<number> {
  return notificationRepo.markAllAsRead(userId);
}

export async function createNotification(dto: CreateNotificationDto): Promise<Notification> {
  return notificationRepo.create(dto);
}

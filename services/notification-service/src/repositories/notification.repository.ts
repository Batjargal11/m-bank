import { Notification, NotificationType } from '@m-bank/shared-types';
import { PaginationParams } from '@m-bank/shared-utils';
import { query } from '../db/connection';

export interface CreateNotificationDto {
  org_id: string;
  user_id?: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
}

export async function findByUserId(
  userId: string,
  pagination: PaginationParams,
): Promise<{ notifications: Notification[]; total: number }> {
  const countResult = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1',
    [userId],
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const sortOrder = pagination.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const dataResult = await query<Notification>(
    `SELECT * FROM notifications WHERE user_id = $1
     ORDER BY created_at ${sortOrder}
     LIMIT $2 OFFSET $3`,
    [userId, pagination.limit, pagination.offset],
  );

  return { notifications: dataResult.rows, total };
}

export async function findByOrgId(
  orgId: string,
  pagination: PaginationParams,
): Promise<{ notifications: Notification[]; total: number }> {
  const countResult = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM notifications WHERE org_id = $1',
    [orgId],
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const sortOrder = pagination.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const dataResult = await query<Notification>(
    `SELECT * FROM notifications WHERE org_id = $1
     ORDER BY created_at ${sortOrder}
     LIMIT $2 OFFSET $3`,
    [orgId, pagination.limit, pagination.offset],
  );

  return { notifications: dataResult.rows, total };
}

export async function create(dto: CreateNotificationDto): Promise<Notification> {
  const result = await query<Notification>(
    `INSERT INTO notifications (org_id, user_id, type, title, message, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      dto.org_id,
      dto.user_id || null,
      dto.type,
      dto.title,
      dto.message,
      dto.entity_type || null,
      dto.entity_id || null,
    ],
  );

  return result.rows[0];
}

export async function markAsRead(id: string): Promise<Notification | null> {
  const result = await query<Notification>(
    `UPDATE notifications SET is_read = true, read_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id],
  );

  return result.rows[0] || null;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await query(
    `UPDATE notifications SET is_read = true, read_at = NOW()
     WHERE user_id = $1 AND is_read = false`,
    [userId],
  );

  return result.rowCount || 0;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
    [userId],
  );

  return parseInt(result.rows[0].count, 10);
}

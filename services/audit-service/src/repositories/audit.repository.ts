import { AuditLog, CreateAuditLogDto } from '@m-bank/shared-types';
import { PaginationParams } from '@m-bank/shared-utils';
import { query } from '../db/connection';

export interface AuditLogFilters {
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  org_id?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function createAuditLog(dto: CreateAuditLogDto): Promise<AuditLog> {
  const result = await query<AuditLog>(
    `INSERT INTO audit_logs (user_id, org_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, correlation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      dto.user_id || null,
      dto.org_id || null,
      dto.action,
      dto.entity_type,
      dto.entity_id || null,
      dto.old_value ? JSON.stringify(dto.old_value) : null,
      dto.new_value ? JSON.stringify(dto.new_value) : null,
      dto.ip_address || null,
      dto.user_agent || null,
      dto.correlation_id,
    ],
  );

  return result.rows[0];
}

export async function findAuditLogs(
  filters: AuditLogFilters,
  pagination: PaginationParams,
): Promise<{ logs: AuditLog[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.entity_type) {
    conditions.push(`entity_type = $${paramIndex++}`);
    params.push(filters.entity_type);
  }

  if (filters.entity_id) {
    conditions.push(`entity_id = $${paramIndex++}`);
    params.push(filters.entity_id);
  }

  if (filters.user_id) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(filters.user_id);
  }

  if (filters.org_id) {
    conditions.push(`org_id = $${paramIndex++}`);
    params.push(filters.org_id);
  }

  if (filters.dateFrom) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.dateTo);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const sortOrder = pagination.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const dataResult = await query<AuditLog>(
    `SELECT * FROM audit_logs ${whereClause}
     ORDER BY created_at ${sortOrder}
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, pagination.limit, pagination.offset],
  );

  return { logs: dataResult.rows, total };
}

export async function findByCorrelationId(correlationId: string): Promise<AuditLog[]> {
  const result = await query<AuditLog>(
    'SELECT * FROM audit_logs WHERE correlation_id = $1 ORDER BY created_at ASC',
    [correlationId],
  );

  return result.rows;
}

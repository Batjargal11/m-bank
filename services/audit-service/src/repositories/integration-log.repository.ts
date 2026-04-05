import { IntegrationLog } from '@m-bank/shared-types';
import { PaginationParams } from '@m-bank/shared-utils';
import { query } from '../db/connection';

export interface CreateIntegrationLogDto {
  target_system: string;
  request_type: string;
  request_url?: string;
  request_body?: Record<string, unknown>;
  response_code?: number;
  response_body?: Record<string, unknown>;
  retry_count?: number;
  status: string;
  error_message?: string;
  correlation_id: string;
  duration_ms?: number;
}

export interface IntegrationLogFilters {
  target_system?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function createIntegrationLog(dto: CreateIntegrationLogDto): Promise<IntegrationLog> {
  const result = await query<IntegrationLog>(
    `INSERT INTO integration_logs (target_system, request_type, request_url, request_body, response_code, response_body, retry_count, status, error_message, correlation_id, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      dto.target_system,
      dto.request_type,
      dto.request_url || null,
      dto.request_body ? JSON.stringify(dto.request_body) : null,
      dto.response_code || null,
      dto.response_body ? JSON.stringify(dto.response_body) : null,
      dto.retry_count || 0,
      dto.status,
      dto.error_message || null,
      dto.correlation_id,
      dto.duration_ms || null,
    ],
  );

  return result.rows[0];
}

export async function findIntegrationLogs(
  filters: IntegrationLogFilters,
  pagination: PaginationParams,
): Promise<{ logs: IntegrationLog[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.target_system) {
    conditions.push(`target_system = $${paramIndex++}`);
    params.push(filters.target_system);
  }

  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
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
    `SELECT COUNT(*) as count FROM integration_logs ${whereClause}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const sortOrder = pagination.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const dataResult = await query<IntegrationLog>(
    `SELECT * FROM integration_logs ${whereClause}
     ORDER BY created_at ${sortOrder}
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, pagination.limit, pagination.offset],
  );

  return { logs: dataResult.rows, total };
}

export async function findById(id: string): Promise<IntegrationLog | null> {
  const result = await query<IntegrationLog>(
    'SELECT * FROM integration_logs WHERE id = $1',
    [id],
  );

  return result.rows[0] || null;
}

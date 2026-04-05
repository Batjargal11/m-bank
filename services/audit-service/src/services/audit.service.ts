import { AuditLog, CreateAuditLogDto, PaginationMeta } from '@m-bank/shared-types';
import { PaginationParams, buildPaginationMeta } from '@m-bank/shared-utils';
import * as auditRepo from '../repositories/audit.repository';
import { AuditLogFilters } from '../repositories/audit.repository';

export async function getAuditLogs(
  filters: AuditLogFilters,
  pagination: PaginationParams,
  page: number,
): Promise<{ logs: AuditLog[]; meta: PaginationMeta }> {
  const result = await auditRepo.findAuditLogs(filters, pagination);
  const meta = buildPaginationMeta(result.total, page, pagination.limit);
  return { logs: result.logs, meta };
}

export async function getByCorrelationId(correlationId: string): Promise<AuditLog[]> {
  return auditRepo.findByCorrelationId(correlationId);
}

export async function createLog(dto: CreateAuditLogDto): Promise<AuditLog> {
  return auditRepo.createAuditLog(dto);
}

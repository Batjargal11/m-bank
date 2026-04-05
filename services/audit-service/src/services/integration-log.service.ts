import { IntegrationLog, PaginationMeta } from '@m-bank/shared-types';
import { PaginationParams, buildPaginationMeta, NotFoundError } from '@m-bank/shared-utils';
import * as integrationLogRepo from '../repositories/integration-log.repository';
import { IntegrationLogFilters, CreateIntegrationLogDto } from '../repositories/integration-log.repository';

export async function getIntegrationLogs(
  filters: IntegrationLogFilters,
  pagination: PaginationParams,
  page: number,
): Promise<{ logs: IntegrationLog[]; meta: PaginationMeta }> {
  const result = await integrationLogRepo.findIntegrationLogs(filters, pagination);
  const meta = buildPaginationMeta(result.total, page, pagination.limit);
  return { logs: result.logs, meta };
}

export async function getById(id: string): Promise<IntegrationLog> {
  const log = await integrationLogRepo.findById(id);

  if (!log) {
    throw new NotFoundError('Integration log not found');
  }

  return log;
}

export async function createLog(dto: CreateIntegrationLogDto): Promise<IntegrationLog> {
  return integrationLogRepo.createIntegrationLog(dto);
}

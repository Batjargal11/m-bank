import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, CreateAuditLogDto } from '@m-bank/shared-types';
import { createLogger } from '@m-bank/shared-utils';
import { config } from '../config';
import * as auditService from '../services/audit.service';
import * as integrationLogService from '../services/integration-log.service';
import { CreateIntegrationLogDto } from '../repositories/integration-log.repository';

const logger = createLogger('audit-consumers');

let auditWorker: Worker | null = null;
let integrationWorker: Worker | null = null;

interface IntegrationLogEvent {
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

export function startConsumers(): void {
  const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

  auditWorker = new Worker(
    QUEUE_NAMES.AUDIT_LOG,
    async (job: Job<CreateAuditLogDto | IntegrationLogEvent>) => {
      const data = job.data;

      logger.info({ jobId: job.id, action: (data as CreateAuditLogDto).action }, 'Processing audit log event');

      // Determine if this is an integration log or audit log
      if ('target_system' in data) {
        const integrationData = data as CreateIntegrationLogDto;
        await integrationLogService.createLog(integrationData);
        logger.info(
          { targetSystem: integrationData.target_system, correlationId: integrationData.correlation_id },
          'Integration log created',
        );
      } else {
        const auditData = data as CreateAuditLogDto;
        await auditService.createLog(auditData);
        logger.info(
          { action: auditData.action, entityType: auditData.entity_type, correlationId: auditData.correlation_id },
          'Audit log created',
        );
      }
    },
    { connection, concurrency: 10 },
  );

  auditWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Audit log worker job failed');
  });

  logger.info('Audit BullMQ consumers started');
}

export async function stopConsumers(): Promise<void> {
  const workers = [auditWorker, integrationWorker];
  await Promise.all(
    workers.filter(Boolean).map((w) => w!.close()),
  );
}

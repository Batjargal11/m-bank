import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, FinacleResultEvent, EinvoiceResultEvent, EventType } from '@m-bank/shared-types';
import { config } from '../config';

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

const finacleResultQueue = new Queue(QUEUE_NAMES.FINACLE_RESULT, { connection });
const einvoiceResultQueue = new Queue(QUEUE_NAMES.EINVOICE_RESULT, { connection });
const auditLogQueue = new Queue(QUEUE_NAMES.AUDIT_LOG, { connection });
const integrationRetryQueue = new Queue(QUEUE_NAMES.INTEGRATION_RETRY, { connection });

export async function publishFinacleResult(
  event: FinacleResultEvent,
): Promise<void> {
  await finacleResultQueue.add(
    EventType.FINACLE_RESULT,
    event,
    {
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

export async function publishEinvoiceResult(
  event: EinvoiceResultEvent,
): Promise<void> {
  await einvoiceResultQueue.add(
    EventType.EINVOICE_RESULT,
    event,
    {
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

export async function publishAuditLog(event: {
  eventId: string;
  correlationId: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  orgId: string;
  details: Record<string, unknown>;
  timestamp: string;
}): Promise<void> {
  await auditLogQueue.add(
    EventType.AUDIT_LOG,
    event,
    {
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

export async function publishRetry(
  outboxId: string,
  targetSystem: string,
  operation: string,
  payload: Record<string, unknown>,
  correlationId: string,
  retryCount: number,
): Promise<void> {
  await integrationRetryQueue.add(
    'integration.retry',
    {
      outboxId,
      targetSystem,
      operation,
      payload,
      correlationId,
      retryCount,
    },
    {
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

export async function closeQueues(): Promise<void> {
  await finacleResultQueue.close();
  await einvoiceResultQueue.close();
  await auditLogQueue.close();
  await integrationRetryQueue.close();
  await connection.quit();
}

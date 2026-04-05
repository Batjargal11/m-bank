import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, InvoiceStatusChangedEvent, EventType } from '@m-bank/shared-types';
import { config } from '../config';

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

const invoiceStatusQueue = new Queue(QUEUE_NAMES.INVOICE_STATUS_CHANGED, { connection });
const auditLogQueue = new Queue(QUEUE_NAMES.AUDIT_LOG, { connection });

export async function publishInvoiceStatusChanged(
  event: InvoiceStatusChangedEvent,
): Promise<void> {
  await invoiceStatusQueue.add(
    EventType.INVOICE_STATUS_CHANGED,
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

export async function closeQueues(): Promise<void> {
  await invoiceStatusQueue.close();
  await auditLogQueue.close();
  await connection.quit();
}

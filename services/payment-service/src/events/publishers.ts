import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  QUEUE_NAMES,
  PaymentInitiatedEvent,
  PaymentStatusChangedEvent,
  EventType,
} from '@m-bank/shared-types';
import { config } from '../config';

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

const paymentInitiatedQueue = new Queue(QUEUE_NAMES.PAYMENT_INITIATED, { connection });
const paymentStatusChangedQueue = new Queue(QUEUE_NAMES.PAYMENT_STATUS_CHANGED, { connection });
const auditLogQueue = new Queue(QUEUE_NAMES.AUDIT_LOG, { connection });

export async function publishPaymentInitiated(
  event: PaymentInitiatedEvent,
): Promise<void> {
  await paymentInitiatedQueue.add(
    EventType.PAYMENT_INITIATED,
    event,
    {
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

export async function publishPaymentStatusChanged(
  event: PaymentStatusChangedEvent,
): Promise<void> {
  await paymentStatusChangedQueue.add(
    EventType.PAYMENT_STATUS_CHANGED,
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
  await paymentInitiatedQueue.close();
  await paymentStatusChangedQueue.close();
  await auditLogQueue.close();
  await connection.quit();
}

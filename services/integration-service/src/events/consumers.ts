import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  QUEUE_NAMES,
  PaymentInitiatedEvent,
  InvoiceStatusChangedEvent,
  EventType,
  InvoiceStatus,
} from '@m-bank/shared-types';
import { createLogger } from '@m-bank/shared-utils';
import { config } from '../config';
import { processPayment } from '../services/finacle.service';
import { syncInvoice, syncCancellation, EinvoiceSyncInput } from '../services/einvoice.service';
import { publishFinacleResult, publishEinvoiceResult, publishAuditLog } from './publishers';
import * as finacleAdapter from '../adapters/finacle.adapter';
import * as einvoiceAdapter from '../adapters/einvoice.adapter';
import { query } from '../db/connection';
import { calculateNextRetry, isRetryable } from '../retry/retry.strategy';

const logger = createLogger('integration-consumers');

let paymentWorker: Worker | null = null;
let invoiceWorker: Worker | null = null;
let retryWorker: Worker | null = null;

export function startConsumers(): void {
  const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

  paymentWorker = new Worker(
    QUEUE_NAMES.PAYMENT_INITIATED,
    async (job: Job<PaymentInitiatedEvent>) => {
      const event = job.data;
      logger.info({ eventId: event.eventId, paymentId: event.payload.paymentId }, 'Processing payment.initiated event');

      const result = await processPayment(event);

      await publishFinacleResult({
        eventId: uuidv4(),
        eventType: EventType.FINACLE_RESULT,
        correlationId: event.correlationId,
        timestamp: new Date().toISOString(),
        source: 'integration-service',
        payload: {
          paymentId: result.paymentId,
          success: result.success,
          txnRef: result.txnRef,
          errorMessage: result.errorMessage,
        },
      });

      await publishAuditLog({
        eventId: uuidv4(),
        correlationId: event.correlationId,
        action: result.success ? 'FINACLE_TRANSFER_SUCCESS' : 'FINACLE_TRANSFER_FAILED',
        entityType: 'payment',
        entityId: result.paymentId,
        userId: 'system',
        orgId: 'system',
        details: {
          txnRef: result.txnRef,
          success: result.success,
          errorMessage: result.errorMessage,
        },
        timestamp: new Date().toISOString(),
      });

      logger.info({ paymentId: result.paymentId, success: result.success }, 'Payment processing completed');
    },
    { connection, concurrency: 5 },
  );

  invoiceWorker = new Worker(
    QUEUE_NAMES.INVOICE_STATUS_CHANGED,
    async (job: Job<InvoiceStatusChangedEvent>) => {
      const event = job.data;
      const { toStatus, invoiceId, invoiceNo, senderOrgId, receiverOrgId, amount, currency } = event.payload;

      logger.info({ eventId: event.eventId, invoiceId, toStatus }, 'Processing invoice.status-changed event');

      if (toStatus === InvoiceStatus.SENT) {
        const syncData: EinvoiceSyncInput = {
          invoiceId,
          invoiceNo,
          senderOrgId,
          receiverOrgId,
          amount,
          vatAmount: 0,
          currency,
          issueDate: new Date().toISOString(),
          dueDate: new Date().toISOString(),
          items: [],
          correlationId: event.correlationId,
        };

        const result = await syncInvoice(syncData);

        await publishEinvoiceResult({
          eventId: uuidv4(),
          eventType: EventType.EINVOICE_RESULT,
          correlationId: event.correlationId,
          timestamp: new Date().toISOString(),
          source: 'integration-service',
          payload: {
            invoiceId,
            success: result.success,
            einvoiceRef: result.einvoiceRef,
            errorMessage: result.errorMessage,
          },
        });

        logger.info({ invoiceId, success: result.success }, 'Invoice sync completed');
      } else if (toStatus === InvoiceStatus.CANCEL_REQUESTED) {
        const result = await syncCancellation(invoiceId, event.correlationId);

        await publishEinvoiceResult({
          eventId: uuidv4(),
          eventType: EventType.EINVOICE_RESULT,
          correlationId: event.correlationId,
          timestamp: new Date().toISOString(),
          source: 'integration-service',
          payload: {
            invoiceId,
            success: result.success,
            einvoiceRef: result.einvoiceRef,
            errorMessage: result.errorMessage,
          },
        });

        logger.info({ invoiceId, success: result.success }, 'Invoice cancellation sync completed');
      }
    },
    { connection, concurrency: 5 },
  );

  retryWorker = new Worker(
    QUEUE_NAMES.INTEGRATION_RETRY,
    async (job: Job<{
      outboxId: string;
      targetSystem: string;
      operation: string;
      payload: Record<string, unknown>;
      correlationId: string;
      retryCount: number;
    }>) => {
      const { outboxId, targetSystem, operation, payload, correlationId, retryCount } = job.data;
      logger.info({ outboxId, targetSystem, operation, retryCount }, 'Processing retry');

      let success = false;
      let errorMessage: string | null = null;

      try {
        if (targetSystem === 'FINACLE' && operation === 'TRANSFER') {
          const result = await finacleAdapter.transfer(
            payload.payerAccount as string,
            payload.beneficiaryAccount as string,
            payload.amount as number,
            payload.currency as string,
            payload.reference as string,
          );
          success = result.success;
          errorMessage = result.errorMessage;
        } else if (targetSystem === 'EINVOICE' && operation === 'REGISTER') {
          const result = await einvoiceAdapter.registerInvoice(payload as unknown as import('../adapters/einvoice.adapter').EinvoiceRegisterRequest);
          success = result.success;
          errorMessage = result.errorMessage;
        } else if (targetSystem === 'EINVOICE' && operation === 'CANCEL') {
          const result = await einvoiceAdapter.cancelInvoice(payload.invoiceRef as string);
          success = result.success;
          errorMessage = result.errorMessage;
        }

        if (success) {
          await query(
            `UPDATE integration_outbox SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
            [outboxId],
          );
          logger.info({ outboxId }, 'Retry succeeded, marked as COMPLETED');
        } else {
          const newRetryCount = retryCount + 1;
          if (isRetryable(newRetryCount, 5)) {
            const nextRetryAt = calculateNextRetry(newRetryCount);
            await query(
              `UPDATE integration_outbox SET retry_count = $1, next_retry_at = $2, last_error = $3, updated_at = NOW() WHERE id = $4`,
              [newRetryCount, nextRetryAt.toISOString(), errorMessage, outboxId],
            );
            logger.warn({ outboxId, newRetryCount }, 'Retry failed, scheduled next attempt');
          } else {
            await query(
              `UPDATE integration_outbox SET status = 'FAILED', last_error = $1, updated_at = NOW() WHERE id = $2`,
              [errorMessage, outboxId],
            );
            logger.error({ outboxId }, 'Retry exhausted, marked as FAILED');
          }
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const newRetryCount = retryCount + 1;

        if (isRetryable(newRetryCount, 5)) {
          const nextRetryAt = calculateNextRetry(newRetryCount);
          await query(
            `UPDATE integration_outbox SET retry_count = $1, next_retry_at = $2, last_error = $3, updated_at = NOW() WHERE id = $4`,
            [newRetryCount, nextRetryAt.toISOString(), message, outboxId],
          );
        } else {
          await query(
            `UPDATE integration_outbox SET status = 'FAILED', last_error = $1, updated_at = NOW() WHERE id = $2`,
            [message, outboxId],
          );
        }

        logger.error({ error, outboxId }, 'Retry processing error');
      }
    },
    { connection, concurrency: 3 },
  );

  paymentWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Payment worker job failed');
  });

  invoiceWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Invoice worker job failed');
  });

  retryWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Retry worker job failed');
  });

  logger.info('BullMQ consumers started');
}

export async function stopConsumers(): Promise<void> {
  if (paymentWorker) {
    await paymentWorker.close();
  }
  if (invoiceWorker) {
    await invoiceWorker.close();
  }
  if (retryWorker) {
    await retryWorker.close();
  }
}

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, PaymentStatusChangedEvent, EinvoiceResultEvent, PaymentStatus } from '@m-bank/shared-types';
import { createLogger } from '@m-bank/shared-utils';
import { config } from '../config';
import { updatePayment, findById } from '../repositories/invoice.repository';
import { query } from '../db/connection';

const logger = createLogger('invoice-consumers');

let paymentWorker: Worker | null = null;
let einvoiceWorker: Worker | null = null;

export function startConsumers(): void {
  const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

  paymentWorker = new Worker(
    QUEUE_NAMES.PAYMENT_STATUS_CHANGED,
    async (job: Job<PaymentStatusChangedEvent>) => {
      const event = job.data;
      logger.info({ eventId: event.eventId, invoiceId: event.payload.invoiceId }, 'Processing payment status changed event');

      if (event.payload.toStatus === PaymentStatus.PAID || event.payload.toStatus === PaymentStatus.PARTIALLY_PAID) {
        const result = await updatePayment(event.payload.invoiceId, event.payload.amount);
        if (result) {
          logger.info(
            { invoiceId: event.payload.invoiceId, paidAmount: event.payload.amount, newStatus: result.status },
            'Invoice payment updated',
          );
        } else {
          logger.warn({ invoiceId: event.payload.invoiceId }, 'Invoice not found for payment update');
        }
      }
    },
    { connection, concurrency: 5 },
  );

  einvoiceWorker = new Worker(
    QUEUE_NAMES.EINVOICE_RESULT,
    async (job: Job<EinvoiceResultEvent>) => {
      const event = job.data;
      logger.info({ eventId: event.eventId, invoiceId: event.payload.invoiceId }, 'Processing e-invoice result event');

      if (event.payload.success && event.payload.einvoiceRef) {
        await query(
          'UPDATE invoices SET external_einvoice_ref = $1, updated_at = NOW() WHERE invoice_id = $2',
          [event.payload.einvoiceRef, event.payload.invoiceId],
        );
        logger.info(
          { invoiceId: event.payload.invoiceId, einvoiceRef: event.payload.einvoiceRef },
          'E-invoice reference updated',
        );
      } else if (!event.payload.success) {
        logger.error(
          { invoiceId: event.payload.invoiceId, error: event.payload.errorMessage },
          'E-invoice sync failed',
        );
      }
    },
    { connection, concurrency: 5 },
  );

  paymentWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Payment status worker job failed');
  });

  einvoiceWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'E-invoice result worker job failed');
  });

  logger.info('BullMQ consumers started');
}

export async function stopConsumers(): Promise<void> {
  if (paymentWorker) {
    await paymentWorker.close();
  }
  if (einvoiceWorker) {
    await einvoiceWorker.close();
  }
}

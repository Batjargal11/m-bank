import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import {
  QUEUE_NAMES,
  FinacleResultEvent,
  PaymentStatus,
  EventType,
} from '@m-bank/shared-types';
import { createLogger } from '@m-bank/shared-utils';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import * as paymentRepo from '../repositories/payment.repository';
import { publishPaymentStatusChanged } from './publishers';

const logger = createLogger('payment-consumers');

let finacleResultWorker: Worker | null = null;

export function startConsumers(): void {
  const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

  finacleResultWorker = new Worker(
    QUEUE_NAMES.FINACLE_RESULT,
    async (job: Job<FinacleResultEvent>) => {
      const event = job.data;
      logger.info(
        { eventId: event.eventId, paymentId: event.payload.paymentId },
        'Processing finacle result event',
      );

      const payment = await paymentRepo.findById(event.payload.paymentId);
      if (!payment) {
        logger.warn({ paymentId: event.payload.paymentId }, 'Payment not found for finacle result');
        return;
      }

      if (event.payload.success && event.payload.txnRef) {
        const updatedPayment = await paymentRepo.updateStatus(
          event.payload.paymentId,
          PaymentStatus.PAID,
          event.payload.txnRef,
        );

        if (updatedPayment) {
          await publishPaymentStatusChanged({
            eventId: uuidv4(),
            eventType: EventType.PAYMENT_STATUS_CHANGED,
            correlationId: event.correlationId,
            timestamp: new Date().toISOString(),
            source: 'payment-service',
            payload: {
              paymentId: updatedPayment.payment_id,
              invoiceId: updatedPayment.invoice_id,
              invoiceNo: updatedPayment.invoice_no,
              fromStatus: PaymentStatus.PAYMENT_PROCESSING,
              toStatus: PaymentStatus.PAID,
              amount: Number(updatedPayment.amount),
              currency: updatedPayment.currency,
              finacleTxnRef: event.payload.txnRef,
              payerOrgId: updatedPayment.payer_org_id,
              beneficiaryOrgId: updatedPayment.beneficiary_org_id,
            },
          });

          logger.info(
            { paymentId: updatedPayment.payment_id, txnRef: event.payload.txnRef },
            'Payment marked as PAID',
          );
        }
      } else {
        const updatedPayment = await paymentRepo.updateStatus(
          event.payload.paymentId,
          PaymentStatus.PAYMENT_FAILED,
        );

        if (updatedPayment) {
          await publishPaymentStatusChanged({
            eventId: uuidv4(),
            eventType: EventType.PAYMENT_STATUS_CHANGED,
            correlationId: event.correlationId,
            timestamp: new Date().toISOString(),
            source: 'payment-service',
            payload: {
              paymentId: updatedPayment.payment_id,
              invoiceId: updatedPayment.invoice_id,
              invoiceNo: updatedPayment.invoice_no,
              fromStatus: PaymentStatus.PAYMENT_PROCESSING,
              toStatus: PaymentStatus.PAYMENT_FAILED,
              amount: Number(updatedPayment.amount),
              currency: updatedPayment.currency,
              finacleTxnRef: null,
              payerOrgId: updatedPayment.payer_org_id,
              beneficiaryOrgId: updatedPayment.beneficiary_org_id,
            },
          });

          logger.error(
            { paymentId: updatedPayment.payment_id, error: event.payload.errorMessage },
            'Payment marked as PAYMENT_FAILED',
          );
        }
      }
    },
    { connection, concurrency: 5 },
  );

  finacleResultWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Finacle result worker job failed');
  });

  logger.info('BullMQ consumers started');
}

export async function stopConsumers(): Promise<void> {
  if (finacleResultWorker) {
    await finacleResultWorker.close();
  }
}

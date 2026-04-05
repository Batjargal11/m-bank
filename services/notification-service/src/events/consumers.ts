import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import {
  QUEUE_NAMES,
  InvoiceStatusChangedEvent,
  PaymentStatusChangedEvent,
  NotificationType,
  InvoiceStatus,
  PaymentStatus,
} from '@m-bank/shared-types';
import { createLogger } from '@m-bank/shared-utils';
import { config } from '../config';
import * as notificationService from '../services/notification.service';
import * as emailService from '../services/email.service';
import * as templates from '../templates';

const logger = createLogger('notification-consumers');

let invoiceWorker: Worker | null = null;
let paymentWorker: Worker | null = null;
let notificationWorker: Worker | null = null;

interface NotificationSendPayload {
  to: string;
  subject: string;
  html: string;
}

export function startConsumers(): void {
  const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

  invoiceWorker = new Worker(
    QUEUE_NAMES.INVOICE_STATUS_CHANGED,
    async (job: Job<InvoiceStatusChangedEvent>) => {
      const event = job.data;
      const { payload } = event;

      logger.info(
        { eventId: event.eventId, invoiceId: payload.invoiceId, toStatus: payload.toStatus },
        'Processing invoice status changed for notifications',
      );

      if (payload.toStatus === InvoiceStatus.SENT || payload.toStatus === InvoiceStatus.RECEIVED) {
        await notificationService.createNotification({
          org_id: payload.receiverOrgId,
          type: NotificationType.INVOICE_RECEIVED,
          title: 'New Invoice Received',
          message: `Invoice ${payload.invoiceNo} received for ${payload.amount} ${payload.currency}`,
          entity_type: 'invoice',
          entity_id: payload.invoiceId,
        });

        logger.info({ invoiceId: payload.invoiceId }, 'INVOICE_RECEIVED notification created');
      }

      if (payload.toStatus === InvoiceStatus.CANCELLED) {
        await notificationService.createNotification({
          org_id: payload.senderOrgId,
          type: NotificationType.INVOICE_CANCELLED,
          title: 'Invoice Cancelled',
          message: `Invoice ${payload.invoiceNo} has been cancelled`,
          entity_type: 'invoice',
          entity_id: payload.invoiceId,
        });

        await notificationService.createNotification({
          org_id: payload.receiverOrgId,
          type: NotificationType.INVOICE_CANCELLED,
          title: 'Invoice Cancelled',
          message: `Invoice ${payload.invoiceNo} has been cancelled`,
          entity_type: 'invoice',
          entity_id: payload.invoiceId,
        });

        logger.info({ invoiceId: payload.invoiceId }, 'INVOICE_CANCELLED notifications created for both orgs');
      }
    },
    { connection, concurrency: 5 },
  );

  paymentWorker = new Worker(
    QUEUE_NAMES.PAYMENT_STATUS_CHANGED,
    async (job: Job<PaymentStatusChangedEvent>) => {
      const event = job.data;
      const { payload } = event;

      logger.info(
        { eventId: event.eventId, paymentId: payload.paymentId, toStatus: payload.toStatus },
        'Processing payment status changed for notifications',
      );

      if (payload.toStatus === PaymentStatus.PAID) {
        await notificationService.createNotification({
          org_id: payload.beneficiaryOrgId,
          type: NotificationType.PAYMENT_RECEIVED,
          title: 'Payment Received',
          message: `Payment of ${payload.amount} ${payload.currency} received for invoice ${payload.invoiceNo}`,
          entity_type: 'payment',
          entity_id: payload.paymentId,
        });

        logger.info({ paymentId: payload.paymentId }, 'PAYMENT_RECEIVED notification created');
      }

      if (payload.toStatus === PaymentStatus.PAYMENT_FAILED) {
        await notificationService.createNotification({
          org_id: payload.payerOrgId,
          type: NotificationType.PAYMENT_FAILED,
          title: 'Payment Failed',
          message: `Payment for invoice ${payload.invoiceNo} has failed. Amount: ${payload.amount} ${payload.currency}`,
          entity_type: 'payment',
          entity_id: payload.paymentId,
        });

        logger.info({ paymentId: payload.paymentId }, 'PAYMENT_FAILED notification created');
      }
    },
    { connection, concurrency: 5 },
  );

  notificationWorker = new Worker(
    QUEUE_NAMES.NOTIFICATION_SEND,
    async (job: Job<NotificationSendPayload>) => {
      const { to, subject, html } = job.data;

      logger.info({ to, subject }, 'Processing email notification');

      await emailService.sendEmail(to, subject, html);
    },
    { connection, concurrency: 3 },
  );

  invoiceWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Invoice notification worker job failed');
  });

  paymentWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Payment notification worker job failed');
  });

  notificationWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Email notification worker job failed');
  });

  logger.info('Notification BullMQ consumers started');
}

export async function stopConsumers(): Promise<void> {
  const workers = [invoiceWorker, paymentWorker, notificationWorker];
  await Promise.all(
    workers.filter(Boolean).map((w) => w!.close()),
  );
}

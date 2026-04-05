import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@m-bank/shared-utils';
import * as einvoiceAdapter from '../adapters/einvoice.adapter';
import { EinvoiceRegisterRequest } from '../adapters/einvoice.adapter';
import { query } from '../db/connection';
import { calculateNextRetry } from '../retry/retry.strategy';

const logger = createLogger('einvoice-service');

export interface EinvoiceSyncResult {
  success: boolean;
  invoiceId: string;
  einvoiceRef: string | null;
  errorMessage: string | null;
}

export interface EinvoiceSyncInput {
  invoiceId: string;
  invoiceNo: string;
  senderOrgId: string;
  receiverOrgId: string;
  amount: number;
  vatAmount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  items: ReadonlyArray<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxAmount: number;
    totalPrice: number;
  }>;
  correlationId: string;
}

export async function syncInvoice(
  data: EinvoiceSyncInput,
): Promise<EinvoiceSyncResult> {
  const { invoiceId, invoiceNo, correlationId } = data;
  logger.info({ invoiceId, invoiceNo, correlationId }, 'Syncing invoice to e-Invoice system');

  try {
    const request: EinvoiceRegisterRequest = {
      invoiceNo: data.invoiceNo,
      senderOrgId: data.senderOrgId,
      receiverOrgId: data.receiverOrgId,
      amount: data.amount,
      vatAmount: data.vatAmount,
      currency: data.currency,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      items: data.items,
    };

    const result = await einvoiceAdapter.registerInvoice(request);

    if (!result.success) {
      logger.error({ invoiceId, error: result.errorMessage }, 'e-Invoice registration failed, storing to outbox');

      await storeToOutbox(
        'EINVOICE',
        'REGISTER',
        { ...data, correlationId: undefined },
        correlationId,
      );

      return {
        success: false,
        invoiceId,
        einvoiceRef: null,
        errorMessage: result.errorMessage,
      };
    }

    logger.info({ invoiceId, einvoiceRef: result.einvoiceRef }, 'Invoice registered successfully');
    return {
      success: true,
      invoiceId,
      einvoiceRef: result.einvoiceRef,
      errorMessage: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, invoiceId }, 'Unexpected error syncing invoice');

    await storeToOutbox(
      'EINVOICE',
      'REGISTER',
      { ...data, correlationId: undefined },
      correlationId,
    );

    return {
      success: false,
      invoiceId,
      einvoiceRef: null,
      errorMessage: message,
    };
  }
}

export async function syncCancellation(
  invoiceRef: string,
  correlationId: string,
): Promise<EinvoiceSyncResult> {
  logger.info({ invoiceRef, correlationId }, 'Syncing cancellation to e-Invoice system');

  try {
    const result = await einvoiceAdapter.cancelInvoice(invoiceRef);

    if (!result.success) {
      logger.error({ invoiceRef, error: result.errorMessage }, 'e-Invoice cancellation failed, storing to outbox');

      await storeToOutbox(
        'EINVOICE',
        'CANCEL',
        { invoiceRef },
        correlationId,
      );

      return {
        success: false,
        invoiceId: invoiceRef,
        einvoiceRef: invoiceRef,
        errorMessage: result.errorMessage,
      };
    }

    logger.info({ invoiceRef }, 'Invoice cancellation synced successfully');
    return {
      success: true,
      invoiceId: invoiceRef,
      einvoiceRef: invoiceRef,
      errorMessage: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, invoiceRef }, 'Unexpected error syncing cancellation');

    await storeToOutbox(
      'EINVOICE',
      'CANCEL',
      { invoiceRef },
      correlationId,
    );

    return {
      success: false,
      invoiceId: invoiceRef,
      einvoiceRef: invoiceRef,
      errorMessage: message,
    };
  }
}

async function storeToOutbox(
  targetSystem: string,
  operation: string,
  payload: Record<string, unknown>,
  correlationId: string,
): Promise<void> {
  const nextRetryAt = calculateNextRetry(0);

  await query(
    `INSERT INTO integration_outbox (id, target_system, operation, payload, correlation_id, retry_count, max_retries, next_retry_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      uuidv4(),
      targetSystem,
      operation,
      JSON.stringify(payload),
      correlationId,
      0,
      5,
      nextRetryAt.toISOString(),
      'PENDING',
    ],
  );

  logger.info({ targetSystem, operation, correlationId }, 'Stored to outbox for retry');
}

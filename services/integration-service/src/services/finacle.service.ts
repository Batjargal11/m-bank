import { v4 as uuidv4 } from 'uuid';
import { PaymentInitiatedEvent } from '@m-bank/shared-types';
import { createLogger } from '@m-bank/shared-utils';
import * as finacleAdapter from '../adapters/finacle.adapter';
import { query } from '../db/connection';
import { calculateNextRetry } from '../retry/retry.strategy';

const logger = createLogger('finacle-service');

export interface FinaclePaymentResult {
  success: boolean;
  paymentId: string;
  txnRef: string | null;
  errorMessage: string | null;
}

export async function processPayment(
  event: PaymentInitiatedEvent,
): Promise<FinaclePaymentResult> {
  const { paymentId, payerAccount, beneficiaryAccount, amount, currency, invoiceNo } = event.payload;
  const correlationId = event.correlationId;

  logger.info({ paymentId, correlationId }, 'Processing payment via Finacle');

  try {
    const validation = await finacleAdapter.validateAccount(payerAccount);
    if (!validation.success) {
      logger.warn({ paymentId, payerAccount }, 'Payer account validation failed');
      return {
        success: false,
        paymentId,
        txnRef: null,
        errorMessage: `Account validation failed: ${validation.errorMessage}`,
      };
    }

    const balance = await finacleAdapter.checkBalance(payerAccount);
    if (!balance.success) {
      logger.warn({ paymentId, payerAccount }, 'Balance check failed');
      return {
        success: false,
        paymentId,
        txnRef: null,
        errorMessage: `Balance check failed: ${balance.errorMessage}`,
      };
    }

    if (balance.availableBalance < amount) {
      logger.warn({ paymentId, available: balance.availableBalance, required: amount }, 'Insufficient balance');
      return {
        success: false,
        paymentId,
        txnRef: null,
        errorMessage: `Insufficient balance: available ${balance.availableBalance}, required ${amount}`,
      };
    }

    const reference = `PAY-${invoiceNo}-${paymentId.slice(0, 8)}`;
    const transferResult = await finacleAdapter.transfer(
      payerAccount,
      beneficiaryAccount,
      amount,
      currency,
      reference,
    );

    if (!transferResult.success) {
      logger.error({ paymentId, error: transferResult.errorMessage }, 'Transfer failed, storing to outbox for retry');

      await storeToOutbox(
        'FINACLE',
        'TRANSFER',
        {
          paymentId,
          payerAccount,
          beneficiaryAccount,
          amount,
          currency,
          reference,
        },
        correlationId,
      );

      return {
        success: false,
        paymentId,
        txnRef: null,
        errorMessage: transferResult.errorMessage,
      };
    }

    logger.info({ paymentId, txnRef: transferResult.txnRef }, 'Transfer completed successfully');
    return {
      success: true,
      paymentId,
      txnRef: transferResult.txnRef,
      errorMessage: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, paymentId }, 'Unexpected error processing payment');

    await storeToOutbox(
      'FINACLE',
      'TRANSFER',
      {
        paymentId,
        payerAccount,
        beneficiaryAccount,
        amount,
        currency,
        reference: `PAY-${invoiceNo}-${paymentId.slice(0, 8)}`,
      },
      correlationId,
    );

    return {
      success: false,
      paymentId,
      txnRef: null,
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

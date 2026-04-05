import { createLogger } from '@m-bank/shared-utils';
import * as paymentRepo from '../repositories/payment.repository';

const logger = createLogger('idempotency-service');

const IDEMPOTENCY_TTL_HOURS = 24;

export interface CachedResponse {
  statusCode: number;
  body: Record<string, unknown>;
}

export async function checkIdempotencyKey(
  key: string,
): Promise<CachedResponse | null> {
  const record = await paymentRepo.findByIdempotencyKey(key);

  if (!record) {
    return null;
  }

  if (record.response_body && record.status_code) {
    logger.info({ key }, 'Idempotency key found, returning cached response');
    return {
      statusCode: record.status_code,
      body: record.response_body,
    };
  }

  return null;
}

export async function storeIdempotencyKey(
  key: string,
  paymentId: string,
  statusCode: number,
  responseBody: Record<string, unknown>,
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

  await paymentRepo.saveIdempotencyKey({
    idempotency_key: key,
    payment_id: paymentId,
    response_body: responseBody,
    status_code: statusCode,
    expires_at: expiresAt.toISOString(),
  });

  logger.info({ key, paymentId }, 'Idempotency key stored');
}

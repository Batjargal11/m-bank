import { InvoiceStatus, canTransition } from '@m-bank/shared-types';
import { AppError } from '@m-bank/shared-utils';

export function validateTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(
      `Invalid status transition from ${from} to ${to}`,
      400,
      'INVALID_STATUS_TRANSITION',
    );
  }
}

export function getAutoTransitions(
  currentStatus: InvoiceStatus,
): InvoiceStatus | null {
  if (currentStatus === InvoiceStatus.SENT) {
    return InvoiceStatus.RECEIVED;
  }
  return null;
}

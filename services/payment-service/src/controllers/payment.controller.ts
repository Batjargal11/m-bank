import { Request, Response, NextFunction } from 'express';
import { successResponse } from '@m-bank/shared-types';
import { ValidationError, getCorrelationId } from '@m-bank/shared-utils';
import * as paymentService from '../services/payment.service';
import {
  createPaymentSchema,
  paymentQuerySchema,
  rejectPaymentSchema,
} from '../validators/payment.validator';

function getUserInfo(req: Request): { userId: string; orgId: string } {
  const userId = req.user?.userId || (req.headers['x-user-id'] as string);
  const orgId = req.user?.orgId || (req.headers['x-org-id'] as string);

  if (!userId || !orgId) {
    throw new ValidationError('Missing user or organization context');
  }

  return { userId, orgId };
}

export async function getPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgId } = getUserInfo(req);
    const queryParams = paymentQuerySchema.parse(req.query);

    const result = await paymentService.getPayments(
      orgId,
      {
        status: queryParams.status,
        dateFrom: queryParams.dateFrom,
        dateTo: queryParams.dateTo,
      },
      {
        page: queryParams.page,
        limit: queryParams.limit,
        sortBy: queryParams.sortBy,
        sortOrder: queryParams.sortOrder,
      },
    );

    res.json(successResponse(result.payments, result.meta));
  } catch (err) {
    next(err);
  }
}

export async function getPaymentById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgId } = getUserInfo(req);
    const payment = await paymentService.getPaymentById(req.params.id, orgId);
    res.json(successResponse(payment));
  } catch (err) {
    next(err);
  }
}

export async function initiatePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, orgId } = getUserInfo(req);
    const dto = createPaymentSchema.parse(req.body);
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    const { payment, cached } = await paymentService.initiatePayment(
      dto,
      userId,
      orgId,
      idempotencyKey,
    );

    const statusCode = cached ? 200 : 201;
    res.status(statusCode).json(successResponse(payment));
  } catch (err) {
    next(err);
  }
}

export async function approvePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, orgId } = getUserInfo(req);
    const payment = await paymentService.approvePayment(req.params.id, userId, orgId);
    res.json(successResponse(payment));
  } catch (err) {
    next(err);
  }
}

export async function rejectPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, orgId } = getUserInfo(req);
    const { reason } = rejectPaymentSchema.parse(req.body);
    const payment = await paymentService.rejectPayment(req.params.id, userId, orgId, reason);
    res.json(successResponse(payment));
  } catch (err) {
    next(err);
  }
}

export async function getPaymentsByInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    getUserInfo(req); // Verify auth
    const payments = await paymentService.getPaymentsByInvoice(req.params.invoiceId);
    res.json(successResponse(payments));
  } catch (err) {
    next(err);
  }
}

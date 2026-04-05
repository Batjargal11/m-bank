import { Request, Response, NextFunction } from 'express';
import { successResponse } from '@m-bank/shared-types';
import { ValidationError, getCorrelationId } from '@m-bank/shared-utils';
import * as invoiceService from '../services/invoice.service';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceQuerySchema,
  cancelRequestSchema,
} from '../validators/invoice.validator';

function getUserInfo(req: Request): { userId: string; orgId: string; orgName: string } {
  const userId = req.user?.userId || (req.headers['x-user-id'] as string);
  const orgId = req.user?.orgId || (req.headers['x-org-id'] as string);
  const orgName = (req.headers['x-org-name'] as string) || 'Unknown';

  if (!userId || !orgId) {
    throw new ValidationError('Missing user or organization context');
  }

  return { userId, orgId, orgName };
}

export async function getInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgId } = getUserInfo(req);
    const queryParams = invoiceQuerySchema.parse(req.query);

    const result = await invoiceService.getInvoices(
      orgId,
      {
        direction: queryParams.direction,
        status: queryParams.status,
        dateFrom: queryParams.dateFrom,
        dateTo: queryParams.dateTo,
        dueDateFrom: queryParams.dueDateFrom,
        dueDateTo: queryParams.dueDateTo,
      },
      {
        page: queryParams.page,
        limit: queryParams.limit,
        sortBy: queryParams.sortBy,
        sortOrder: queryParams.sortOrder,
      },
    );

    res.json(successResponse(result.invoices, result.meta));
  } catch (err) {
    next(err);
  }
}

export async function getInvoiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgId } = getUserInfo(req);
    const invoice = await invoiceService.getInvoiceById(req.params.id, orgId);
    res.json(successResponse(invoice));
  } catch (err) {
    next(err);
  }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, orgId, orgName } = getUserInfo(req);
    const dto = createInvoiceSchema.parse(req.body);
    const correlationId = getCorrelationId(req);

    const invoice = await invoiceService.createInvoice(dto, userId, orgId, orgName, correlationId);
    res.status(201).json(successResponse(invoice));
  } catch (err) {
    next(err);
  }
}

export async function updateInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, orgId } = getUserInfo(req);
    const dto = updateInvoiceSchema.parse(req.body);

    const invoice = await invoiceService.updateInvoice(req.params.id, dto, userId, orgId);
    res.json(successResponse(invoice));
  } catch (err) {
    next(err);
  }
}

export async function deleteInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgId } = getUserInfo(req);
    await invoiceService.deleteInvoice(req.params.id, orgId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function sendInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, orgId } = getUserInfo(req);
    const correlationId = getCorrelationId(req);

    const invoice = await invoiceService.sendInvoice(req.params.id, userId, orgId, correlationId);
    res.json(successResponse(invoice));
  } catch (err) {
    next(err);
  }
}

export async function viewInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, orgId } = getUserInfo(req);
    const correlationId = getCorrelationId(req);

    const invoice = await invoiceService.viewInvoice(req.params.id, userId, orgId, correlationId);
    res.json(successResponse(invoice));
  } catch (err) {
    next(err);
  }
}

export async function requestCancel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, orgId } = getUserInfo(req);
    const { reason } = cancelRequestSchema.parse(req.body);
    const correlationId = getCorrelationId(req);

    const invoice = await invoiceService.requestCancel(req.params.id, userId, orgId, reason, correlationId);
    res.json(successResponse(invoice));
  } catch (err) {
    next(err);
  }
}

export async function getStatusHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgId } = getUserInfo(req);

    // Verify access first
    await invoiceService.getInvoiceById(req.params.id, orgId);

    const history = await invoiceService.getStatusHistory(req.params.id);
    res.json(successResponse(history));
  } catch (err) {
    next(err);
  }
}

export async function getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgId } = getUserInfo(req);
    const stats = await invoiceService.getDashboardStats(orgId);
    res.json(successResponse(stats));
  } catch (err) {
    next(err);
  }
}

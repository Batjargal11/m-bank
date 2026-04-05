import { Request, Response, NextFunction } from 'express';
import { successResponse } from '@m-bank/shared-types';
import { parsePagination } from '@m-bank/shared-utils';
import * as auditService from '../services/audit.service';

export async function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const pagination = parsePagination({ page, limit });

    const filters = {
      entity_type: req.query.entity_type as string | undefined,
      entity_id: req.query.entity_id as string | undefined,
      user_id: req.query.user_id as string | undefined,
      org_id: req.query.org_id as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };

    const result = await auditService.getAuditLogs(filters, pagination, page);

    res.json(successResponse(result.logs, result.meta));
  } catch (err) {
    next(err);
  }
}

export async function getByCorrelationId(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const logs = await auditService.getByCorrelationId(req.params.correlationId);

    res.json(successResponse(logs));
  } catch (err) {
    next(err);
  }
}

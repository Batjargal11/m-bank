import { Request, Response, NextFunction } from 'express';
import { successResponse } from '@m-bank/shared-types';
import { parsePagination } from '@m-bank/shared-utils';
import * as integrationLogService from '../services/integration-log.service';

export async function getIntegrationLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const pagination = parsePagination({ page, limit });

    const filters = {
      target_system: req.query.target_system as string | undefined,
      status: req.query.status as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };

    const result = await integrationLogService.getIntegrationLogs(filters, pagination, page);

    res.json(successResponse(result.logs, result.meta));
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const log = await integrationLogService.getById(req.params.id);

    res.json(successResponse(log));
  } catch (err) {
    next(err);
  }
}

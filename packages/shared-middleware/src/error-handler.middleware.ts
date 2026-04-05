import { Request, Response, NextFunction } from 'express';
import { AppError } from '@m-bank/shared-utils';
import { errorResponse } from '@m-bank/shared-types';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const correlationId = (req as any).correlationId || 'unknown';

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      ...errorResponse(err.message),
      code: err.code,
      correlationId,
    });
    return;
  }

  console.error(`[${correlationId}] Unhandled error:`, err);
  res.status(500).json({
    ...errorResponse('Internal server error'),
    code: 'INTERNAL_ERROR',
    correlationId,
  });
}

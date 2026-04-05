import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

const CORRELATION_HEADER = 'x-correlation-id';

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const existingId = req.headers[CORRELATION_HEADER] as string | undefined;
  const correlationId = existingId || uuidv4();

  req.headers[CORRELATION_HEADER] = correlationId;
  (req as unknown as Record<string, unknown>).correlationId = correlationId;

  next();
}

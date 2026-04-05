import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

const CORRELATION_HEADER = 'x-correlation-id';

export function correlationMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const correlationId = (req.headers[CORRELATION_HEADER] as string) || uuidv4();
  req.headers[CORRELATION_HEADER] = correlationId;
  (req as any).correlationId = correlationId;
  next();
}

export function getCorrelationId(req: Request): string {
  return (req as any).correlationId || (req.headers[CORRELATION_HEADER] as string) || uuidv4();
}

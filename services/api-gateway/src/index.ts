import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createLogger } from '@m-bank/shared-utils';
import { config } from './config';
import { requestIdMiddleware } from './middleware/request-id';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { authMiddleware } from './middleware/auth';
import { setupProxies } from './proxy';
import healthRouter from './health';

const logger = createLogger('api-gateway');

function startServer(): void {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: ['http://localhost:5173', 'http://localhost:4173'],
      credentials: true,
    }),
  );
  app.use(express.json());

  app.use(requestIdMiddleware);
  app.use(rateLimitMiddleware);

  app.use(healthRouter);

  app.use(authMiddleware);

  setupProxies(app);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      data: null,
      error: 'Route not found',
    });
  });

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      logger.error({ err }, 'Unhandled error');
      res.status(500).json({
        success: false,
        data: null,
        error: 'Internal server error',
      });
    },
  );

  app.listen(config.port, () => {
    logger.info(`API Gateway listening on port ${config.port}`);
  });
}

startServer();

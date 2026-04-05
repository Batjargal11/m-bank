import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createLogger, correlationMiddleware } from '@m-bank/shared-utils';
import { requestLogger, errorHandler } from '@m-bank/shared-middleware';
import { successResponse } from '@m-bank/shared-types';
import { config } from './config';
import { pool, query } from './db/connection';
import internalRoutes from './routes/internal.routes';
import { startConsumers, stopConsumers } from './events/consumers';
import { publishRetry, closeQueues } from './events/publishers';

const logger = createLogger('integration-service');

async function runMigrations(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT id FROM migrations WHERE filename = $1',
        [file],
      );

      if (rows.length > 0) {
        logger.info(`Migration ${file} already applied, skipping.`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [file],
        );
        await client.query('COMMIT');
        logger.info(`Migration ${file} applied successfully.`);
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error({ err, file }, `Migration ${file} failed`);
        throw err;
      }
    }

    logger.info('All migrations completed.');
  } finally {
    client.release();
  }
}

async function sweepOutbox(): Promise<void> {
  try {
    const { rows } = await query<{
      id: string;
      target_system: string;
      operation: string;
      payload: Record<string, unknown>;
      correlation_id: string;
      retry_count: number;
    }>(
      `SELECT id, target_system, operation, payload, correlation_id, retry_count
       FROM integration_outbox
       WHERE status = 'PENDING' AND next_retry_at <= NOW()
       ORDER BY next_retry_at ASC
       LIMIT 50`,
    );

    if (rows.length === 0) {
      return;
    }

    logger.info({ count: rows.length }, 'Outbox sweep found items to retry');

    for (const row of rows) {
      await publishRetry(
        row.id,
        row.target_system,
        row.operation,
        row.payload,
        row.correlation_id,
        row.retry_count,
      );
    }
  } catch (error: unknown) {
    logger.error({ error }, 'Outbox sweep failed');
  }
}

async function startServer(): Promise<void> {
  await runMigrations();

  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(correlationMiddleware);
  app.use(requestLogger(logger));

  app.get('/health', (_req, res) => {
    res.json(successResponse({ status: 'healthy', service: 'integration-service' }));
  });

  app.use('/internal', internalRoutes);

  app.use(errorHandler);

  startConsumers();

  const outboxInterval = setInterval(sweepOutbox, 30_000);

  const server = app.listen(config.port, () => {
    logger.info(`Integration service listening on port ${config.port}`);
  });

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down integration service...');
    clearInterval(outboxInterval);
    server.close();
    await stopConsumers();
    await closeQueues();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  logger.error({ err }, 'Failed to start integration service');
  process.exit(1);
});

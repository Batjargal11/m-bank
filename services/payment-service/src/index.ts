import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createLogger, correlationMiddleware } from '@m-bank/shared-utils';
import { requestLogger, errorHandler } from '@m-bank/shared-middleware';
import { successResponse } from '@m-bank/shared-types';
import { config } from './config';
import { pool } from './db/connection';
import paymentRoutes from './routes/payment.routes';
import { startConsumers, stopConsumers } from './events/consumers';

const logger = createLogger('payment-service');

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

async function startServer(): Promise<void> {
  await runMigrations();

  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(correlationMiddleware);
  app.use(requestLogger(logger));

  app.get('/health', (_req, res) => {
    res.json(successResponse({ status: 'healthy', service: 'payment-service' }));
  });

  app.use('/payments', paymentRoutes);

  app.use(errorHandler);

  startConsumers();

  const server = app.listen(config.port, () => {
    logger.info(`Payment service listening on port ${config.port}`);
  });

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down payment service...');
    await stopConsumers();
    await pool.end();
    server.close(() => {
      logger.info('Payment service stopped.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  logger.error({ err }, 'Failed to start payment service');
  process.exit(1);
});

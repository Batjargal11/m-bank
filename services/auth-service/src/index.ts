import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createLogger, correlationMiddleware } from '@m-bank/shared-utils';
import { requestLogger, errorHandler } from '@m-bank/shared-middleware';
import { successResponse } from '@m-bank/shared-types';
import { config } from './config';
import { pool } from './db/connection';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import orgRoutes from './routes/org.routes';

const logger = createLogger('auth-service');

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
    res.json(successResponse({ status: 'healthy', service: 'auth-service' }));
  });

  app.use('/auth', authRoutes);
  app.use('/users', userRoutes);
  app.use('/organizations', orgRoutes);

  // Internal endpoints (no auth required, called by other services)
  app.get('/internal/orgs/:id', async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT org_id, name, registration_no, is_active FROM organizations WHERE org_id = $1',
        [req.params.id],
      );
      if (rows.length === 0) {
        res.status(404).json({ success: false, data: null, error: 'Organization not found' });
        return;
      }
      res.json({ success: true, data: rows[0], error: null });
    } catch (err) {
      next(err);
    }
  });

  app.get('/internal/users/:id', async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT user_id, org_id, username, full_name, role FROM users WHERE user_id = $1',
        [req.params.id],
      );
      if (rows.length === 0) {
        res.status(404).json({ success: false, data: null, error: 'User not found' });
        return;
      }
      res.json({ success: true, data: rows[0], error: null });
    } catch (err) {
      next(err);
    }
  });

  app.use(errorHandler);

  app.listen(config.port, () => {
    logger.info(`Auth service listening on port ${config.port}`);
  });
}

startServer().catch((err) => {
  logger.error({ err }, 'Failed to start auth service');
  process.exit(1);
});

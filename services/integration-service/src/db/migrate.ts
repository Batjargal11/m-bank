import fs from 'fs';
import path from 'path';
import { pool } from './connection';
import { createLogger } from '@m-bank/shared-utils';

const logger = createLogger('integration-migrate');

async function runMigrations(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
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

runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'Migration runner failed');
    process.exit(1);
  });

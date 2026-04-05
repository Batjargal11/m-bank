function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: requireEnv('REDIS_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  integrationServiceUrl: process.env.INTEGRATION_SERVICE_URL || 'http://integration-service:3004',
  invoiceDatabaseUrl: process.env.INVOICE_DATABASE_URL || process.env.DATABASE_URL?.replace('payment_db', 'invoice_db') || '',
  finacleUrl: process.env.FINACLE_URL || 'http://localhost:4010',
};

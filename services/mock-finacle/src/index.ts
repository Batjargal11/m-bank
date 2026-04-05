import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';
import finacleRoutes from './routes/finacle.routes';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

const PORT = parseInt(process.env.PORT || '3010', 10);

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Incoming request');
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: { status: 'healthy', service: 'mock-finacle' },
  });
});

// Mount finacle routes
app.use('/finacle', finacleRoutes);

app.listen(PORT, () => {
  logger.info(`Mock Finacle service listening on port ${PORT}`);
  logger.info('Pre-seeded accounts:');
  logger.info('  1001000001 - Монгол Технологи ХХК (MNT, 50,000,000)');
  logger.info('  1001000002 - Монгол Технологи ХХК (USD, 100,000)');
  logger.info('  2001000001 - Улаанбаатар Худалдаа ХХК (MNT, 30,000,000)');
  logger.info('  2001000002 - Улаанбаатар Худалдаа ХХК (USD, 50,000)');
});

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';
import einvoiceRoutes from './routes/einvoice.routes';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

const PORT = parseInt(process.env.PORT || '3011', 10);

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
    data: { status: 'healthy', service: 'mock-einvoice' },
  });
});

// Mount e-invoice routes
app.use('/einvoice', einvoiceRoutes);

app.listen(PORT, () => {
  logger.info(`Mock e-Invoice service listening on port ${PORT}`);
  logger.info('E-invoice registry initialized (empty)');
});

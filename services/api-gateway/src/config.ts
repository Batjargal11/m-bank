export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',

  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  invoiceServiceUrl: process.env.INVOICE_SERVICE_URL || 'http://invoice-service:3002',
  paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3003',
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3004',
  auditServiceUrl: process.env.AUDIT_SERVICE_URL || 'http://audit-service:3005',
} as const;

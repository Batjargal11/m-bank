import { config } from './config';

export interface RouteDefinition {
  readonly prefix: string;
  readonly target: string;
  readonly targetPath: string;
}

export const routeTable: readonly RouteDefinition[] = [
  { prefix: '/api/auth', target: config.authServiceUrl, targetPath: '/auth' },
  { prefix: '/api/users', target: config.authServiceUrl, targetPath: '/users' },
  { prefix: '/api/organizations', target: config.authServiceUrl, targetPath: '/organizations' },
  { prefix: '/api/invoices', target: config.invoiceServiceUrl, targetPath: '/invoices' },
  { prefix: '/api/payments', target: config.paymentServiceUrl, targetPath: '/payments' },
  { prefix: '/api/notifications', target: config.notificationServiceUrl, targetPath: '/notifications' },
  { prefix: '/api/audit', target: config.auditServiceUrl, targetPath: '/audit' },
];

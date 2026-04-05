import { Express, Request } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createLogger } from '@m-bank/shared-utils';
import { routeTable, RouteDefinition } from './routes';

const logger = createLogger('api-gateway:proxy');

export function setupProxies(app: Express): void {
  for (const route of routeTable) {
    logger.info({ prefix: route.prefix, target: route.target }, 'Registering proxy route');

    app.use(
      route.prefix,
      createProxyMiddleware({
        target: route.target,
        changeOrigin: true,
        pathRewrite: (_path, req) => {
          // Express strips the mount prefix from req.url
          // e.g., /api/auth/login -> req.url = /login
          // We need to prepend the targetPath: /auth + /login = /auth/login
          return route.targetPath + req.url;
        },
        on: {
          proxyReq(proxyReq, req) {
            const incomingReq = req as Request;

            const correlationId = incomingReq.headers['x-correlation-id'];
            if (correlationId) {
              proxyReq.setHeader('x-correlation-id', correlationId as string);
            }

            const authorization = incomingReq.headers.authorization;
            if (authorization) {
              proxyReq.setHeader('authorization', authorization);
            }

            const user = incomingReq.user;
            if (user) {
              proxyReq.setHeader('x-user-id', user.userId);
              if (user.orgId) {
                proxyReq.setHeader('x-org-id', user.orgId);
              }
              proxyReq.setHeader('x-user-role', user.role);
            }

            // Re-stream parsed body for proxy
            if (incomingReq.body && Object.keys(incomingReq.body as object).length > 0) {
              const bodyData = JSON.stringify(incomingReq.body);
              proxyReq.setHeader('Content-Type', 'application/json');
              proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
              proxyReq.write(bodyData);
            }
          },
          error(err, _req, res) {
            logger.error({ err, target: route.target }, 'Proxy error');
            const response = res as import('http').ServerResponse;
            if (!response.headersSent) {
              response.writeHead(502, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({
                success: false,
                data: null,
                error: 'Service unavailable',
              }));
            }
          },
        },
      }),
    );
  }
}

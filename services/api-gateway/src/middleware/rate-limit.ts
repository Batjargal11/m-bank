import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory, RateLimiterAbstract } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { config } from '../config';
import { createLogger } from '@m-bank/shared-utils';

const logger = createLogger('api-gateway:rate-limit');

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis connection error in rate limiter');
    });
  }
  return redisClient;
}

function createLimiter(
  keyPrefix: string,
  points: number,
  duration: number,
): RateLimiterAbstract {
  try {
    return new RateLimiterRedis({
      storeClient: getRedisClient(),
      keyPrefix,
      points,
      duration,
    });
  } catch {
    logger.warn(`Falling back to in-memory rate limiter for ${keyPrefix}`);
    return new RateLimiterMemory({
      keyPrefix,
      points,
      duration,
    });
  }
}

const globalLimiter = createLimiter('rl:global', 100, 60);
const authLoginLimiter = createLimiter('rl:auth-login', 30, 60);
const paymentsLimiter = createLimiter('rl:payments', 20, 60);

function sendRateLimitResponse(res: Response): void {
  res.status(429).json({
    success: false,
    data: null,
    error: 'Too many requests. Please try again later.',
  });
}

export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    await globalLimiter.consume(clientIp);
  } catch {
    sendRateLimitResponse(res);
    return;
  }

  try {
    if (req.path.startsWith('/api/auth/login')) {
      await authLoginLimiter.consume(clientIp);
    } else if (req.path.startsWith('/api/payments')) {
      const userKey = req.user?.userId || clientIp;
      await paymentsLimiter.consume(userKey);
    }
  } catch {
    sendRateLimitResponse(res);
    return;
  }

  next();
}

import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.js';

/**
 * Middleware to log all HTTP requests with method, path, status, and latency
 */
export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const latency = Date.now() - startTime;
    const logData = {
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      query: req.query,
      status: res.statusCode,
      latencyMs: latency,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: (req as any).user?.id, // Include user ID if authenticated
    };

    // Choose log level based on status code
    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};

import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metricsService.js';

/**
 * Middleware to collect HTTP request metrics
 */
export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Record metrics when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const route = req.route?.path || req.path;

    metricsService.recordHttpRequest(
      req.method,
      route,
      res.statusCode,
      duration
    );
  });

  next();
};

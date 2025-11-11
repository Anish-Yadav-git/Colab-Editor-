import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisService } from '../config/redis.js';
import { metricsService } from '../services/metricsService.js';
import logger from '../config/logger.js';

/**
 * Liveness probe endpoint
 * Returns 200 if the server is running
 */
export const liveness = (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Readiness probe endpoint
 * Checks if the server is ready to accept traffic
 * Verifies MongoDB and Redis connections
 */
export const readiness = async (_req: Request, res: Response): Promise<void> => {
  const checks: {
    mongodb: boolean;
    redis: boolean;
  } = {
    mongodb: false,
    redis: false,
  };

  try {
    // Check MongoDB connection
    checks.mongodb = mongoose.connection.readyState === 1;

    // Check Redis connection (optional - server can work without Redis)
    try {
      checks.redis = redisService.getConnectionStatus();
    } catch (error) {
      logger.warn('Redis health check failed', { error });
      checks.redis = false;
    }

    // Server is ready if MongoDB is connected
    // Redis is optional for single-server mode
    const isReady = checks.mongodb;

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks,
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks,
      });
    }
  } catch (error) {
    logger.error('Readiness check failed', { error });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      checks,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Metrics endpoint for Prometheus scraping
 * Returns metrics in Prometheus text format
 */
export const metrics = async (_req: Request, res: Response): Promise<void> => {
  try {
    const metricsText = await metricsService.getMetrics();

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(metricsText);
  } catch (error) {
    logger.error('Failed to generate metrics', { error });
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate metrics',
    });
  }
};

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisService } from '../config/redis.js';
import { metricsService } from '../services/metricsService.js';
import { roomManager } from '../websocket/RoomManager.js';
import { documentCacheService } from '../services/documentCacheService.js';
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
    
    // Add batch metrics as custom metrics
    const batchMetrics = roomManager.getBatchMetrics();
    const batchMetricsText = `
# HELP operation_batch_total Total number of operation batches sent
# TYPE operation_batch_total counter
operation_batch_total ${batchMetrics.totalBatches}

# HELP operation_batch_operations_total Total number of operations batched
# TYPE operation_batch_operations_total counter
operation_batch_operations_total ${batchMetrics.totalOperations}

# HELP operation_batch_size_average Average number of operations per batch
# TYPE operation_batch_size_average gauge
operation_batch_size_average ${batchMetrics.averageBatchSize}
`;

    // Add cache metrics
    const cacheStats = await documentCacheService.getCacheStats();
    const cacheMetricsText = `
# HELP document_cache_keys_total Total number of cached document snapshots
# TYPE document_cache_keys_total gauge
document_cache_keys_total ${cacheStats.totalKeys}

# HELP document_cache_memory_used Redis memory used for cache
# TYPE document_cache_memory_used gauge
# document_cache_memory_used ${cacheStats.memoryUsed}
`;

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(metricsText + batchMetricsText + cacheMetricsText);
  } catch (error) {
    logger.error('Failed to generate metrics', { error });
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate metrics',
    });
  }
};

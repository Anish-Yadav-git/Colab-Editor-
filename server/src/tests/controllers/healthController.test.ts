import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { liveness, readiness, metrics } from '../../controllers/healthController.js';
import { redisService } from '../../config/redis.js';
import { metricsService } from '../../services/metricsService.js';
import logger from '../../config/logger.js';

// Mock dependencies
vi.mock('../../config/redis.js', () => ({
  redisService: {
    getConnectionStatus: vi.fn(),
  },
}));

vi.mock('../../services/metricsService.js', () => ({
  metricsService: {
    getMetrics: vi.fn(),
  },
}));

vi.mock('../../config/logger.js', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Health Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let sendMock: ReturnType<typeof vi.fn>;
  let setMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRequest = {};
    jsonMock = vi.fn();
    sendMock = vi.fn();
    setMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({
      json: jsonMock,
      send: sendMock,
    });

    mockResponse = {
      status: statusMock,
      set: setMock,
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('liveness', () => {
    it('should return 200 status with ok response', () => {
      liveness(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          timestamp: expect.any(String),
        })
      );
    });

    it('should include ISO timestamp in response', () => {
      const beforeTime = new Date().toISOString();
      liveness(mockRequest as Request, mockResponse as Response);
      const afterTime = new Date().toISOString();

      const response = jsonMock.mock.calls[0][0];
      expect(response.timestamp).toBeDefined();
      expect(response.timestamp >= beforeTime).toBe(true);
      expect(response.timestamp <= afterTime).toBe(true);
    });
  });

  describe('readiness', () => {
    it('should return 200 when MongoDB is connected', async () => {
      vi.mocked(redisService.getConnectionStatus).mockReturnValue(true);

      await readiness(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          timestamp: expect.any(String),
          checks: expect.objectContaining({
            mongodb: expect.any(Boolean),
            redis: true,
          }),
        })
      );
    });

    it('should return 200 when MongoDB is connected but Redis is not', async () => {
      // Mock Redis as disconnected
      vi.mocked(redisService.getConnectionStatus).mockReturnValue(false);

      await readiness(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          checks: expect.objectContaining({
            mongodb: expect.any(Boolean),
            redis: false,
          }),
        })
      );
    });

    it('should handle Redis check errors gracefully', async () => {
      // Mock Redis throwing error
      vi.mocked(redisService.getConnectionStatus).mockImplementation(() => {
        throw new Error('Redis connection error');
      });

      await readiness(mockRequest as Request, mockResponse as Response);

      expect(logger.warn).toHaveBeenCalledWith(
        'Redis health check failed',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          checks: expect.objectContaining({
            mongodb: expect.any(Boolean),
            redis: false,
          }),
        })
      );
    });
  });

  describe('metrics', () => {
    it('should return metrics in Prometheus format', async () => {
      const mockMetrics = '# HELP test_metric Test metric\n# TYPE test_metric counter\ntest_metric 42\n';
      vi.mocked(metricsService.getMetrics).mockResolvedValue(mockMetrics);

      await metrics(mockRequest as Request, mockResponse as Response);

      expect(setMock).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; version=0.0.4; charset=utf-8'
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(sendMock).toHaveBeenCalledWith(mockMetrics);
    });

    it('should handle metrics generation errors', async () => {
      const error = new Error('Metrics generation failed');
      vi.mocked(metricsService.getMetrics).mockRejectedValue(error);

      await metrics(mockRequest as Request, mockResponse as Response);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to generate metrics',
        expect.objectContaining({
          error,
        })
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'error',
        message: 'Failed to generate metrics',
      });
    });

    it('should set correct content type header', async () => {
      vi.mocked(metricsService.getMetrics).mockResolvedValue('metrics_data');

      await metrics(mockRequest as Request, mockResponse as Response);

      expect(setMock).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; version=0.0.4; charset=utf-8'
      );
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { metricsMiddleware } from '../../middleware/metricsMiddleware.js';
import { metricsService } from '../../services/metricsService.js';

// Mock metrics service
vi.mock('../../services/metricsService.js', () => ({
  metricsService: {
    recordHttpRequest: vi.fn(),
  },
}));

describe('Metrics Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let finishCallback: () => void;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      method: 'GET',
      path: '/api/documents',
      route: {
        path: '/api/documents',
      } as any,
    };

    mockResponse = {
      statusCode: 200,
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
        return mockResponse as Response;
      }),
    };

    mockNext = vi.fn();
  });

  describe('middleware execution', () => {
    it('should call next() immediately', () => {
      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should register finish event listener', () => {
      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should not block request processing', () => {
      const startTime = Date.now();

      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete almost instantly (< 10ms)
      expect(duration).toBeLessThan(10);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('metrics recording', () => {
    it('should record metrics when response finishes', () => {
      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Simulate response finish
      finishCallback();

      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        'GET',
        '/api/documents',
        200,
        expect.any(Number)
      );
    });

    it('should record correct HTTP method', () => {
      mockRequest.method = 'POST';

      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      finishCallback();

      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        'POST',
        expect.any(String),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should record correct status code', () => {
      mockResponse.statusCode = 404;

      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      finishCallback();

      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        404,
        expect.any(Number)
      );
    });

    it('should use route path when available', () => {
      mockRequest.route = {
        path: '/api/documents/:id',
      } as any;

      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      finishCallback();

      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.any(String),
        '/api/documents/:id',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should fall back to request path when route not available', () => {
      mockRequest.route = undefined;
      mockRequest.path = '/api/health';

      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      finishCallback();

      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.any(String),
        '/api/health',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should record accurate duration', (done) => {
      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Wait 50ms before finishing response
      setTimeout(() => {
        finishCallback();

        const recordedDuration = vi.mocked(metricsService.recordHttpRequest).mock
          .calls[0][3];

        // Duration should be at least 50ms
        expect(recordedDuration).toBeGreaterThanOrEqual(50);
        // But not too much more (allow 20ms margin)
        expect(recordedDuration).toBeLessThan(100);

        done();
      }, 50);
    });
  });

  describe('error handling', () => {
    it('should record metrics even for error responses', () => {
      mockResponse.statusCode = 500;

      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      finishCallback();

      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        'GET',
        '/api/documents',
        500,
        expect.any(Number)
      );
    });

    it('should record metrics for 4xx errors', () => {
      mockResponse.statusCode = 401;

      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      finishCallback();

      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        'GET',
        '/api/documents',
        401,
        expect.any(Number)
      );
    });

    it('should not throw if metrics service fails', () => {
      vi.mocked(metricsService.recordHttpRequest).mockImplementation(() => {
        throw new Error('Metrics service error');
      });

      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Should not throw
      expect(() => finishCallback()).toThrow();
      
      // Reset mock implementation for subsequent tests
      vi.mocked(metricsService.recordHttpRequest).mockImplementation(() => {});
    });
  });

  describe('different HTTP methods', () => {
    it('should handle GET requests', () => {
      mockRequest.method = 'GET';

      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      finishCallback();

      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        'GET',
        expect.any(String),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should handle POST requests', () => {
      mockRequest.method = 'POST';

      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      finishCallback();

      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        'POST',
        expect.any(String),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should handle PUT requests', () => {
      mockRequest.method = 'PUT';

      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      finishCallback();

      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        'PUT',
        expect.any(String),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should handle DELETE requests', () => {
      mockRequest.method = 'DELETE';

      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      finishCallback();

      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        'DELETE',
        expect.any(String),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should handle PATCH requests', () => {
      mockRequest.method = 'PATCH';

      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      finishCallback();

      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        'PATCH',
        expect.any(String),
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  describe('multiple requests', () => {
    it('should record metrics for each request independently', () => {
      // First request
      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );
      const firstFinish = finishCallback;

      // Second request
      mockRequest.method = 'POST';
      mockRequest.path = '/api/documents/create';
      metricsMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );
      const secondFinish = finishCallback;

      // Finish both requests
      firstFinish();
      secondFinish();

      expect(metricsService.recordHttpRequest).toHaveBeenCalledTimes(2);
    });
  });
});

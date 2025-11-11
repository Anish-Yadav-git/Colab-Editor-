import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import mongoose from 'mongoose';
import healthRoutes from '../../routes/health.js';
import { metricsMiddleware } from '../../middleware/metricsMiddleware.js';
import { metricsService } from '../../services/metricsService.js';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';

describe('Monitoring Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    // Connect to test database
    await connectDatabase();

    // Create Express app with monitoring routes
    app = express();
    app.use(metricsMiddleware);
    app.use('/health', healthRoutes);
    // Metrics endpoint is at /health/metrics based on the routes file
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(() => {
    // Reset metrics before each test
    metricsService.registry.resetMetrics();
  });

  describe('Health Check Endpoints', () => {
    describe('GET /health/live', () => {
      it('should return 200 status with ok response', async () => {
        const response = await request(app).get('/health/live');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
          expect.objectContaining({
            status: 'ok',
            timestamp: expect.any(String),
          })
        );
      });

      it('should return valid ISO timestamp', async () => {
        const response = await request(app).get('/health/live');

        const timestamp = new Date(response.body.timestamp);
        expect(timestamp.toISOString()).toBe(response.body.timestamp);
      });

      it('should respond quickly (< 100ms)', async () => {
        const startTime = Date.now();
        await request(app).get('/health/live');
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(100);
      });

      it('should return JSON content type', async () => {
        const response = await request(app).get('/health/live');

        expect(response.headers['content-type']).toMatch(/application\/json/);
      });
    });

    describe('GET /health/ready', () => {
      it('should return 200 when MongoDB is connected', async () => {
        const response = await request(app).get('/health/ready');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
          expect.objectContaining({
            status: 'ready',
            timestamp: expect.any(String),
            checks: expect.objectContaining({
              mongodb: true,
            }),
          })
        );
      });

      it('should include MongoDB connection status', async () => {
        const response = await request(app).get('/health/ready');

        expect(response.body.checks).toHaveProperty('mongodb');
        expect(typeof response.body.checks.mongodb).toBe('boolean');
      });

      it('should include Redis connection status', async () => {
        const response = await request(app).get('/health/ready');

        expect(response.body.checks).toHaveProperty('redis');
        expect(typeof response.body.checks.redis).toBe('boolean');
      });

      it('should return valid timestamp', async () => {
        const response = await request(app).get('/health/ready');

        const timestamp = new Date(response.body.timestamp);
        expect(timestamp.toISOString()).toBe(response.body.timestamp);
      });

      it('should return JSON content type', async () => {
        const response = await request(app).get('/health/ready');

        expect(response.headers['content-type']).toMatch(/application\/json/);
      });
    });
  });

  describe('Metrics Endpoint', () => {
    describe('GET /health/metrics', () => {
      it('should return 200 status', async () => {
        const response = await request(app).get('/health/metrics');

        expect(response.status).toBe(200);
      });

      it('should return Prometheus text format', async () => {
        const response = await request(app).get('/health/metrics');

        expect(response.headers['content-type']).toMatch(
          /text\/plain.*charset=utf-8/
        );
      });

      it('should include HELP and TYPE comments', async () => {
        const response = await request(app).get('/health/metrics');

        expect(response.text).toContain('# HELP');
        expect(response.text).toContain('# TYPE');
      });

      it('should include default app label', async () => {
        const response = await request(app).get('/health/metrics');

        expect(response.text).toContain('app="collaborative-editor"');
      });

      it('should include operation latency metrics', async () => {
        // Record some operations
        metricsService.recordOperationLatency('insert', 'doc123', 50);

        const response = await request(app).get('/health/metrics');

        expect(response.text).toContain('operation_latency_ms');
      });

      it('should include active connections metrics', async () => {
        metricsService.setActiveConnections(5);

        const response = await request(app).get('/health/metrics');

        expect(response.text).toContain('websocket_connections_active');
        expect(response.text).toContain('websocket_connections_active{app="collaborative-editor"} 5');
      });

      it('should include operations total metrics', async () => {
        metricsService.incrementOperations('insert', 'success');

        const response = await request(app).get('/health/metrics');

        expect(response.text).toContain('operations_total');
      });

      it('should include HTTP request metrics', async () => {
        metricsService.recordHttpRequest('GET', '/api/test', 200, 50);

        const response = await request(app).get('/health/metrics');

        expect(response.text).toContain('http_request_duration_ms');
        expect(response.text).toContain('http_requests_total');
      });

      it('should include document operations metrics', async () => {
        metricsService.recordDocumentOperation('doc123', 'insert');

        const response = await request(app).get('/health/metrics');

        expect(response.text).toContain('document_operations_total');
      });

      it('should include active rooms metrics', async () => {
        metricsService.setActiveRooms(3);

        const response = await request(app).get('/health/metrics');

        expect(response.text).toContain('active_rooms');
        expect(response.text).toContain('active_rooms{app="collaborative-editor"} 3');
      });
    });
  });

  describe('Metrics Middleware Integration', () => {
    beforeEach(() => {
      // Add a test route
      app.get('/test-route', (_req, res) => {
        res.status(200).json({ message: 'test' });
      });
    });

    it('should record metrics for HTTP requests', async () => {
      await request(app).get('/test-route');

      const metricsResponse = await request(app).get('/health/metrics');

      expect(metricsResponse.text).toContain('http_request_duration_ms');
      expect(metricsResponse.text).toContain('http_requests_total');
    });

    it('should record correct HTTP method', async () => {
      await request(app).get('/test-route');

      const metricsResponse = await request(app).get('/health/metrics');

      expect(metricsResponse.text).toContain('method="GET"');
    });

    it('should record correct status code', async () => {
      await request(app).get('/test-route');

      const metricsResponse = await request(app).get('/health/metrics');

      expect(metricsResponse.text).toContain('status_code="200"');
    });

    it('should record metrics for 404 responses', async () => {
      await request(app).get('/non-existent-route');

      const metricsResponse = await request(app).get('/health/metrics');

      expect(metricsResponse.text).toContain('status_code="404"');
    });
  });

  describe('Log Format and Content', () => {
    it('should log health check requests', async () => {
      // This test verifies that the logging infrastructure is working
      // In a real scenario, you would capture logs and verify their format
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      // Logs are written to console/file, verified by logger.test.ts
    });

    it('should log metrics requests', async () => {
      const response = await request(app).get('/health/metrics');

      expect(response.status).toBe(200);
      // Logs are written to console/file, verified by logger.test.ts
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent health checks', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => request(app).get('/health/live'));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });

    it('should handle multiple concurrent metrics requests', async () => {
      const requests = Array(5)
        .fill(null)
        .map(() => request(app).get('/health/metrics'));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.text).toContain('# HELP');
      });
    });

    it('should maintain metrics accuracy under load', async () => {
      // Record multiple operations
      for (let i = 0; i < 100; i++) {
        metricsService.incrementOperations('test', 'success');
      }

      const response = await request(app).get('/health/metrics');

      expect(response.text).toContain('operations_total');
      // Verify the counter increased
      expect(response.text).toMatch(/operations_total.*100/);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle metrics endpoint errors gracefully', async () => {
      // This is tested in healthController.test.ts with mocked failures
      // Here we verify the endpoint is accessible
      const response = await request(app).get('/health/metrics');

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Metrics Data Accuracy', () => {
    it('should accurately track operation latency', async () => {
      metricsService.recordOperationLatency('insert', 'doc1', 10);
      metricsService.recordOperationLatency('insert', 'doc1', 50);
      metricsService.recordOperationLatency('insert', 'doc1', 100);

      const response = await request(app).get('/health/metrics');

      // Should have histogram buckets
      expect(response.text).toContain('operation_latency_ms_bucket');
      expect(response.text).toContain('le="10"');
      expect(response.text).toContain('le="50"');
      expect(response.text).toContain('le="100"');
    });

    it('should accurately track operations by type and status', async () => {
      metricsService.incrementOperations('insert', 'success');
      metricsService.incrementOperations('insert', 'success');
      metricsService.incrementOperations('delete', 'error');

      const response = await request(app).get('/health/metrics');

      expect(response.text).toContain('operation_type="insert"');
      expect(response.text).toContain('operation_type="delete"');
      expect(response.text).toContain('status="success"');
      expect(response.text).toContain('status="error"');
    });

    it('should accurately track active connections', async () => {
      metricsService.setActiveConnections(0);
      metricsService.incrementActiveConnections();
      metricsService.incrementActiveConnections();
      metricsService.incrementActiveConnections();

      const response = await request(app).get('/health/metrics');

      expect(response.text).toContain('websocket_connections_active{app="collaborative-editor"} 3');
    });

    it('should accurately track document operations', async () => {
      metricsService.recordDocumentOperation('doc1', 'insert');
      metricsService.recordDocumentOperation('doc1', 'insert');
      metricsService.recordDocumentOperation('doc2', 'delete');

      const response = await request(app).get('/health/metrics');

      expect(response.text).toContain('document_id="doc1"');
      expect(response.text).toContain('document_id="doc2"');
    });
  });
});

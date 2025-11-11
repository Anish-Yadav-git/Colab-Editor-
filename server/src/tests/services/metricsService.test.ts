import { describe, it, expect, beforeEach } from 'vitest';
import { metricsService } from '../../services/metricsService.js';

describe('MetricsService', () => {
  beforeEach(async () => {
    // Reset metrics before each test
    metricsService.registry.resetMetrics();
  });

  describe('initialization', () => {
    it('should initialize with all required metrics', () => {
      expect(metricsService.operationLatency).toBeDefined();
      expect(metricsService.activeConnections).toBeDefined();
      expect(metricsService.operationsTotal).toBeDefined();
      expect(metricsService.httpRequestDuration).toBeDefined();
      expect(metricsService.httpRequestsTotal).toBeDefined();
      expect(metricsService.documentOperations).toBeDefined();
      expect(metricsService.activeRooms).toBeDefined();
    });

    it('should have registry with default labels', async () => {
      const metrics = await metricsService.getMetrics();
      // All metrics should have the default app label
      expect(metrics).toContain('app="collaborative-editor"');
    });
  });

  describe('recordOperationLatency', () => {
    it('should record operation latency', async () => {
      metricsService.recordOperationLatency('insert', 'doc123', 50);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('operation_latency_ms');
      expect(metrics).toContain('operation_type="insert"');
      expect(metrics).toContain('document_id="doc123"');
    });

    it('should record multiple latencies', async () => {
      metricsService.recordOperationLatency('insert', 'doc1', 10);
      metricsService.recordOperationLatency('delete', 'doc2', 20);
      metricsService.recordOperationLatency('insert', 'doc1', 30);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('operation_latency_ms');
      expect(metrics).toContain('operation_type="insert"');
      expect(metrics).toContain('operation_type="delete"');
    });

    it('should use histogram buckets correctly', async () => {
      // Record values in different buckets
      metricsService.recordOperationLatency('test', 'doc1', 5);
      metricsService.recordOperationLatency('test', 'doc1', 50);
      metricsService.recordOperationLatency('test', 'doc1', 500);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('operation_latency_ms_bucket');
      expect(metrics).toContain('le="5"');
      expect(metrics).toContain('le="50"');
      expect(metrics).toContain('le="500"');
    });
  });

  describe('incrementOperations', () => {
    it('should increment operations counter with success status', async () => {
      metricsService.incrementOperations('insert', 'success');

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('operations_total');
      expect(metrics).toContain('operation_type="insert"');
      expect(metrics).toContain('status="success"');
    });

    it('should increment operations counter with error status', async () => {
      metricsService.incrementOperations('delete', 'error');

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('operations_total');
      expect(metrics).toContain('operation_type="delete"');
      expect(metrics).toContain('status="error"');
    });

    it('should track multiple operations', async () => {
      metricsService.incrementOperations('insert', 'success');
      metricsService.incrementOperations('insert', 'success');
      metricsService.incrementOperations('insert', 'error');

      const metrics = await metricsService.getMetrics();
      
      expect(metrics).toContain('operations_total');
      expect(metrics).toContain('operation_type="insert"');
      expect(metrics).toContain('status="success"');
      expect(metrics).toContain('status="error"');
    });
  });

  describe('active connections management', () => {
    it('should set active connections count', async () => {
      metricsService.setActiveConnections(10);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('websocket_connections_active');
      expect(metrics).toContain('websocket_connections_active{app="collaborative-editor"} 10');
    });

    it('should increment active connections', async () => {
      metricsService.setActiveConnections(5);
      metricsService.incrementActiveConnections();

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('websocket_connections_active{app="collaborative-editor"} 6');
    });

    it('should decrement active connections', async () => {
      metricsService.setActiveConnections(5);
      metricsService.decrementActiveConnections();

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('websocket_connections_active{app="collaborative-editor"} 4');
    });

    it('should handle multiple increments and decrements', async () => {
      metricsService.setActiveConnections(0);
      metricsService.incrementActiveConnections();
      metricsService.incrementActiveConnections();
      metricsService.incrementActiveConnections();
      metricsService.decrementActiveConnections();

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('websocket_connections_active{app="collaborative-editor"} 2');
    });
  });

  describe('recordHttpRequest', () => {
    it('should record HTTP request metrics', async () => {
      metricsService.recordHttpRequest('GET', '/api/documents', 200, 50);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('http_request_duration_ms');
      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('route="/api/documents"');
      expect(metrics).toContain('status_code="200"');
    });

    it('should record multiple HTTP requests', async () => {
      metricsService.recordHttpRequest('GET', '/api/documents', 200, 50);
      metricsService.recordHttpRequest('POST', '/api/documents', 201, 100);
      metricsService.recordHttpRequest('GET', '/api/documents/:id', 404, 10);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('method="POST"');
      expect(metrics).toContain('status_code="200"');
      expect(metrics).toContain('status_code="201"');
      expect(metrics).toContain('status_code="404"');
    });

    it('should track request duration in histogram', async () => {
      metricsService.recordHttpRequest('GET', '/api/test', 200, 5);
      metricsService.recordHttpRequest('GET', '/api/test', 200, 50);
      metricsService.recordHttpRequest('GET', '/api/test', 200, 500);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('http_request_duration_ms_bucket');
      expect(metrics).toContain('le="5"');
      expect(metrics).toContain('le="50"');
      expect(metrics).toContain('le="500"');
    });
  });

  describe('recordDocumentOperation', () => {
    it('should record document operation', async () => {
      metricsService.recordDocumentOperation('doc123', 'insert');

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('document_operations_total');
      expect(metrics).toContain('document_id="doc123"');
      expect(metrics).toContain('operation_type="insert"');
    });

    it('should track multiple document operations', async () => {
      metricsService.recordDocumentOperation('doc1', 'insert');
      metricsService.recordDocumentOperation('doc1', 'insert');
      metricsService.recordDocumentOperation('doc2', 'delete');

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('document_id="doc1"');
      expect(metrics).toContain('document_id="doc2"');
      expect(metrics).toContain('operation_type="insert"');
      expect(metrics).toContain('operation_type="delete"');
    });
  });

  describe('setActiveRooms', () => {
    it('should set active rooms count', async () => {
      metricsService.setActiveRooms(5);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('active_rooms');
      expect(metrics).toContain('active_rooms{app="collaborative-editor"} 5');
    });

    it('should update active rooms count', async () => {
      metricsService.setActiveRooms(3);
      metricsService.setActiveRooms(7);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('active_rooms{app="collaborative-editor"} 7');
    });
  });

  describe('getMetrics', () => {
    it('should return metrics in Prometheus text format', async () => {
      metricsService.setActiveConnections(5);
      metricsService.incrementOperations('test', 'success');

      const metrics = await metricsService.getMetrics();

      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
    });

    it('should include all registered metrics', async () => {
      // Record some data for each metric type
      metricsService.recordOperationLatency('test', 'doc1', 10);
      metricsService.setActiveConnections(3);
      metricsService.incrementOperations('test', 'success');
      metricsService.recordHttpRequest('GET', '/test', 200, 50);
      metricsService.recordDocumentOperation('doc1', 'insert');
      metricsService.setActiveRooms(2);

      const metrics = await metricsService.getMetrics();

      expect(metrics).toContain('operation_latency_ms');
      expect(metrics).toContain('websocket_connections_active');
      expect(metrics).toContain('operations_total');
      expect(metrics).toContain('http_request_duration_ms');
      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('document_operations_total');
      expect(metrics).toContain('active_rooms');
    });

    it('should include default labels', async () => {
      metricsService.setActiveConnections(1);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('app="collaborative-editor"');
    });
  });

  describe('metrics format', () => {
    it('should produce valid Prometheus format', async () => {
      metricsService.recordOperationLatency('insert', 'doc1', 25);
      metricsService.incrementOperations('insert', 'success');

      const metrics = await metricsService.getMetrics();

      // Check for Prometheus format elements
      const lines = metrics.split('\n');
      const helpLines = lines.filter(line => line.startsWith('# HELP'));
      const typeLines = lines.filter(line => line.startsWith('# TYPE'));

      expect(helpLines.length).toBeGreaterThan(0);
      expect(typeLines.length).toBeGreaterThan(0);
    });
  });
});

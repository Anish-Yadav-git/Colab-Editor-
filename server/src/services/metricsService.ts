import { Registry, Histogram, Gauge, Counter } from 'prom-client';

/**
 * Metrics service for collecting and exposing Prometheus metrics
 */
class MetricsService {
  public readonly registry: Registry;

  // Operation latency histogram
  public readonly operationLatency: Histogram<string>;

  // Active WebSocket connections gauge
  public readonly activeConnections: Gauge<string>;

  // Operations per second counter
  public readonly operationsTotal: Counter<string>;

  // HTTP request duration histogram
  public readonly httpRequestDuration: Histogram<string>;

  // HTTP requests total counter
  public readonly httpRequestsTotal: Counter<string>;

  // Document operations counter
  public readonly documentOperations: Counter<string>;

  // Active rooms gauge
  public readonly activeRooms: Gauge<string>;

  constructor() {
    // Create a new registry
    this.registry = new Registry();

    // Set default labels
    this.registry.setDefaultLabels({
      app: 'collaborative-editor',
    });

    // Operation latency histogram (in milliseconds)
    this.operationLatency = new Histogram({
      name: 'operation_latency_ms',
      help: 'Latency of operations in milliseconds',
      labelNames: ['operation_type', 'document_id'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
      registers: [this.registry],
    });

    // Active WebSocket connections gauge
    this.activeConnections = new Gauge({
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections',
      registers: [this.registry],
    });

    // Operations per second counter
    this.operationsTotal = new Counter({
      name: 'operations_total',
      help: 'Total number of operations processed',
      labelNames: ['operation_type', 'status'],
      registers: [this.registry],
    });

    // HTTP request duration histogram
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_ms',
      help: 'Duration of HTTP requests in milliseconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
      registers: [this.registry],
    });

    // HTTP requests total counter
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // Document operations counter
    this.documentOperations = new Counter({
      name: 'document_operations_total',
      help: 'Total number of document operations',
      labelNames: ['document_id', 'operation_type'],
      registers: [this.registry],
    });

    // Active rooms gauge
    this.activeRooms = new Gauge({
      name: 'active_rooms',
      help: 'Number of active document rooms',
      registers: [this.registry],
    });
  }

  /**
   * Record operation latency
   */
  recordOperationLatency(
    operationType: string,
    documentId: string,
    latencyMs: number
  ): void {
    this.operationLatency.observe(
      { operation_type: operationType, document_id: documentId },
      latencyMs
    );
  }

  /**
   * Increment operations counter
   */
  incrementOperations(operationType: string, status: 'success' | 'error'): void {
    this.operationsTotal.inc({ operation_type: operationType, status });
  }

  /**
   * Set active connections count
   */
  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  /**
   * Increment active connections
   */
  incrementActiveConnections(): void {
    this.activeConnections.inc();
  }

  /**
   * Decrement active connections
   */
  decrementActiveConnections(): void {
    this.activeConnections.dec();
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number
  ): void {
    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
    };

    this.httpRequestDuration.observe(labels, durationMs);
    this.httpRequestsTotal.inc(labels);
  }

  /**
   * Record document operation
   */
  recordDocumentOperation(documentId: string, operationType: string): void {
    this.documentOperations.inc({
      document_id: documentId,
      operation_type: operationType,
    });
  }

  /**
   * Set active rooms count
   */
  setActiveRooms(count: number): void {
    this.activeRooms.set(count);
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

// Export singleton instance
export const metricsService = new MetricsService();

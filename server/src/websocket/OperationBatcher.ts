import { WebSocket } from 'ws';
import logger from '../config/logger.js';

/**
 * OperationBatcher batches multiple Yjs updates into a single WebSocket message
 * to reduce network overhead and improve performance
 */
export class OperationBatcher {
  private batches: Map<string, BatchInfo> = new Map();
  private readonly BATCH_INTERVAL = 50; // Flush every 50ms
  private readonly MAX_BATCH_SIZE = 10; // Flush when 10 operations accumulated
  private metricsCollector: BatchMetrics = {
    totalBatches: 0,
    totalOperations: 0,
    averageBatchSize: 0,
  };

  /**
   * Add an operation to the batch for a specific document
   */
  addOperation(documentId: string, update: Uint8Array, socket: WebSocket): void {
    let batch = this.batches.get(documentId);

    if (!batch) {
      batch = {
        operations: [],
        timer: null,
        documentId,
      };
      this.batches.set(documentId, batch);
    }

    // Add operation to batch
    batch.operations.push({ update, socket });

    // Start timer if not already started
    if (!batch.timer) {
      batch.timer = setTimeout(() => {
        this.flushBatch(documentId);
      }, this.BATCH_INTERVAL);
    }

    // Flush immediately if batch size limit reached
    if (batch.operations.length >= this.MAX_BATCH_SIZE) {
      this.flushBatch(documentId);
    }
  }

  /**
   * Flush a batch for a specific document
   */
  private flushBatch(documentId: string): void {
    const batch = this.batches.get(documentId);

    if (!batch || batch.operations.length === 0) {
      return;
    }

    // Clear timer
    if (batch.timer) {
      clearTimeout(batch.timer);
      batch.timer = null;
    }

    // Group operations by socket to avoid sending duplicates
    const socketGroups = new Map<WebSocket, Uint8Array[]>();

    for (const op of batch.operations) {
      const updates = socketGroups.get(op.socket) || [];
      updates.push(op.update);
      socketGroups.set(op.socket, updates);
    }

    // Send batched operations to each socket
    socketGroups.forEach((updates, socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        // If single operation, send as-is
        if (updates.length === 1) {
          const message = this.createYjsUpdateMessage(updates[0]);
          socket.send(message, { binary: true });
        } else {
          // Merge multiple updates into a single message
          const mergedUpdate = this.mergeUpdates(updates);
          const message = this.createYjsUpdateMessage(mergedUpdate);
          socket.send(message, { binary: true });
        }
      }
    });

    // Update metrics
    this.updateMetrics(batch.operations.length);

    // Log batch efficiency
    logger.debug('Flushed operation batch', {
      documentId,
      operationCount: batch.operations.length,
      socketCount: socketGroups.size,
      averageBatchSize: this.metricsCollector.averageBatchSize.toFixed(2),
      operationType: 'flush_batch',
    });

    // Clear batch
    batch.operations = [];
    this.batches.delete(documentId);
  }

  /**
   * Merge multiple Yjs updates into a single update
   */
  private mergeUpdates(updates: Uint8Array[]): Uint8Array {
    // Calculate total size
    let totalSize = 0;
    for (const update of updates) {
      totalSize += update.length;
    }

    // Create merged buffer
    const merged = new Uint8Array(totalSize);
    let offset = 0;

    for (const update of updates) {
      merged.set(update, offset);
      offset += update.length;
    }

    return merged;
  }

  /**
   * Create a Yjs update message with type prefix
   */
  private createYjsUpdateMessage(update: Uint8Array): Buffer {
    const messageType = 0; // 0 = SYNC message
    const buffer = Buffer.allocUnsafe(1 + update.length);
    buffer[0] = messageType;
    Buffer.from(update).copy(buffer, 1);
    return buffer;
  }

  /**
   * Update batch metrics
   */
  private updateMetrics(batchSize: number): void {
    this.metricsCollector.totalBatches++;
    this.metricsCollector.totalOperations += batchSize;
    this.metricsCollector.averageBatchSize =
      this.metricsCollector.totalOperations / this.metricsCollector.totalBatches;
  }

  /**
   * Get batch metrics
   */
  getMetrics(): BatchMetrics {
    return { ...this.metricsCollector };
  }

  /**
   * Force flush all pending batches
   */
  flushAll(): void {
    const documentIds = Array.from(this.batches.keys());
    for (const documentId of documentIds) {
      this.flushBatch(documentId);
    }
  }

  /**
   * Shutdown the batcher and flush all pending batches
   */
  shutdown(): void {
    logger.info('Shutting down OperationBatcher', {
      pendingBatches: this.batches.size,
      metrics: this.metricsCollector,
      operationType: 'shutdown_batcher',
    });

    this.flushAll();
  }
}

interface BatchInfo {
  operations: Array<{ update: Uint8Array; socket: WebSocket }>;
  timer: NodeJS.Timeout | null;
  documentId: string;
}

export interface BatchMetrics {
  totalBatches: number;
  totalOperations: number;
  averageBatchSize: number;
}

// Export singleton instance
export const operationBatcher = new OperationBatcher();

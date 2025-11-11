/**
 * OfflineQueue Service
 * 
 * Manages queuing of Yjs operations when the WebSocket connection is offline.
 * Uses IndexedDB for persistent storage to survive page reloads.
 * Tracks vector clocks for proper operation ordering.
 */

export interface QueuedOperation {
  id: string;
  timestamp: number;
  yjsUpdate: Uint8Array;
  vectorClock: Map<string, number>;
  retryCount: number;
  documentId: string;
}

interface SerializedOperation {
  id: string;
  timestamp: number;
  yjsUpdate: number[]; // Uint8Array serialized as number array
  vectorClock: [string, number][]; // Map serialized as array of tuples
  retryCount: number;
  documentId: string;
}

const DB_NAME = 'collaborative-editor-offline';
const DB_VERSION = 1;
const STORE_NAME = 'operations';

export class OfflineQueue {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void>;
  private documentId: string;

  constructor(documentId: string) {
    this.documentId = documentId;
    this.initPromise = this.initDB();
  }

  /**
   * Initialize IndexedDB database
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          // Create indexes for efficient querying
          store.createIndex('documentId', 'documentId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Ensure database is initialized before operations
   */
  private async ensureDB(): Promise<IDBDatabase> {
    await this.initPromise;
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Add an operation to the queue
   */
  async enqueue(
    yjsUpdate: Uint8Array,
    vectorClock: Map<string, number>
  ): Promise<string> {
    const db = await this.ensureDB();
    
    const operation: QueuedOperation = {
      id: this.generateOperationId(),
      timestamp: Date.now(),
      yjsUpdate,
      vectorClock,
      retryCount: 0,
      documentId: this.documentId,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Serialize the operation for storage
      const serialized = this.serializeOperation(operation);
      const request = store.add(serialized);

      request.onsuccess = () => {
        resolve(operation.id);
      };

      request.onerror = () => {
        console.error('Failed to enqueue operation:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all queued operations for this document, ordered by timestamp
   */
  async getAll(): Promise<QueuedOperation[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('documentId');
      const request = index.getAll(this.documentId);

      request.onsuccess = () => {
        const serialized = request.result as SerializedOperation[];
        const operations = serialized
          .map(op => this.deserializeOperation(op))
          .sort((a, b) => a.timestamp - b.timestamp);
        resolve(operations);
      };

      request.onerror = () => {
        console.error('Failed to get operations:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get count of queued operations
   */
  async getCount(): Promise<number> {
    const operations = await this.getAll();
    return operations.length;
  }

  /**
   * Remove an operation from the queue
   */
  async dequeue(operationId: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(operationId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to dequeue operation:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all operations for this document
   */
  async clear(): Promise<void> {
    const db = await this.ensureDB();
    const operations = await this.getAll();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      let completed = 0;
      const total = operations.length;

      if (total === 0) {
        resolve();
        return;
      }

      operations.forEach(op => {
        const request = store.delete(op.id);
        
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };

        request.onerror = () => {
          console.error('Failed to clear operation:', request.error);
          reject(request.error);
        };
      });
    });
  }

  /**
   * Increment retry count for an operation
   */
  async incrementRetryCount(operationId: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(operationId);

      getRequest.onsuccess = () => {
        const operation = getRequest.result as SerializedOperation;
        if (operation) {
          operation.retryCount++;
          const putRequest = store.put(operation);
          
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve(); // Operation not found, already processed
        }
      };

      getRequest.onerror = () => {
        console.error('Failed to get operation for retry:', getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  /**
   * Generate a unique operation ID
   */
  private generateOperationId(): string {
    return `${this.documentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Serialize operation for IndexedDB storage
   */
  private serializeOperation(operation: QueuedOperation): SerializedOperation {
    return {
      id: operation.id,
      timestamp: operation.timestamp,
      yjsUpdate: Array.from(operation.yjsUpdate),
      vectorClock: Array.from(operation.vectorClock.entries()),
      retryCount: operation.retryCount,
      documentId: operation.documentId,
    };
  }

  /**
   * Deserialize operation from IndexedDB storage
   */
  private deserializeOperation(serialized: SerializedOperation): QueuedOperation {
    return {
      id: serialized.id,
      timestamp: serialized.timestamp,
      yjsUpdate: new Uint8Array(serialized.yjsUpdate),
      vectorClock: new Map(serialized.vectorClock),
      retryCount: serialized.retryCount,
      documentId: serialized.documentId,
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

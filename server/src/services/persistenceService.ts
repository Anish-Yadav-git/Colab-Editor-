import { Document } from '../models/Document.js';
import { Operation } from '../models/Operation.js';
import mongoose from 'mongoose';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';
import * as Y from 'yjs';
import { logDatabaseError } from '../utils/errorLogger.js';
import { documentCacheService } from './documentCacheService.js';
import logger from '../config/logger.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export class PersistenceService {
  /**
   * Save a Yjs document snapshot with gzip compression
   * @param documentId - The document ID
   * @param yjsState - The Yjs state vector as Uint8Array
   */
  async saveSnapshot(
    documentId: string,
    yjsState: Uint8Array
  ): Promise<void> {
    // Compress the snapshot data
    const compressed = await gzipAsync(Buffer.from(yjsState));

    // Update the document with the compressed snapshot
    await Document.findByIdAndUpdate(documentId, {
      $set: {
        snapshotData: compressed,
        lastSnapshotAt: new Date(),
      },
    });

    // Cache the uncompressed snapshot in Redis
    await documentCacheService.setSnapshot(documentId, yjsState);

    logger.debug('Saved and cached document snapshot', {
      documentId,
      snapshotSize: yjsState.length,
      compressedSize: compressed.length,
      operationType: 'save_snapshot',
    });
  }

  /**
   * Load the latest Yjs document snapshot
   * @param documentId - The document ID
   * @returns The decompressed Yjs state vector or null if no snapshot exists
   */
  async loadSnapshot(documentId: string): Promise<Uint8Array | null> {
    // Try to get from cache first
    const cached = await documentCacheService.getSnapshot(documentId);
    if (cached) {
      logger.debug('Loaded snapshot from cache', {
        documentId,
        snapshotSize: cached.length,
        operationType: 'load_snapshot_cached',
      });
      return cached;
    }

    // Cache miss - load from database
    const document = await Document.findById(documentId);

    if (!document || !document.snapshotData) {
      return null;
    }

    // Decompress the snapshot data
    const decompressed = await gunzipAsync(document.snapshotData);
    const snapshot = new Uint8Array(decompressed);

    // Cache for future requests
    await documentCacheService.setSnapshot(documentId, snapshot);

    logger.debug('Loaded snapshot from database and cached', {
      documentId,
      snapshotSize: snapshot.length,
      operationType: 'load_snapshot_db',
    });

    return snapshot;
  }

  /**
   * Append an operation to the operation log
   * @param documentId - The document ID
   * @param userId - The user ID who performed the operation
   * @param yjsUpdate - The Yjs update as Uint8Array
   * @param operationType - The type of operation
   * @param clientId - The client ID
   * @param sessionId - The session ID
   * @param vectorClock - Optional vector clock for operation ordering
   */
  async appendOperation(
    documentId: string,
    userId: string,
    yjsUpdate: Uint8Array,
    operationType: 'insert' | 'delete' | 'format',
    clientId: string,
    sessionId: string,
    vectorClock?: Map<string, number>
  ): Promise<void> {
    await Operation.appendOperation(
      new mongoose.Types.ObjectId(documentId),
      new mongoose.Types.ObjectId(userId),
      operationType,
      Buffer.from(yjsUpdate),
      clientId,
      sessionId,
      vectorClock
    );

    // Increment operation count in document metadata
    await Document.findByIdAndUpdate(documentId, {
      $inc: { 'metadata.operationCount': 1 },
    });

    // Note: We don't invalidate cache here as operations are incremental
    // Cache will be updated when a new snapshot is created
  }

  /**
   * Get operations since a specific timestamp for incremental sync
   * @param documentId - The document ID
   * @param since - The timestamp to get operations since
   * @returns Array of operations
   */
  async getOperationsSince(
    documentId: string,
    since: Date
  ): Promise<Array<{ yjsUpdate: Uint8Array; timestamp: Date }>> {
    const operations = await Operation.findSince(
      new mongoose.Types.ObjectId(documentId),
      since
    );

    return operations.map((op) => ({
      yjsUpdate: new Uint8Array(op.yjsUpdate),
      timestamp: op.timestamp,
    }));
  }

  /**
   * Compact operations by creating a snapshot and deleting old operations
   * @param documentId - The document ID
   * @param retentionDays - Number of days to retain operations (default: 30)
   */
  async compactOperations(
    documentId: string,
    retentionDays: number = 30
  ): Promise<void> {
    const document = await Document.findById(documentId);

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Check if compaction is needed (>1000 operations since last snapshot)
    const lastSnapshotAt = document.lastSnapshotAt || document.createdAt;
    const operationsSinceSnapshot = await Operation.countDocuments({
      documentId: new mongoose.Types.ObjectId(documentId),
      timestamp: { $gte: lastSnapshotAt },
    });

    if (operationsSinceSnapshot <= 1000) {
      return; // No compaction needed
    }

    // Load current snapshot or create new Yjs document
    const yjsDoc = new Y.Doc();
    const existingSnapshot = await this.loadSnapshot(documentId);

    if (existingSnapshot) {
      Y.applyUpdate(yjsDoc, existingSnapshot);
    }

    // Apply all operations since last snapshot
    const operations = await Operation.find({
      documentId: new mongoose.Types.ObjectId(documentId),
      timestamp: { $gte: lastSnapshotAt },
    }).sort({ timestamp: 1 });

    for (const op of operations) {
      Y.applyUpdate(yjsDoc, new Uint8Array(op.yjsUpdate));
    }

    // Save new snapshot
    const newSnapshot = Y.encodeStateAsUpdate(yjsDoc);
    await this.saveSnapshot(documentId, newSnapshot);

    // Delete operations older than retention period
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - retentionDays);

    await Operation.compactOperations(
      new mongoose.Types.ObjectId(documentId),
      retentionDate
    );
  }

  /**
   * Get document state at a specific point in time (time-travel)
   * @param documentId - The document ID
   * @param targetTime - The target timestamp
   * @returns The Yjs state at the target time
   */
  async getDocumentAtTime(
    documentId: string,
    targetTime: Date
  ): Promise<Uint8Array> {
    const document = await Document.findById(documentId);

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Create a new Yjs document
    const yjsDoc = new Y.Doc();

    // Load the snapshot that was created before the target time
    const lastSnapshotAt = document.lastSnapshotAt;

    if (lastSnapshotAt && lastSnapshotAt <= targetTime) {
      const snapshot = await this.loadSnapshot(documentId);
      if (snapshot) {
        Y.applyUpdate(yjsDoc, snapshot);
      }
    }

    // Get operations between snapshot time and target time
    const startTime = lastSnapshotAt || document.createdAt;
    const operations = await Operation.find({
      documentId: new mongoose.Types.ObjectId(documentId),
      timestamp: {
        $gte: startTime,
        $lte: targetTime,
      },
    }).sort({ timestamp: 1 });

    // Apply operations up to target time
    for (const op of operations) {
      Y.applyUpdate(yjsDoc, new Uint8Array(op.yjsUpdate));
    }

    // Return the reconstructed state
    return Y.encodeStateAsUpdate(yjsDoc);
  }

  /**
   * Background job to compact documents with many operations
   * Should be called periodically (e.g., every hour)
   */
  async compactAllDocuments(): Promise<void> {
    // Find all documents that need compaction
    const documents = await Document.find({
      isDeleted: false,
    });

    for (const doc of documents) {
      try {
        const docId = (doc._id as mongoose.Types.ObjectId).toString();
        await this.compactOperations(docId);
      } catch (error) {
        const docId = (doc._id as mongoose.Types.ObjectId).toString();
        logDatabaseError('compactOperations', error, {
          documentId: docId,
          operationType: 'compact_operations',
        });
      }
    }
  }
}

export const persistenceService = new PersistenceService();

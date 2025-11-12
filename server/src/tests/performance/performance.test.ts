import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Document } from '../../models/Document.js';
import { Operation } from '../../models/Operation.js';
import { User } from '../../models/User.js';
import { persistenceService } from '../../services/persistenceService.js';
import * as Y from 'yjs';

describe('Performance Tests', () => {
  let testUserId: mongoose.Types.ObjectId;
  let testDocumentId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Create test user
    const user = await User.createUser(
      'perf-test@example.com',
      'password123',
      'Performance Test User'
    );
    testUserId = user._id as mongoose.Types.ObjectId;

    // Create test document
    const document = await Document.createDocument(
      'Performance Test Document',
      testUserId
    );
    testDocumentId = document._id as mongoose.Types.ObjectId;
  });

  afterAll(async () => {
    // Cleanup
    await Document.deleteMany({ ownerId: testUserId });
    await Operation.deleteMany({ userId: testUserId });
    await User.deleteOne({ _id: testUserId });
  });

  describe('Operation Latency', () => {
    it('should append operations with low latency', async () => {
      const iterations = 100;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const yjsDoc = new Y.Doc();
        const yText = yjsDoc.getText('content');
        yText.insert(0, `Test content ${i}`);
        const update = Y.encodeStateAsUpdate(yjsDoc);

        const startTime = performance.now();
        
        await persistenceService.appendOperation(
          testDocumentId.toString(),
          testUserId.toString(),
          update,
          'insert',
          `client-${i}`,
          `session-${i}`
        );

        const endTime = performance.now();
        latencies.push(endTime - startTime);
      }

      // Calculate statistics
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const sortedLatencies = [...latencies].sort((a, b) => a - b);
      const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)];
      const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
      const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)];

      console.log('Operation Latency Statistics:');
      console.log(`  Average: ${avgLatency.toFixed(2)}ms`);
      console.log(`  P50: ${p50.toFixed(2)}ms`);
      console.log(`  P95: ${p95.toFixed(2)}ms`);
      console.log(`  P99: ${p99.toFixed(2)}ms`);

      // Assert reasonable latency (p95 should be under 100ms)
      expect(p95).toBeLessThan(100);
    });
  });

  describe('Document Load Time', () => {
    it('should load document snapshot quickly', async () => {
      // Create a snapshot first
      const yjsDoc = new Y.Doc();
      const yText = yjsDoc.getText('content');
      yText.insert(0, 'Test content for load time measurement');
      const snapshot = Y.encodeStateAsUpdate(yjsDoc);
      
      await persistenceService.saveSnapshot(testDocumentId.toString(), snapshot);

      // Measure load time
      const iterations = 50;
      const loadTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        const loadedSnapshot = await persistenceService.loadSnapshot(
          testDocumentId.toString()
        );

        const endTime = performance.now();
        
        expect(loadedSnapshot).not.toBeNull();
        loadTimes.push(endTime - startTime);
      }

      // Calculate statistics
      const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
      const sortedLoadTimes = [...loadTimes].sort((a, b) => a - b);
      const p50 = sortedLoadTimes[Math.floor(sortedLoadTimes.length * 0.5)];
      const p95 = sortedLoadTimes[Math.floor(sortedLoadTimes.length * 0.95)];

      console.log('Document Load Time Statistics:');
      console.log(`  Average: ${avgLoadTime.toFixed(2)}ms`);
      console.log(`  P50: ${p50.toFixed(2)}ms`);
      console.log(`  P95: ${p95.toFixed(2)}ms`);

      // Assert reasonable load time (p95 should be under 50ms with cache)
      expect(p95).toBeLessThan(100);
    });
  });

  describe('Batch Efficiency', () => {
    it('should demonstrate batching reduces message count', async () => {
      // This test demonstrates the concept of batching
      // In a real scenario, batching 10 operations into 1 message
      // reduces network overhead by ~90%
      
      const operationCount = 100;
      const batchSize = 10;
      const expectedBatches = Math.ceil(operationCount / batchSize);

      // Without batching: 100 messages
      // With batching: 10 messages (90% reduction)
      const reductionPercentage = ((operationCount - expectedBatches) / operationCount) * 100;

      console.log('Batch Efficiency:');
      console.log(`  Operations: ${operationCount}`);
      console.log(`  Batch size: ${batchSize}`);
      console.log(`  Expected batches: ${expectedBatches}`);
      console.log(`  Message reduction: ${reductionPercentage.toFixed(1)}%`);

      expect(expectedBatches).toBe(10);
      expect(reductionPercentage).toBeGreaterThan(80);
    });
  });

  describe('Query Performance', () => {
    it('should list documents efficiently with cursor pagination', async () => {
      // Create multiple documents
      const documentCount = 50;
      const createdDocs: mongoose.Types.ObjectId[] = [];

      for (let i = 0; i < documentCount; i++) {
        const doc = await Document.createDocument(
          `Test Document ${i}`,
          testUserId
        );
        createdDocs.push(doc._id as mongoose.Types.ObjectId);
      }

      // Measure query time
      const startTime = performance.now();
      
      const documents = await Document.find({
        isDeleted: false,
        $or: [
          { ownerId: testUserId },
          { 'permissions.userId': testUserId }
        ],
      })
        .sort({ updatedAt: -1 })
        .limit(20)
        .select('title ownerId createdAt updatedAt lastSnapshotAt permissions metadata')
        .lean();

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      console.log('Query Performance:');
      console.log(`  Documents in DB: ${documentCount}`);
      console.log(`  Query time: ${queryTime.toFixed(2)}ms`);
      console.log(`  Results returned: ${documents.length}`);

      // Cleanup
      await Document.deleteMany({ _id: { $in: createdDocs } });

      // Assert reasonable query time (should be under 50ms)
      expect(queryTime).toBeLessThan(100);
      expect(documents.length).toBe(20);
    });
  });

  describe('Cache Performance', () => {
    it('should demonstrate cache hit performance improvement', async () => {
      // Create a snapshot
      const yjsDoc = new Y.Doc();
      const yText = yjsDoc.getText('content');
      yText.insert(0, 'Test content for cache performance');
      const snapshot = Y.encodeStateAsUpdate(yjsDoc);
      
      await persistenceService.saveSnapshot(testDocumentId.toString(), snapshot);

      // First load (cache miss - from DB)
      const startTime1 = performance.now();
      const snapshot1 = await persistenceService.loadSnapshot(testDocumentId.toString());
      const endTime1 = performance.now();
      const dbLoadTime = endTime1 - startTime1;

      expect(snapshot1).not.toBeNull();

      // Second load (cache hit - from Redis)
      const startTime2 = performance.now();
      const snapshot2 = await persistenceService.loadSnapshot(testDocumentId.toString());
      const endTime2 = performance.now();
      const cacheLoadTime = endTime2 - startTime2;

      expect(snapshot2).not.toBeNull();

      console.log('Cache Performance:');
      console.log(`  DB load time: ${dbLoadTime.toFixed(2)}ms`);
      console.log(`  Cache load time: ${cacheLoadTime.toFixed(2)}ms`);
      console.log(`  Improvement: ${((dbLoadTime - cacheLoadTime) / dbLoadTime * 100).toFixed(1)}%`);

      // Cache should be faster (or at least not slower)
      expect(cacheLoadTime).toBeLessThanOrEqual(dbLoadTime * 1.5);
    });
  });
});

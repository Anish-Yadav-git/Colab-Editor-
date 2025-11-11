/**
 * Tests for OfflineQueue service
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OfflineQueue } from './OfflineQueue';

describe('OfflineQueue', () => {
  let queue: OfflineQueue;
  const documentId = 'test-doc-123';

  beforeEach(async () => {
    queue = new OfflineQueue(documentId);
    // Wait for DB initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    await queue.clear();
    queue.close();
  });

  describe('enqueue', () => {
    it('should add operation to queue', async () => {
      const update = new Uint8Array([1, 2, 3, 4]);
      const vectorClock = new Map([['client1', 100]]);

      const operationId = await queue.enqueue(update, vectorClock);

      expect(operationId).toBeDefined();
      expect(operationId).toContain(documentId);

      const count = await queue.getCount();
      expect(count).toBe(1);
    });

    it('should store multiple operations', async () => {
      const update1 = new Uint8Array([1, 2, 3]);
      const update2 = new Uint8Array([4, 5, 6]);
      const vectorClock = new Map([['client1', 100]]);

      await queue.enqueue(update1, vectorClock);
      await queue.enqueue(update2, vectorClock);

      const count = await queue.getCount();
      expect(count).toBe(2);
    });

    it('should preserve operation data', async () => {
      const update = new Uint8Array([10, 20, 30, 40, 50]);
      const vectorClock = new Map([
        ['client1', 100],
        ['client2', 200],
      ]);

      await queue.enqueue(update, vectorClock);

      const operations = await queue.getAll();
      expect(operations).toHaveLength(1);
      expect(operations[0].yjsUpdate).toEqual(update);
      expect(operations[0].vectorClock).toEqual(vectorClock);
      expect(operations[0].documentId).toBe(documentId);
      expect(operations[0].retryCount).toBe(0);
    });
  });

  describe('getAll', () => {
    it('should return empty array when queue is empty', async () => {
      const operations = await queue.getAll();
      expect(operations).toEqual([]);
    });

    it('should return operations in timestamp order', async () => {
      const update1 = new Uint8Array([1]);
      const update2 = new Uint8Array([2]);
      const update3 = new Uint8Array([3]);
      const vectorClock = new Map([['client1', 100]]);

      // Add with small delays to ensure different timestamps
      await queue.enqueue(update1, vectorClock);
      await new Promise(resolve => setTimeout(resolve, 10));
      await queue.enqueue(update2, vectorClock);
      await new Promise(resolve => setTimeout(resolve, 10));
      await queue.enqueue(update3, vectorClock);

      const operations = await queue.getAll();
      expect(operations).toHaveLength(3);
      expect(operations[0].yjsUpdate).toEqual(update1);
      expect(operations[1].yjsUpdate).toEqual(update2);
      expect(operations[2].yjsUpdate).toEqual(update3);
      
      // Verify timestamps are in order
      expect(operations[0].timestamp).toBeLessThan(operations[1].timestamp);
      expect(operations[1].timestamp).toBeLessThan(operations[2].timestamp);
    });
  });

  describe('dequeue', () => {
    it('should remove operation from queue', async () => {
      const update = new Uint8Array([1, 2, 3]);
      const vectorClock = new Map([['client1', 100]]);

      const operationId = await queue.enqueue(update, vectorClock);
      expect(await queue.getCount()).toBe(1);

      await queue.dequeue(operationId);
      expect(await queue.getCount()).toBe(0);
    });

    it('should only remove specified operation', async () => {
      const update1 = new Uint8Array([1]);
      const update2 = new Uint8Array([2]);
      const vectorClock = new Map([['client1', 100]]);

      const id1 = await queue.enqueue(update1, vectorClock);
      const id2 = await queue.enqueue(update2, vectorClock);
      expect(await queue.getCount()).toBe(2);

      await queue.dequeue(id1);
      expect(await queue.getCount()).toBe(1);

      const operations = await queue.getAll();
      expect(operations[0].id).toBe(id2);
    });
  });

  describe('clear', () => {
    it('should remove all operations', async () => {
      const update = new Uint8Array([1, 2, 3]);
      const vectorClock = new Map([['client1', 100]]);

      await queue.enqueue(update, vectorClock);
      await queue.enqueue(update, vectorClock);
      await queue.enqueue(update, vectorClock);
      expect(await queue.getCount()).toBe(3);

      await queue.clear();
      expect(await queue.getCount()).toBe(0);
    });

    it('should handle empty queue', async () => {
      await queue.clear();
      expect(await queue.getCount()).toBe(0);
    });
  });

  describe('incrementRetryCount', () => {
    it('should increment retry count', async () => {
      const update = new Uint8Array([1, 2, 3]);
      const vectorClock = new Map([['client1', 100]]);

      const operationId = await queue.enqueue(update, vectorClock);
      
      let operations = await queue.getAll();
      expect(operations[0].retryCount).toBe(0);

      await queue.incrementRetryCount(operationId);
      
      operations = await queue.getAll();
      expect(operations[0].retryCount).toBe(1);

      await queue.incrementRetryCount(operationId);
      
      operations = await queue.getAll();
      expect(operations[0].retryCount).toBe(2);
    });

    it('should handle non-existent operation gracefully', async () => {
      await expect(queue.incrementRetryCount('non-existent-id')).resolves.not.toThrow();
    });
  });

  describe('getCount', () => {
    it('should return correct count', async () => {
      expect(await queue.getCount()).toBe(0);

      const update = new Uint8Array([1, 2, 3]);
      const vectorClock = new Map([['client1', 100]]);

      await queue.enqueue(update, vectorClock);
      expect(await queue.getCount()).toBe(1);

      await queue.enqueue(update, vectorClock);
      expect(await queue.getCount()).toBe(2);

      await queue.enqueue(update, vectorClock);
      expect(await queue.getCount()).toBe(3);
    });
  });

  describe('persistence', () => {
    it('should persist operations across queue instances', async () => {
      const update = new Uint8Array([1, 2, 3, 4, 5]);
      const vectorClock = new Map([['client1', 100]]);

      await queue.enqueue(update, vectorClock);
      await queue.enqueue(update, vectorClock);
      
      // Don't close the queue, just create a new instance
      // In fake-indexeddb, the data persists in memory

      // Create new queue instance (simulating page reload)
      const newQueue = new OfflineQueue(documentId);
      await new Promise(resolve => setTimeout(resolve, 100));

      const count = await newQueue.getCount();
      expect(count).toBe(2);

      const operations = await newQueue.getAll();
      expect(operations[0].yjsUpdate).toEqual(update);

      // Clean up both queues
      await newQueue.clear();
      newQueue.close();
    });
  });
});

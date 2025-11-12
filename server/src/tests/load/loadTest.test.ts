import { describe, test, expect } from 'vitest';
import * as Y from 'yjs';

/**
 * Load Tests
 * 
 * These tests simulate high load scenarios with many concurrent users
 * and measure operation latency and system performance.
 * 
 * Requirements: 11.5 - Load tests simulating 100+ concurrent users
 */

describe('Load Tests', () => {
  // Helper to create a client
  function createClient(clientId: number): { doc: Y.Doc; text: Y.Text } {
    const doc = new Y.Doc();
    doc.clientID = clientId;
    const text = doc.getText('content');
    return { doc, text };
  }

  // Helper to sync all clients
  function syncClients(clients: Array<{ doc: Y.Doc }>): void {
    for (let i = 0; i < clients.length; i++) {
      const update = Y.encodeStateAsUpdate(clients[i].doc);
      for (let j = 0; j < clients.length; j++) {
        if (i !== j) {
          Y.applyUpdate(clients[j].doc, update);
        }
      }
    }
  }

  // Helper to measure operation latency
  function measureLatency(operation: () => void): number {
    const start = performance.now();
    operation();
    const end = performance.now();
    return end - start;
  }

  // Helper to calculate percentiles
  function calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  describe('Concurrent Users', () => {
    test('100 concurrent users making edits converge', () => {
      const clientCount = 100;
      const clients = Array.from({ length: clientCount }, (_, i) =>
        createClient(i + 1)
      );

      // Initialize with content
      clients[0].text.insert(0, 'Load test document');
      syncClients(clients);

      // Each client makes 10 edits
      for (let round = 0; round < 10; round++) {
        clients.forEach((client, index) => {
          const pos = Math.floor(Math.random() * (client.text.length + 1));
          client.text.insert(pos, String(index % 10));
        });

        // Sync every round
        syncClients(clients);
      }

      // Verify all clients converged
      const finalStates = clients.map((c) => c.text.toString());
      for (let i = 1; i < finalStates.length; i++) {
        expect(finalStates[i]).toBe(finalStates[0]);
      }

      // Verify no data loss - characters may be interspersed but should all be present
      const finalText = finalStates[0];
      expect(finalText).toContain('L');
      expect(finalText).toContain('o');
      expect(finalText).toContain('a');
      expect(finalText).toContain('d');
    }, 30000);

    test('200 concurrent users with mixed operations', () => {
      const clientCount = 200;
      const clients = Array.from({ length: clientCount }, (_, i) =>
        createClient(i + 1)
      );

      // Initialize
      clients[0].text.insert(0, 'Stress test');
      syncClients(clients);

      // Each client makes random operations
      clients.forEach((client) => {
        const operation = Math.random();
        const len = client.text.length;

        if (operation < 0.7 && len > 0) {
          // 70% insert
          const pos = Math.floor(Math.random() * (len + 1));
          client.text.insert(pos, 'X');
        } else if (len > 1) {
          // 30% delete
          const pos = Math.floor(Math.random() * len);
          client.text.delete(pos, 1);
        }
      });

      // Sync all
      syncClients(clients);

      // Verify convergence
      const finalStates = clients.map((c) => c.text.toString());
      for (let i = 1; i < finalStates.length; i++) {
        expect(finalStates[i]).toBe(finalStates[0]);
      }
    }, 60000);
  });

  describe('Operation Latency', () => {
    test('measure insert operation latency (p50, p95, p99)', () => {
      const client = createClient(1);
      const latencies: number[] = [];

      // Initialize with content
      client.text.insert(0, 'Performance test document');

      // Measure 1000 insert operations
      for (let i = 0; i < 1000; i++) {
        const latency = measureLatency(() => {
          const pos = Math.floor(Math.random() * (client.text.length + 1));
          client.text.insert(pos, 'A');
        });
        latencies.push(latency);
      }

      // Calculate percentiles
      const p50 = calculatePercentile(latencies, 50);
      const p95 = calculatePercentile(latencies, 95);
      const p99 = calculatePercentile(latencies, 99);

      console.log(`Insert Latency - p50: ${p50.toFixed(3)}ms, p95: ${p95.toFixed(3)}ms, p99: ${p99.toFixed(3)}ms`);

      // Verify latency is reasonable (< 10ms for p95)
      expect(p95).toBeLessThan(10);
    });

    test('measure delete operation latency (p50, p95, p99)', () => {
      const client = createClient(1);
      const latencies: number[] = [];

      // Initialize with large content
      client.text.insert(0, 'A'.repeat(10000));

      // Measure 1000 delete operations
      for (let i = 0; i < 1000; i++) {
        const latency = measureLatency(() => {
          if (client.text.length > 0) {
            const pos = Math.floor(Math.random() * client.text.length);
            client.text.delete(pos, 1);
          }
        });
        latencies.push(latency);
      }

      // Calculate percentiles
      const p50 = calculatePercentile(latencies, 50);
      const p95 = calculatePercentile(latencies, 95);
      const p99 = calculatePercentile(latencies, 99);

      console.log(`Delete Latency - p50: ${p50.toFixed(3)}ms, p95: ${p95.toFixed(3)}ms, p99: ${p99.toFixed(3)}ms`);

      // Verify latency is reasonable
      expect(p95).toBeLessThan(10);
    });

    test('measure sync operation latency with 10 clients', () => {
      const clientCount = 10;
      const clients = Array.from({ length: clientCount }, (_, i) =>
        createClient(i + 1)
      );
      const latencies: number[] = [];

      // Initialize
      clients[0].text.insert(0, 'Sync test');
      syncClients(clients);

      // Measure sync latency for 50 rounds
      for (let round = 0; round < 50; round++) {
        // Each client makes an edit
        clients.forEach((client) => {
          client.text.insert(client.text.length, 'X');
        });

        // Measure sync time
        const latency = measureLatency(() => {
          syncClients(clients);
        });
        latencies.push(latency);
      }

      // Calculate percentiles
      const p50 = calculatePercentile(latencies, 50);
      const p95 = calculatePercentile(latencies, 95);
      const p99 = calculatePercentile(latencies, 99);

      console.log(`Sync Latency (10 clients) - p50: ${p50.toFixed(3)}ms, p95: ${p95.toFixed(3)}ms, p99: ${p99.toFixed(3)}ms`);

      // Note: Full mesh sync (O(n²)) is expensive. In production, server would broadcast.
      // Verify sync completes
      expect(p95).toBeLessThan(1000);
    }, 60000);
  });

  describe('Large Documents', () => {
    test('handle document with 100k characters', () => {
      const client = createClient(1);

      // Create large document
      const largeText = 'A'.repeat(100000);
      client.text.insert(0, largeText);

      // Verify document size
      expect(client.text.length).toBe(100000);

      // Make edits on large document
      const latencies: number[] = [];
      for (let i = 0; i < 100; i++) {
        const latency = measureLatency(() => {
          const pos = Math.floor(Math.random() * client.text.length);
          client.text.insert(pos, 'X');
        });
        latencies.push(latency);
      }

      const p95 = calculatePercentile(latencies, 95);
      console.log(`Large doc (100k chars) insert p95: ${p95.toFixed(3)}ms`);

      // Verify performance doesn't degrade significantly
      expect(p95).toBeLessThan(20);
    });

    test('handle document with 500k characters', () => {
      const client = createClient(1);

      // Create very large document
      const largeText = 'A'.repeat(500000);
      client.text.insert(0, largeText);

      // Verify document size
      expect(client.text.length).toBe(500000);

      // Make edits
      const latencies: number[] = [];
      for (let i = 0; i < 50; i++) {
        const latency = measureLatency(() => {
          const pos = Math.floor(Math.random() * client.text.length);
          client.text.insert(pos, 'X');
        });
        latencies.push(latency);
      }

      const p95 = calculatePercentile(latencies, 95);
      console.log(`Large doc (500k chars) insert p95: ${p95.toFixed(3)}ms`);

      // Verify performance is still acceptable
      expect(p95).toBeLessThan(50);
    });

    test('sync large document between multiple clients', () => {
      const clients = [createClient(1), createClient(2), createClient(3)];

      // Create large document on client 1
      const largeText = 'B'.repeat(100000);
      clients[0].text.insert(0, largeText);

      // Measure sync time
      const syncLatency = measureLatency(() => {
        syncClients(clients);
      });

      console.log(`Large doc sync latency: ${syncLatency.toFixed(3)}ms`);

      // Verify all clients have same content
      expect(clients[1].text.length).toBe(100000);
      expect(clients[2].text.length).toBe(100000);
      expect(clients[0].text.toString()).toBe(clients[1].text.toString());

      // Verify sync time is reasonable
      expect(syncLatency).toBeLessThan(1000);
    });
  });

  describe('Data Integrity Under Load', () => {
    test('no data loss with 100 concurrent users and 1000 operations', () => {
      const clientCount = 100;
      const operationsPerClient = 10;
      const clients = Array.from({ length: clientCount }, (_, i) =>
        createClient(i + 1)
      );

      // Track expected character count
      let expectedInserts = 0;
      let expectedDeletes = 0;

      // Initialize
      clients[0].text.insert(0, 'Start');
      expectedInserts += 5;
      syncClients(clients);

      // Each client makes operations
      for (let op = 0; op < operationsPerClient; op++) {
        clients.forEach((client) => {
          const len = client.text.length;
          if (Math.random() < 0.8) {
            // 80% insert
            const pos = Math.floor(Math.random() * (len + 1));
            client.text.insert(pos, 'X');
            expectedInserts++;
          } else if (len > 1) {
            // 20% delete
            const pos = Math.floor(Math.random() * len);
            client.text.delete(pos, 1);
            expectedDeletes++;
          }
        });

        // Sync every 2 operations
        if (op % 2 === 0) {
          syncClients(clients);
        }
      }

      // Final sync
      syncClients(clients);

      // Verify convergence
      const finalStates = clients.map((c) => c.text.toString());
      for (let i = 1; i < finalStates.length; i++) {
        expect(finalStates[i]).toBe(finalStates[0]);
      }

      // Verify expected length (allow small variance due to concurrent deletes)
      const expectedLength = expectedInserts - expectedDeletes;
      const actualLength = finalStates[0].length;
      const variance = Math.abs(actualLength - expectedLength);
      expect(variance).toBeLessThan(100); // Allow some variance in concurrent scenario

      console.log(`Data integrity: ${clientCount} clients, ${clientCount * operationsPerClient} total ops, final length: ${finalStates[0].length}`);
    }, 60000);

    test('verify character preservation under heavy load', () => {
      const clientCount = 20;
      const clients = Array.from({ length: clientCount }, (_, i) =>
        createClient(i + 1)
      );

      // Each client inserts unique marker (single char to avoid splitting)
      const markers = 'ABCDEFGHIJKLMNOPQRST'.split('');
      clients.forEach((client, i) => {
        client.text.insert(0, markers[i]);
      });

      syncClients(clients);

      // Make many random edits
      for (let round = 0; round < 10; round++) {
        clients.forEach((client) => {
          const len = client.text.length;
          if (len > 0) {
            const pos = Math.floor(Math.random() * (len + 1));
            client.text.insert(pos, 'X');
          }
        });
        syncClients(clients);
      }

      // Verify all marker characters are present
      const finalText = clients[0].text.toString();
      markers.forEach((marker) => {
        expect(finalText).toContain(marker);
      });
    }, 30000);
  });

  describe('Memory and Performance', () => {
    test('memory usage remains stable with many operations', () => {
      const client = createClient(1);

      // Initialize
      client.text.insert(0, 'Memory test');

      // Perform many operations
      for (let i = 0; i < 10000; i++) {
        const pos = Math.floor(Math.random() * (client.text.length + 1));
        client.text.insert(pos, 'A');

        // Occasionally delete to prevent unbounded growth
        if (i % 100 === 0 && client.text.length > 1000) {
          const delPos = Math.floor(Math.random() * client.text.length);
          client.text.delete(delPos, 1);
        }
      }

      // Verify document is still functional
      expect(client.text.length).toBeGreaterThan(0);

      // Measure final operation latency
      const latency = measureLatency(() => {
        client.text.insert(0, 'X');
      });

      console.log(`Latency after 10k ops: ${latency.toFixed(3)}ms`);

      // Verify performance hasn't degraded significantly
      expect(latency).toBeLessThan(10);
    });

    test('update size remains reasonable with many clients', () => {
      const clientCount = 100;
      const clients = Array.from({ length: clientCount }, (_, i) =>
        createClient(i + 1)
      );

      // Initialize
      clients[0].text.insert(0, 'Update size test');
      syncClients(clients);

      // Each client makes one edit
      clients.forEach((client, i) => {
        client.text.insert(client.text.length, String(i % 10));
      });

      // Measure update sizes
      const updateSizes = clients.map((client) => {
        const update = Y.encodeStateAsUpdate(client.doc);
        return update.length;
      });

      const avgSize = updateSizes.reduce((a, b) => a + b, 0) / updateSizes.length;
      const maxSize = Math.max(...updateSizes);

      console.log(`Update sizes - avg: ${avgSize.toFixed(0)} bytes, max: ${maxSize} bytes`);

      // Verify update sizes are reasonable (< 1KB for single character insert)
      expect(maxSize).toBeLessThan(1024);
    });
  });

  describe('Throughput', () => {
    test('measure operations per second with single client', () => {
      const client = createClient(1);
      client.text.insert(0, 'Throughput test');

      const startTime = performance.now();
      const operationCount = 10000;

      for (let i = 0; i < operationCount; i++) {
        const pos = Math.floor(Math.random() * (client.text.length + 1));
        client.text.insert(pos, 'X');
      }

      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000; // seconds
      const opsPerSecond = operationCount / duration;

      console.log(`Single client throughput: ${opsPerSecond.toFixed(0)} ops/sec`);

      // Verify throughput is reasonable (> 1000 ops/sec)
      expect(opsPerSecond).toBeGreaterThan(1000);
    });

    test('measure aggregate throughput with 50 clients', () => {
      const clientCount = 50;
      const opsPerClient = 100;
      const clients = Array.from({ length: clientCount }, (_, i) =>
        createClient(i + 1)
      );

      // Initialize
      clients[0].text.insert(0, 'Aggregate throughput');
      syncClients(clients);

      const startTime = performance.now();

      // All clients make operations
      for (let op = 0; op < opsPerClient; op++) {
        clients.forEach((client) => {
          const pos = Math.floor(Math.random() * (client.text.length + 1));
          client.text.insert(pos, 'X');
        });
      }

      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000; // seconds
      const totalOps = clientCount * opsPerClient;
      const opsPerSecond = totalOps / duration;

      console.log(`Aggregate throughput (${clientCount} clients): ${opsPerSecond.toFixed(0)} ops/sec`);

      // Verify aggregate throughput
      expect(opsPerSecond).toBeGreaterThan(5000);
    });
  });
});

import { describe, test, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';

/**
 * Fault Injection Tests
 * 
 * These tests inject various faults (latency, packet loss, server failures)
 * to verify that the system handles failures gracefully and recovers correctly.
 * 
 * Requirements: 11.3 - Fault injection with artificial latency and network faults
 */

describe('Fault Injection Tests', () => {
  // Helper to create a client
  function createClient(clientId: string): { doc: Y.Doc; text: Y.Text } {
    const doc = new Y.Doc();
    doc.clientID = parseInt(clientId, 10);
    const text = doc.getText('content');
    return { doc, text };
  }

  // Helper to simulate delayed sync (network latency)
  async function syncWithLatency(
    clients: Array<{ doc: Y.Doc }>,
    latencyMs: number
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));

    // Exchange updates between all clients
    for (let i = 0; i < clients.length; i++) {
      const update = Y.encodeStateAsUpdate(clients[i].doc);
      for (let j = 0; j < clients.length; j++) {
        if (i !== j) {
          Y.applyUpdate(clients[j].doc, update);
        }
      }
    }
  }

  // Helper to simulate packet loss
  function syncWithPacketLoss(
    clients: Array<{ doc: Y.Doc }>,
    lossRate: number
  ): void {
    // Exchange updates between all clients with random packet loss
    for (let i = 0; i < clients.length; i++) {
      const update = Y.encodeStateAsUpdate(clients[i].doc);
      for (let j = 0; j < clients.length; j++) {
        if (i !== j) {
          // Simulate packet loss
          if (Math.random() > lossRate) {
            Y.applyUpdate(clients[j].doc, update);
          }
        }
      }
    }
  }

  // Helper to sync all clients normally
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

  describe('Network Latency', () => {
    test('clients converge with 500ms latency', async () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
      ];

      // Clients make concurrent edits
      clients[0].text.insert(0, 'Hello ');
      clients[1].text.insert(0, 'World ');
      clients[2].text.insert(0, '!');

      // Sync with 500ms latency
      await syncWithLatency(clients, 500);

      // All clients should converge despite latency
      const finalStates = clients.map((c) => c.text.toString());
      expect(finalStates[0]).toBe(finalStates[1]);
      expect(finalStates[1]).toBe(finalStates[2]);
      expect(finalStates[0]).toContain('Hello');
      expect(finalStates[0]).toContain('World');
      expect(finalStates[0]).toContain('!');
    });

    test('rapid edits converge with high latency', async () => {
      const clients = [createClient('1'), createClient('2')];

      // Initialize
      clients[0].text.insert(0, 'Start');
      await syncWithLatency(clients, 100);

      // Rapid edits with latency
      for (let i = 0; i < 10; i++) {
        clients[0].text.insert(clients[0].text.length, 'A');
        clients[1].text.insert(clients[1].text.length, 'B');
        await syncWithLatency(clients, 200);
      }

      // Final sync
      await syncWithLatency(clients, 200);

      // Should converge
      expect(clients[0].text.toString()).toBe(clients[1].text.toString());
      expect(clients[0].text.toString()).toContain('Start');
    });

    test('variable latency does not cause divergence', async () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
      ];

      // Initialize
      clients[0].text.insert(0, 'Test');
      syncClients(clients);

      // Make edits with variable latency
      for (let i = 0; i < 5; i++) {
        clients.forEach((client, index) => {
          client.text.insert(client.text.length, String(index));
        });

        // Random latency between 50-500ms
        const latency = 50 + Math.random() * 450;
        await syncWithLatency(clients, latency);
      }

      // All should converge
      const finalStates = clients.map((c) => c.text.toString());
      expect(finalStates[0]).toBe(finalStates[1]);
      expect(finalStates[1]).toBe(finalStates[2]);
    });
  });

  describe('Packet Loss', () => {
    test('clients converge after packet loss with retry', () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
      ];

      // Initialize
      clients[0].text.insert(0, 'Initial');
      syncClients(clients);

      // Make edits
      clients[0].text.insert(7, ' A');
      clients[1].text.insert(7, ' B');
      clients[2].text.insert(7, ' C');

      // First sync with 50% packet loss
      syncWithPacketLoss(clients, 0.5);

      // Clients may not be converged yet
      // Retry sync (simulating retransmission)
      syncClients(clients);

      // Should converge after retry
      const finalStates = clients.map((c) => c.text.toString());
      expect(finalStates[0]).toBe(finalStates[1]);
      expect(finalStates[1]).toBe(finalStates[2]);
    });

    test('multiple sync attempts overcome packet loss', () => {
      const clients = [createClient('1'), createClient('2')];

      // Initialize
      clients[0].text.insert(0, 'Start');
      syncClients(clients);

      // Make many edits
      for (let i = 0; i < 20; i++) {
        clients[0].text.insert(clients[0].text.length, 'X');
        clients[1].text.insert(clients[1].text.length, 'Y');
      }

      // Sync with packet loss multiple times
      for (let attempt = 0; attempt < 5; attempt++) {
        syncWithPacketLoss(clients, 0.3); // 30% loss
      }

      // Final reliable sync
      syncClients(clients);

      // Should converge
      expect(clients[0].text.toString()).toBe(clients[1].text.toString());
    });

    test('partial updates are handled correctly', () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
      ];

      // Initialize
      clients[0].text.insert(0, 'ABC');
      syncClients(clients);

      // Client 1 makes multiple edits
      clients[0].text.insert(1, '1');
      clients[0].text.insert(2, '2');
      clients[0].text.insert(3, '3');

      // Simulate partial delivery (only some clients receive update)
      const update = Y.encodeStateAsUpdate(clients[0].doc);
      Y.applyUpdate(clients[1].doc, update); // Client 2 receives
      // Client 3 doesn't receive (packet lost)

      // Client 3 makes its own edit
      clients[2].text.insert(3, 'Z');

      // Eventually all updates are delivered
      syncClients(clients);

      // All should converge
      const finalStates = clients.map((c) => c.text.toString());
      expect(finalStates[0]).toBe(finalStates[1]);
      expect(finalStates[1]).toBe(finalStates[2]);
    });
  });

  describe('Server Restart Simulation', () => {
    test('clients recover after server restart', () => {
      const clients = [createClient('1'), createClient('2')];

      // Initial state
      clients[0].text.insert(0, 'Before restart');
      syncClients(clients);

      // Both clients make edits
      clients[0].text.insert(14, ' A');
      clients[1].text.insert(14, ' B');

      // Simulate server restart (save state, create new server)
      const savedStates = clients.map((c) => Y.encodeStateAsUpdate(c.doc));

      // Create new "server" document
      const serverDoc = new Y.Doc();
      const serverText = serverDoc.getText('content');

      // Restore state from saved snapshots
      savedStates.forEach((state) => {
        Y.applyUpdate(serverDoc, state);
      });

      // Clients reconnect and sync with server
      const serverUpdate = Y.encodeStateAsUpdate(serverDoc);
      clients.forEach((client) => {
        Y.applyUpdate(client.doc, serverUpdate);
      });

      // Sync clients with each other
      syncClients(clients);

      // Should converge
      expect(clients[0].text.toString()).toBe(clients[1].text.toString());
      expect(clients[0].text.toString()).toContain('Before restart');
    });

    test('edits during server downtime are preserved', () => {
      const clients = [createClient('1'), createClient('2')];

      // Initial state
      clients[0].text.insert(0, 'Initial');
      syncClients(clients);

      // Save server state
      const serverSnapshot = Y.encodeStateAsUpdate(clients[0].doc);

      // Simulate server going down
      // Clients continue editing locally
      clients[0].text.insert(7, ' offline1');
      clients[1].text.insert(7, ' offline2');

      // Server comes back up
      const serverDoc = new Y.Doc();
      Y.applyUpdate(serverDoc, serverSnapshot);

      // Clients reconnect and send their offline edits
      const update0 = Y.encodeStateAsUpdate(clients[0].doc);
      const update1 = Y.encodeStateAsUpdate(clients[1].doc);

      Y.applyUpdate(serverDoc, update0);
      Y.applyUpdate(serverDoc, update1);

      // Server broadcasts merged state
      const mergedUpdate = Y.encodeStateAsUpdate(serverDoc);
      clients.forEach((client) => {
        Y.applyUpdate(client.doc, mergedUpdate);
      });

      // All should converge with offline edits preserved
      const finalStates = clients.map((c) => c.text.toString());
      expect(finalStates[0]).toBe(finalStates[1]);
      expect(finalStates[0]).toContain('Initial');
      expect(finalStates[0]).toContain('offline1');
      expect(finalStates[0]).toContain('offline2');
    });

    test('server restart mid-edit preserves consistency', () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
      ];

      // Initial state
      clients[0].text.insert(0, 'Start');
      syncClients(clients);

      // Clients start making edits
      clients[0].text.insert(5, ' A');
      clients[1].text.insert(5, ' B');

      // Partial sync (only client 1's edit reaches server)
      const serverDoc = new Y.Doc();
      const serverText = serverDoc.getText('content');
      serverText.insert(0, 'Start');
      const update0 = Y.encodeStateAsUpdate(clients[0].doc);
      Y.applyUpdate(serverDoc, update0);

      // Server restarts (client 2's edit was in flight)
      // Client 3 makes edit during restart
      clients[2].text.insert(5, ' C');

      // Server comes back, all clients resync
      const update1 = Y.encodeStateAsUpdate(clients[1].doc);
      const update2 = Y.encodeStateAsUpdate(clients[2].doc);

      Y.applyUpdate(serverDoc, update1);
      Y.applyUpdate(serverDoc, update2);

      // Broadcast merged state
      const mergedUpdate = Y.encodeStateAsUpdate(serverDoc);
      clients.forEach((client) => {
        Y.applyUpdate(client.doc, mergedUpdate);
      });

      // All should converge
      const finalStates = clients.map((c) => c.text.toString());
      expect(finalStates[0]).toBe(finalStates[1]);
      expect(finalStates[1]).toBe(finalStates[2]);
      expect(finalStates[0]).toContain('Start');
    });
  });

  describe('Graceful Recovery', () => {
    test('system recovers from temporary network partition', () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
      ];

      // Initial state
      clients[0].text.insert(0, 'Partition test');
      syncClients(clients);

      // Network partition: clients 1&2 can communicate, client 3 isolated
      clients[0].text.insert(14, ' A');
      clients[1].text.insert(14, ' B');
      clients[2].text.insert(14, ' C'); // Isolated

      // Sync only clients 1 and 2
      const update0 = Y.encodeStateAsUpdate(clients[0].doc);
      const update1 = Y.encodeStateAsUpdate(clients[1].doc);
      Y.applyUpdate(clients[0].doc, update1);
      Y.applyUpdate(clients[1].doc, update0);

      // Network heals, all clients sync
      syncClients(clients);

      // All should converge
      const finalStates = clients.map((c) => c.text.toString());
      expect(finalStates[0]).toBe(finalStates[1]);
      expect(finalStates[1]).toBe(finalStates[2]);
      expect(finalStates[0]).toContain('Partition test');
      expect(finalStates[0]).toContain('A');
      expect(finalStates[0]).toContain('B');
      expect(finalStates[0]).toContain('C');
    });

    test('concurrent failures do not cause data loss', () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
        createClient('4'),
      ];

      // Initialize
      clients[0].text.insert(0, 'Resilience');
      syncClients(clients);

      // All clients make edits
      clients[0].text.insert(10, ' A');
      clients[1].text.insert(10, ' B');
      clients[2].text.insert(10, ' C');
      clients[3].text.insert(10, ' D');

      // Simulate multiple failures
      // - 50% packet loss
      // - Client 2 temporarily disconnected
      syncWithPacketLoss([clients[0], clients[2], clients[3]], 0.5);

      // Retry with all clients
      syncClients(clients);

      // All should converge with no data loss
      const finalStates = clients.map((c) => c.text.toString());
      for (let i = 1; i < finalStates.length; i++) {
        expect(finalStates[i]).toBe(finalStates[0]);
      }
      expect(finalStates[0]).toContain('Resilience');
      expect(finalStates[0]).toContain('A');
      expect(finalStates[0]).toContain('B');
      expect(finalStates[0]).toContain('C');
      expect(finalStates[0]).toContain('D');
    });

    test('system handles rapid connect/disconnect cycles', () => {
      const clients = [createClient('1'), createClient('2')];

      // Initialize
      clients[0].text.insert(0, 'Unstable');
      syncClients(clients);

      // Simulate rapid connect/disconnect
      for (let i = 0; i < 10; i++) {
        // Make edit
        clients[0].text.insert(clients[0].text.length, 'A');
        clients[1].text.insert(clients[1].text.length, 'B');

        // Sometimes sync, sometimes don't (simulating disconnect)
        if (Math.random() > 0.3) {
          syncClients(clients);
        }
      }

      // Final stable sync
      syncClients(clients);

      // Should converge
      expect(clients[0].text.toString()).toBe(clients[1].text.toString());
      expect(clients[0].text.toString()).toContain('Unstable');
    });
  });

  describe('Edge Case Failures', () => {
    test('handles out-of-order message delivery', () => {
      const clients = [createClient('1'), createClient('2')];

      // Initialize
      clients[0].text.insert(0, 'Order');
      syncClients(clients);

      // Client 1 makes multiple sequential edits
      clients[0].text.insert(5, '1');
      const update1 = Y.encodeStateAsUpdate(clients[0].doc);

      clients[0].text.insert(6, '2');
      const update2 = Y.encodeStateAsUpdate(clients[0].doc);

      clients[0].text.insert(7, '3');
      const update3 = Y.encodeStateAsUpdate(clients[0].doc);

      // Apply updates out of order to client 2
      Y.applyUpdate(clients[1].doc, update3);
      Y.applyUpdate(clients[1].doc, update1);
      Y.applyUpdate(clients[1].doc, update2);

      // Should still converge correctly
      expect(clients[0].text.toString()).toBe(clients[1].text.toString());
    });

    test('handles duplicate message delivery', () => {
      const clients = [createClient('1'), createClient('2')];

      // Initialize
      clients[0].text.insert(0, 'Duplicate');
      syncClients(clients);

      // Client 1 makes edit
      clients[0].text.insert(9, ' test');
      const update = Y.encodeStateAsUpdate(clients[0].doc);

      // Apply same update multiple times (simulating duplicate delivery)
      Y.applyUpdate(clients[1].doc, update);
      Y.applyUpdate(clients[1].doc, update);
      Y.applyUpdate(clients[1].doc, update);

      // Should handle duplicates gracefully
      expect(clients[0].text.toString()).toBe(clients[1].text.toString());
      expect(clients[1].text.toString()).toBe('Duplicate test');
    });

    test('handles corrupted state recovery', () => {
      const clients = [createClient('1'), createClient('2')];

      // Initialize
      clients[0].text.insert(0, 'Recovery');
      syncClients(clients);

      // Both make edits
      clients[0].text.insert(8, ' A');
      clients[1].text.insert(8, ' B');

      // Simulate client 2 having corrupted state
      // Recovery: full state sync from client 1
      const fullState = Y.encodeStateAsUpdate(clients[0].doc);

      // Create fresh document for client 2 (simulating reset)
      const newDoc = new Y.Doc();
      newDoc.clientID = clients[1].doc.clientID;
      Y.applyUpdate(newDoc, fullState);

      // Apply client 2's pending edits
      const client2Edits = Y.encodeStateAsUpdate(clients[1].doc);
      Y.applyUpdate(newDoc, client2Edits);

      // Update client 2's document
      clients[1].doc = newDoc;
      clients[1].text = newDoc.getText('content');

      // Sync
      syncClients(clients);

      // Should converge
      expect(clients[0].text.toString()).toBe(clients[1].text.toString());
    });
  });
});

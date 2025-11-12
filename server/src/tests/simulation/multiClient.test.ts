import { describe, test, expect } from 'vitest';
import * as Y from 'yjs';

/**
 * Multi-Client Simulation Tests
 * 
 * These tests simulate multiple clients programmatically and verify
 * that concurrent edits from multiple clients converge to the same state.
 * 
 * Note: These tests simulate clients without actual WebSocket connections
 * to focus on CRDT convergence behavior.
 * 
 * Requirements: 11.2 - Multi-client simulation with concurrent random edits
 */

describe('Multi-Client Simulation Tests', () => {
  // Helper to create a simulated client
  function createClient(clientId: string): { doc: Y.Doc; text: Y.Text } {
    const doc = new Y.Doc();
    doc.clientID = parseInt(clientId, 10);
    const text = doc.getText('content');
    return { doc, text };
  }

  // Helper to sync updates between clients
  function syncClients(clients: Array<{ doc: Y.Doc }>): void {
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

  describe('Three Client Concurrent Edits', () => {
    test('three clients making sequential edits converge', () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
      ];

      // Client 1 inserts
      clients[0].text.insert(0, 'Hello ');
      syncClients(clients);

      // Client 2 inserts
      clients[1].text.insert(6, 'World ');
      syncClients(clients);

      // Client 3 inserts
      clients[2].text.insert(12, '!');
      syncClients(clients);

      // All clients should have same state
      const finalStates = clients.map((c) => c.text.toString());
      expect(finalStates[0]).toBe(finalStates[1]);
      expect(finalStates[1]).toBe(finalStates[2]);
      expect(finalStates[0]).toBe('Hello World !');
    });

    test('three clients making concurrent edits converge', () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
      ];

      // All clients insert simultaneously (before sync)
      clients[0].text.insert(0, 'A');
      clients[1].text.insert(0, 'B');
      clients[2].text.insert(0, 'C');

      // Sync all updates
      syncClients(clients);

      // All clients should have same state
      const finalStates = clients.map((c) => c.text.toString());
      expect(finalStates[0]).toBe(finalStates[1]);
      expect(finalStates[1]).toBe(finalStates[2]);
      expect(finalStates[0].length).toBe(3);
      expect(finalStates[0]).toContain('A');
      expect(finalStates[0]).toContain('B');
      expect(finalStates[0]).toContain('C');
    });

    test('three clients with mixed operations converge', () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
      ];

      // Initialize with some content
      clients[0].text.insert(0, 'ABCDEFGH');
      syncClients(clients);

      // Mixed operations (concurrent)
      clients[0].text.insert(4, 'X'); // Insert
      clients[1].text.delete(2, 2);   // Delete
      clients[2].text.insert(8, 'Y'); // Insert at end

      // Sync all updates
      syncClients(clients);

      // All clients should have same state
      const finalStates = clients.map((c) => c.text.toString());
      expect(finalStates[0]).toBe(finalStates[1]);
      expect(finalStates[1]).toBe(finalStates[2]);
    });
  });

  describe('Five Client Concurrent Edits', () => {
    test('five clients making random edits converge', () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
        createClient('4'),
        createClient('5'),
      ];

      // Initialize with content
      clients[0].text.insert(0, 'Initial content for testing');
      syncClients(clients);

      // Each client makes random edits (concurrent)
      clients.forEach((client, index) => {
        const text = client.text;
        const len = text.length;

        // Random insert
        if (len > 0) {
          const pos = Math.floor(Math.random() * len);
          text.insert(pos, `${index}`);
        }

        // Random delete (small range)
        if (len > 5) {
          const pos = Math.floor(Math.random() * (len - 2));
          text.delete(pos, 1);
        }
      });

      // Sync all updates
      syncClients(clients);

      // All clients should have same state
      const finalStates = clients.map((c) => c.text.toString());
      for (let i = 1; i < finalStates.length; i++) {
        expect(finalStates[i]).toBe(finalStates[0]);
      }
    });

    test('five clients with rapid sequential operations converge', () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
        createClient('4'),
        createClient('5'),
      ];

      // Each client rapidly inserts multiple characters
      for (let i = 0; i < 5; i++) {
        clients.forEach((client, index) => {
          client.text.insert(client.text.length, `${index}`);
        });
        syncClients(clients);
      }

      // All clients should have same state
      const finalStates = clients.map((c) => c.text.toString());
      for (let i = 1; i < finalStates.length; i++) {
        expect(finalStates[i]).toBe(finalStates[0]);
      }
      expect(finalStates[0].length).toBe(25); // 5 clients * 5 inserts
    });
  });

  describe('Various Edit Patterns', () => {
    test('clients with typing simulation converge', () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
      ];

      // Simulate typing: each client types a sentence character by character
      const sentences = [
        'The quick brown fox ',
        'jumps over the ',
        'lazy dog.',
      ];

      sentences.forEach((sentence, clientIndex) => {
        for (let i = 0; i < sentence.length; i++) {
          clients[clientIndex].text.insert(
            clients[clientIndex].text.length,
            sentence[i]
          );
          // Sync after each character to simulate real-time typing
          if (i % 5 === 0) {
            syncClients(clients);
          }
        }
      });

      // Final sync
      syncClients(clients);

      // All clients should have same state
      const finalStates = clients.map((c) => c.text.toString());
      expect(finalStates[0]).toBe(finalStates[1]);
      expect(finalStates[1]).toBe(finalStates[2]);
      expect(finalStates[0]).toContain('quick');
      expect(finalStates[0]).toContain('jumps');
      expect(finalStates[0]).toContain('lazy');
    });

    test('clients with backspace simulation converge', () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
      ];

      // Initialize with content
      clients[0].text.insert(0, 'AAABBBCCCDDDEEEFFFGGGHHHIII');
      syncClients(clients);

      // Simulate backspace: each client deletes from different positions
      clients.forEach((client, index) => {
        const startPos = index * 9; // Different starting positions
        for (let i = 0; i < 3; i++) {
          if (client.text.length > startPos) {
            client.text.delete(startPos, 1);
          }
        }
      });

      // Sync all deletions
      syncClients(clients);

      // All clients should have same state
      const finalStates = clients.map((c) => c.text.toString());
      expect(finalStates[0]).toBe(finalStates[1]);
      expect(finalStates[1]).toBe(finalStates[2]);
      expect(finalStates[0].length).toBe(18); // 27 - 9 deletions
    });

    test('clients with cut and paste simulation converge', () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
      ];

      // Initialize with content
      clients[0].text.insert(0, 'ABC DEF GHI JKL MNO');
      syncClients(clients);

      // Client 1: Cut "DEF" and paste at end (concurrent)
      const cutText1 = clients[0].text.toString().substring(4, 7);
      clients[0].text.delete(4, 3);
      clients[0].text.insert(clients[0].text.length, cutText1);

      // Client 2: Cut "JKL" and paste at beginning (concurrent)
      const cutText2 = clients[1].text.toString().substring(12, 15);
      clients[1].text.delete(12, 3);
      clients[1].text.insert(0, cutText2);

      // Sync all operations
      syncClients(clients);

      // All clients should have same state
      const finalStates = clients.map((c) => c.text.toString());
      expect(finalStates[0]).toBe(finalStates[1]);
      expect(finalStates[1]).toBe(finalStates[2]);
      // Original content should still be present
      expect(finalStates[0]).toContain('ABC');
      expect(finalStates[0]).toContain('GHI');
      expect(finalStates[0]).toContain('MNO');
    });
  });

  describe('Client Join and Leave', () => {
    test('new client joining receives current state', () => {
      const client1 = createClient('1');

      // Client 1 creates content
      client1.text.insert(0, 'Hello World');

      // Client 2 joins later
      const client2 = createClient('2');

      // Sync state from client 1 to client 2
      const update = Y.encodeStateAsUpdate(client1.doc);
      Y.applyUpdate(client2.doc, update);

      // Client 2 should have same content
      expect(client2.text.toString()).toBe(client1.text.toString());
      expect(client2.text.toString()).toBe('Hello World');
    });

    test('client leaving does not affect remaining clients', () => {
      const clients = [
        createClient('1'),
        createClient('2'),
        createClient('3'),
      ];

      // All clients create content
      clients[0].text.insert(0, 'A');
      clients[1].text.insert(0, 'B');
      clients[2].text.insert(0, 'C');

      syncClients(clients);
      const stateBeforeLeave = clients[0].text.toString();

      // Simulate client 2 leaving (we just stop syncing with it)
      const remainingClients = [clients[0], clients[2]];

      // Remaining clients continue editing
      clients[0].text.insert(clients[0].text.length, 'X');
      clients[2].text.insert(clients[2].text.length, 'Y');

      // Sync only remaining clients
      syncClients(remainingClients);

      // Remaining clients should converge
      expect(clients[0].text.toString()).toBe(clients[2].text.toString());
      expect(clients[0].text.toString()).toContain(stateBeforeLeave);
    });
  });

  describe('Stress Testing', () => {
    test('ten clients with 100 operations each converge', () => {
      const clients = Array.from({ length: 10 }, (_, i) =>
        createClient(String(i + 1))
      );

      // Initialize with content
      clients[0].text.insert(0, 'Start');
      syncClients(clients);

      // Each client makes 100 random operations
      for (let op = 0; op < 100; op++) {
        clients.forEach((client) => {
          const len = client.text.length;
          const operation = Math.random();

          if (operation < 0.7 && len > 0) {
            // 70% insert
            const pos = Math.floor(Math.random() * (len + 1));
            client.text.insert(pos, String.fromCharCode(65 + (op % 26)));
          } else if (len > 1) {
            // 30% delete
            const pos = Math.floor(Math.random() * len);
            client.text.delete(pos, 1);
          }
        });

        // Sync every 10 operations
        if (op % 10 === 0) {
          syncClients(clients);
        }
      }

      // Final sync
      syncClients(clients);

      // All clients should converge
      const finalStates = clients.map((c) => c.text.toString());
      for (let i = 1; i < finalStates.length; i++) {
        expect(finalStates[i]).toBe(finalStates[0]);
      }
    });
  });
});

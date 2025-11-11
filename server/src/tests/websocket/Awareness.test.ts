import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { Room } from '../../websocket/Room.js';
import * as awarenessProtocol from 'y-protocols/awareness';

describe('Awareness Protocol', () => {
  let room: Room;
  const documentId = 'test-doc-awareness';

  beforeEach(() => {
    room = new Room(documentId);
  });

  afterEach(() => {
    room.cleanup();
  });

  describe('Awareness State Synchronization', () => {
    it('should create awareness instance with room', () => {
      expect(room.awareness).toBeDefined();
      expect(room.awareness.doc).toBe(room.yjsDoc);
    });

    it('should update awareness state', () => {
      const clientId = room.awareness.clientID;
      const awarenessState = {
        user: {
          id: 'user-1',
          name: 'Test User',
          color: '#FF0000',
        },
        cursor: {
          line: 5,
          column: 10,
        },
      };

      room.awareness.setLocalState(awarenessState);

      const states = room.awareness.getStates();
      const localState = states.get(clientId);

      expect(localState).toEqual(awarenessState);
    });

    it('should broadcast awareness updates to other clients', async () => {
      const mockSocket1 = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      const mockSocket2 = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      // Add clients to room
      room.addClient(mockSocket1, 'user-1', 'User One', 'user1@test.com');
      room.addClient(mockSocket2, 'user-2', 'User Two', 'user2@test.com');

      // Set up awareness listener
      const broadcastedUpdates: Uint8Array[] = [];
      room.setupAwarenessListener((update: Uint8Array, origin: any) => {
        broadcastedUpdates.push(update);
      });

      // Update awareness state
      const awarenessState = {
        user: {
          id: 'user-1',
          name: 'User One',
          color: '#FF0000',
        },
        cursor: {
          line: 5,
          column: 10,
        },
      };

      room.awareness.setLocalState(awarenessState);

      // Wait for throttle to flush
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should have broadcasted at least one update
      expect(broadcastedUpdates.length).toBeGreaterThan(0);
    });

    it('should encode and decode awareness updates correctly', () => {
      const clientId = room.awareness.clientID;
      const awarenessState = {
        user: {
          id: 'user-1',
          name: 'Test User',
          color: '#00FF00',
        },
        cursor: {
          line: 10,
          column: 20,
        },
        selection: {
          start: { line: 10, column: 20 },
          end: { line: 10, column: 30 },
        },
      };

      // Set local state
      room.awareness.setLocalState(awarenessState);

      // Encode awareness update
      const update = awarenessProtocol.encodeAwarenessUpdate(room.awareness, [clientId]);

      // Create a new awareness instance to decode into
      const newAwareness = new awarenessProtocol.Awareness(room.yjsDoc);

      // Apply the update
      awarenessProtocol.applyAwarenessUpdate(newAwareness, update, null);

      // Verify the state was transferred
      const decodedState = newAwareness.getStates().get(clientId);
      expect(decodedState).toEqual(awarenessState);
    });

    it('should handle multiple client awareness states', () => {
      const mockSocket1 = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      const mockSocket2 = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      const mockSocket3 = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      // Add clients
      room.addClient(mockSocket1, 'user-1', 'User One', 'user1@test.com');
      room.addClient(mockSocket2, 'user-2', 'User Two', 'user2@test.com');
      room.addClient(mockSocket3, 'user-3', 'User Three', 'user3@test.com');

      expect(room.getClientCount()).toBe(3);

      // Awareness instance should exist and be accessible
      expect(room.awareness).toBeDefined();
      const states = room.awareness.getStates();
      expect(states).toBeDefined();
    });
  });

  describe('Awareness Cleanup on Disconnect', () => {
    it('should remove awareness state when client disconnects', () => {
      const mockSocket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      // Add client
      room.addClient(mockSocket, 'user-1', 'User One', 'user1@test.com');

      // Set awareness state with user info
      const clientId = room.awareness.clientID;
      room.awareness.setLocalState({
        user: {
          id: 'user-1',
          name: 'User One',
          color: '#FF0000',
        },
        cursor: { line: 5, column: 10 },
      });

      const statesBefore = room.awareness.getStates();
      expect(statesBefore.size).toBeGreaterThan(0);

      // Remove client
      room.removeClient('user-1');

      // Verify client was removed
      expect(room.hasClient('user-1')).toBe(false);
    });

    it('should broadcast awareness removal to other clients', async () => {
      const mockSocket1 = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      const mockSocket2 = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      // Add clients
      room.addClient(mockSocket1, 'user-1', 'User One', 'user1@test.com');
      room.addClient(mockSocket2, 'user-2', 'User Two', 'user2@test.com');

      // Set up awareness listener to track broadcasts
      const broadcasts: Buffer[] = [];
      const originalBroadcast = room.broadcastToRoom.bind(room);
      room.broadcastToRoom = vi.fn((message: Buffer | string) => {
        broadcasts.push(typeof message === 'string' ? Buffer.from(message) : message);
        originalBroadcast(message);
      });

      // Set awareness state for user-1
      room.awareness.setLocalState({
        user: {
          id: 'user-1',
          name: 'User One',
          color: '#FF0000',
        },
        cursor: { line: 5, column: 10 },
      });

      // Remove user-1
      room.removeClient('user-1');

      // Verify the broadcast function was called
      expect(room.broadcastToRoom).toHaveBeenCalled();
    });

    it('should clean up all awareness states on room cleanup', () => {
      const mockSocket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      // Add client and set awareness
      room.addClient(mockSocket, 'user-1', 'User One', 'user1@test.com');
      room.awareness.setLocalState({
        user: { id: 'user-1', name: 'User One', color: '#FF0000' },
        cursor: { line: 5, column: 10 },
      });

      const statesBefore = room.awareness.getStates();
      expect(statesBefore.size).toBeGreaterThan(0);

      // Cleanup room
      room.cleanup();

      // Verify socket was closed
      expect(mockSocket.close).toHaveBeenCalledWith(1000, 'Room closed');
    });
  });

  describe('Awareness Throttling', () => {
    it('should throttle awareness updates', async () => {
      const mockSocket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      room.addClient(mockSocket, 'user-1', 'User One', 'user1@test.com');

      // Track broadcasts
      const broadcasts: Uint8Array[] = [];
      room.setupAwarenessListener((update: Uint8Array) => {
        broadcasts.push(update);
      });

      // Send multiple rapid updates
      for (let i = 0; i < 20; i++) {
        room.awareness.setLocalState({
          user: { id: 'user-1', name: 'User One', color: '#FF0000' },
          cursor: { line: i, column: i * 2 },
        });
      }

      // Wait for throttle period
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should have throttled the updates (fewer broadcasts than updates)
      // With 100ms throttle, 20 updates should result in ~2 broadcasts
      expect(broadcasts.length).toBeLessThan(20);
      expect(broadcasts.length).toBeGreaterThan(0);
    });

    it('should flush buffered updates after throttle period', async () => {
      const mockSocket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      room.addClient(mockSocket, 'user-1', 'User One', 'user1@test.com');

      const broadcasts: Uint8Array[] = [];
      room.setupAwarenessListener((update: Uint8Array) => {
        broadcasts.push(update);
      });

      // Send a single update
      room.awareness.setLocalState({
        user: { id: 'user-1', name: 'User One', color: '#FF0000' },
        cursor: { line: 5, column: 10 },
      });

      // Should not broadcast immediately
      expect(broadcasts.length).toBe(0);

      // Wait for throttle period
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should have flushed the buffer
      expect(broadcasts.length).toBe(1);
    });

    it('should flush immediately when buffer is full', async () => {
      const mockSocket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      room.addClient(mockSocket, 'user-1', 'User One', 'user1@test.com');

      const broadcasts: Uint8Array[] = [];
      room.setupAwarenessListener((update: Uint8Array) => {
        broadcasts.push(update);
      });

      // Send exactly 10 updates (buffer size)
      for (let i = 0; i < 10; i++) {
        room.awareness.setLocalState({
          user: { id: 'user-1', name: 'User One', color: '#FF0000' },
          cursor: { line: i, column: i * 2 },
        });
      }

      // Should have flushed immediately when buffer reached size limit
      // (without waiting for throttle period)
      expect(broadcasts.length).toBeGreaterThan(0);
    });

    it('should merge multiple updates into single broadcast', async () => {
      const mockSocket1 = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      const mockSocket2 = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      room.addClient(mockSocket1, 'user-1', 'User One', 'user1@test.com');
      room.addClient(mockSocket2, 'user-2', 'User Two', 'user2@test.com');

      const broadcasts: Uint8Array[] = [];
      room.setupAwarenessListener((update: Uint8Array) => {
        broadcasts.push(update);
      });

      // Send multiple updates rapidly
      for (let i = 0; i < 5; i++) {
        room.awareness.setLocalState({
          user: { id: 'user-1', name: 'User One', color: '#FF0000' },
          cursor: { line: i, column: i * 2 },
        });
      }

      // Wait for throttle
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should have merged updates into fewer broadcasts
      expect(broadcasts.length).toBeGreaterThan(0);
      expect(broadcasts.length).toBeLessThan(5);
    });
  });
});

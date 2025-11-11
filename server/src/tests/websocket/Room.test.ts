import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Room } from '../../websocket/Room.js';
import { WebSocket } from 'ws';

describe('Room', () => {
  let room: Room;
  const documentId = 'test-doc-123';

  beforeEach(() => {
    room = new Room(documentId);
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(room.documentId).toBe(documentId);
      expect(room.clients.size).toBe(0);
      expect(room.yjsDoc).toBeDefined();
      expect(room.lastActivity).toBeInstanceOf(Date);
    });
  });

  describe('addClient', () => {
    it('should add a client to the room', () => {
      const mockSocket = {} as WebSocket;
      const userId = 'user-1';
      const userName = 'Test User';
      const userEmail = 'test@example.com';

      room.addClient(mockSocket, userId, userName, userEmail);

      expect(room.clients.size).toBe(1);
      expect(room.hasClient(userId)).toBe(true);

      const client = room.getClient(userId);
      expect(client).toBeDefined();
      expect(client?.userId).toBe(userId);
      expect(client?.userName).toBe(userName);
      expect(client?.userEmail).toBe(userEmail);
      expect(client?.socket).toBe(mockSocket);
      expect(client?.joinedAt).toBeInstanceOf(Date);
    });

    it('should update lastActivity when adding a client', () => {
      const mockSocket = {} as WebSocket;
      const beforeAdd = new Date();

      room.addClient(mockSocket, 'user-1', 'Test User', 'test@example.com');

      expect(room.lastActivity.getTime()).toBeGreaterThanOrEqual(beforeAdd.getTime());
    });

    it('should replace existing client with same userId', () => {
      const mockSocket1 = { id: 1 } as unknown as WebSocket;
      const mockSocket2 = { id: 2 } as unknown as WebSocket;
      const userId = 'user-1';

      room.addClient(mockSocket1, userId, 'User 1', 'user1@example.com');
      room.addClient(mockSocket2, userId, 'User 1 Updated', 'user1@example.com');

      expect(room.clients.size).toBe(1);
      const client = room.getClient(userId);
      expect(client?.socket).toBe(mockSocket2);
      expect(client?.userName).toBe('User 1 Updated');
    });
  });

  describe('removeClient', () => {
    it('should remove a client from the room', () => {
      const mockSocket = {} as WebSocket;
      const userId = 'user-1';

      room.addClient(mockSocket, userId, 'Test User', 'test@example.com');
      expect(room.clients.size).toBe(1);

      const removed = room.removeClient(userId);

      expect(removed).toBe(true);
      expect(room.clients.size).toBe(0);
      expect(room.hasClient(userId)).toBe(false);
    });

    it('should return false when removing non-existent client', () => {
      const removed = room.removeClient('non-existent-user');
      expect(removed).toBe(false);
    });

    it('should update lastActivity when removing a client', () => {
      const mockSocket = {} as WebSocket;
      room.addClient(mockSocket, 'user-1', 'Test User', 'test@example.com');

      const beforeRemove = new Date();
      room.removeClient('user-1');

      expect(room.lastActivity.getTime()).toBeGreaterThanOrEqual(beforeRemove.getTime());
    });
  });

  describe('client queries', () => {
    beforeEach(() => {
      room.addClient({} as WebSocket, 'user-1', 'User 1', 'user1@example.com');
      room.addClient({} as WebSocket, 'user-2', 'User 2', 'user2@example.com');
      room.addClient({} as WebSocket, 'user-3', 'User 3', 'user3@example.com');
    });

    it('should return correct client count', () => {
      expect(room.getClientCount()).toBe(3);
    });

    it('should check if room has clients', () => {
      expect(room.hasClients()).toBe(true);

      room.removeClient('user-1');
      room.removeClient('user-2');
      room.removeClient('user-3');

      expect(room.hasClients()).toBe(false);
    });

    it('should get all clients', () => {
      const clients = room.getAllClients();

      expect(clients).toHaveLength(3);
      expect(clients[0].userId).toBe('user-1');
      expect(clients[1].userId).toBe('user-2');
      expect(clients[2].userId).toBe('user-3');
    });

    it('should check if specific user is in room', () => {
      expect(room.hasClient('user-1')).toBe(true);
      expect(room.hasClient('user-2')).toBe(true);
      expect(room.hasClient('non-existent')).toBe(false);
    });
  });

  describe('activity tracking', () => {
    it('should update activity timestamp', () => {
      const before = room.lastActivity.getTime();

      // Wait a bit to ensure time difference
      setTimeout(() => {
        room.updateActivity();
        expect(room.lastActivity.getTime()).toBeGreaterThan(before);
      }, 10);
    });

    it('should calculate time since last activity', () => {
      const timeSince = room.getTimeSinceLastActivity();
      expect(timeSince).toBeGreaterThanOrEqual(0);
      expect(timeSince).toBeLessThan(1000); // Should be less than 1 second
    });
  });

  describe('broadcastToRoom', () => {
    it('should broadcast message to all clients', () => {
      const mockSocket1 = {
        readyState: WebSocket.OPEN,
        bufferedAmount: 0,
        send: vi.fn(),
      } as unknown as WebSocket;

      const mockSocket2 = {
        readyState: WebSocket.OPEN,
        bufferedAmount: 0,
        send: vi.fn(),
      } as unknown as WebSocket;

      room.addClient(mockSocket1, 'user-1', 'User 1', 'user1@example.com');
      room.addClient(mockSocket2, 'user-2', 'User 2', 'user2@example.com');

      const message = 'test message';
      room.broadcastToRoom(message);

      expect(mockSocket1.send).toHaveBeenCalledWith(
        Buffer.from(message),
        expect.any(Function)
      );
      expect(mockSocket2.send).toHaveBeenCalledWith(
        Buffer.from(message),
        expect.any(Function)
      );
    });

    it('should exclude specified socket from broadcast', () => {
      const mockSocket1 = {
        readyState: WebSocket.OPEN,
        bufferedAmount: 0,
        send: vi.fn(),
      } as unknown as WebSocket;

      const mockSocket2 = {
        readyState: WebSocket.OPEN,
        bufferedAmount: 0,
        send: vi.fn(),
      } as unknown as WebSocket;

      room.addClient(mockSocket1, 'user-1', 'User 1', 'user1@example.com');
      room.addClient(mockSocket2, 'user-2', 'User 2', 'user2@example.com');

      const message = 'test message';
      room.broadcastToRoom(message, mockSocket1);

      expect(mockSocket1.send).not.toHaveBeenCalled();
      expect(mockSocket2.send).toHaveBeenCalled();
    });

    it('should skip clients with closed connections', () => {
      const mockSocket1 = {
        readyState: WebSocket.CLOSED,
        bufferedAmount: 0,
        send: vi.fn(),
      } as unknown as WebSocket;

      const mockSocket2 = {
        readyState: WebSocket.OPEN,
        bufferedAmount: 0,
        send: vi.fn(),
      } as unknown as WebSocket;

      room.addClient(mockSocket1, 'user-1', 'User 1', 'user1@example.com');
      room.addClient(mockSocket2, 'user-2', 'User 2', 'user2@example.com');

      const message = 'test message';
      room.broadcastToRoom(message);

      expect(mockSocket1.send).not.toHaveBeenCalled();
      expect(mockSocket2.send).toHaveBeenCalled();
    });

    it('should handle backpressure by skipping clients with high buffer', () => {
      const mockSocket1 = {
        readyState: WebSocket.OPEN,
        bufferedAmount: 2 * 1024 * 1024, // 2MB - exceeds limit
        send: vi.fn(),
      } as unknown as WebSocket;

      const mockSocket2 = {
        readyState: WebSocket.OPEN,
        bufferedAmount: 0,
        send: vi.fn(),
      } as unknown as WebSocket;

      room.addClient(mockSocket1, 'user-1', 'User 1', 'user1@example.com');
      room.addClient(mockSocket2, 'user-2', 'User 2', 'user2@example.com');

      const message = 'test message';
      room.broadcastToRoom(message);

      expect(mockSocket1.send).not.toHaveBeenCalled();
      expect(mockSocket2.send).toHaveBeenCalled();
    });

    it('should accept Buffer as message', () => {
      const mockSocket = {
        readyState: WebSocket.OPEN,
        bufferedAmount: 0,
        send: vi.fn(),
      } as unknown as WebSocket;

      room.addClient(mockSocket, 'user-1', 'User 1', 'user1@example.com');

      const message = Buffer.from('test message');
      room.broadcastToRoom(message);

      expect(mockSocket.send).toHaveBeenCalledWith(message, expect.any(Function));
    });

    it('should update activity on successful broadcast', () => {
      const mockSocket = {
        readyState: WebSocket.OPEN,
        bufferedAmount: 0,
        send: vi.fn(),
      } as unknown as WebSocket;

      room.addClient(mockSocket, 'user-1', 'User 1', 'user1@example.com');

      const before = room.lastActivity.getTime();
      room.broadcastToRoom('test message');

      expect(room.lastActivity.getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  describe('cleanup', () => {
    it('should close all client connections', () => {
      const mockSocket1 = {
        readyState: WebSocket.OPEN,
        close: vi.fn(),
      } as unknown as WebSocket;

      const mockSocket2 = {
        readyState: WebSocket.OPEN,
        close: vi.fn(),
      } as unknown as WebSocket;

      room.addClient(mockSocket1, 'user-1', 'User 1', 'user1@example.com');
      room.addClient(mockSocket2, 'user-2', 'User 2', 'user2@example.com');

      room.cleanup();

      expect(mockSocket1.close).toHaveBeenCalledWith(1000, 'Room closed');
      expect(mockSocket2.close).toHaveBeenCalledWith(1000, 'Room closed');
    });

    it('should clear all clients', () => {
      const mockSocket = {
        readyState: WebSocket.OPEN,
        close: vi.fn(),
      } as unknown as WebSocket;

      room.addClient(mockSocket, 'user-1', 'User 1', 'user1@example.com');
      expect(room.clients.size).toBe(1);

      room.cleanup();

      expect(room.clients.size).toBe(0);
    });

    it('should destroy Yjs document', () => {
      const destroySpy = vi.spyOn(room.yjsDoc, 'destroy');

      room.cleanup();

      expect(destroySpy).toHaveBeenCalled();
    });
  });
});

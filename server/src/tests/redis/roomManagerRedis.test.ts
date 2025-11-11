import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomManager } from '../../websocket/RoomManager.js';
import { redisService } from '../../config/redis.js';
import { WebSocket } from 'ws';

// Mock Redis service
vi.mock('../../config/redis.js', () => {
  const mockPublish = vi.fn().mockResolvedValue(undefined);
  const mockSubscribe = vi.fn().mockResolvedValue(undefined);
  const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
  const mockIsAvailable = vi.fn().mockReturnValue(false); // Default to unavailable

  return {
    redisService: {
      isAvailable: mockIsAvailable,
      publish: mockPublish,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      disconnect: vi.fn().mockResolvedValue(undefined),
    },
    RedisService: {
      getChannelName: (documentId: string) => `room:${documentId}`,
    },
  };
});

// Mock persistence service
vi.mock('../../services/persistenceService.js', () => ({
  persistenceService: {
    loadSnapshot: vi.fn().mockResolvedValue(null),
    saveSnapshot: vi.fn().mockResolvedValue(undefined),
    appendOperation: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('RoomManager with Redis Integration', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = RoomManager.getInstance();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await roomManager.shutdown();
  });

  describe('Fallback to Single-Server Mode', () => {
    it('should work without Redis when unavailable', async () => {
      // Redis is unavailable (mocked to return false)
      expect(redisService.isAvailable()).toBe(false);

      const documentId = 'test-doc-1';
      const room = await roomManager.getRoom(documentId);

      expect(room).toBeDefined();
      expect(room.documentId).toBe(documentId);

      // Should not attempt to publish to Redis
      expect(redisService.publish).not.toHaveBeenCalled();
    });

    it('should handle room operations without Redis', async () => {
      const documentId = 'test-doc-2';
      const room = await roomManager.getRoom(documentId);

      // Mock WebSocket
      const mockSocket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        bufferedAmount: 0,
      } as unknown as WebSocket;

      // Add client to room
      await roomManager.addClientToRoom(
        documentId,
        mockSocket,
        'user1',
        'Test User',
        'test@example.com'
      );

      const clients = roomManager.getActiveClients(documentId);
      expect(clients).toHaveLength(1);
      expect(clients[0].userId).toBe('user1');
    });
  });

  describe('Redis Integration (when available)', () => {
    beforeEach(() => {
      // Mock Redis as available
      vi.mocked(redisService.isAvailable).mockReturnValue(true);
    });

    it('should subscribe to Redis channel when creating room', async () => {
      const documentId = 'test-doc-3';
      await roomManager.getRoom(documentId);

      // Should subscribe to the channel
      expect(redisService.subscribe).toHaveBeenCalledWith(
        'room:test-doc-3',
        expect.any(Function)
      );
    });

    it('should not subscribe twice to the same channel', async () => {
      const documentId = 'test-doc-4';

      // Get room twice
      await roomManager.getRoom(documentId);
      await roomManager.getRoom(documentId);

      // Should only subscribe once
      expect(redisService.subscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('Channel Naming Convention', () => {
    it('should use correct channel naming format', async () => {
      vi.mocked(redisService.isAvailable).mockReturnValue(true);

      const documentId = 'my-document-123';
      await roomManager.getRoom(documentId);

      expect(redisService.subscribe).toHaveBeenCalledWith(
        'room:my-document-123',
        expect.any(Function)
      );
    });
  });

  describe('Room Cleanup', () => {
    it('should unsubscribe from Redis when cleaning up room', async () => {
      vi.mocked(redisService.isAvailable).mockReturnValue(true);

      const documentId = 'test-doc-5';
      await roomManager.getRoom(documentId);

      // Shutdown should unsubscribe
      await roomManager.shutdown();

      expect(redisService.unsubscribe).toHaveBeenCalledWith('room:test-doc-5');
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis publish errors gracefully', async () => {
      vi.mocked(redisService.isAvailable).mockReturnValue(true);
      vi.mocked(redisService.publish).mockRejectedValue(new Error('Redis error'));

      const documentId = 'test-doc-6';
      const room = await roomManager.getRoom(documentId);

      // Should not throw error even if Redis publish fails
      expect(room).toBeDefined();
    });

    it('should handle Redis subscribe errors gracefully', async () => {
      vi.mocked(redisService.isAvailable).mockReturnValue(true);
      vi.mocked(redisService.subscribe).mockRejectedValue(new Error('Subscribe error'));

      const documentId = 'test-doc-7';

      // Should not throw error
      await expect(roomManager.getRoom(documentId)).resolves.toBeDefined();
    });
  });
});

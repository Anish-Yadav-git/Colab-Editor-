import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisService } from '../../config/redis.js';

describe('RedisService', () => {
  let redisService: RedisService;

  beforeEach(() => {
    // Reset the singleton instance before each test
    RedisService.resetInstance();
    redisService = RedisService.getInstance();
  });

  afterEach(async () => {
    // Cleanup after each test
    if (redisService) {
      await redisService.disconnect();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = RedisService.getInstance();
      const instance2 = RedisService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Connection', () => {
    it('should initialize with isAvailable false', () => {
      expect(redisService.isAvailable()).toBe(false);
    });

    it('should handle connection failure gracefully', async () => {
      // Set invalid Redis configuration
      process.env.REDIS_HOST = 'invalid-host';
      process.env.REDIS_PORT = '9999';

      await expect(redisService.connect()).rejects.toThrow();
      expect(redisService.isAvailable()).toBe(false);
    });
  });

  describe('Channel Naming', () => {
    it('should generate correct channel name for document', () => {
      const documentId = 'doc123';
      const channelName = RedisService.getChannelName(documentId);

      expect(channelName).toBe('room:doc123');
    });

    it('should handle special characters in document ID', () => {
      const documentId = 'doc-123_test';
      const channelName = RedisService.getChannelName(documentId);

      expect(channelName).toBe('room:doc-123_test');
    });
  });

  describe('Publish/Subscribe (when Redis unavailable)', () => {
    it('should handle publish when Redis is not available', async () => {
      // Redis is not connected
      expect(redisService.isAvailable()).toBe(false);

      // Should not throw error
      await expect(redisService.publish('test-channel', 'test-message')).resolves.toBeUndefined();
    });

    it('should handle subscribe when Redis is not available', async () => {
      // Redis is not connected
      expect(redisService.isAvailable()).toBe(false);

      const callback = vi.fn();

      // Should not throw error
      await expect(
        redisService.subscribe('test-channel', callback)
      ).resolves.toBeUndefined();
    });
  });

  describe('Disconnect', () => {
    it('should handle disconnect when not connected', async () => {
      // Should not throw error
      await expect(redisService.disconnect()).resolves.toBeUndefined();
    });
  });
});

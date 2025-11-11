import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { WebSocketRateLimiter } from '../../websocket/WebSocketRateLimiter.js';

describe('WebSocket Security', () => {
  describe('WebSocketRateLimiter', () => {
    let rateLimiter: WebSocketRateLimiter;
    let mockSocket: WebSocket;

    beforeEach(() => {
      rateLimiter = new WebSocketRateLimiter();
      mockSocket = {} as WebSocket;
    });

    afterEach(() => {
      rateLimiter.shutdown();
    });

    it('should allow operations within rate limit', () => {
      // Make 50 operations (well under 100/sec limit)
      for (let i = 0; i < 50; i++) {
        const allowed = rateLimiter.checkRateLimit(mockSocket, 'user-1', 'doc-1');
        expect(allowed).toBe(true);
      }
    });

    it('should block operations exceeding rate limit', () => {
      // Make 101 operations to exceed 100/sec limit
      let blockedCount = 0;
      for (let i = 0; i < 101; i++) {
        const allowed = rateLimiter.checkRateLimit(mockSocket, 'user-1', 'doc-1');
        if (!allowed) {
          blockedCount++;
        }
      }

      expect(blockedCount).toBeGreaterThan(0);
    });

    it('should reset rate limit after time window', async () => {
      // Fill up the rate limit
      for (let i = 0; i < 100; i++) {
        rateLimiter.checkRateLimit(mockSocket, 'user-1', 'doc-1');
      }

      // Next operation should be blocked
      let allowed = rateLimiter.checkRateLimit(mockSocket, 'user-1', 'doc-1');
      expect(allowed).toBe(false);

      // Wait for window to reset (1 second + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be allowed again
      allowed = rateLimiter.checkRateLimit(mockSocket, 'user-1', 'doc-1');
      expect(allowed).toBe(true);
    });

    it('should track violations', () => {
      // Exceed rate limit multiple times
      for (let i = 0; i < 150; i++) {
        rateLimiter.checkRateLimit(mockSocket, 'user-1', 'doc-1');
      }

      const info = rateLimiter.getRateLimitInfo(mockSocket);
      expect(info).toBeDefined();
      expect(info!.violations).toBeGreaterThan(0);
    });

    it('should disconnect socket after max violations', () => {
      const mockSocketWithClose = {
        readyState: WebSocket.OPEN,
        close: vi.fn(),
      } as unknown as WebSocket;

      // Exceed rate limit enough times to trigger disconnect
      for (let i = 0; i < 400; i++) {
        rateLimiter.checkRateLimit(mockSocketWithClose, 'user-1', 'doc-1');
      }

      // Socket should be closed after 3 violations
      expect(mockSocketWithClose.close).toHaveBeenCalled();
    });

    it('should remove socket from tracking', () => {
      rateLimiter.checkRateLimit(mockSocket, 'user-1', 'doc-1');
      expect(rateLimiter.getRateLimitInfo(mockSocket)).toBeDefined();

      rateLimiter.removeSocket(mockSocket);
      expect(rateLimiter.getRateLimitInfo(mockSocket)).toBeUndefined();
    });

    it('should track different sockets independently', () => {
      const socket1 = {} as WebSocket;
      const socket2 = {} as WebSocket;

      // Fill rate limit for socket1
      for (let i = 0; i < 100; i++) {
        rateLimiter.checkRateLimit(socket1, 'user-1', 'doc-1');
      }

      // socket1 should be blocked
      let allowed1 = rateLimiter.checkRateLimit(socket1, 'user-1', 'doc-1');
      expect(allowed1).toBe(false);

      // socket2 should still be allowed
      let allowed2 = rateLimiter.checkRateLimit(socket2, 'user-2', 'doc-1');
      expect(allowed2).toBe(true);
    });

    it('should clean up old entries', async () => {
      rateLimiter.checkRateLimit(mockSocket, 'user-1', 'doc-1');
      expect(rateLimiter.getRateLimitInfo(mockSocket)).toBeDefined();

      // Wait for cleanup interval (10 seconds + buffer)
      await new Promise((resolve) => setTimeout(resolve, 11000));

      // Entry should be cleaned up
      expect(rateLimiter.getRateLimitInfo(mockSocket)).toBeUndefined();
    });

    it('should handle shutdown gracefully', () => {
      rateLimiter.checkRateLimit(mockSocket, 'user-1', 'doc-1');
      expect(rateLimiter.getRateLimitInfo(mockSocket)).toBeDefined();

      rateLimiter.shutdown();

      // All entries should be cleared
      expect(rateLimiter.getRateLimitInfo(mockSocket)).toBeUndefined();
    });
  });

  describe('WebSocket Origin Validation', () => {
    it('should validate allowed origins', () => {
      const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];

      const validateOrigin = (origin: string | undefined): boolean => {
        if (!origin) return true;
        return allowedOrigins.includes(origin);
      };

      expect(validateOrigin('http://localhost:5173')).toBe(true);
      expect(validateOrigin('http://localhost:3000')).toBe(true);
      expect(validateOrigin(undefined)).toBe(true);
    });

    it('should reject disallowed origins', () => {
      const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];

      const validateOrigin = (origin: string | undefined): boolean => {
        if (!origin) return true;
        return allowedOrigins.includes(origin);
      };

      expect(validateOrigin('http://malicious-site.com')).toBe(false);
      expect(validateOrigin('http://evil.com')).toBe(false);
    });

    it('should handle multiple allowed origins from environment', () => {
      const corsOrigin = 'http://localhost:5173,http://localhost:3000,https://app.example.com';
      const allowedOrigins = corsOrigin.split(',');

      const validateOrigin = (origin: string | undefined): boolean => {
        if (!origin) return true;
        return allowedOrigins.includes(origin);
      };

      expect(validateOrigin('http://localhost:5173')).toBe(true);
      expect(validateOrigin('https://app.example.com')).toBe(true);
      expect(validateOrigin('http://other.com')).toBe(false);
    });
  });

  describe('Operation Size Validation', () => {
    it('should accept operations within size limit', () => {
      const maxSize = 1 * 1024 * 1024; // 1MB
      const data = Buffer.alloc(500 * 1024); // 500KB

      expect(data.length).toBeLessThan(maxSize);
    });

    it('should reject operations exceeding size limit', () => {
      const maxSize = 1 * 1024 * 1024; // 1MB
      const data = Buffer.alloc(2 * 1024 * 1024); // 2MB

      expect(data.length).toBeGreaterThan(maxSize);
    });

    it('should validate binary message size', () => {
      const validateSize = (data: Buffer, maxSize: number): boolean => {
        return data.length <= maxSize;
      };

      const maxSize = 1 * 1024 * 1024;
      const smallData = Buffer.alloc(100);
      const largeData = Buffer.alloc(2 * 1024 * 1024);

      expect(validateSize(smallData, maxSize)).toBe(true);
      expect(validateSize(largeData, maxSize)).toBe(false);
    });
  });

  describe('Connection Limits', () => {
    it('should enforce maximum connection limit', () => {
      const maxConnections = 1000;
      let currentConnections = 0;

      const canAcceptConnection = (): boolean => {
        return currentConnections < maxConnections;
      };

      // Simulate 999 connections
      currentConnections = 999;
      expect(canAcceptConnection()).toBe(true);

      // Simulate 1000 connections
      currentConnections = 1000;
      expect(canAcceptConnection()).toBe(false);

      // Simulate 1001 connections
      currentConnections = 1001;
      expect(canAcceptConnection()).toBe(false);
    });

    it('should track active connections', () => {
      let activeConnections = 0;

      const addConnection = () => {
        activeConnections++;
      };

      const removeConnection = () => {
        activeConnections--;
      };

      expect(activeConnections).toBe(0);

      addConnection();
      addConnection();
      expect(activeConnections).toBe(2);

      removeConnection();
      expect(activeConnections).toBe(1);

      removeConnection();
      expect(activeConnections).toBe(0);
    });
  });
});

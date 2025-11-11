import { WebSocket } from 'ws';
import logger from '../config/logger.js';

interface RateLimitInfo {
  operationCount: number;
  windowStart: number;
  violations: number;
}

/**
 * WebSocket rate limiter to prevent abuse
 * Tracks operations per second per connection
 */
export class WebSocketRateLimiter {
  private rateLimits: Map<WebSocket, RateLimitInfo> = new Map();
  private readonly MAX_OPS_PER_SECOND = 100;
  private readonly WINDOW_MS = 1000; // 1 second
  private readonly MAX_VIOLATIONS = 3; // Disconnect after 3 violations
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up old entries every 10 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10000);
  }

  /**
   * Check if operation is allowed for this socket
   * Returns true if allowed, false if rate limit exceeded
   */
  checkRateLimit(socket: WebSocket, userId?: string, documentId?: string): boolean {
    const now = Date.now();
    let info = this.rateLimits.get(socket);

    // Initialize if first operation
    if (!info) {
      info = {
        operationCount: 1,
        windowStart: now,
        violations: 0,
      };
      this.rateLimits.set(socket, info);
      return true;
    }

    // Check if we're in a new window
    const windowElapsed = now - info.windowStart;
    if (windowElapsed >= this.WINDOW_MS) {
      // Reset for new window
      info.operationCount = 1;
      info.windowStart = now;
      return true;
    }

    // Increment operation count
    info.operationCount++;

    // Check if rate limit exceeded
    if (info.operationCount > this.MAX_OPS_PER_SECOND) {
      info.violations++;

      logger.warn('WebSocket rate limit exceeded', {
        userId,
        documentId,
        operationCount: info.operationCount,
        violations: info.violations,
        windowMs: windowElapsed,
      });

      // Disconnect if too many violations
      if (info.violations >= this.MAX_VIOLATIONS) {
        logger.error('WebSocket rate limit violations exceeded, disconnecting', {
          userId,
          documentId,
          violations: info.violations,
        });

        // Close the connection
        if (socket.readyState === WebSocket.OPEN) {
          socket.close(1008, 'Rate limit exceeded');
        }
      }

      return false;
    }

    return true;
  }

  /**
   * Remove rate limit tracking for a socket
   */
  removeSocket(socket: WebSocket): void {
    this.rateLimits.delete(socket);
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: WebSocket[] = [];

    this.rateLimits.forEach((info, socket) => {
      // Remove entries older than 10 seconds
      if (now - info.windowStart > 10000) {
        toDelete.push(socket);
      }
    });

    toDelete.forEach((socket) => {
      this.rateLimits.delete(socket);
    });

    if (toDelete.length > 0) {
      logger.debug('Cleaned up rate limit entries', {
        count: toDelete.length,
      });
    }
  }

  /**
   * Get current rate limit info for a socket (for testing/debugging)
   */
  getRateLimitInfo(socket: WebSocket): RateLimitInfo | undefined {
    return this.rateLimits.get(socket);
  }

  /**
   * Shutdown the rate limiter
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.rateLimits.clear();
  }
}

// Export singleton instance
export const wsRateLimiter = new WebSocketRateLimiter();

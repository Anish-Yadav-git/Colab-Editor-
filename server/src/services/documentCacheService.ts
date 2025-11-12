import { redisService } from '../config/redis.js';
import logger from '../config/logger.js';

/**
 * DocumentCacheService provides Redis caching for document snapshots
 * to reduce MongoDB load and improve performance
 */
export class DocumentCacheService {
  private readonly CACHE_TTL = 300; // 5 minutes in seconds
  private readonly CACHE_KEY_PREFIX = 'doc:snapshot:';

  /**
   * Get cache key for a document snapshot
   */
  private getCacheKey(documentId: string): string {
    return `${this.CACHE_KEY_PREFIX}${documentId}`;
  }

  /**
   * Get document snapshot from cache
   * @param documentId - The document ID
   * @returns The cached snapshot as Uint8Array or null if not found
   */
  async getSnapshot(documentId: string): Promise<Uint8Array | null> {
    if (!redisService.isAvailable()) {
      logger.debug('Redis not available, skipping cache lookup', {
        documentId,
        operationType: 'cache_get',
      });
      return null;
    }

    try {
      const publisher = redisService.getPublisher();
      if (!publisher) {
        return null;
      }

      const cacheKey = this.getCacheKey(documentId);
      const cached = await publisher.get(cacheKey);

      if (cached) {
        logger.debug('Cache hit for document snapshot', {
          documentId,
          cacheKey,
          operationType: 'cache_hit',
        });

        // Decode from base64
        const buffer = Buffer.from(cached, 'base64');
        return new Uint8Array(buffer);
      }

      logger.debug('Cache miss for document snapshot', {
        documentId,
        cacheKey,
        operationType: 'cache_miss',
      });

      return null;
    } catch (error) {
      logger.error('Error getting snapshot from cache', {
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        operationType: 'cache_get_error',
      });
      return null; // Fall back to database on cache error
    }
  }

  /**
   * Set document snapshot in cache
   * @param documentId - The document ID
   * @param snapshot - The snapshot data as Uint8Array
   */
  async setSnapshot(documentId: string, snapshot: Uint8Array): Promise<void> {
    if (!redisService.isAvailable()) {
      logger.debug('Redis not available, skipping cache set', {
        documentId,
        operationType: 'cache_set',
      });
      return;
    }

    try {
      const publisher = redisService.getPublisher();
      if (!publisher) {
        return;
      }

      const cacheKey = this.getCacheKey(documentId);
      
      // Encode to base64 for storage
      const base64Data = Buffer.from(snapshot).toString('base64');

      // Set with TTL
      await publisher.setEx(cacheKey, this.CACHE_TTL, base64Data);

      logger.debug('Cached document snapshot', {
        documentId,
        cacheKey,
        snapshotSize: snapshot.length,
        ttl: this.CACHE_TTL,
        operationType: 'cache_set',
      });
    } catch (error) {
      logger.error('Error setting snapshot in cache', {
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        operationType: 'cache_set_error',
      });
      // Don't throw - caching is optional
    }
  }

  /**
   * Invalidate document snapshot cache
   * @param documentId - The document ID
   */
  async invalidateSnapshot(documentId: string): Promise<void> {
    if (!redisService.isAvailable()) {
      logger.debug('Redis not available, skipping cache invalidation', {
        documentId,
        operationType: 'cache_invalidate',
      });
      return;
    }

    try {
      const publisher = redisService.getPublisher();
      if (!publisher) {
        return;
      }

      const cacheKey = this.getCacheKey(documentId);
      await publisher.del(cacheKey);

      logger.debug('Invalidated document snapshot cache', {
        documentId,
        cacheKey,
        operationType: 'cache_invalidate',
      });
    } catch (error) {
      logger.error('Error invalidating snapshot cache', {
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        operationType: 'cache_invalidate_error',
      });
      // Don't throw - cache invalidation failure is not critical
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    memoryUsed: string;
  }> {
    if (!redisService.isAvailable()) {
      return {
        totalKeys: 0,
        memoryUsed: '0',
      };
    }

    try {
      const publisher = redisService.getPublisher();
      if (!publisher) {
        return {
          totalKeys: 0,
          memoryUsed: '0',
        };
      }

      // Count keys with our prefix
      const keys = await publisher.keys(`${this.CACHE_KEY_PREFIX}*`);
      
      // Get memory info
      const info = await publisher.info('memory');
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsed = memoryMatch ? memoryMatch[1] : '0';

      return {
        totalKeys: keys.length,
        memoryUsed,
      };
    } catch (error) {
      logger.error('Error getting cache stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operationType: 'cache_stats_error',
      });
      return {
        totalKeys: 0,
        memoryUsed: '0',
      };
    }
  }
}

// Export singleton instance
export const documentCacheService = new DocumentCacheService();

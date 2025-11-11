import { WebSocket } from 'ws';
import { Room, ClientInfo } from './Room.js';
import { persistenceService } from '../services/persistenceService.js';
import { redisService, RedisService } from '../config/redis.js';
import * as Y from 'yjs';
import { randomUUID } from 'crypto';
import { metricsService } from '../services/metricsService.js';
import { logError, logDatabaseError, logWebSocketError } from '../utils/errorLogger.js';
import logger from '../config/logger.js';

/**
 * RoomManager singleton service
 * Manages all active document rooms and handles room lifecycle
 * Supports multi-server scaling via Redis pub/sub
 */
export class RoomManager {
  private static instance: RoomManager;
  private rooms: Map<string, Room>;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly INACTIVE_ROOM_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly serverId: string; // Unique server ID to prevent echo
  private subscribedChannels: Set<string> = new Set();

  private constructor() {
    this.rooms = new Map();
    this.serverId = randomUUID(); // Generate unique server ID
    logger.info('RoomManager initialized', {
      serverId: this.serverId,
      operationType: 'init_room_manager',
    });
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  /**
   * Get or create a room for a document
   * Loads document snapshot from persistence when creating a new room
   */
  async getRoom(documentId: string): Promise<Room> {
    // Check if room already exists
    let room = this.rooms.get(documentId);

    if (room) {
      room.updateActivity();
      return room;
    }

    // Create new room
    room = new Room(documentId);

    // Load document snapshot from persistence
    try {
      const snapshot = await persistenceService.loadSnapshot(documentId);

      if (snapshot) {
        // Apply snapshot to Yjs document
        room.applySnapshot(snapshot);
        logger.info('Loaded snapshot for document', {
          documentId,
          snapshotSize: snapshot.length,
          operationType: 'load_snapshot',
        });
      } else {
        logger.info('No snapshot found for document, starting with empty document', {
          documentId,
          operationType: 'load_snapshot',
        });
      }
    } catch (error) {
      logDatabaseError('load_snapshot', error, {
        documentId,
        operationType: 'load_snapshot',
      });
      // Continue with empty document if snapshot loading fails
    }

    // Set up update listener to persist changes
    room.setupUpdateListener(async (update: Uint8Array, origin: any) => {
      try {
        // Increment operation count
        room.incrementOperationCount();

        // Broadcast update to all clients in the room (except origin)
        const updateMessage = this.createYjsUpdateMessage(update);
        room.broadcastToRoom(updateMessage, origin);

        // Publish update to Redis for cross-server broadcasting
        await this.publishUpdateToRedis(documentId, update, origin);

        // Persist the update to the operation log
        // We need to extract user info from the origin (WebSocket)
        let userId = 'system'; // Default for system updates
        let clientId = 'server';
        let sessionId = 'server-session';

        if (origin && typeof origin === 'object' && 'userId' in origin) {
          userId = origin.userId || 'system';
          clientId = origin.userId || 'server';
          sessionId = `session-${origin.userId || 'server'}`;
        }

        // Persist operation
        await persistenceService.appendOperation(
          documentId,
          userId,
          update,
          'insert', // Default type, could be enhanced to detect actual type
          clientId,
          sessionId
        );

        logger.debug('Persisted update for document', {
          documentId,
          userId,
          updateSize: update.length,
          operationCount: room.getOperationCount(),
          operationType: 'persist_update',
        });

        // Check if we need to create a snapshot (after 1000 operations)
        if (room.getOperationCount() >= 1000) {
          logger.info('Creating snapshot after 1000 operations', {
            documentId,
            operationCount: room.getOperationCount(),
            operationType: 'create_snapshot',
          });

          // Create snapshot
          const snapshot = Y.encodeStateAsUpdate(room.yjsDoc);
          await persistenceService.saveSnapshot(documentId, snapshot);

          // Reset operation count
          room.resetOperationCount();

          logger.info('Snapshot created successfully', {
            documentId,
            snapshotSize: snapshot.length,
            operationType: 'create_snapshot',
          });
        }
      } catch (error) {
        logError('Error handling update for document', error, {
          documentId,
          userId,
          operationType: 'handle_update',
        });
      }
    });

    // Set up awareness listener to broadcast cursor/presence updates
    room.setupAwarenessListener(async (update: Uint8Array, origin: any) => {
      try {
        // Broadcast awareness update to all clients in the room (except origin)
        const awarenessMessage = this.createAwarenessUpdateMessage(update);
        room.broadcastToRoom(awarenessMessage, origin);

        // Publish awareness update to Redis for cross-server broadcasting
        await this.publishAwarenessToRedis(documentId, update, origin);

        logger.debug('Broadcasted awareness update', {
          documentId,
          updateSize: update.length,
          operationType: 'broadcast_awareness',
        });
      } catch (error) {
        logError('Error handling awareness update', error, {
          documentId,
          operationType: 'handle_awareness_update',
        });
      }
    });

    // Store room
    this.rooms.set(documentId, room);

    // Update metrics
    metricsService.setActiveRooms(this.rooms.size);

    // Subscribe to Redis channel for cross-server updates
    await this.subscribeToRedisChannel(documentId);

    logger.info('Created new room', {
      documentId,
      totalRooms: this.rooms.size,
      operationType: 'create_room',
    });

    return room;
  }

  /**
   * Get an existing room without creating it
   */
  getRoomIfExists(documentId: string): Room | undefined {
    return this.rooms.get(documentId);
  }

  /**
   * Add a client to a room
   */
  async addClientToRoom(
    documentId: string,
    socket: WebSocket,
    userId: string,
    userName: string,
    userEmail: string
  ): Promise<Room> {
    const room = await this.getRoom(documentId);
    room.addClient(socket, userId, userName, userEmail);
    return room;
  }

  /**
   * Remove a client from a room
   */
  removeClientFromRoom(documentId: string, userId: string): void {
    const room = this.rooms.get(documentId);

    if (!room) {
      return;
    }

    room.removeClient(userId);

    // If room is empty, it will be cleaned up by the cleanup job
    if (!room.hasClients()) {
      logger.info('Room is now empty', {
        documentId,
        operationType: 'room_empty',
      });
    }
  }

  /**
   * Get active clients in a room
   */
  getActiveClients(documentId: string): ClientInfo[] {
    const room = this.rooms.get(documentId);

    if (!room) {
      return [];
    }

    return room.getAllClients();
  }

  /**
   * Broadcast a message to all clients in a room
   * @param documentId - The document/room ID
   * @param message - The message to broadcast
   * @param excludeSocket - Optional socket to exclude from broadcast
   */
  broadcastToRoom(documentId: string, message: Buffer | string, excludeSocket?: WebSocket): void {
    const room = this.rooms.get(documentId);

    if (!room) {
      logger.warn('Cannot broadcast to non-existent room', {
        documentId,
        operationType: 'broadcast_to_room',
      });
      return;
    }

    room.broadcastToRoom(message, excludeSocket);
  }

  /**
   * Get the number of active rooms
   */
  getActiveRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Get all active room IDs
   */
  getActiveRoomIds(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Check if a room exists
   */
  hasRoom(documentId: string): boolean {
    return this.rooms.has(documentId);
  }

  /**
   * Start the cleanup job for inactive rooms
   */
  startCleanupJob(): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    logger.info('Starting room cleanup job', {
      cleanupInterval: this.CLEANUP_INTERVAL,
      inactiveTimeout: this.INACTIVE_ROOM_TIMEOUT,
      operationType: 'start_cleanup_job',
    });

    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveRooms();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Stop the cleanup job
   */
  stopCleanupJob(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Stopped room cleanup job', {
        operationType: 'stop_cleanup_job',
      });
    }
  }

  /**
   * Clean up inactive rooms (>30 min idle with no clients)
   */
  async cleanupInactiveRooms(): Promise<void> {
    const now = Date.now();
    const roomsToCleanup: string[] = [];

    this.rooms.forEach((room, documentId) => {
      // Only cleanup rooms with no clients
      if (!room.hasClients()) {
        const timeSinceLastActivity = now - room.lastActivity.getTime();

        if (timeSinceLastActivity > this.INACTIVE_ROOM_TIMEOUT) {
          roomsToCleanup.push(documentId);
        }
      }
    });

    // Cleanup identified rooms
    for (const documentId of roomsToCleanup) {
      await this.cleanupRoom(documentId);
    }

    if (roomsToCleanup.length > 0) {
      logger.info('Cleaned up inactive rooms', {
        cleanedUpCount: roomsToCleanup.length,
        remainingRooms: this.rooms.size,
        operationType: 'cleanup_inactive_rooms',
      });
    }
  }

  /**
   * Clean up a specific room
   */
  private async cleanupRoom(documentId: string): Promise<void> {
    const room = this.rooms.get(documentId);

    if (!room) {
      return;
    }

    // Unsubscribe from Redis channel
    await this.unsubscribeFromRedisChannel(documentId);

    // Cleanup room resources
    room.cleanup();

    // Remove from map
    this.rooms.delete(documentId);

    // Update metrics
    metricsService.setActiveRooms(this.rooms.size);

    logger.info('Cleaned up room', {
      documentId,
      remainingRooms: this.rooms.size,
      operationType: 'cleanup_room',
    });
  }

  /**
   * Create a Yjs update message for broadcasting
   */
  private createYjsUpdateMessage(update: Uint8Array): Buffer {
    // Create a simple binary message with message type prefix
    // Message format: [messageType: 1 byte][update: N bytes]
    const messageType = 0; // 0 = SYNC message
    const buffer = Buffer.allocUnsafe(1 + update.length);
    buffer[0] = messageType;
    Buffer.from(update).copy(buffer, 1);
    return buffer;
  }

  /**
   * Create an awareness update message for broadcasting
   */
  private createAwarenessUpdateMessage(update: Uint8Array): Buffer {
    // Message format: [messageType: 1 byte][update: N bytes]
    const messageType = 1; // 1 = AWARENESS message
    const buffer = Buffer.allocUnsafe(1 + update.length);
    buffer[0] = messageType;
    Buffer.from(update).copy(buffer, 1);
    return buffer;
  }

  /**
   * Subscribe to Redis channel for a document room
   */
  private async subscribeToRedisChannel(documentId: string): Promise<void> {
    if (!redisService.isAvailable()) {
      logger.debug('Redis not available, skipping subscription', {
        documentId,
        operationType: 'subscribe_redis',
      });
      return;
    }

    const channel = RedisService.getChannelName(documentId);

    // Check if already subscribed
    if (this.subscribedChannels.has(channel)) {
      return;
    }

    try {
      await redisService.subscribe(channel, (message: string, receivedChannel: string) => {
        this.handleRedisMessage(documentId, message, receivedChannel);
      });

      this.subscribedChannels.add(channel);
      logger.info('Subscribed to Redis channel', {
        documentId,
        channel,
        operationType: 'subscribe_redis',
      });
    } catch (error) {
      logError('Error subscribing to Redis channel', error, {
        documentId,
        channel,
        operationType: 'subscribe_redis',
      });
    }
  }

  /**
   * Unsubscribe from Redis channel for a document room
   */
  private async unsubscribeFromRedisChannel(documentId: string): Promise<void> {
    const channel = RedisService.getChannelName(documentId);

    if (!this.subscribedChannels.has(channel)) {
      return;
    }

    try {
      await redisService.unsubscribe(channel);
      this.subscribedChannels.delete(channel);
      logger.info('Unsubscribed from Redis channel', {
        documentId,
        channel,
        operationType: 'unsubscribe_redis',
      });
    } catch (error) {
      logError('Error unsubscribing from Redis channel', error, {
        documentId,
        channel,
        operationType: 'unsubscribe_redis',
      });
    }
  }

  /**
   * Handle incoming Redis messages
   */
  private handleRedisMessage(documentId: string, message: string, _channel: string): void {
    try {
      const data = JSON.parse(message);

      // Ignore messages from this server (prevent echo)
      if (data.serverId === this.serverId) {
        return;
      }

      const room = this.rooms.get(documentId);
      if (!room) {
        logger.warn('Received Redis message for non-existent room', {
          documentId,
          operationType: 'handle_redis_message',
        });
        return;
      }

      // Handle different message types
      if (data.type === 'update') {
        // Decode the update from base64
        const update = Buffer.from(data.update, 'base64');
        const updateMessage = this.createYjsUpdateMessage(update);

        // Broadcast to local clients only (origin is null to broadcast to all)
        room.broadcastToRoom(updateMessage);

        logger.debug('Received Yjs update from Redis', {
          documentId,
          updateSize: update.length,
          operationType: 'redis_yjs_update',
        });
      } else if (data.type === 'awareness') {
        // Decode the awareness update from base64
        const update = Buffer.from(data.update, 'base64');
        const awarenessMessage = this.createAwarenessUpdateMessage(update);

        // Broadcast to local clients only
        room.broadcastToRoom(awarenessMessage);

        logger.debug('Received awareness update from Redis', {
          documentId,
          updateSize: update.length,
          operationType: 'redis_awareness_update',
        });
      }
    } catch (error) {
      logError('Error handling Redis message', error, {
        documentId,
        operationType: 'handle_redis_message',
      });
    }
  }

  /**
   * Publish Yjs update to Redis for cross-server broadcasting
   */
  private async publishUpdateToRedis(
    documentId: string,
    update: Uint8Array,
    _origin: any
  ): Promise<void> {
    if (!redisService.isAvailable()) {
      return; // Fall back to single-server mode
    }

    try {
      const channel = RedisService.getChannelName(documentId);

      // Create message with server ID to prevent echo
      const message = JSON.stringify({
        type: 'update',
        serverId: this.serverId,
        update: Buffer.from(update).toString('base64'),
        timestamp: Date.now(),
      });

      await redisService.publish(channel, message);

      logger.debug('Published Yjs update to Redis', {
        documentId,
        updateSize: update.length,
        operationType: 'publish_yjs_update',
      });
    } catch (error) {
      logError('Error publishing update to Redis', error, {
        documentId,
        operationType: 'publish_yjs_update',
      });
      // Don't throw - fall back to single-server mode
    }
  }

  /**
   * Publish awareness update to Redis for cross-server broadcasting
   */
  private async publishAwarenessToRedis(
    documentId: string,
    update: Uint8Array,
    _origin: any
  ): Promise<void> {
    if (!redisService.isAvailable()) {
      return; // Fall back to single-server mode
    }

    try {
      const channel = RedisService.getChannelName(documentId);

      // Create message with server ID to prevent echo
      const message = JSON.stringify({
        type: 'awareness',
        serverId: this.serverId,
        update: Buffer.from(update).toString('base64'),
        timestamp: Date.now(),
      });

      await redisService.publish(channel, message);

      logger.debug('Published awareness update to Redis', {
        documentId,
        updateSize: update.length,
        operationType: 'publish_awareness_update',
      });
    } catch (error) {
      logError('Error publishing awareness to Redis', error, {
        documentId,
        operationType: 'publish_awareness_update',
      });
      // Don't throw - fall back to single-server mode
    }
  }

  /**
   * Shutdown the room manager and cleanup all rooms
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down RoomManager', {
      activeRooms: this.rooms.size,
      subscribedChannels: this.subscribedChannels.size,
      operationType: 'shutdown_room_manager',
    });

    // Stop cleanup job
    this.stopCleanupJob();

    // Unsubscribe from all Redis channels
    const channelsToUnsubscribe = Array.from(this.subscribedChannels);
    for (const channel of channelsToUnsubscribe) {
      const documentId = channel.replace('room:', '');
      await this.unsubscribeFromRedisChannel(documentId);
    }

    // Cleanup all rooms
    const roomIds = Array.from(this.rooms.keys());
    for (const documentId of roomIds) {
      await this.cleanupRoom(documentId);
    }

    logger.info('RoomManager shutdown complete', {
      operationType: 'shutdown_room_manager',
    });
  }
}

// Export singleton instance
export const roomManager = RoomManager.getInstance();

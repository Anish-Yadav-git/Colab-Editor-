import { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { logWebSocketError } from '../utils/errorLogger.js';
import logger from '../config/logger.js';

export interface ClientInfo {
  socket: WebSocket;
  userId: string;
  userName: string;
  userEmail: string;
  joinedAt: Date;
}

/**
 * Room class manages a single document editing session
 * Tracks connected clients and maintains the Yjs document state
 */
export class Room {
  public readonly documentId: string;
  public readonly clients: Map<string, ClientInfo>;
  public readonly yjsDoc: Y.Doc;
  public readonly awareness: awarenessProtocol.Awareness;
  public lastActivity: Date;
  private updateHandler: ((update: Uint8Array, origin: any) => void) | null = null;
  private awarenessUpdateHandler: ((changes: any, origin: any) => void) | null = null;
  private operationCount: number = 0;
  
  // Throttling for awareness updates
  private awarenessUpdateBuffer: Array<{ update: Uint8Array; origin: any }> = [];
  private awarenessFlushTimer: NodeJS.Timeout | null = null;
  private readonly AWARENESS_THROTTLE_MS = 100; // 100ms = 10 updates per second
  private readonly AWARENESS_BUFFER_SIZE = 10; // Flush when buffer reaches this size

  constructor(documentId: string) {
    this.documentId = documentId;
    this.clients = new Map();
    this.yjsDoc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.yjsDoc);
    this.lastActivity = new Date();
  }

  /**
   * Set up update listener for the Yjs document
   * This should be called after the room is created and snapshot is loaded
   */
  setupUpdateListener(
    onUpdate: (update: Uint8Array, origin: any) => void
  ): void {
    // Remove existing listener if any
    if (this.updateHandler) {
      this.yjsDoc.off('update', this.updateHandler);
    }

    // Set up new listener
    this.updateHandler = onUpdate;
    this.yjsDoc.on('update', this.updateHandler);

    logger.info('Update listener set up for room', {
      documentId: this.documentId,
      operationType: 'setup_update_listener',
    });
  }

  /**
   * Set up awareness update listener
   * This broadcasts awareness changes (cursor positions, selections) to all clients
   * Updates are throttled to 10 per second (100ms intervals)
   */
  setupAwarenessListener(
    onAwarenessUpdate: (update: Uint8Array, origin: any) => void
  ): void {
    // Remove existing listener if any
    if (this.awarenessUpdateHandler) {
      this.awareness.off('update', this.awarenessUpdateHandler);
    }

    // Set up new listener with throttling
    this.awarenessUpdateHandler = (changes: any, origin: any) => {
      // Encode awareness update
      // changes.added and changes.updated are Sets of client IDs
      const changedClients = Array.from(changes.added as Set<number>).concat(
        Array.from(changes.updated as Set<number>)
      );
      const update = awarenessProtocol.encodeAwarenessUpdate(
        this.awareness,
        changedClients
      );
      
      // Add to buffer
      this.awarenessUpdateBuffer.push({ update, origin });
      
      // Flush immediately if buffer is full
      if (this.awarenessUpdateBuffer.length >= this.AWARENESS_BUFFER_SIZE) {
        this.flushAwarenessUpdates(onAwarenessUpdate);
        return;
      }
      
      // Schedule flush if not already scheduled
      if (!this.awarenessFlushTimer) {
        this.awarenessFlushTimer = setTimeout(() => {
          this.flushAwarenessUpdates(onAwarenessUpdate);
        }, this.AWARENESS_THROTTLE_MS);
      }
    };
    
    this.awareness.on('update', this.awarenessUpdateHandler);

    logger.info('Awareness listener set up for room with throttling', {
      documentId: this.documentId,
      throttleMs: this.AWARENESS_THROTTLE_MS,
      operationType: 'setup_awareness_listener',
    });
  }

  /**
   * Flush buffered awareness updates
   */
  private flushAwarenessUpdates(
    onAwarenessUpdate: (update: Uint8Array, origin: any) => void
  ): void {
    // Clear timer
    if (this.awarenessFlushTimer) {
      clearTimeout(this.awarenessFlushTimer);
      this.awarenessFlushTimer = null;
    }

    // Process all buffered updates
    if (this.awarenessUpdateBuffer.length > 0) {
      // Get all current awareness states and send as one merged update
      // This is more efficient than sending multiple individual updates
      const awarenessStates = Array.from(this.awareness.getStates().keys());
      if (awarenessStates.length > 0) {
        const mergedUpdate = awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          awarenessStates
        );
        
        // Use the origin from the last update
        const lastOrigin = this.awarenessUpdateBuffer[this.awarenessUpdateBuffer.length - 1].origin;
        onAwarenessUpdate(mergedUpdate, lastOrigin);
      }

      logger.debug('Flushed awareness updates', {
        documentId: this.documentId,
        updateCount: this.awarenessUpdateBuffer.length,
        operationType: 'flush_awareness_updates',
      });

      // Clear buffer
      this.awarenessUpdateBuffer = [];
    }
  }

  /**
   * Apply a snapshot to the Yjs document
   */
  applySnapshot(snapshot: Uint8Array): void {
    Y.applyUpdate(this.yjsDoc, snapshot);
    logger.info('Applied snapshot to room', {
      documentId: this.documentId,
      snapshotSize: snapshot.length,
      operationType: 'apply_snapshot',
    });
  }

  /**
   * Increment operation count
   */
  incrementOperationCount(): void {
    this.operationCount++;
  }

  /**
   * Get current operation count
   */
  getOperationCount(): number {
    return this.operationCount;
  }

  /**
   * Reset operation count (typically after snapshot creation)
   */
  resetOperationCount(): void {
    this.operationCount = 0;
  }

  /**
   * Add a client to the room
   */
  addClient(socket: WebSocket, userId: string, userName: string, userEmail: string): void {
    const clientInfo: ClientInfo = {
      socket,
      userId,
      userName,
      userEmail,
      joinedAt: new Date(),
    };

    this.clients.set(userId, clientInfo);
    this.lastActivity = new Date();

    logger.info('Client added to room', {
      documentId: this.documentId,
      userId,
      userName,
      totalClients: this.clients.size,
      operationType: 'add_client',
    });
  }

  /**
   * Remove a client from the room
   */
  removeClient(userId: string): boolean {
    const removed = this.clients.delete(userId);

    if (removed) {
      // Remove client's awareness state
      // We need to find the client ID in awareness states
      const awarenessStates = this.awareness.getStates();
      const clientIdsToRemove: number[] = [];
      
      awarenessStates.forEach((state, clientId) => {
        if (state && state.user && state.user.id === userId) {
          clientIdsToRemove.push(clientId);
        }
      });

      // Remove awareness states for this user
      if (clientIdsToRemove.length > 0) {
        awarenessProtocol.removeAwarenessStates(this.awareness, clientIdsToRemove, null);
        // Encode the removal as an awareness update
        const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, clientIdsToRemove);
        this.broadcastToRoom(this.createAwarenessUpdateMessage(update));
      }

      this.lastActivity = new Date();
      logger.info('Client removed from room', {
        documentId: this.documentId,
        userId,
        remainingClients: this.clients.size,
        operationType: 'remove_client',
      });
    }

    return removed;
  }

  /**
   * Get a client by user ID
   */
  getClient(userId: string): ClientInfo | undefined {
    return this.clients.get(userId);
  }

  /**
   * Check if room has any active clients
   */
  hasClients(): boolean {
    return this.clients.size > 0;
  }

  /**
   * Get the number of active clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get all client information
   */
  getAllClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  /**
   * Check if a user is in the room
   */
  hasClient(userId: string): boolean {
    return this.clients.has(userId);
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(): void {
    this.lastActivity = new Date();
  }

  /**
   * Get time since last activity in milliseconds
   */
  getTimeSinceLastActivity(): number {
    return Date.now() - this.lastActivity.getTime();
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
   * Broadcast a message to all clients in the room
   * @param message - The message to broadcast (Buffer or string)
   * @param excludeSocket - Optional socket to exclude from broadcast (typically the sender)
   */
  broadcastToRoom(message: Buffer | string, excludeSocket?: WebSocket): void {
    const messageBuffer = typeof message === 'string' ? Buffer.from(message) : message;
    let successCount = 0;
    let errorCount = 0;

    this.clients.forEach((client) => {
      // Skip excluded socket
      if (excludeSocket && client.socket === excludeSocket) {
        return;
      }

      // Check if socket is open
      if (client.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      try {
        // Check backpressure (bufferedAmount indicates unsent data)
        const bufferedAmount = client.socket.bufferedAmount;
        const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB

        if (bufferedAmount > MAX_BUFFER_SIZE) {
          logger.warn('Backpressure detected, skipping message', {
            documentId: this.documentId,
            userId: client.userId,
            bufferedAmount,
            maxBufferSize: MAX_BUFFER_SIZE,
            operationType: 'broadcast_backpressure',
          });
          errorCount++;
          return;
        }

        // Send message
        client.socket.send(messageBuffer, (error) => {
          if (error) {
            logWebSocketError('broadcast_error', error, {
              documentId: this.documentId,
              userId: client.userId,
              operationType: 'broadcast_to_client',
            });
            errorCount++;
          }
        });

        successCount++;
      } catch (error) {
        logWebSocketError('broadcast_exception', error, {
          documentId: this.documentId,
          userId: client.userId,
          operationType: 'broadcast_to_client',
        });
        errorCount++;
      }
    });

    // Update activity on successful broadcast
    if (successCount > 0) {
      this.updateActivity();
    }

    // Log broadcast summary for debugging
    if (errorCount > 0) {
      logger.warn('Broadcast completed with errors', {
        documentId: this.documentId,
        successCount,
        errorCount,
        operationType: 'broadcast_summary',
      });
    }
  }

  /**
   * Clean up room resources
   */
  cleanup(): void {
    logger.info('Cleaning up room', {
      documentId: this.documentId,
      clientCount: this.clients.size,
      operationType: 'cleanup_room',
    });

    // Remove update listener
    if (this.updateHandler) {
      this.yjsDoc.off('update', this.updateHandler);
      this.updateHandler = null;
    }

    // Remove awareness listener
    if (this.awarenessUpdateHandler) {
      this.awareness.off('update', this.awarenessUpdateHandler);
      this.awarenessUpdateHandler = null;
    }

    // Clear awareness flush timer
    if (this.awarenessFlushTimer) {
      clearTimeout(this.awarenessFlushTimer);
      this.awarenessFlushTimer = null;
    }

    // Clear awareness buffer
    this.awarenessUpdateBuffer = [];

    // Close all client connections
    this.clients.forEach((client) => {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.close(1000, 'Room closed');
      }
    });

    // Clear clients
    this.clients.clear();

    // Destroy awareness
    this.awareness.destroy();

    // Destroy Yjs document
    this.yjsDoc.destroy();
  }
}

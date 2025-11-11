import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { authService, TokenPayload } from '../services/authService.js';
import { roomManager } from './RoomManager.js';
import { YjsSyncProtocol } from './YjsSyncProtocol.js';
import {
  operationDeduplicator,
  OperationDeduplicator,
} from './OperationDeduplicator.js';
import { metricsService } from '../services/metricsService.js';
import { logWebSocketError, logAuthFailure } from '../utils/errorLogger.js';
import logger from '../config/logger.js';
import { wsRateLimiter } from './WebSocketRateLimiter.js';
import { validateOperationSize } from '../middleware/inputSanitization.js';

interface WebSocketWithMetadata extends WebSocket {
  isAlive?: boolean;
  userId?: string;
  userName?: string;
  userEmail?: string;
  documentId?: string;
  authenticated?: boolean;
}

// Message types for WebSocket communication
export enum MessageType {
  JOIN_DOCUMENT = 'join_document',
  LEAVE_DOCUMENT = 'leave_document',
  YJS_SYNC = 'yjs_sync',
  AWARENESS_UPDATE = 'awareness_update',
  ERROR = 'error',
  ACK = 'ack',
}

export interface WebSocketMessage {
  type: MessageType;
  documentId?: string;
  payload?: unknown;
  messageId?: string;
}

export interface JoinDocumentPayload {
  documentId: string;
}

export interface ErrorPayload {
  message: string;
  code?: string;
}

// Message handler type
type MessageHandler = (socket: WebSocketWithMetadata, message: WebSocketMessage) => void;

export class WebSocketServer {
  private wss: WSServer | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 60000; // 60 seconds
  private readonly MAX_CONNECTIONS = 1000;
  private messageHandlers: Map<MessageType, MessageHandler> = new Map();

  /**
   * Initialize WebSocket server attached to HTTP server
   */
  initialize(httpServer: HTTPServer): void {
    this.wss = new WSServer({
      server: httpServer,
      maxPayload: 10 * 1024 * 1024, // 10MB max message size
      clientTracking: true,
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleServerError.bind(this));

    // Register default message handlers
    this.registerDefaultHandlers();

    // Start heartbeat mechanism
    this.startHeartbeat();

    console.log('WebSocket server initialized');
  }

  /**
   * Register default message handlers
   */
  private registerDefaultHandlers(): void {
    this.registerHandler(MessageType.JOIN_DOCUMENT, this.handleJoinDocument.bind(this));
    this.registerHandler(MessageType.LEAVE_DOCUMENT, this.handleLeaveDocument.bind(this));
    // YJS_SYNC and AWARENESS_UPDATE will be implemented in later tasks
  }

  /**
   * Register a message handler for a specific message type
   */
  registerHandler(type: MessageType, handler: MessageHandler): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocketWithMetadata, request: IncomingMessage): void {
    try {
      // Validate Origin header
      const originValidation = this.validateOrigin(request);
      if (!originValidation.valid) {
        logger.warn('WebSocket origin validation failed', {
          origin: request.headers.origin,
          ip: request.socket.remoteAddress,
        });
        socket.close(1008, 'Invalid origin');
        return;
      }

      // Check connection limit
      if (this.wss && this.wss.clients.size > this.MAX_CONNECTIONS) {
        logger.warn('Connection limit reached, rejecting new connection', {
          currentConnections: this.wss.clients.size,
          maxConnections: this.MAX_CONNECTIONS,
        });
        socket.close(1008, 'Connection limit reached');
        return;
      }

      // Authenticate connection
      const authResult = this.authenticateConnection(request);
      if (!authResult.success) {
        logAuthFailure(authResult.error || 'Authentication failed', {
          ip: request.socket.remoteAddress,
          userAgent: request.headers['user-agent'],
        });
        socket.close(1008, authResult.error || 'Authentication failed');
        return;
      }

      // Initialize connection metadata
      socket.isAlive = true;
      socket.authenticated = true;
      socket.userId = authResult.user!.userId;
      socket.userName = authResult.user!.name;
      socket.userEmail = authResult.user!.email;

      // Set connection timeout
      const timeout = setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
          console.log('Connection timeout, closing socket');
          socket.close(1000, 'Connection timeout');
        }
      }, this.CONNECTION_TIMEOUT);

      // Handle pong responses
      socket.on('pong', () => {
        socket.isAlive = true;
      });

      // Handle messages
      socket.on('message', (data: Buffer) => {
        this.handleMessage(socket, data);
      });

      // Handle errors
      socket.on('error', (error: Error) => {
        logWebSocketError('socket_error', error, {
          userId: socket.userId,
          documentId: socket.documentId,
        });
      });

      // Handle close
      socket.on('close', (code: number, reason: Buffer) => {
        clearTimeout(timeout);
        wsRateLimiter.removeSocket(socket);
        this.handleDisconnect(socket, code, reason.toString());
      });

      // Increment active connections metric
      metricsService.incrementActiveConnections();

      logger.info('WebSocket connection authenticated', {
        userId: socket.userId,
        userName: socket.userName,
      });
    } catch (error) {
      logWebSocketError('connection_error', error, {
        ip: request.socket.remoteAddress,
      });
      socket.close(1011, 'Internal server error');
    }
  }

  /**
   * Validate Origin header for WebSocket connections
   */
  private validateOrigin(request: IncomingMessage): { valid: boolean } {
    const origin = request.headers.origin;

    // Get allowed origins from environment variable
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:5173', 'http://localhost:3000'];

    // Allow connections without origin header (e.g., from native apps)
    if (!origin) {
      return { valid: true };
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return { valid: true };
    }

    // Also allow if origin matches the host (same-origin)
    const host = request.headers.host;
    if (host && origin.includes(host)) {
      return { valid: true };
    }

    return { valid: false };
  }

  /**
   * Authenticate WebSocket connection using JWT token from query params
   */
  private authenticateConnection(request: IncomingMessage): {
    success: boolean;
    user?: TokenPayload;
    error?: string;
  } {
    try {
      // Extract token from query parameters
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        return { success: false, error: 'No token provided' };
      }

      // Verify token
      const decoded = authService.verifyAccessToken(token);

      return { success: true, user: decoded };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      logAuthFailure(errorMessage, {
        ip: request.socket.remoteAddress,
        userAgent: request.headers['user-agent'],
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(socket: WebSocketWithMetadata, data: Buffer): Promise<void> {
    try {
      // Check if this is a binary message (Yjs sync or awareness)
      if (data.length > 0 && data[0] <= 1) {
        const messageType = data[0];
        
        if (messageType === 0) {
          // Yjs sync protocol message
          await this.handleYjsSyncMessage(socket, new Uint8Array(data.slice(1)));
        } else if (messageType === 1) {
          // Awareness update message
          await this.handleAwarenessMessage(socket, new Uint8Array(data.slice(1)));
        }
        return;
      }

      // Parse as JSON message
      const message = this.parseMessage(data);
      if (!message) {
        this.sendError(socket, 'Invalid message format', 'INVALID_FORMAT');
        return;
      }

      // Validate message
      const validation = this.validateMessage(message);
      if (!validation.valid) {
        this.sendError(socket, validation.error || 'Invalid message', 'VALIDATION_ERROR');
        return;
      }

      // Route message to appropriate handler
      const handler = this.messageHandlers.get(message.type);
      if (!handler) {
        this.sendError(socket, `Unknown message type: ${message.type}`, 'UNKNOWN_TYPE');
        return;
      }

      // Execute handler
      handler(socket, message);
    } catch (error) {
      logWebSocketError('message_handling_error', error, {
        userId: socket.userId,
        documentId: socket.documentId,
      });
      this.sendError(socket, 'Internal server error', 'INTERNAL_ERROR');
    }
  }

  /**
   * Handle Yjs sync protocol message
   */
  private async handleYjsSyncMessage(
    socket: WebSocketWithMetadata,
    message: Uint8Array
  ): Promise<void> {
    try {
      // Validate operation size
      try {
        validateOperationSize(message);
      } catch (error) {
        logger.warn('Operation size validation failed', {
          userId: socket.userId,
          documentId: socket.documentId,
          size: message.byteLength,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        this.sendError(socket, 'Operation size exceeds limit', 'SIZE_LIMIT_EXCEEDED');
        return;
      }

      // Check rate limit
      if (!wsRateLimiter.checkRateLimit(socket, socket.userId, socket.documentId)) {
        logger.warn('Rate limit exceeded for Yjs sync message', {
          userId: socket.userId,
          documentId: socket.documentId,
        });
        return;
      }

      // Check if user has joined a document
      if (!socket.documentId) {
        logger.warn('Received Yjs sync message without joining a document', {
          userId: socket.userId,
        });
        return;
      }

      // Get the room
      const room = roomManager.getRoomIfExists(socket.documentId);
      if (!room) {
        logger.warn('Room not found for document', {
          documentId: socket.documentId,
          userId: socket.userId,
        });
        return;
      }

      // Check for duplicate operation
      const operationId = OperationDeduplicator.generateOperationId(message);
      if (operationDeduplicator.isDuplicate(socket.documentId, operationId)) {
        logger.debug('Duplicate operation detected, ignoring', {
          documentId: socket.documentId,
          userId: socket.userId,
          operationId,
        });
        return;
      }

      // Handle the sync message and get response
      const response = YjsSyncProtocol.handleMessage(message, room.yjsDoc, socket);

      // Send response if any
      if (response) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(response, { binary: true });
        }
      }

      // Broadcast update to other clients in the room
      // (The update will be broadcast via the room's update listener)
    } catch (error) {
      logWebSocketError('yjs_sync_error', error, {
        userId: socket.userId,
        documentId: socket.documentId,
        operationType: 'yjs_sync',
      });
    }
  }

  /**
   * Handle awareness update message
   */
  private async handleAwarenessMessage(
    socket: WebSocketWithMetadata,
    message: Uint8Array
  ): Promise<void> {
    try {
      // Check rate limit
      if (!wsRateLimiter.checkRateLimit(socket, socket.userId, socket.documentId)) {
        logger.warn('Rate limit exceeded for awareness message', {
          userId: socket.userId,
          documentId: socket.documentId,
        });
        return;
      }

      // Check if user has joined a document
      if (!socket.documentId) {
        logger.warn('Received awareness message without joining a document', {
          userId: socket.userId,
        });
        return;
      }

      // Get the room
      const room = roomManager.getRoomIfExists(socket.documentId);
      if (!room) {
        logger.warn('Room not found for document', {
          documentId: socket.documentId,
          userId: socket.userId,
        });
        return;
      }

      // Import awareness protocol
      const awarenessProtocol = await import('y-protocols/awareness');

      // Apply awareness update to the room's awareness instance
      awarenessProtocol.applyAwarenessUpdate(room.awareness, message, socket);

      // The awareness update listener will broadcast to other clients
      logger.debug('Applied awareness update', {
        userId: socket.userId,
        documentId: socket.documentId,
      });
    } catch (error) {
      logWebSocketError('awareness_error', error, {
        userId: socket.userId,
        documentId: socket.documentId,
        operationType: 'awareness_update',
      });
    }
  }

  /**
   * Parse incoming message data
   */
  private parseMessage(data: Buffer): WebSocketMessage | null {
    try {
      const text = data.toString('utf8');
      const parsed = JSON.parse(text);
      return parsed as WebSocketMessage;
    } catch (error) {
      logger.warn('Error parsing WebSocket message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Validate message schema
   */
  private validateMessage(message: WebSocketMessage): { valid: boolean; error?: string } {
    // Check required fields
    if (!message.type) {
      return { valid: false, error: 'Missing message type' };
    }

    // Validate message type
    if (!Object.values(MessageType).includes(message.type)) {
      return { valid: false, error: 'Invalid message type' };
    }

    // Type-specific validation
    switch (message.type) {
      case MessageType.JOIN_DOCUMENT:
        if (!message.documentId) {
          return { valid: false, error: 'Missing documentId for join_document' };
        }
        break;
      case MessageType.LEAVE_DOCUMENT:
        if (!message.documentId) {
          return { valid: false, error: 'Missing documentId for leave_document' };
        }
        break;
      case MessageType.YJS_SYNC:
      case MessageType.AWARENESS_UPDATE:
        if (!message.documentId) {
          return { valid: false, error: `Missing documentId for ${message.type}` };
        }
        if (!message.payload) {
          return { valid: false, error: `Missing payload for ${message.type}` };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Send error message to client
   */
  private sendError(socket: WebSocketWithMetadata, message: string, code?: string): void {
    const errorMessage: WebSocketMessage = {
      type: MessageType.ERROR,
      payload: {
        message,
        code,
      } as ErrorPayload,
    };

    this.sendMessage(socket, errorMessage);
  }

  /**
   * Send message to client
   */
  private sendMessage(socket: WebSocketWithMetadata, message: WebSocketMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  /**
   * Handle join document message
   */
  private async handleJoinDocument(
    socket: WebSocketWithMetadata,
    message: WebSocketMessage
  ): Promise<void> {
    const documentId = message.documentId!;
    socket.documentId = documentId;

    logger.info('User joined document', {
      userId: socket.userId,
      documentId,
    });

    try {
      // Add client to room
      const room = await roomManager.addClientToRoom(
        documentId,
        socket,
        socket.userId!,
        socket.userName!,
        socket.userEmail!
      );

      // Send initial sync message (sync step 1)
      const syncStep1 = YjsSyncProtocol.createSyncStep1Message(room.yjsDoc);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(syncStep1, { binary: true });
      }

      // Send initial awareness state
      const awarenessProtocol = await import('y-protocols/awareness');
      const awarenessStates = Array.from(room.awareness.getStates().keys());
      if (awarenessStates.length > 0) {
        const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
          room.awareness,
          awarenessStates
        );
        
        // Create awareness message with type prefix
        const awarenessMessage = Buffer.allocUnsafe(1 + awarenessUpdate.length);
        awarenessMessage[0] = 1; // 1 = AWARENESS message
        Buffer.from(awarenessUpdate).copy(awarenessMessage, 1);
        
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(awarenessMessage, { binary: true });
        }
      }

      // Send acknowledgment
      this.sendMessage(socket, {
        type: MessageType.ACK,
        messageId: message.messageId,
        payload: { documentId },
      });
    } catch (error) {
      logWebSocketError('join_document_error', error, {
        userId: socket.userId,
        documentId,
        operationType: 'join_document',
      });
      this.sendError(socket, 'Failed to join document', 'JOIN_ERROR');
    }
  }

  /**
   * Handle leave document message
   */
  private handleLeaveDocument(socket: WebSocketWithMetadata, message: WebSocketMessage): void {
    const documentId = message.documentId!;

    logger.info('User left document', {
      userId: socket.userId,
      documentId,
    });

    // Remove client from room
    if (socket.userId) {
      roomManager.removeClientFromRoom(documentId, socket.userId);
    }

    if (socket.documentId === documentId) {
      socket.documentId = undefined;
    }

    // Send acknowledgment
    this.sendMessage(socket, {
      type: MessageType.ACK,
      messageId: message.messageId,
      payload: { documentId },
    });
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnect(socket: WebSocketWithMetadata, code: number, reason: string): void {
    logger.info('WebSocket disconnected', {
      userId: socket.userId,
      documentId: socket.documentId,
      code,
      reason: reason || 'No reason',
    });

    // Remove client from room if they were in one
    if (socket.documentId && socket.userId) {
      roomManager.removeClientFromRoom(socket.documentId, socket.userId);
    }

    // Decrement active connections metric
    metricsService.decrementActiveConnections();
  }

  /**
   * Handle WebSocket server errors
   */
  private handleServerError(error: Error): void {
    logWebSocketError('server_error', error, {
      operationType: 'websocket_server',
    });
  }

  /**
   * Start heartbeat mechanism to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;

      this.wss.clients.forEach((socket: WebSocket) => {
        const ws = socket as WebSocketWithMetadata;

        if (ws.isAlive === false) {
          logger.info('Terminating dead connection', {
            userId: ws.userId,
            documentId: ws.documentId,
          });
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: Buffer | string, excludeSocket?: WebSocket): void {
    if (!this.wss) return;

    this.wss.clients.forEach((client: WebSocket) => {
      if (client !== excludeSocket && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Get count of active connections
   */
  getConnectionCount(): number {
    return this.wss?.clients.size || 0;
  }

  /**
   * Gracefully shutdown WebSocket server
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket server...');

    this.stopHeartbeat();
    wsRateLimiter.shutdown();

    if (this.wss) {
      // Close all client connections
      this.wss.clients.forEach((socket: WebSocket) => {
        socket.close(1001, 'Server shutting down');
      });

      // Close the server
      return new Promise((resolve, reject) => {
        this.wss!.close((error) => {
          if (error) {
            logWebSocketError('shutdown_error', error, {
              operationType: 'shutdown',
            });
            reject(error);
          } else {
            logger.info('WebSocket server closed');
            this.wss = null;
            resolve();
          }
        });
      });
    }
  }
}

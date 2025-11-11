import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, Server as HTTPServer } from 'http';
import WebSocket from 'ws';
import { WebSocketServer, MessageType } from '../../websocket/WebSocketServer.js';
import { authService } from '../../services/authService.js';

describe('WebSocketServer', () => {
  let httpServer: HTTPServer;
  let wsServer: WebSocketServer;
  let serverPort: number;
  let testToken: string;

  beforeEach(async () => {
    // Create HTTP server
    httpServer = createServer();
    wsServer = new WebSocketServer();

    // Start server on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        serverPort = (httpServer.address() as any).port;
        resolve();
      });
    });

    // Initialize WebSocket server
    wsServer.initialize(httpServer);

    // Generate test token
    testToken = authService.generateAccessToken({
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      name: 'Test User',
    } as any);
  });

  afterEach(async () => {
    await wsServer.shutdown();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  describe('Connection establishment', () => {
    it('should accept connection with valid token', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}?token=${testToken}`);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          expect(client.readyState).toBe(WebSocket.OPEN);
          client.close();
          resolve();
        });
        client.on('error', reject);
      });
    });

    it('should reject connection without token', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        client.on('close', (code) => {
          expect(code).toBe(1008);
          resolve();
        });
      });
    });

    it('should reject connection with invalid token', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}?token=invalid-token`);

      await new Promise<void>((resolve) => {
        client.on('close', (code) => {
          expect(code).toBe(1008);
          resolve();
        });
      });
    });

    it('should track connection count', async () => {
      const client1 = new WebSocket(`ws://localhost:${serverPort}?token=${testToken}`);
      await new Promise<void>((resolve) => {
        client1.on('open', () => resolve());
      });

      expect(wsServer.getConnectionCount()).toBe(1);

      const client2 = new WebSocket(`ws://localhost:${serverPort}?token=${testToken}`);
      await new Promise<void>((resolve) => {
        client2.on('open', () => resolve());
      });

      expect(wsServer.getConnectionCount()).toBe(2);

      client1.close();
      client2.close();
    });
  });

  describe('Authentication', () => {
    it('should authenticate connection with valid JWT', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}?token=${testToken}`);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          expect(client.readyState).toBe(WebSocket.OPEN);
          client.close();
          resolve();
        });
        client.on('error', reject);
      });
    });

    it('should reject expired token', async () => {
      // Create expired token
      const expiredToken = authService.generateAccessToken({
        _id: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        name: 'Test User',
      } as any);

      // Mock token verification to throw expired error
      vi.spyOn(authService, 'verifyAccessToken').mockImplementation(() => {
        throw new Error('Access token expired');
      });

      const client = new WebSocket(`ws://localhost:${serverPort}?token=${expiredToken}`);

      await new Promise<void>((resolve) => {
        client.on('close', (code) => {
          expect(code).toBe(1008);
          resolve();
        });
      });

      vi.restoreAllMocks();
    });
  });

  describe('Message routing', () => {
    it('should route join_document message', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}?token=${testToken}`);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          const message = {
            type: MessageType.JOIN_DOCUMENT,
            documentId: 'doc123',
            messageId: 'msg1',
          };

          client.send(JSON.stringify(message));

          client.on('message', (data: Buffer) => {
            const response = JSON.parse(data.toString());
            expect(response.type).toBe(MessageType.ACK);
            expect(response.messageId).toBe('msg1');
            expect(response.payload.documentId).toBe('doc123');
            client.close();
            resolve();
          });
        });
        client.on('error', reject);
      });
    });

    it('should route leave_document message', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}?token=${testToken}`);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          const message = {
            type: MessageType.LEAVE_DOCUMENT,
            documentId: 'doc123',
            messageId: 'msg2',
          };

          client.send(JSON.stringify(message));

          client.on('message', (data: Buffer) => {
            const response = JSON.parse(data.toString());
            expect(response.type).toBe(MessageType.ACK);
            expect(response.messageId).toBe('msg2');
            client.close();
            resolve();
          });
        });
        client.on('error', reject);
      });
    });

    it('should reject invalid message format', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}?token=${testToken}`);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          client.send('invalid json');

          client.on('message', (data: Buffer) => {
            const response = JSON.parse(data.toString());
            expect(response.type).toBe(MessageType.ERROR);
            expect(response.payload.code).toBe('INVALID_FORMAT');
            client.close();
            resolve();
          });
        });
        client.on('error', reject);
      });
    });

    it('should reject message with missing type', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}?token=${testToken}`);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          const message = {
            documentId: 'doc123',
          };

          client.send(JSON.stringify(message));

          client.on('message', (data: Buffer) => {
            const response = JSON.parse(data.toString());
            expect(response.type).toBe(MessageType.ERROR);
            expect(response.payload.code).toBe('VALIDATION_ERROR');
            client.close();
            resolve();
          });
        });
        client.on('error', reject);
      });
    });

    it('should reject message with unknown type', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}?token=${testToken}`);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          const message = {
            type: 'unknown_type',
            documentId: 'doc123',
          };

          client.send(JSON.stringify(message));

          client.on('message', (data: Buffer) => {
            const response = JSON.parse(data.toString());
            expect(response.type).toBe(MessageType.ERROR);
            expect(response.payload.code).toBe('VALIDATION_ERROR');
            client.close();
            resolve();
          });
        });
        client.on('error', reject);
      });
    });

    it('should reject join_document without documentId', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}?token=${testToken}`);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          const message = {
            type: MessageType.JOIN_DOCUMENT,
          };

          client.send(JSON.stringify(message));

          client.on('message', (data: Buffer) => {
            const response = JSON.parse(data.toString());
            expect(response.type).toBe(MessageType.ERROR);
            expect(response.payload.code).toBe('VALIDATION_ERROR');
            client.close();
            resolve();
          });
        });
        client.on('error', reject);
      });
    });
  });

  describe('Connection cleanup', () => {
    it('should handle client disconnect', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}?token=${testToken}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => {
          expect(wsServer.getConnectionCount()).toBe(1);
          client.close();
        });

        client.on('close', () => {
          // Give server time to process disconnect
          setTimeout(() => {
            expect(wsServer.getConnectionCount()).toBe(0);
            resolve();
          }, 100);
        });
      });
    });

    it('should respond to ping with pong', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}?token=${testToken}`);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          client.ping();

          client.on('pong', () => {
            client.close();
            resolve();
          });
        });
        client.on('error', reject);
      });
    });
  });

  describe('Broadcast functionality', () => {
    it('should broadcast message to all clients', async () => {
      const client1 = new WebSocket(`ws://localhost:${serverPort}?token=${testToken}`);
      const client2 = new WebSocket(`ws://localhost:${serverPort}?token=${testToken}`);

      await Promise.all([
        new Promise<void>((resolve) => client1.on('open', () => resolve())),
        new Promise<void>((resolve) => client2.on('open', () => resolve())),
      ]);

      const receivedMessages: string[] = [];

      client1.on('message', (data: Buffer) => {
        receivedMessages.push(data.toString());
      });

      client2.on('message', (data: Buffer) => {
        receivedMessages.push(data.toString());
      });

      // Broadcast a test message
      wsServer.broadcast('test message');

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(receivedMessages.length).toBe(2);
          expect(receivedMessages[0]).toBe('test message');
          expect(receivedMessages[1]).toBe('test message');
          client1.close();
          client2.close();
          resolve();
        }, 100);
      });
    });
  });
});

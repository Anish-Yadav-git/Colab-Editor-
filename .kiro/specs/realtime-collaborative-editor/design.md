# Design Document: Real-Time Collaborative Editor

## Overview

This document describes the architecture and design for a real-time collaborative text editor built on the MERN stack. The system uses WebSocket for bidirectional communication, Yjs CRDT library for conflict-free convergence, JWT for authentication, and MongoDB for durable persistence. The design prioritizes low-latency local edits, guaranteed convergence under concurrent modifications, and graceful handling of offline scenarios.

### Technology Stack

- **Frontend**: React 18+ with TypeScript, Yjs CRDT library, y-websocket provider, Monaco Editor or Slate.js
- **Backend**: Node.js with Express, ws (WebSocket library), JWT authentication
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: WebSocket with Yjs awareness protocol for cursors/presence
- **State Management**: React Context API or Zustand for client state
- **Testing**: Jest, React Testing Library, Playwright for E2E

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ React Editor │  │ Yjs Document │  │  Awareness   │      │
│  │  Component   │◄─┤   (CRDT)     │  │  (Cursors)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │  WebSocket      │                        │
│                   │  Provider       │                        │
│                   └────────┬────────┘                        │
└────────────────────────────┼──────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Load Balancer │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│  WS Server 1   │  │  WS Server 2    │  │  WS Server N   │
│  ┌──────────┐  │  │  ┌──────────┐   │  │  ┌──────────┐  │
│  │ Room Mgr │  │  │  │ Room Mgr │   │  │  │ Room Mgr │  │
│  └────┬─────┘  │  │  └────┬─────┘   │  │  └────┬─────┘  │
│       │        │  │       │         │  │       │        │
│  ┌────▼─────┐  │  │  ┌────▼─────┐   │  │  ┌────▼─────┐  │
│  │ Yjs Sync │  │  │  │ Yjs Sync │   │  │  │ Yjs Sync │  │
│  └────┬─────┘  │  │  └────┬─────┘   │  │  └────┬─────┘  │
└───────┼────────┘  └────────┼─────────┘  └───────┼────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Redis Pub/Sub │
                    │  (Multi-server) │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│  REST API 1    │  │  REST API 2     │  │  REST API N    │
│  ┌──────────┐  │  │  ┌──────────┐   │  │  ┌──────────┐  │
│  │Auth Mdlw │  │  │  │Auth Mdlw │   │  │  │Auth Mdlw │  │
│  └────┬─────┘  │  │  └────┬─────┘   │  │  └────┬─────┘  │
│  ┌────▼─────┐  │  │  ┌────▼─────┐   │  │  ┌────▼─────┐  │
│  │Controllers│ │  │  │Controllers│  │  │  │Controllers│ │
│  └────┬─────┘  │  │  └────┬─────┘   │  │  └────┬─────┘  │
└───────┼────────┘  └────────┼─────────┘  └───────┼────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────▼────────┐
                    │    MongoDB      │
                    │  ┌───────────┐  │
                    │  │ Documents │  │
                    │  ├───────────┤  │
                    │  │Operations │  │
                    │  ├───────────┤  │
                    │  │  Users    │  │
                    │  └───────────┘  │
                    └─────────────────┘
```

### Component Responsibilities

**Client Layer:**

- React Editor Component: Renders the text editor UI (Monaco/Slate)
- Yjs Document: CRDT data structure maintaining document state
- Awareness: Tracks and broadcasts cursor positions and user presence
- WebSocket Provider: Manages connection, syncs Yjs updates bidirectionally

**Server Layer:**

- Room Manager: Manages active document sessions, user presence per room
- Yjs Sync Handler: Processes Yjs sync protocol messages, broadcasts updates
- Redis Pub/Sub: Enables cross-server communication for horizontal scaling
- REST API: Handles document CRUD, authentication, permissions
- Auth Middleware: Validates JWT tokens, enforces ACLs

**Persistence Layer:**

- MongoDB Documents Collection: Stores document metadata and periodic snapshots
- MongoDB Operations Collection: Stores operation logs for versioning
- MongoDB Users Collection: Stores user accounts and authentication data

## Components and Interfaces

### 1. Frontend Components

#### EditorContainer Component

```typescript
interface EditorContainerProps {
  documentId: string;
  userId: string;
  token: string;
  readOnly?: boolean;
}

// Responsibilities:
// - Initialize Yjs document and WebSocket provider
// - Handle connection state (connected, disconnected, syncing)
// - Render editor component with Yjs binding
// - Display connection status and active users
```

#### CollaborativeCursor Component

```typescript
interface CursorData {
  userId: string;
  userName: string;
  color: string;
  position: { line: number; column: number };
  selection?: { start: Position; end: Position };
}

// Responsibilities:
// - Subscribe to Yjs awareness updates
// - Render cursor indicators for remote users
// - Throttle cursor position updates (10/sec)
// - Assign stable colors to users
```

#### OfflineIndicator Component

```typescript
interface OfflineState {
  isOffline: boolean;
  queuedOpsCount: number;
  lastSyncTime: Date;
}

// Responsibilities:
// - Monitor WebSocket connection status
// - Display offline banner when disconnected
// - Show queued operations count
// - Trigger sync on reconnection
```

### 2. Backend Components

#### WebSocket Server

```typescript
interface WSServer {
  // Initialize WebSocket server
  initialize(httpServer: Server): void;

  // Handle new client connections
  onConnection(socket: WebSocket, request: IncomingMessage): void;

  // Authenticate WebSocket connection
  authenticateConnection(token: string): Promise<User>;

  // Join document room
  joinRoom(socket: WebSocket, documentId: string, userId: string): void;

  // Leave document room
  leaveRoom(socket: WebSocket, documentId: string, userId: string): void;

  // Broadcast message to room
  broadcastToRoom(
    documentId: string,
    message: Buffer,
    excludeSocket?: WebSocket
  ): void;
}
```

#### Room Manager

```typescript
interface Room {
  documentId: string;
  clients: Map<string, ClientInfo>;
  yjsDoc: Y.Doc;
  lastActivity: Date;
}

interface ClientInfo {
  socket: WebSocket;
  userId: string;
  userName: string;
  joinedAt: Date;
}

interface RoomManager {
  // Get or create room
  getRoom(documentId: string): Promise<Room>;

  // Add client to room
  addClient(documentId: string, socket: WebSocket, user: User): void;

  // Remove client from room
  removeClient(documentId: string, socket: WebSocket): void;

  // Get active clients in room
  getActiveClients(documentId: string): ClientInfo[];

  // Cleanup inactive rooms
  cleanupInactiveRooms(): void;
}
```

#### Persistence Service

```typescript
interface PersistenceService {
  // Save Yjs document snapshot
  saveSnapshot(documentId: string, yjsState: Uint8Array): Promise<void>;

  // Load Yjs document snapshot
  loadSnapshot(documentId: string): Promise<Uint8Array | null>;

  // Append operation to log
  appendOperation(documentId: string, operation: Operation): Promise<void>;

  // Get operations since timestamp
  getOperationsSince(documentId: string, timestamp: Date): Promise<Operation[]>;

  // Compact old operations
  compactOperations(documentId: string, beforeDate: Date): Promise<void>;

  // Get document at point in time
  getDocumentAtTime(documentId: string, timestamp: Date): Promise<Uint8Array>;
}
```

#### Document Controller

```typescript
interface DocumentController {
  // Create new document
  createDocument(req: Request, res: Response): Promise<void>;

  // Get document by ID
  getDocument(req: Request, res: Response): Promise<void>;

  // List user's documents
  listDocuments(req: Request, res: Response): Promise<void>;

  // Update document metadata
  updateDocument(req: Request, res: Response): Promise<void>;

  // Delete document
  deleteDocument(req: Request, res: Response): Promise<void>;

  // Share document with user
  shareDocument(req: Request, res: Response): Promise<void>;

  // Get document history
  getDocumentHistory(req: Request, res: Response): Promise<void>;
}
```

#### Authentication Middleware

```typescript
interface AuthMiddleware {
  // Verify JWT token
  verifyToken(req: Request, res: Response, next: NextFunction): void;

  // Check document permissions
  checkDocumentPermission(
    permission: 'read' | 'write' | 'admin'
  ): (req: Request, res: Response, next: NextFunction) => void;

  // Generate JWT token
  generateToken(user: User): string;

  // Refresh token
  refreshToken(req: Request, res: Response): Promise<void>;
}
```

## Data Models

### MongoDB Schemas

#### Document Schema

```typescript
interface DocumentSchema {
  _id: ObjectId;
  title: string;
  ownerId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  lastSnapshotAt: Date;
  snapshotData: Buffer; // Yjs state vector
  permissions: {
    userId: ObjectId;
    role: 'owner' | 'editor' | 'viewer';
  }[];
  metadata: {
    characterCount: number;
    operationCount: number;
    activeUsers: number;
  };
  isDeleted: boolean;
  deletedAt?: Date;
}
```

#### Operation Schema

```typescript
interface OperationSchema {
  _id: ObjectId;
  documentId: ObjectId;
  userId: ObjectId;
  timestamp: Date;
  operationType: 'insert' | 'delete' | 'format';
  yjsUpdate: Buffer; // Encoded Yjs update
  vectorClock: Map<string, number>; // For ordering
  metadata: {
    clientId: string;
    sessionId: string;
  };
}
```

#### User Schema

```typescript
interface UserSchema {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  lastLoginAt: Date;
  preferences: {
    editorTheme: string;
    cursorColor: string;
  };
}
```

### Client-Side Data Structures

#### Yjs Document Structure

```typescript
// Yjs document with shared types
const yjsDoc = new Y.Doc();
const yText = yjsDoc.getText('content'); // Shared text content
const yAwareness = new awarenessProtocol.Awareness(yjsDoc); // Cursor/presence

// Awareness state structure
interface AwarenessState {
  user: {
    id: string;
    name: string;
    color: string;
  };
  cursor: {
    line: number;
    column: number;
  } | null;
  selection: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  } | null;
}
```

#### Offline Queue Structure

```typescript
interface OfflineQueue {
  operations: QueuedOperation[];
  lastSyncedClock: Map<string, number>;
}

interface QueuedOperation {
  id: string;
  timestamp: Date;
  yjsUpdate: Uint8Array;
  retryCount: number;
}
```

## Error Handling

### Client-Side Error Handling

1. **Connection Errors**
   - Detect WebSocket disconnection
   - Show offline indicator
   - Queue operations in IndexedDB
   - Attempt reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s)

2. **Sync Errors**
   - If sync fails after reconnection, reload document from server
   - Preserve local changes in separate buffer
   - Prompt user to manually merge if automatic merge fails

3. **Operation Errors**
   - Validate operations before applying
   - Log malformed operations to console
   - Ignore invalid operations, continue with valid ones

### Server-Side Error Handling

1. **WebSocket Errors**
   - Catch and log all WebSocket errors with context
   - Gracefully close connections on unrecoverable errors
   - Clean up room state when client disconnects

2. **Database Errors**
   - Retry transient MongoDB errors (connection timeout, etc.)
   - Log persistent errors with full context
   - Return 500 status with generic error message (don't expose internals)

3. **Authentication Errors**
   - Return 401 for invalid/expired tokens
   - Return 403 for insufficient permissions
   - Log authentication failures for security monitoring

4. **Validation Errors**
   - Validate all incoming operations against schema
   - Reject invalid operations with descriptive error
   - Log validation failures for debugging

### Duplicate Operation Prevention

```typescript
// Server-side duplicate detection
class OperationDeduplicator {
  private recentOps: Map<string, Set<string>> = new Map();

  isDuplicate(documentId: string, operationId: string): boolean {
    const docOps = this.recentOps.get(documentId) || new Set();
    if (docOps.has(operationId)) {
      return true;
    }
    docOps.add(operationId);
    this.recentOps.set(documentId, docOps);

    // Clean up old entries after 1 minute
    setTimeout(() => docOps.delete(operationId), 60000);
    return false;
  }
}
```

## Testing Strategy

### Unit Tests

1. **CRDT Convergence Tests**

   ```typescript
   describe('Yjs CRDT Convergence', () => {
     test('concurrent inserts converge to same state', () => {
       const doc1 = new Y.Doc();
       const doc2 = new Y.Doc();

       // Apply operations in different order
       // Verify both docs converge to same final state
     });

     test('concurrent delete and insert preserve intent', () => {
       // Test specific conflict scenarios
     });
   });
   ```

2. **Operation Queue Tests**

   ```typescript
   describe('Offline Operation Queue', () => {
     test('queues operations when offline', () => {
       // Simulate offline state
       // Verify operations are queued
     });

     test('syncs queued operations on reconnect', () => {
       // Simulate reconnection
       // Verify operations are sent in order
     });
   });
   ```

3. **Permission Tests**
   ```typescript
   describe('Access Control', () => {
     test('viewer cannot edit document', () => {
       // Attempt edit with viewer role
       // Verify rejection
     });

     test('editor can edit but not delete', () => {
       // Test editor permissions
     });
   });
   ```

### Integration Tests

1. **Multi-Client Simulation**

   ```typescript
   describe('Multi-Client Editing', () => {
     test('3 clients editing concurrently converge', async () => {
       // Spawn 3 WebSocket clients
       // Each makes random edits
       // Verify all converge to same state
     });
   });
   ```

2. **Persistence Tests**
   ```typescript
   describe('Document Persistence', () => {
     test('document survives server restart', async () => {
       // Create document, make edits
       // Restart server
       // Verify document loads with correct content
     });

     test('operation log replay produces correct state', async () => {
       // Create document, make edits
       // Replay operations from log
       // Verify final state matches
     });
   });
   ```

### End-to-End Tests

1. **User Workflows**

   ```typescript
   describe('E2E User Workflows', () => {
     test('user creates, edits, and shares document', async () => {
       // Use Playwright to simulate full user flow
     });

     test('offline editing and sync', async () => {
       // Simulate network disconnection
       // Make edits offline
       // Reconnect and verify sync
     });
   });
   ```

2. **Fault Injection Tests**
   ```typescript
   describe('Fault Tolerance', () => {
     test('handles 500ms latency gracefully', async () => {
       // Inject network latency
       // Verify UI remains responsive
     });

     test('recovers from temporary server failure', async () => {
       // Kill server mid-edit
       // Restart server
       // Verify client reconnects and syncs
     });
   });
   ```

### Load Tests

1. **Concurrent Users**
   - Simulate 100 concurrent users in single document
   - Measure operation latency (target: p95 < 100ms)
   - Verify no data loss or corruption

2. **Large Documents**
   - Test with documents up to 1MB (≈500k characters)
   - Measure load time and edit responsiveness
   - Verify snapshot/compaction works correctly

3. **Operation Throughput**
   - Measure ops/second server can handle
   - Test with burst traffic patterns
   - Verify backpressure mechanisms activate correctly

## Scalability Considerations

### Horizontal Scaling

1. **Stateless API Servers**
   - REST API servers are stateless
   - Can scale horizontally behind load balancer
   - Session state stored in JWT (client-side)

2. **WebSocket Server Scaling**
   - Use Redis Pub/Sub for cross-server communication
   - Sticky sessions route user to same WS server when possible
   - If server dies, client reconnects to different server via load balancer

3. **Room Sharding**
   - Each document room exists on one WS server at a time
   - Use consistent hashing to assign documents to servers
   - Migrate rooms between servers during rebalancing

### Database Optimization

1. **Indexing Strategy**

   ```typescript
   // Documents collection
   db.documents.createIndex({ ownerId: 1, createdAt: -1 });
   db.documents.createIndex({ 'permissions.userId': 1 });

   // Operations collection
   db.operations.createIndex({ documentId: 1, timestamp: -1 });
   db.operations.createIndex(
     { documentId: 1, timestamp: 1 },
     {
       expireAfterSeconds: 2592000, // 30 days TTL
     }
   );
   ```

2. **Snapshot Strategy**
   - Create snapshot every 1000 operations
   - Store snapshot as compressed Yjs state vector
   - Compact operations older than last snapshot

3. **Read Optimization**
   - Cache recent document snapshots in Redis
   - Use MongoDB read replicas for document list queries
   - Implement pagination for large result sets

### Performance Optimizations

1. **Operation Batching**
   - Batch multiple Yjs updates into single WebSocket message
   - Flush batch every 50ms or when batch reaches 10 operations
   - Reduces network overhead significantly

2. **Cursor Throttling**
   - Throttle cursor updates to max 10/second per user
   - Use requestAnimationFrame for smooth cursor rendering
   - Debounce awareness broadcasts

3. **Lazy Loading**
   - Load document content on demand
   - Paginate document list (20 per page)
   - Lazy load user avatars and metadata

## Security Considerations

### Authentication & Authorization

1. **JWT Token Security**
   - Use RS256 algorithm (asymmetric)
   - Short expiration (15 minutes for access token)
   - Refresh token with longer expiration (7 days)
   - Store refresh token in httpOnly cookie

2. **WebSocket Authentication**
   - Require JWT token in initial WebSocket handshake
   - Validate token before allowing room join
   - Re-validate permissions on each operation

3. **Permission Enforcement**
   - Check permissions server-side for every operation
   - Never trust client-side permission checks
   - Log permission violations for security monitoring

### Data Protection

1. **Input Validation**
   - Validate all incoming operations against schema
   - Sanitize document titles and user names
   - Limit operation size (max 1MB per operation)

2. **Rate Limiting**
   - Limit operations per user (100/second)
   - Limit document creation (10/hour per user)
   - Limit WebSocket connections per IP (10 concurrent)

3. **Data Encryption**
   - Use TLS for all WebSocket and HTTP connections
   - Encrypt sensitive data at rest in MongoDB
   - Hash passwords with bcrypt (cost factor 12)

### Attack Prevention

1. **DoS Protection**
   - Implement backpressure on WebSocket connections
   - Limit document size (10MB max)
   - Limit concurrent users per document (100 max)
   - Use connection pooling for MongoDB

2. **Injection Prevention**
   - Use parameterized queries for MongoDB
   - Validate and sanitize all user input
   - Use Content Security Policy headers

3. **CSRF Protection**
   - Use SameSite cookie attribute
   - Implement CSRF tokens for state-changing operations
   - Validate Origin header on WebSocket connections

## Monitoring and Observability

### Metrics to Track

1. **Performance Metrics**
   - Operation latency (p50, p95, p99)
   - WebSocket message throughput (ops/sec)
   - Document load time
   - Snapshot creation time

2. **Business Metrics**
   - Active users per document
   - Total documents created
   - Average session duration
   - Operations per document

3. **System Metrics**
   - WebSocket connection count
   - MongoDB query latency
   - Redis pub/sub latency
   - Memory usage per room

### Logging Strategy

1. **Structured Logging**

   ```typescript
   logger.info('Operation applied', {
     correlationId: req.id,
     documentId: doc.id,
     userId: user.id,
     operationType: 'insert',
     latencyMs: 45,
     timestamp: new Date().toISOString(),
   });
   ```

2. **Log Levels**
   - ERROR: Unrecoverable errors, data corruption
   - WARN: Recoverable errors, permission violations
   - INFO: Normal operations, user actions
   - DEBUG: Detailed operation data, state transitions

3. **Correlation IDs**
   - Generate unique ID for each request
   - Pass correlation ID through all layers
   - Include in all log messages for tracing

### Health Checks

1. **Liveness Probe**

   ```typescript
   app.get('/health/live', (req, res) => {
     res.status(200).json({ status: 'ok' });
   });
   ```

2. **Readiness Probe**

   ```typescript
   app.get('/health/ready', async (req, res) => {
     const dbOk = await checkMongoConnection();
     const redisOk = await checkRedisConnection();

     if (dbOk && redisOk) {
       res.status(200).json({ status: 'ready' });
     } else {
       res.status(503).json({ status: 'not ready' });
     }
   });
   ```

3. **Metrics Endpoint**
   ```typescript
   app.get('/metrics', (req, res) => {
     res.set('Content-Type', 'text/plain');
     res.send(prometheusRegistry.metrics());
   });
   ```

## Deployment Architecture

### Development Environment

- Single Node.js server with WebSocket and REST API
- Local MongoDB instance
- Local Redis instance
- React dev server with hot reload

### Production Environment

- Multiple Node.js instances behind load balancer (NGINX/ALB)
- MongoDB Atlas cluster (3-node replica set)
- Redis cluster for pub/sub
- CDN for static assets
- SSL/TLS termination at load balancer
- Container orchestration (Docker + Kubernetes)

### CI/CD Pipeline

1. Run unit tests and linting
2. Build Docker images
3. Run integration tests against test environment
4. Deploy to staging environment
5. Run E2E tests
6. Manual approval gate
7. Blue-green deployment to production
8. Monitor metrics for 15 minutes
9. Automatic rollback if error rate exceeds threshold

## Future Enhancements

1. **Rich Text Formatting**
   - Support for bold, italic, headings
   - Use Yjs XmlFragment for structured content
   - Extend awareness protocol for format selections

2. **Comments and Annotations**
   - Thread-based comments on text ranges
   - Resolve/unresolve comment threads
   - Notifications for mentions

3. **Version History UI**
   - Visual timeline of document changes
   - Diff view between versions
   - Restore to previous version

4. **Presence Indicators**
   - Show user avatars in document
   - Display "User is typing..." indicators
   - Show user activity status (active, idle, away)

5. **Conflict Resolution UI**
   - Visual indicators for conflicting edits
   - Manual conflict resolution interface
   - Undo/redo with conflict awareness

6. **Mobile Support**
   - Responsive editor for tablets
   - Touch-optimized cursor controls
   - Offline-first mobile app

7. **Export/Import**
   - Export to Markdown, PDF, DOCX
   - Import from various formats
   - Preserve formatting during conversion

8. **Advanced Permissions**
   - Granular permissions (comment-only, suggest-only)
   - Time-limited access links
   - Public sharing with view-only mode

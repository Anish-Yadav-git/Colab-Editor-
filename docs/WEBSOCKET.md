# WebSocket Protocol Documentation

## Overview

This document describes the WebSocket protocol used for real-time collaborative editing. The protocol is based on the Yjs CRDT library and uses binary encoding for efficient data transmission.

---

## Connection

### Establishing Connection

**WebSocket URL:** `ws://localhost:3001` (development) or `wss://your-domain.com` (production)

**Query Parameters:**
- `token` (required): JWT access token for authentication
- `documentId` (required): MongoDB ObjectId of the document to join

**Example:**

```javascript
const ws = new WebSocket(
  `ws://localhost:3001?token=${accessToken}&documentId=${documentId}`
);
```

### Connection Lifecycle

1. **Handshake:**
   - Client initiates WebSocket connection with token and documentId
   - Server validates JWT token
   - Server checks user permissions for document
   - Server accepts or rejects connection

2. **Initial Sync:**
   - Server sends Yjs sync step 1 (state vector request)
   - Client responds with its state vector
   - Server sends sync step 2 (missing updates)
   - Client applies updates and is now synced

3. **Real-time Updates:**
   - Client sends incremental updates as user edits
   - Server broadcasts updates to all clients in room
   - Server persists updates to MongoDB

4. **Disconnection:**
   - Client or server closes connection
   - Server removes client from room
   - Server cleans up awareness state

---

## Message Format

All messages use Yjs binary encoding. The first byte indicates the message type:

### Message Types

| Type | Value | Description |
|------|-------|-------------|
| Sync | 0 | Document synchronization messages |
| Awareness | 1 | Cursor and presence updates |

---

## Sync Protocol

### Sync Step 1: State Vector Exchange

**Direction:** Server → Client (on connection) or Client → Server

**Purpose:** Request missing updates from peer

**Message Structure:**
```
[messageType: 0, syncType: 0, stateVector: Uint8Array]
```

**Flow:**
1. Server sends its state vector to client
2. Client compares with its own state
3. Client identifies missing updates

### Sync Step 2: Document Update

**Direction:** Server → Client or Client → Server

**Purpose:** Send missing updates to sync document state

**Message Structure:**
```
[messageType: 0, syncType: 1, update: Uint8Array]
```

**Flow:**
1. Peer sends encoded Yjs updates
2. Receiver applies updates to local Yjs document
3. Document states are now synchronized

### Incremental Updates

**Direction:** Bidirectional

**Purpose:** Broadcast real-time edits

**Message Structure:**
```
[messageType: 0, syncType: 2, update: Uint8Array]
```

**Flow:**
1. User makes edit in local editor
2. Yjs generates update
3. Client sends update via WebSocket
4. Server broadcasts to all clients in room
5. Server persists update to MongoDB
6. Other clients apply update to their documents

---

## Awareness Protocol

### Awareness Updates

**Direction:** Bidirectional

**Purpose:** Share cursor positions, selections, and user presence

**Message Structure:**
```
[messageType: 1, awarenessUpdate: Uint8Array]
```

**Awareness State Format:**

```typescript
interface AwarenessState {
  user: {
    id: string;           // User ID
    name: string;         // Display name
    color: string;        // Hex color for cursor/selection
  };
  cursor: {
    line: number;         // Cursor line number
    column: number;       // Cursor column number
  } | null;
  selection: {
    start: {
      line: number;
      column: number;
    };
    end: {
      line: number;
      column: number;
    };
  } | null;
}
```

**Throttling:**
- Cursor updates are throttled to 10 per second
- Prevents network congestion
- Maintains smooth visual experience

**Cleanup:**
- Awareness state removed on disconnect
- Inactive cursors fade after 30 seconds
- Server broadcasts removal to all clients

---

## Implementation Examples

### Client-Side (JavaScript/TypeScript)

#### Basic WebSocket Connection

```javascript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Create Yjs document
const yjsDoc = new Y.Doc();

// Create WebSocket provider
const provider = new WebsocketProvider(
  'ws://localhost:3001',
  documentId,
  yjsDoc,
  {
    params: { token: accessToken },
    connect: true,
    awareness: new awarenessProtocol.Awareness(yjsDoc),
  }
);

// Monitor connection status
provider.on('status', ({ status }) => {
  console.log('Status:', status);
  // 'connecting' | 'connected' | 'disconnected'
});

provider.on('sync', (isSynced) => {
  console.log('Synced:', isSynced);
});

// Get shared text type
const yText = yjsDoc.getText('content');

// Listen to changes
yText.observe((event) => {
  console.log('Changes:', event.changes);
});

// Make changes
yText.insert(0, 'Hello, world!');
```

#### Awareness Integration

```javascript
import { Awareness } from 'y-protocols/awareness';

const awareness = provider.awareness;

// Set local awareness state
awareness.setLocalState({
  user: {
    id: userId,
    name: userName,
    color: userColor,
  },
  cursor: {
    line: 10,
    column: 25,
  },
  selection: null,
});

// Listen to awareness changes
awareness.on('change', ({ added, updated, removed }) => {
  // Handle remote cursor updates
  added.forEach((clientId) => {
    const state = awareness.getStates().get(clientId);
    console.log('User joined:', state);
  });

  updated.forEach((clientId) => {
    const state = awareness.getStates().get(clientId);
    console.log('User updated:', state);
  });

  removed.forEach((clientId) => {
    console.log('User left:', clientId);
  });
});

// Update cursor position (throttled)
const updateCursor = throttle((line, column) => {
  const currentState = awareness.getLocalState();
  awareness.setLocalState({
    ...currentState,
    cursor: { line, column },
  });
}, 100); // 10 updates per second
```

#### Monaco Editor Integration

```javascript
import { MonacoBinding } from 'y-monaco';
import * as monaco from 'monaco-editor';

// Create Monaco editor
const editor = monaco.editor.create(document.getElementById('editor'), {
  value: '',
  language: 'plaintext',
});

// Bind Yjs to Monaco
const binding = new MonacoBinding(
  yText,
  editor.getModel(),
  new Set([editor]),
  awareness
);

// Cursor updates are handled automatically by MonacoBinding
```

---

### Server-Side (Node.js/TypeScript)

#### WebSocket Server Setup

```typescript
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection } from 'y-websocket/bin/utils';

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', async (ws, req) => {
  try {
    // Parse query parameters
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const documentId = url.searchParams.get('documentId');

    // Validate token
    const user = await authenticateToken(token);
    if (!user) {
      ws.close(1008, 'Authentication failed');
      return;
    }

    // Check document permissions
    const hasAccess = await checkDocumentAccess(user.id, documentId);
    if (!hasAccess) {
      ws.close(1008, 'Access denied');
      return;
    }

    // Setup Yjs connection
    setupWSConnection(ws, req, {
      docName: documentId,
      gc: true,
    });

    // Add to room
    await roomManager.addClient(documentId, ws, user);

    // Handle disconnect
    ws.on('close', () => {
      roomManager.removeClient(documentId, ws);
    });
  } catch (error) {
    console.error('Connection error:', error);
    ws.close(1011, 'Internal server error');
  }
});
```

#### Room Management

```typescript
class Room {
  documentId: string;
  clients: Map<string, ClientInfo>;
  yjsDoc: Y.Doc;
  awareness: Awareness;

  constructor(documentId: string) {
    this.documentId = documentId;
    this.clients = new Map();
    this.yjsDoc = new Y.Doc();
    this.awareness = new Awareness(this.yjsDoc);

    // Listen to document updates
    this.yjsDoc.on('update', async (update: Uint8Array, origin: any) => {
      // Persist to MongoDB
      await persistenceService.appendOperation(documentId, update);

      // Broadcast to other clients
      this.broadcast(update, origin);
    });

    // Listen to awareness updates
    this.awareness.on('update', ({ added, updated, removed }, origin) => {
      // Broadcast awareness changes
      const awarenessUpdate = encodeAwarenessUpdate(
        this.awareness,
        [...added, ...updated, ...removed]
      );
      this.broadcast(awarenessUpdate, origin);
    });
  }

  addClient(ws: WebSocket, user: User): void {
    const clientId = generateClientId();
    this.clients.set(clientId, { ws, user });

    // Send initial sync
    this.syncClient(ws);
  }

  removeClient(ws: WebSocket): void {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws === ws) {
        this.clients.delete(clientId);
        this.awareness.removeState(clientId);
        break;
      }
    }
  }

  broadcast(message: Uint8Array, excludeOrigin?: any): void {
    this.clients.forEach((client) => {
      if (client.ws !== excludeOrigin && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  syncClient(ws: WebSocket): void {
    // Send state vector
    const stateVector = Y.encodeStateVector(this.yjsDoc);
    ws.send(createSyncMessage(0, stateVector));
  }
}
```

---

## Error Handling

### Connection Errors

**Authentication Failure:**
```
Close Code: 1008 (Policy Violation)
Reason: "Authentication failed"
```

**Access Denied:**
```
Close Code: 1008 (Policy Violation)
Reason: "Access denied"
```

**Invalid Document:**
```
Close Code: 1008 (Policy Violation)
Reason: "Document not found"
```

**Server Error:**
```
Close Code: 1011 (Internal Error)
Reason: "Internal server error"
```

### Message Errors

**Malformed Message:**
- Server logs error
- Message is ignored
- Connection remains open

**Rate Limit Exceeded:**
- Server disconnects client
- Close code: 1008
- Reason: "Rate limit exceeded"

---

## Performance Considerations

### Message Batching

Updates are batched to reduce network overhead:
- Multiple rapid edits combined into single message
- Flush every 50ms or when 10 operations accumulated
- Reduces message count by 70-90%

### Compression

- Yjs uses efficient binary encoding
- Updates are typically 10-100 bytes
- State vectors are compact (proportional to number of clients)

### Backpressure

Server monitors WebSocket buffer:
```typescript
if (ws.bufferedAmount > 1024 * 1024) {
  // 1MB buffer threshold
  console.warn('Backpressure detected');
  // Slow down or disconnect client
}
```

---

## Security

### Authentication

- JWT token required in connection URL
- Token validated on handshake
- Invalid tokens rejected immediately

### Authorization

- Document permissions checked before connection
- Viewer role: Read-only access
- Editor role: Read and write access
- Owner role: Full access including sharing

### Rate Limiting

- Maximum 100 operations per second per client
- Excessive clients disconnected automatically
- Prevents DoS attacks

### Input Validation

- Message size limited to 1MB
- Malformed messages rejected
- Document size limited to 10MB

---

## Monitoring

### Metrics

Track these metrics for WebSocket connections:

- **Active Connections:** Current number of WebSocket connections
- **Messages Per Second:** Rate of messages processed
- **Operation Latency:** Time from client send to broadcast
- **Sync Time:** Time to complete initial sync
- **Error Rate:** Failed connections or messages

### Logging

Log these events:

```typescript
// Connection events
logger.info('WebSocket connected', {
  userId,
  documentId,
  clientId,
});

// Operation events
logger.debug('Operation received', {
  documentId,
  userId,
  operationType,
  size: update.length,
});

// Error events
logger.error('WebSocket error', {
  userId,
  documentId,
  error: error.message,
});
```

---

## Testing

### Manual Testing

Use `wscat` for manual WebSocket testing:

```bash
npm install -g wscat

wscat -c "ws://localhost:3001?token=YOUR_TOKEN&documentId=DOCUMENT_ID"
```

### Automated Testing

```javascript
import WebSocket from 'ws';

describe('WebSocket Protocol', () => {
  it('should connect and sync', (done) => {
    const ws = new WebSocket(
      `ws://localhost:3001?token=${token}&documentId=${docId}`
    );

    ws.on('open', () => {
      console.log('Connected');
    });

    ws.on('message', (data) => {
      const message = new Uint8Array(data);
      const messageType = message[0];

      if (messageType === 0) {
        // Sync message
        console.log('Received sync message');
        done();
      }
    });

    ws.on('error', (error) => {
      done(error);
    });
  });
});
```

---

## Troubleshooting

### Connection Issues

**Problem:** Connection immediately closes

**Solutions:**
- Check JWT token is valid and not expired
- Verify documentId exists and user has access
- Check server logs for authentication errors

**Problem:** Connection established but no sync

**Solutions:**
- Verify Yjs document is properly initialized
- Check browser console for JavaScript errors
- Ensure WebSocket provider is connected

### Sync Issues

**Problem:** Changes not appearing for other users

**Solutions:**
- Verify WebSocket connection is open
- Check network tab for outgoing messages
- Ensure Yjs document is bound to editor
- Check server logs for broadcast errors

**Problem:** Document state diverges

**Solutions:**
- Reload page to force full sync
- Check for JavaScript errors in console
- Verify Yjs version compatibility
- Check for duplicate operation IDs

### Performance Issues

**Problem:** High latency or lag

**Solutions:**
- Check network latency (ping server)
- Verify server is not overloaded
- Check for rate limiting
- Reduce cursor update frequency

---

## References

- [Yjs Documentation](https://docs.yjs.dev/)
- [y-websocket Provider](https://github.com/yjs/y-websocket)
- [Awareness Protocol](https://github.com/yjs/y-protocols)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

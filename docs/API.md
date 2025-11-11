# API Documentation

## Overview

This document provides comprehensive documentation for the Real-Time Collaborative Editor REST API and WebSocket protocol.

**Base URL:** `http://localhost:3001/api` (development)

**Authentication:** JWT Bearer tokens required for most endpoints

**Content-Type:** `application/json`

---

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [Document Management Endpoints](#document-management-endpoints)
3. [Health Check Endpoints](#health-check-endpoints)
4. [WebSocket Protocol](#websocket-protocol)
5. [Error Responses](#error-responses)
6. [Rate Limits](#rate-limits)

---

## Authentication Endpoints

### Register New User

Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Authentication:** None required

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Validation Rules:**
- `email`: Valid email format, unique
- `password`: Minimum 8 characters
- `name`: 1-100 characters

**Success Response (201 Created):**

```json
{
  "message": "User registered successfully",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-01-15T10:30:00.000Z"
  },
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

- `400 Bad Request`: Invalid input or validation error
- `409 Conflict`: Email already exists
- `500 Internal Server Error`: Server error

**Example:**

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "name": "John Doe"
  }'
```

---

### Login

Authenticate with existing credentials.

**Endpoint:** `POST /api/auth/login`

**Authentication:** None required

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Success Response (200 OK):**

```json
{
  "message": "Login successful",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "preferences": {
      "editorTheme": "light",
      "cursorColor": "#4A90E2"
    }
  },
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

- `400 Bad Request`: Missing email or password
- `401 Unauthorized`: Invalid credentials
- `500 Internal Server Error`: Server error

**Example:**

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'
```

---

### Refresh Token

Obtain a new access token using a refresh token.

**Endpoint:** `POST /api/auth/refresh`

**Authentication:** None required (refresh token in body)

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200 OK):**

```json
{
  "message": "Token refreshed successfully",
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

- `400 Bad Request`: Missing refresh token
- `401 Unauthorized`: Invalid or expired refresh token
- `500 Internal Server Error`: Server error

**Example:**

```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

---

### Get Current User

Retrieve the authenticated user's profile.

**Endpoint:** `GET /api/auth/me`

**Authentication:** Required (Bearer token)

**Success Response (200 OK):**

```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "preferences": {
      "editorTheme": "light",
      "cursorColor": "#4A90E2"
    },
    "createdAt": "2025-01-15T10:30:00.000Z",
    "lastLoginAt": "2025-01-16T14:20:00.000Z"
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

**Example:**

```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Document Management Endpoints

### Create Document

Create a new collaborative document.

**Endpoint:** `POST /api/documents`

**Authentication:** Required (Bearer token)

**Request Body:**

```json
{
  "title": "My New Document"
}
```

**Validation Rules:**
- `title`: Required, 1-200 characters, non-empty after trimming

**Success Response (201 Created):**

```json
{
  "id": "507f1f77bcf86cd799439012",
  "title": "My New Document",
  "ownerId": "507f1f77bcf86cd799439011",
  "createdAt": "2025-01-16T15:00:00.000Z",
  "updatedAt": "2025-01-16T15:00:00.000Z",
  "permissions": [
    {
      "userId": "507f1f77bcf86cd799439011",
      "role": "owner"
    }
  ],
  "metadata": {
    "characterCount": 0,
    "operationCount": 0,
    "activeUsers": 0
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid title
- `401 Unauthorized`: Missing or invalid token
- `500 Internal Server Error`: Server error

**Example:**

```bash
curl -X POST http://localhost:3001/api/documents \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My New Document"
  }'
```

---

### Get Document

Retrieve a document by ID.

**Endpoint:** `GET /api/documents/:id`

**Authentication:** Required (Bearer token)

**URL Parameters:**
- `id`: Document ID (MongoDB ObjectId)

**Success Response (200 OK):**

```json
{
  "id": "507f1f77bcf86cd799439012",
  "title": "My New Document",
  "ownerId": "507f1f77bcf86cd799439011",
  "createdAt": "2025-01-16T15:00:00.000Z",
  "updatedAt": "2025-01-16T15:30:00.000Z",
  "lastSnapshotAt": "2025-01-16T15:30:00.000Z",
  "permissions": [
    {
      "userId": "507f1f77bcf86cd799439011",
      "role": "owner"
    },
    {
      "userId": "507f1f77bcf86cd799439013",
      "role": "editor"
    }
  ],
  "metadata": {
    "characterCount": 1250,
    "operationCount": 45,
    "activeUsers": 2
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid document ID format
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Document not found or access denied
- `500 Internal Server Error`: Server error

**Example:**

```bash
curl -X GET http://localhost:3001/api/documents/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### List Documents

List all documents accessible to the authenticated user with pagination.

**Endpoint:** `GET /api/documents`

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `page` (optional): Page number (default: 1, min: 1)
- `limit` (optional): Items per page (default: 20, min: 1, max: 100)

**Success Response (200 OK):**

```json
{
  "documents": [
    {
      "id": "507f1f77bcf86cd799439012",
      "title": "My New Document",
      "ownerId": "507f1f77bcf86cd799439011",
      "createdAt": "2025-01-16T15:00:00.000Z",
      "updatedAt": "2025-01-16T15:30:00.000Z",
      "lastSnapshotAt": "2025-01-16T15:30:00.000Z",
      "permissions": [
        {
          "userId": "507f1f77bcf86cd799439011",
          "role": "owner"
        }
      ],
      "metadata": {
        "characterCount": 1250,
        "operationCount": 45,
        "activeUsers": 2
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid pagination parameters
- `401 Unauthorized`: Missing or invalid token
- `500 Internal Server Error`: Server error

**Example:**

```bash
curl -X GET "http://localhost:3001/api/documents?page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Update Document

Update document metadata (title).

**Endpoint:** `PATCH /api/documents/:id`

**Authentication:** Required (Bearer token)

**URL Parameters:**
- `id`: Document ID (MongoDB ObjectId)

**Request Body:**

```json
{
  "title": "Updated Document Title"
}
```

**Validation Rules:**
- `title`: 1-200 characters, non-empty after trimming

**Success Response (200 OK):**

```json
{
  "id": "507f1f77bcf86cd799439012",
  "title": "Updated Document Title",
  "ownerId": "507f1f77bcf86cd799439011",
  "createdAt": "2025-01-16T15:00:00.000Z",
  "updatedAt": "2025-01-16T16:00:00.000Z",
  "lastSnapshotAt": "2025-01-16T15:30:00.000Z",
  "permissions": [
    {
      "userId": "507f1f77bcf86cd799439011",
      "role": "owner"
    }
  ],
  "metadata": {
    "characterCount": 1250,
    "operationCount": 45,
    "activeUsers": 2
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid document ID or title
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Document not found
- `500 Internal Server Error`: Server error

**Example:**

```bash
curl -X PATCH http://localhost:3001/api/documents/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Document Title"
  }'
```

---

### Delete Document

Soft delete a document (marks as deleted, doesn't remove from database).

**Endpoint:** `DELETE /api/documents/:id`

**Authentication:** Required (Bearer token)

**URL Parameters:**
- `id`: Document ID (MongoDB ObjectId)

**Success Response (200 OK):**

```json
{
  "message": "Document deleted successfully",
  "id": "507f1f77bcf86cd799439012"
}
```

**Error Responses:**

- `400 Bad Request`: Invalid document ID
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Document not found
- `500 Internal Server Error`: Server error

**Example:**

```bash
curl -X DELETE http://localhost:3001/api/documents/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Share Document

Grant permissions to another user for a document.

**Endpoint:** `POST /api/documents/:id/share`

**Authentication:** Required (Bearer token)

**URL Parameters:**
- `id`: Document ID (MongoDB ObjectId)

**Request Body:**

```json
{
  "email": "collaborator@example.com",
  "role": "editor"
}
```

**Validation Rules:**
- `email`: Valid email format, must exist in system
- `role`: One of `owner`, `editor`, `viewer`

**Success Response (200 OK):**

```json
{
  "message": "Document shared successfully",
  "documentId": "507f1f77bcf86cd799439012",
  "sharedWith": {
    "userId": "507f1f77bcf86cd799439013",
    "email": "collaborator@example.com",
    "name": "Jane Smith",
    "role": "editor"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid document ID, email, or role
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Document or user not found
- `500 Internal Server Error`: Server error

**Example:**

```bash
curl -X POST http://localhost:3001/api/documents/507f1f77bcf86cd799439012/share \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "collaborator@example.com",
    "role": "editor"
  }'
```

---

### Get Document History

Retrieve operation log for a document with pagination and date filtering.

**Endpoint:** `GET /api/documents/:id/history`

**Authentication:** Required (Bearer token)

**URL Parameters:**
- `id`: Document ID (MongoDB ObjectId)

**Query Parameters:**
- `page` (optional): Page number (default: 1, min: 1)
- `limit` (optional): Items per page (default: 50, min: 1, max: 100)
- `startDate` (optional): Filter operations after this date (ISO 8601 format)
- `endDate` (optional): Filter operations before this date (ISO 8601 format)

**Success Response (200 OK):**

```json
{
  "operations": [
    {
      "id": "507f1f77bcf86cd799439014",
      "documentId": "507f1f77bcf86cd799439012",
      "userId": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "email": "user@example.com"
      },
      "timestamp": "2025-01-16T15:30:00.000Z",
      "operationType": "insert",
      "metadata": {
        "clientId": "client-abc123",
        "sessionId": "session-xyz789"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 45,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  },
  "filters": {
    "startDate": "2025-01-16T00:00:00.000Z",
    "endDate": "2025-01-17T00:00:00.000Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid document ID, pagination, or date parameters
- `401 Unauthorized`: Missing or invalid token
- `500 Internal Server Error`: Server error

**Example:**

```bash
curl -X GET "http://localhost:3001/api/documents/507f1f77bcf86cd799439012/history?page=1&limit=50&startDate=2025-01-16T00:00:00.000Z" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Health Check Endpoints

### Liveness Probe

Check if the server is running.

**Endpoint:** `GET /health/live`

**Authentication:** None required

**Success Response (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2025-01-16T15:00:00.000Z"
}
```

**Example:**

```bash
curl -X GET http://localhost:3001/health/live
```

---

### Readiness Probe

Check if the server is ready to accept traffic (MongoDB and Redis connections).

**Endpoint:** `GET /health/ready`

**Authentication:** None required

**Success Response (200 OK):**

```json
{
  "status": "ready",
  "timestamp": "2025-01-16T15:00:00.000Z",
  "checks": {
    "mongodb": true,
    "redis": true
  }
}
```

**Error Response (503 Service Unavailable):**

```json
{
  "status": "not ready",
  "timestamp": "2025-01-16T15:00:00.000Z",
  "checks": {
    "mongodb": false,
    "redis": true
  }
}
```

**Example:**

```bash
curl -X GET http://localhost:3001/health/ready
```

---

### Metrics

Prometheus metrics endpoint.

**Endpoint:** `GET /metrics`

**Authentication:** None required

**Success Response (200 OK):**

Returns Prometheus text format metrics.

**Example:**

```bash
curl -X GET http://localhost:3001/metrics
```

---

## WebSocket Protocol

### Connection

**URL:** `ws://localhost:3001?token=<JWT_TOKEN>&documentId=<DOCUMENT_ID>`

**Query Parameters:**
- `token`: JWT access token for authentication
- `documentId`: Document ID to join

**Connection Flow:**

1. Client connects with JWT token and document ID
2. Server validates token and permissions
3. Server sends initial sync message (Yjs state vector)
4. Client sends its state vector
5. Server sends missing updates
6. Connection established, real-time sync begins

**Example (JavaScript):**

```javascript
const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';
const documentId = '507f1f77bcf86cd799439012';
const ws = new WebSocket(
  `ws://localhost:3001?token=${token}&documentId=${documentId}`
);

ws.onopen = () => {
  console.log('Connected to document');
};

ws.onmessage = (event) => {
  // Handle Yjs sync messages
  const message = new Uint8Array(event.data);
  // Process with Yjs
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from document');
};
```

---

### Message Types

The WebSocket protocol uses Yjs binary encoding for all messages. Messages are categorized by their first byte:

#### Sync Messages (messageType: 0)

**Sync Step 1 - State Vector:**
- Client sends its current state vector
- Server responds with missing updates

**Sync Step 2 - Update:**
- Server sends document updates to sync client

**Update Message:**
- Incremental document changes
- Broadcast to all clients in room

#### Awareness Messages (messageType: 1)

**Awareness Update:**
- Cursor position and selection
- User presence information
- Throttled to 10 updates/second

**Awareness State Structure:**

```javascript
{
  user: {
    id: "507f1f77bcf86cd799439011",
    name: "John Doe",
    color: "#4A90E2"
  },
  cursor: {
    line: 10,
    column: 25
  },
  selection: {
    start: { line: 10, column: 25 },
    end: { line: 10, column: 35 }
  }
}
```

---

### Using with Yjs

**Recommended Setup:**

```javascript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const yjsDoc = new Y.Doc();
const provider = new WebsocketProvider(
  'ws://localhost:3001',
  documentId,
  yjsDoc,
  {
    params: { token: accessToken },
  }
);

// Listen to sync status
provider.on('status', (event) => {
  console.log('Connection status:', event.status);
  // 'connecting' | 'connected' | 'disconnected'
});

provider.on('sync', (isSynced) => {
  console.log('Document synced:', isSynced);
});

// Get shared text
const yText = yjsDoc.getText('content');

// Listen to changes
yText.observe((event) => {
  console.log('Text changed:', event);
});

// Make changes
yText.insert(0, 'Hello, world!');
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message"
}
```

### Common HTTP Status Codes

- `200 OK`: Request succeeded
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters or validation error
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Service temporarily unavailable

### Error Examples

**Validation Error (400):**

```json
{
  "error": "Validation error",
  "message": "Title must be between 1 and 200 characters"
}
```

**Authentication Error (401):**

```json
{
  "error": "Authentication failed",
  "message": "Invalid email or password"
}
```

**Permission Error (403):**

```json
{
  "error": "Forbidden",
  "message": "You do not have permission to edit this document"
}
```

**Not Found Error (404):**

```json
{
  "error": "Not found",
  "message": "Document not found or access denied"
}
```

---

## Rate Limits

### REST API Rate Limits

- **General API requests:** 100 requests per minute per IP
- **Document creation:** 10 documents per hour per user
- **Authentication attempts:** 5 failed attempts per 15 minutes per IP

### WebSocket Rate Limits

- **Operations per second:** 100 ops/sec per connection
- **Connections per IP:** 10 concurrent connections
- **Message size:** Maximum 1MB per operation

**Rate Limit Response (429 Too Many Requests):**

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

---

## Authentication Flow

### Complete Authentication Flow

1. **Register or Login:**
   - Call `POST /api/auth/register` or `POST /api/auth/login`
   - Receive `accessToken` (15 min expiry) and `refreshToken` (7 days expiry)

2. **Make Authenticated Requests:**
   - Include `Authorization: Bearer <accessToken>` header
   - Access token valid for 15 minutes

3. **Token Refresh:**
   - When access token expires (401 response)
   - Call `POST /api/auth/refresh` with refresh token
   - Receive new access token

4. **WebSocket Connection:**
   - Use access token in WebSocket URL query parameter
   - Connection authenticated on handshake

### Token Storage Recommendations

- **Access Token:** Store in memory (React state/context)
- **Refresh Token:** Store in httpOnly cookie (server-side) or secure storage
- **Never:** Store tokens in localStorage (XSS vulnerability)

---

## Postman Collection

A Postman collection is available for testing all API endpoints:

**Import URL:** `docs/postman_collection.json`

The collection includes:
- Pre-configured environment variables
- All authentication endpoints
- All document management endpoints
- Health check endpoints
- Example requests with sample data
- Automated token refresh scripts

---

## Additional Resources

- [WebSocket Protocol Details](./WEBSOCKET.md)
- [Authentication Guide](../server/src/docs/AUTHENTICATION.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Troubleshooting Guide](../README.md#troubleshooting)

---

## Support

For issues or questions:
- GitHub Issues: [Project Repository]
- Documentation: [README.md](../README.md)
- API Status: `GET /health/ready`

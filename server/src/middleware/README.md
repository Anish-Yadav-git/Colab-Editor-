# Authentication Middleware

This module provides Express middleware for JWT authentication and document permission enforcement.

## Middleware Functions

### `verifyToken`

Verifies JWT token and attaches user information to the request object.

**Features:**
- Extracts token from `Authorization: Bearer <token>` header
- Validates JWT signature and expiration
- Verifies user still exists in database
- Attaches user info to `req.user`

**Error Handling:**
- 401: No token provided
- 401: Token expired (with specific message for refresh)
- 401: Invalid token (malformed or invalid signature)
- 401: User not found in database
- 500: Unexpected authentication errors

**Usage:**
```typescript
import { verifyToken } from './middleware/auth.js';

app.get('/api/protected', verifyToken, (req, res) => {
  // req.user is available here
  res.json({ userId: req.user.userId });
});
```

### `checkDocumentPermission(requiredPermission)`

Middleware factory that checks if authenticated user has required permission level for a document.

**Permission Levels:**
- `read`: Viewer, Editor, and Owner can access
- `write`: Editor and Owner can access
- `admin`: Only Owner can access

**Features:**
- Validates user is authenticated
- Fetches document from database
- Checks if document is deleted
- Enforces role-based access control (RBAC)
- Supports document ID from `req.params.id` or `req.params.documentId`

**Error Handling:**
- 401: User not authenticated
- 400: Document ID missing
- 404: Document not found
- 404: Document has been deleted
- 403: Insufficient permissions
- 500: Database or permission check errors

**Usage:**
```typescript
import { verifyToken, checkDocumentPermission } from './middleware/auth.js';

// Require read permission
app.get('/api/documents/:id', 
  verifyToken, 
  checkDocumentPermission('read'), 
  (req, res) => {
    // User has read permission
  }
);

// Require write permission
app.patch('/api/documents/:id', 
  verifyToken, 
  checkDocumentPermission('write'), 
  (req, res) => {
    // User has write permission
  }
);

// Require admin permission
app.delete('/api/documents/:id', 
  verifyToken, 
  checkDocumentPermission('admin'), 
  (req, res) => {
    // User has admin permission (owner only)
  }
);
```

### `optionalAuth`

Optional authentication middleware that attaches user info if token is present, but doesn't require it.

**Features:**
- Silently fails if no token or invalid token
- Useful for endpoints that work for both authenticated and anonymous users

**Usage:**
```typescript
import { optionalAuth } from './middleware/auth.js';

app.get('/api/public-documents', optionalAuth, (req, res) => {
  // req.user may or may not be present
  const userId = req.user?.userId;
});
```

## Requirements Coverage

This implementation satisfies the following requirements:

- **Requirement 7.1**: Verifies JWT authentication token for document access
- **Requirement 7.2**: Enforces role-based access control (owner, editor, viewer)
- **Requirement 7.3**: Rejects viewer edit attempts with appropriate error
- **Requirement 7.4**: Validates ACLs server-side before allowing operations

## Testing

Comprehensive test suite available at `server/src/tests/middleware/auth.test.ts` covering:

- Token extraction and validation
- Expired token handling
- Invalid token handling
- User not found scenarios
- Permission enforcement for all roles
- Document not found scenarios
- Deleted document handling
- Error handling for database failures

Run tests with:
```bash
npm test -- src/tests/middleware/auth.test.ts
```

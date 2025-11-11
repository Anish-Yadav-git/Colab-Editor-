# Authentication System Documentation

## Overview

The authentication system implements JWT-based authentication with access and refresh tokens. It provides secure user registration, login, and token refresh capabilities with rate limiting and comprehensive error handling.

## Architecture

### Components

1. **AuthService** (`services/authService.ts`)
   - Token generation and verification
   - Token extraction from headers
   - Supports both access and refresh tokens

2. **Auth Middleware** (`middleware/auth.ts`)
   - `verifyToken`: Validates JWT and attaches user to request
   - `checkDocumentPermission`: Enforces document-level ACLs
   - `optionalAuth`: Optional authentication for public endpoints

3. **Auth Controller** (`controllers/authController.ts`)
   - `register`: Create new user account
   - `login`: Authenticate and return tokens
   - `refresh`: Refresh access token
   - `getCurrentUser`: Get authenticated user profile

4. **Auth Routes** (`routes/auth.ts`)
   - Defines API endpoints with rate limiting
   - Applies appropriate middleware

## API Endpoints

### POST /api/auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

**Rate Limit:** 3 requests per hour per IP

### POST /api/auth/login

Authenticate with existing credentials.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "preferences": {
      "editorTheme": "light",
      "cursorColor": "#000000"
    }
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

**Rate Limit:** 5 requests per 15 minutes per IP

### POST /api/auth/refresh

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response (200):**
```json
{
  "message": "Token refreshed successfully",
  "accessToken": "eyJhbGc..."
}
```

### GET /api/auth/me

Get current authenticated user profile.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "preferences": {
      "editorTheme": "light",
      "cursorColor": "#000000"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastLoginAt": "2024-01-01T12:00:00.000Z"
  }
}
```

## Using Authentication Middleware

### Protect Routes with Authentication

```typescript
import { verifyToken } from './middleware/auth.js';

router.get('/protected', verifyToken, (req, res) => {
  // req.user is available here
  const userId = req.user.userId;
  res.json({ message: 'Protected resource' });
});
```

### Enforce Document Permissions

```typescript
import { verifyToken, checkDocumentPermission } from './middleware/auth.js';

// Require read permission
router.get(
  '/documents/:id',
  verifyToken,
  checkDocumentPermission('read'),
  getDocument
);

// Require write permission
router.patch(
  '/documents/:id',
  verifyToken,
  checkDocumentPermission('write'),
  updateDocument
);

// Require admin permission
router.delete(
  '/documents/:id',
  verifyToken,
  checkDocumentPermission('admin'),
  deleteDocument
);
```

## Token Configuration

Configure token settings in `.env`:

```env
# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## Security Features

1. **Password Hashing**: Passwords are hashed using bcrypt with cost factor 12
2. **Token Expiration**: Access tokens expire in 15 minutes, refresh tokens in 7 days
3. **Rate Limiting**: Prevents brute force attacks
4. **Input Validation**: All inputs are validated before processing
5. **Error Handling**: Secure error messages that don't leak sensitive information

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation error",
  "message": "Email, password, and name are required"
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication failed",
  "message": "Invalid email or password"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You do not have write permission for this document"
}
```

### 409 Conflict
```json
{
  "error": "Conflict",
  "message": "User with this email already exists"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too many requests",
  "message": "Too many authentication attempts, please try again later"
}
```

## Testing

Run authentication tests:

```bash
npm test -- src/tests/services/authService.test.ts
npm test -- src/tests/controllers/authController.test.ts
```

## Best Practices

1. **Always use HTTPS** in production to protect tokens in transit
2. **Store refresh tokens securely** (httpOnly cookies recommended)
3. **Implement token rotation** for refresh tokens in production
4. **Monitor failed login attempts** for security threats
5. **Use environment variables** for secrets, never commit them
6. **Implement logout** by invalidating tokens on the client side
7. **Consider token blacklisting** for immediate revocation if needed

## Future Enhancements

- [ ] Implement RS256 algorithm with public/private key pairs
- [ ] Add token blacklisting for logout functionality
- [ ] Implement refresh token rotation
- [ ] Add multi-factor authentication (MFA)
- [ ] Add OAuth2 integration (Google, GitHub, etc.)
- [ ] Implement session management
- [ ] Add password reset functionality
- [ ] Add email verification

# Authentication Endpoints Documentation

## Overview

This document describes the authentication endpoints implemented for the real-time collaborative editor. All endpoints are prefixed with `/api/auth`.

## Endpoints

### 1. POST /api/auth/register

Register a new user account.

**Rate Limit:** 3 requests per hour per IP

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Validation:**
- Email: Required, valid email format
- Password: Required, minimum 8 characters
- Name: Required, 1-100 characters

**Success Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "accessToken": "jwt_access_token",
  "refreshToken": "jwt_refresh_token"
}
```

**Error Responses:**
- 400: Validation error (missing fields, invalid email, short password)
- 409: User with email already exists
- 500: Server error

---

### 2. POST /api/auth/login

Authenticate user and return tokens.

**Rate Limit:** 5 requests per 15 minutes per IP

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Validation:**
- Email: Required
- Password: Required

**Success Response (200):**
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
  "accessToken": "jwt_access_token",
  "refreshToken": "jwt_refresh_token"
}
```

**Error Responses:**
- 400: Validation error (missing fields)
- 401: Invalid email or password
- 500: Server error

---

### 3. POST /api/auth/refresh

Refresh access token using refresh token.

**Rate Limit:** None (refresh tokens are long-lived)

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Validation:**
- refreshToken: Required, valid JWT

**Success Response (200):**
```json
{
  "message": "Token refreshed successfully",
  "accessToken": "new_jwt_access_token"
}
```

**Error Responses:**
- 400: Validation error (missing refresh token)
- 401: Invalid or expired refresh token, user not found
- 500: Server error

---

### 4. GET /api/auth/me

Get current authenticated user profile.

**Authentication:** Required (Bearer token)

**Success Response (200):**
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

**Error Responses:**
- 401: Authentication required (no token or invalid token)
- 404: User not found
- 500: Server error

---

## Token Information

### Access Token
- Algorithm: HS256 (can be upgraded to RS256 for production)
- Expiration: 15 minutes (configurable via JWT_EXPIRES_IN)
- Used for: API authentication

### Refresh Token
- Algorithm: HS256
- Expiration: 7 days (configurable via JWT_REFRESH_EXPIRES_IN)
- Used for: Obtaining new access tokens

### Token Payload
```json
{
  "userId": "user_id",
  "email": "user@example.com",
  "name": "John Doe",
  "iat": 1234567890,
  "exp": 1234567890
}
```

---

## Security Features

### Rate Limiting
- **Registration:** 3 attempts per hour per IP
- **Login:** 5 attempts per 15 minutes per IP
- **Refresh:** No limit (tokens are already time-limited)

### Input Validation
- Email format validation
- Password strength requirements (min 8 characters)
- Name length validation (1-100 characters)
- Request body validation

### Password Security
- Passwords hashed using bcrypt with cost factor 12
- Passwords never returned in responses
- Constant-time comparison for password validation

### Token Security
- JWT tokens with expiration
- Separate access and refresh tokens
- Token verification on protected routes
- User existence validation on token refresh

---

## Requirements Coverage

This implementation satisfies the following requirements:

### Requirement 7.1
✅ JWT authentication token verification for document access

### Requirement 7.5
✅ User registration and authentication endpoints
✅ Token generation and validation
✅ Input validation and error handling
✅ Rate limiting for security

---

## Testing

All endpoints are covered by:
- Unit tests (15 tests in authController.test.ts)
- Integration tests (12 tests in auth.integration.test.ts)
- Service tests (authService.test.ts)
- Middleware tests (auth.test.ts)

Run tests with:
```bash
npm test
```

---

## Environment Variables

Required environment variables:

```env
# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

---

## Usage Example

### Registration Flow
```javascript
// 1. Register new user
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    name: 'John Doe'
  })
});

const { accessToken, refreshToken } = await registerResponse.json();

// 2. Use access token for authenticated requests
const userResponse = await fetch('/api/auth/me', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
```

### Login Flow
```javascript
// 1. Login with credentials
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { accessToken, refreshToken } = await loginResponse.json();

// 2. Store tokens securely
localStorage.setItem('accessToken', accessToken);
// Store refresh token in httpOnly cookie (recommended) or secure storage
```

### Token Refresh Flow
```javascript
// When access token expires
const refreshResponse = await fetch('/api/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refreshToken: storedRefreshToken
  })
});

const { accessToken } = await refreshResponse.json();
// Update stored access token
```

---

## Next Steps

Future enhancements:
1. Implement RS256 algorithm for production (asymmetric keys)
2. Add refresh token rotation for enhanced security
3. Implement token blacklisting for logout
4. Add OAuth2 providers (Google, GitHub)
5. Implement 2FA (two-factor authentication)
6. Add password reset functionality
7. Implement account verification via email

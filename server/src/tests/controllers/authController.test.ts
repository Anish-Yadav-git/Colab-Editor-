import { describe, it, expect, beforeEach } from 'vitest';
import { User } from '../../models/User.js';
import { authService } from '../../services/authService.js';
import { register, login, refresh, getCurrentUser } from '../../controllers/authController.js';
import '../setup.js';

// Mock Express Request and Response
const createMockRequest = (body: any = {}, user?: any) => ({
  body,
  user,
  params: {},
  headers: {},
}) as any;

const createMockResponse = () => {
  const res: any = {
    statusCode: 200,
    jsonData: null,
  };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.jsonData = data;
    return res;
  };
  return res;
};

describe('AuthController', () => {
  describe('register', () => {
    it('should register a new user successfully', async () => {
      const req = createMockRequest({
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      });
      const res = createMockResponse();

      await register(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.jsonData.message).toBe('User registered successfully');
      expect(res.jsonData.user.email).toBe('newuser@example.com');
      expect(res.jsonData.accessToken).toBeTruthy();
      expect(res.jsonData.refreshToken).toBeTruthy();
    });

    it('should reject registration with missing fields', async () => {
      const req = createMockRequest({
        email: 'test@example.com',
        // missing password and name
      });
      const res = createMockResponse();

      await register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('Validation error');
    });

    it('should reject registration with invalid email', async () => {
      const req = createMockRequest({
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User',
      });
      const res = createMockResponse();

      await register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.message).toContain('Invalid email format');
    });

    it('should reject registration with short password', async () => {
      const req = createMockRequest({
        email: 'test@example.com',
        password: 'short',
        name: 'Test User',
      });
      const res = createMockResponse();

      await register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.message).toContain('at least 8 characters');
    });

    it('should reject duplicate email registration', async () => {
      await User.createUser('existing@example.com', 'password123', 'Existing User');

      const req = createMockRequest({
        email: 'existing@example.com',
        password: 'password123',
        name: 'Another User',
      });
      const res = createMockResponse();

      await register(req, res);

      expect(res.statusCode).toBe(409);
      expect(res.jsonData.message).toContain('already exists');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await User.createUser('test@example.com', 'password123', 'Test User');
    });

    it('should login successfully with valid credentials', async () => {
      const req = createMockRequest({
        email: 'test@example.com',
        password: 'password123',
      });
      const res = createMockResponse();

      await login(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.message).toBe('Login successful');
      expect(res.jsonData.user.email).toBe('test@example.com');
      expect(res.jsonData.accessToken).toBeTruthy();
      expect(res.jsonData.refreshToken).toBeTruthy();
    });

    it('should reject login with missing fields', async () => {
      const req = createMockRequest({
        email: 'test@example.com',
        // missing password
      });
      const res = createMockResponse();

      await login(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('Validation error');
    });

    it('should reject login with invalid email', async () => {
      const req = createMockRequest({
        email: 'nonexistent@example.com',
        password: 'password123',
      });
      const res = createMockResponse();

      await login(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.message).toContain('Invalid email or password');
    });

    it('should reject login with wrong password', async () => {
      const req = createMockRequest({
        email: 'test@example.com',
        password: 'wrongpassword',
      });
      const res = createMockResponse();

      await login(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.message).toContain('Invalid email or password');
    });

    it('should update lastLoginAt on successful login', async () => {
      const req = createMockRequest({
        email: 'test@example.com',
        password: 'password123',
      });
      const res = createMockResponse();

      await login(req, res);

      const user = await User.findByEmail('test@example.com');
      expect(user?.lastLoginAt).toBeTruthy();
    });
  });

  describe('refresh', () => {
    let testUser: any;
    let validRefreshToken: string;

    beforeEach(async () => {
      testUser = await User.createUser('test@example.com', 'password123', 'Test User');
      validRefreshToken = authService.generateRefreshToken(testUser);
    });

    it('should refresh access token with valid refresh token', async () => {
      const req = createMockRequest({
        refreshToken: validRefreshToken,
      });
      const res = createMockResponse();

      await refresh(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.message).toBe('Token refreshed successfully');
      expect(res.jsonData.accessToken).toBeTruthy();
    });

    it('should reject refresh with missing token', async () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      await refresh(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('Validation error');
    });

    it('should reject refresh with invalid token', async () => {
      const req = createMockRequest({
        refreshToken: 'invalid-token',
      });
      const res = createMockResponse();

      await refresh(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.error).toBe('Invalid token');
    });
  });

  describe('getCurrentUser', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await User.createUser('test@example.com', 'password123', 'Test User');
    });

    it('should return current user profile', async () => {
      const req = createMockRequest({}, {
        userId: testUser._id.toString(),
        email: testUser.email,
        name: testUser.name,
      });
      const res = createMockResponse();

      await getCurrentUser(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.user.email).toBe('test@example.com');
      expect(res.jsonData.user.name).toBe('Test User');
    });

    it('should reject request without authentication', async () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      await getCurrentUser(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.error).toBe('Authentication required');
    });
  });
});

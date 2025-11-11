import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import authRoutes from '../../routes/auth.js';
import { User } from '../../models/User.js';
import { Document } from '../../models/Document.js';
import { verifyToken, checkDocumentPermission } from '../../middleware/auth.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Create a test route for permission enforcement testing
const testRouter = express.Router();
testRouter.get(
  '/documents/:id/read',
  verifyToken,
  checkDocumentPermission('read'),
  (req, res) => {
    res.json({ message: 'Read access granted' });
  }
);
testRouter.post(
  '/documents/:id/write',
  verifyToken,
  checkDocumentPermission('write'),
  (req, res) => {
    res.json({ message: 'Write access granted' });
  }
);
testRouter.delete(
  '/documents/:id/admin',
  verifyToken,
  checkDocumentPermission('admin'),
  (req, res) => {
    res.json({ message: 'Admin access granted' });
  }
);
app.use('/api/test', testRouter);

describe('Auth Integration Tests', () => {
  beforeAll(async () => {
    await connectDatabase();
    // Clean up all test data once before all tests
    await User.deleteMany({ email: { $regex: /test|integration|owner|editor|viewer|noaccess|expiry|fullflow|temp/i } });
    await Document.deleteMany({});
  });

  afterAll(async () => {
    // Clean up after all tests
    await User.deleteMany({ email: { $regex: /test|integration|owner|editor|viewer|noaccess|expiry|fullflow|temp/i } });
    await Document.deleteMany({});
    await disconnectDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const uniqueEmail = `integration-${Date.now()}@example.com`;
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: uniqueEmail,
          password: 'password123',
          name: 'Integration Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(uniqueEmail);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should reject registration with short password', async () => {
      const uniqueEmail = `test2-${Date.now()}@example.com`;
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: uniqueEmail,
          password: 'short',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('at least 8 characters');
    });
  });

  describe('POST /api/auth/login', () => {
    let loginEmail: string;

    beforeAll(async () => {
      loginEmail = `login-${Date.now()}@example.com`;
      await User.createUser(loginEmail, 'password123', 'Login User');
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: loginEmail,
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.email).toBe(loginEmail);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: loginEmail,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: `nonexistent-${Date.now()}@example.com`,
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid email or password');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;
    let refreshEmail: string;

    beforeAll(async () => {
      refreshEmail = `refresh-${Date.now()}@example.com`;
      await User.createUser(refreshEmail, 'password123', 'Refresh User');
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: refreshEmail,
          password: 'password123',
        });

      refreshToken = response.body.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Token refreshed successfully');
      expect(response.body.accessToken).toBeDefined();
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    it('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        });

      accessToken = response.body.accessToken;
    });

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('login@example.com');
      expect(response.body.user.name).toBe('Login User');
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('Token Expiration and Refresh', () => {
    let user: any;
    let expiredAccessToken: string;
    let validRefreshToken: string;

    beforeAll(async () => {
      // Create a test user
      user = await User.createUser(
        'expiry-test@example.com',
        'password123',
        'Expiry Test User'
      );

      // Generate an expired access token (expires in 1 second)
      const secret = process.env.JWT_SECRET || 'default-secret-change-me';
      expiredAccessToken = jwt.sign(
        {
          userId: user._id.toString(),
          email: user.email,
          name: user.name,
        },
        secret,
        { expiresIn: '1s', algorithm: 'HS256' }
      );

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Generate a valid refresh token
      const refreshSecret =
        process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-me';
      validRefreshToken = jwt.sign(
        {
          userId: user._id.toString(),
          email: user.email,
          name: user.name,
        },
        refreshSecret,
        { expiresIn: '7d', algorithm: 'HS256' }
      );
    });

    it('should reject expired access token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredAccessToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token expired');
      expect(response.body.message).toContain('refresh your token');
    });

    it('should successfully refresh with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Token refreshed successfully');
      expect(response.body.accessToken).toBeDefined();

      // Verify the new access token works
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${response.body.accessToken}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.user.email).toBe('expiry-test@example.com');
    });

    it('should reject expired refresh token', async () => {
      const secret =
        process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-me';
      const expiredRefreshToken = jwt.sign(
        {
          userId: user._id.toString(),
          email: user.email,
          name: user.name,
        },
        secret,
        { expiresIn: '1s', algorithm: 'HS256' }
      );

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: expiredRefreshToken });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    it('should reject malformed token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not.a.valid.jwt.token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    it('should reject token with wrong signature', async () => {
      const wrongToken = jwt.sign(
        {
          userId: user._id.toString(),
          email: user.email,
          name: user.name,
        },
        'wrong-secret',
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${wrongToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('Permission Enforcement', () => {
    let ownerUser: any;
    let editorUser: any;
    let viewerUser: any;
    let noAccessUser: any;
    let document: any;
    let ownerToken: string;
    let editorToken: string;
    let viewerToken: string;
    let noAccessToken: string;

    beforeAll(async () => {
      // Create test users
      ownerUser = await User.createUser(
        'owner@example.com',
        'password123',
        'Owner User'
      );
      editorUser = await User.createUser(
        'editor@example.com',
        'password123',
        'Editor User'
      );
      viewerUser = await User.createUser(
        'viewer@example.com',
        'password123',
        'Viewer User'
      );
      noAccessUser = await User.createUser(
        'noaccess@example.com',
        'password123',
        'No Access User'
      );

      // Create a test document with permissions
      document = await Document.create({
        title: 'Test Document',
        ownerId: ownerUser._id,
        permissions: [
          { userId: ownerUser._id, role: 'owner' },
          { userId: editorUser._id, role: 'editor' },
          { userId: viewerUser._id, role: 'viewer' },
        ],
        snapshotData: Buffer.from('test content'),
        metadata: {
          characterCount: 0,
          operationCount: 0,
          activeUsers: 0,
        },
        isDeleted: false,
      });

      // Generate tokens for each user
      const secret = process.env.JWT_SECRET || 'default-secret-change-me';
      ownerToken = jwt.sign(
        {
          userId: ownerUser._id.toString(),
          email: ownerUser.email,
          name: ownerUser.name,
        },
        secret,
        { expiresIn: '15m', algorithm: 'HS256' }
      );
      editorToken = jwt.sign(
        {
          userId: editorUser._id.toString(),
          email: editorUser.email,
          name: editorUser.name,
        },
        secret,
        { expiresIn: '15m', algorithm: 'HS256' }
      );
      viewerToken = jwt.sign(
        {
          userId: viewerUser._id.toString(),
          email: viewerUser.email,
          name: viewerUser.name,
        },
        secret,
        { expiresIn: '15m', algorithm: 'HS256' }
      );
      noAccessToken = jwt.sign(
        {
          userId: noAccessUser._id.toString(),
          email: noAccessUser.email,
          name: noAccessUser.name,
        },
        secret,
        { expiresIn: '15m', algorithm: 'HS256' }
      );
    });

    describe('Read Permission', () => {
      it('should allow owner to read', async () => {
        const response = await request(app)
          .get(`/api/test/documents/${document._id}/read`)
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Read access granted');
      });

      it('should allow editor to read', async () => {
        const response = await request(app)
          .get(`/api/test/documents/${document._id}/read`)
          .set('Authorization', `Bearer ${editorToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Read access granted');
      });

      it('should allow viewer to read', async () => {
        const response = await request(app)
          .get(`/api/test/documents/${document._id}/read`)
          .set('Authorization', `Bearer ${viewerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Read access granted');
      });

      it('should deny user without permissions', async () => {
        const response = await request(app)
          .get(`/api/test/documents/${document._id}/read`)
          .set('Authorization', `Bearer ${noAccessToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
        expect(response.body.message).toContain('read permission');
      });

      it('should deny unauthenticated user', async () => {
        const response = await request(app).get(
          `/api/test/documents/${document._id}/read`
        );

        expect(response.status).toBe(401);
      });
    });

    describe('Write Permission', () => {
      it('should allow owner to write', async () => {
        const response = await request(app)
          .post(`/api/test/documents/${document._id}/write`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ content: 'test' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Write access granted');
      });

      it('should allow editor to write', async () => {
        const response = await request(app)
          .post(`/api/test/documents/${document._id}/write`)
          .set('Authorization', `Bearer ${editorToken}`)
          .send({ content: 'test' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Write access granted');
      });

      it('should deny viewer from writing', async () => {
        const response = await request(app)
          .post(`/api/test/documents/${document._id}/write`)
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({ content: 'test' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
        expect(response.body.message).toContain('write permission');
      });

      it('should deny user without permissions from writing', async () => {
        const response = await request(app)
          .post(`/api/test/documents/${document._id}/write`)
          .set('Authorization', `Bearer ${noAccessToken}`)
          .send({ content: 'test' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });
    });

    describe('Admin Permission', () => {
      it('should allow owner admin access', async () => {
        const response = await request(app)
          .delete(`/api/test/documents/${document._id}/admin`)
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Admin access granted');
      });

      it('should deny editor from admin actions', async () => {
        const response = await request(app)
          .delete(`/api/test/documents/${document._id}/admin`)
          .set('Authorization', `Bearer ${editorToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
        expect(response.body.message).toContain('admin permission');
      });

      it('should deny viewer from admin actions', async () => {
        const response = await request(app)
          .delete(`/api/test/documents/${document._id}/admin`)
          .set('Authorization', `Bearer ${viewerToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });

      it('should deny user without permissions from admin actions', async () => {
        const response = await request(app)
          .delete(`/api/test/documents/${document._id}/admin`)
          .set('Authorization', `Bearer ${noAccessToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });
    });

    describe('Edge Cases', () => {
      it('should return 404 for non-existent document', async () => {
        const fakeId = '507f1f77bcf86cd799439011';
        const response = await request(app)
          .get(`/api/test/documents/${fakeId}/read`)
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Not found');
      });

      it('should return 404 for deleted document', async () => {
        // Create and delete a document
        const deletedDoc = await Document.create({
          title: 'Deleted Document',
          ownerId: ownerUser._id,
          permissions: [{ userId: ownerUser._id, role: 'owner' }],
          snapshotData: Buffer.from('test'),
          metadata: {
            characterCount: 0,
            operationCount: 0,
            activeUsers: 0,
          },
          isDeleted: true,
          deletedAt: new Date(),
        });

        const response = await request(app)
          .get(`/api/test/documents/${deletedDoc._id}/read`)
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('deleted');
      });

      it('should return 400 for missing document ID', async () => {
        const response = await request(app)
          .get('/api/test/documents//read')
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(response.status).toBe(404); // Express returns 404 for malformed routes
      });

      it('should handle token for deleted user', async () => {
        // Create a user and get their token
        const tempUser = await User.createUser(
          'temp@example.com',
          'password123',
          'Temp User'
        );
        const secret = process.env.JWT_SECRET || 'default-secret-change-me';
        const tempToken = jwt.sign(
          {
            userId: tempUser._id.toString(),
            email: tempUser.email,
            name: tempUser.name,
          },
          secret,
          { expiresIn: '15m', algorithm: 'HS256' }
        );

        // Delete the user
        await User.deleteOne({ _id: tempUser._id });

        // Try to use the token
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${tempToken}`);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authentication failed');
        expect(response.body.message).toContain('User not found');
      });
    });
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full registration, login, and access flow', async () => {
      // Step 1: Register
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'fullflow@example.com',
          password: 'password123',
          name: 'Full Flow User',
        });

      expect(registerResponse.status).toBe(201);
      const { accessToken: registerToken, refreshToken } =
        registerResponse.body;
      expect(registerToken).toBeDefined();
      expect(refreshToken).toBeDefined();

      // Step 2: Access protected resource with registration token
      const meResponse1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${registerToken}`);

      expect(meResponse1.status).toBe(200);
      expect(meResponse1.body.user.email).toBe('fullflow@example.com');

      // Step 3: Login again
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'fullflow@example.com',
          password: 'password123',
        });

      expect(loginResponse.status).toBe(200);
      const { accessToken: loginToken } = loginResponse.body;

      // Step 4: Access protected resource with login token
      const meResponse2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginToken}`);

      expect(meResponse2.status).toBe(200);
      expect(meResponse2.body.user.email).toBe('fullflow@example.com');

      // Step 5: Refresh token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(200);
      const { accessToken: newToken } = refreshResponse.body;

      // Step 6: Access protected resource with refreshed token
      const meResponse3 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newToken}`);

      expect(meResponse3.status).toBe(200);
      expect(meResponse3.body.user.email).toBe('fullflow@example.com');
    });
  });
});

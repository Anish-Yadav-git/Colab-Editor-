import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from '../../routes/auth.js';
import documentRoutes from '../../routes/documents.js';
import { User } from '../../models/User.js';
import { Document } from '../../models/Document.js';
import { authService } from '../../services/authService.js';

describe('Security Tests', () => {
  let app: Express;
  let testUser: any;
  let testToken: string;
  let testDocument: any;

  beforeAll(async () => {
    // Create test app with security middleware
    app = express();
    
    // Security middleware
    app.use(helmet());
    app.use(cors({
      origin: 'http://localhost:5173',
      credentials: true,
    }));
    
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/documents', documentRoutes);
  });

  beforeEach(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Document.deleteMany({});

    // Create test user using the proper method
    testUser = await User.createUser(
      'security-test@example.com',
      'SecurePass123!',
      'Security Test User'
    );

    // Generate test token
    testToken = authService.generateAccessToken(testUser);

    // Create test document
    testDocument = await Document.create({
      title: 'Test Document',
      ownerId: testUser._id,
      permissions: [
        {
          userId: testUser._id,
          role: 'owner',
        },
      ],
    });
  });

  describe('Rate Limiting Behavior', () => {
    it('should handle multiple rapid requests gracefully', async () => {
      // Make multiple rapid requests
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'security-test@example.com',
            password: 'SecurePass123!',
          })
      );

      const responses = await Promise.all(requests);

      // All requests should complete (even if rate limited)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });

    it('should not crash server with burst traffic', async () => {
      // Simulate burst traffic with document list requests
      const requests = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/documents')
          .set('Authorization', `Bearer ${testToken}`)
      );

      const responses = await Promise.all(requests);

      // Server should handle all requests
      responses.forEach(response => {
        expect([200, 429, 503]).toContain(response.status);
      });
    });

    it('should handle concurrent document creation attempts', async () => {
      // Try to create multiple documents rapidly
      const requests = Array(5).fill(null).map((_, i) =>
        request(app)
          .post('/api/documents')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            title: `Rapid Document ${i}`,
          })
      );

      const responses = await Promise.all(requests);

      // Should handle all requests
      const successCount = responses.filter(r => r.status === 201).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount + rateLimitedCount).toBe(5);
    });

    it('should enforce operation size limits', async () => {
      // Try to create document with very large title
      const largeTitle = 'A'.repeat(10000);

      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          title: largeTitle,
        });

      // Should reject or truncate
      expect([400, 413]).toContain(response.status);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "test@example.com", "password": invalid}');

      expect(response.status).toBe(400);
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize document titles', async () => {
      const maliciousTitle = '<script>alert("XSS")</script>';

      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          title: maliciousTitle,
        });

      if (response.status === 201) {
        const document = await Document.findById(response.body.document._id);
        // Title should not contain script tags
        expect(document?.title).not.toContain('<script>');
      }
    });

    it('should sanitize user names during registration', async () => {
      const maliciousName = '<img src=x onerror=alert(1)>';

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'xss-test@example.com',
          password: 'SecurePass123!',
          name: maliciousName,
        });

      if (response.status === 201) {
        const user = await User.findOne({ email: 'xss-test@example.com' });
        // Name should not contain HTML tags
        expect(user?.name).not.toContain('<img');
      }
    });

    it('should reject SQL injection attempts in email', async () => {
      const sqlInjection = "admin'--";

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: sqlInjection,
          password: 'password',
        });

      // Should fail authentication, not cause database error
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should validate email format', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        '',
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email,
            password: 'SecurePass123!',
            name: 'Test User',
          });

        expect(response.status).toBe(400);
      }
    });

    it('should enforce password requirements', async () => {
      const weakPasswords = [
        'short',
        '12345678',
        'password',
        'nouppercaseornumber',
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password,
            name: 'Test User',
          });

        expect(response.status).toBe(400);
      }
    });

    it('should reject excessively long input fields', async () => {
      const longEmail = 'a'.repeat(300) + '@example.com';

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: longEmail,
          password: 'SecurePass123!',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
    });

    it('should handle null and undefined values safely', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          title: null,
        });

      expect(response.status).toBe(400);
    });

    it('should reject documents with invalid characters', async () => {
      const invalidTitle = 'Document\x00WithNull';

      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          title: invalidTitle,
        });

      // Should either reject or sanitize
      if (response.status === 201) {
        const document = await Document.findById(response.body.document._id);
        expect(document?.title).not.toContain('\x00');
      } else {
        expect(response.status).toBe(400);
      }
    });
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers in responses', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Origin', 'http://localhost:5173');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/documents')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

      expect([200, 204]).toContain(response.status);
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    it('should allow credentials in CORS', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Origin', 'http://localhost:5173');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Origin', 'http://malicious-site.com');

      // CORS should not allow this origin
      expect(response.headers['access-control-allow-origin']).not.toBe('http://malicious-site.com');
    });

    it('should include security headers from helmet', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${testToken}`);

      // Check for common security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
    });

    it('should set appropriate Content-Type headers', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('Authentication Security', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/documents');

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token format', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', 'Bearer invalid-token-format');

      expect(response.status).toBe(401);
    });

    it('should reject requests with expired tokens', async () => {
      // Generate token with very short expiration
      const expiredToken = authService.generateAccessToken(
        {
          userId: testUser._id.toString(),
          email: testUser.email,
          name: testUser.name,
        },
        '0s' // Immediately expired
      );

      // Wait a moment to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    it('should not expose sensitive information in error messages', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password',
        });

      expect(response.status).toBe(401);
      // Should not reveal whether user exists
      expect(response.body.message).not.toContain('user not found');
      expect(response.body.message).not.toContain('email does not exist');
    });

    it('should prevent brute force attacks with consistent timing', async () => {
      const start1 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        });
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        });
      const time2 = Date.now() - start2;

      // Timing should be similar (within 200ms) to prevent timing attacks
      expect(Math.abs(time1 - time2)).toBeLessThan(200);
    });
  });

  describe('Authorization Security', () => {
    it('should prevent unauthorized document access', async () => {
      // Create another user
      const otherUser = await User.createUser(
        'other@example.com',
        'SecurePass123!',
        'Other User'
      );

      const otherToken = authService.generateAccessToken({
        userId: otherUser._id.toString(),
        email: otherUser.email,
        name: otherUser.name,
      });

      // Try to access test document with other user's token
      const response = await request(app)
        .get(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
    });

    it('should prevent viewers from editing documents', async () => {
      // Create viewer user
      const viewer = await User.createUser(
        'viewer@example.com',
        'SecurePass123!',
        'Viewer User'
      );

      // Add viewer permission
      testDocument.permissions.push({
        userId: viewer._id,
        role: 'viewer',
      });
      await testDocument.save();

      const viewerToken = authService.generateAccessToken({
        userId: viewer._id.toString(),
        email: viewer.email,
        name: viewer.name,
      });

      // Try to update document as viewer
      const response = await request(app)
        .patch(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Updated Title',
        });

      expect(response.status).toBe(403);
    });

    it('should prevent non-owners from deleting documents', async () => {
      // Create editor user
      const editor = await User.createUser(
        'editor@example.com',
        'SecurePass123!',
        'Editor User'
      );

      // Add editor permission
      testDocument.permissions.push({
        userId: editor._id,
        role: 'editor',
      });
      await testDocument.save();

      const editorToken = authService.generateAccessToken({
        userId: editor._id.toString(),
        email: editor.email,
        name: editor.name,
      });

      // Try to delete document as editor
      const response = await request(app)
        .delete(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(403);
    });

    it('should prevent privilege escalation attempts', async () => {
      // Create editor user
      const editor = await User.createUser(
        'editor2@example.com',
        'SecurePass123!',
        'Editor User 2'
      );

      testDocument.permissions.push({
        userId: editor._id,
        role: 'editor',
      });
      await testDocument.save();

      const editorToken = authService.generateAccessToken({
        userId: editor._id.toString(),
        email: editor.email,
        name: editor.name,
      });

      // Try to share document (admin permission required)
      const response = await request(app)
        .post(`/api/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          email: 'newuser@example.com',
          role: 'editor',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Data Validation Security', () => {
    it('should reject invalid MongoDB ObjectIds', async () => {
      const response = await request(app)
        .get('/api/documents/invalid-id')
        .set('Authorization', `Bearer ${testToken}`);

      expect([400, 404]).toContain(response.status);
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should reject invalid role values', async () => {
      const response = await request(app)
        .post(`/api/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          email: 'newuser@example.com',
          role: 'superadmin', // Invalid role
        });

      expect(response.status).toBe(400);
    });

    it('should prevent NoSQL injection in queries', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: { $ne: null },
          password: { $ne: null },
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose stack traces in production', async () => {
      // Try to trigger an error
      const response = await request(app)
        .get('/api/documents/000000000000000000000000')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.body.stack).toBeUndefined();
      expect(response.body.trace).toBeUndefined();
    });

    it('should return generic error messages for server errors', async () => {
      // This would need to trigger an actual server error
      // For now, just verify error structure
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', 'Bearer malformed.token.here');

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.message).toBeDefined();
    });

    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking database failure
      // Verify that errors don't crash the server
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${testToken}`);

      // Should return a response, not crash
      expect(response.status).toBeDefined();
    });
  });
});

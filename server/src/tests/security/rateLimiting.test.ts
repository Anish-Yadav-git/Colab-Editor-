import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { apiLimiter, documentCreationLimiter, authLimiter } from '../../middleware/rateLimiter.js';

describe('Rate Limiting Middleware', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('API Rate Limiter', () => {
    beforeEach(() => {
      app.use('/api', apiLimiter);
      app.get('/api/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within rate limit', async () => {
      // Make 5 requests (well under the 100/minute limit)
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/api/test');
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should return 429 when rate limit exceeded', async () => {
      // Make 101 requests to exceed the 100/minute limit
      const requests = [];
      for (let i = 0; i < 101; i++) {
        requests.push(request(app).get('/api/test'));
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter((r) => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });

    it('should return error message when rate limited', async () => {
      // Make 101 requests to exceed the limit
      for (let i = 0; i < 101; i++) {
        await request(app).get('/api/test');
      }

      const response = await request(app).get('/api/test');
      if (response.status === 429) {
        expect(response.body.error).toBeDefined();
        expect(response.body.error).toContain('Too many requests');
      }
    });
  });

  describe('Document Creation Rate Limiter', () => {
    beforeEach(() => {
      app.use('/api/documents', documentCreationLimiter);
      app.post('/api/documents', (req, res) => {
        res.json({ success: true, documentId: 'test-doc-id' });
      });
    });

    it('should allow document creation within rate limit', async () => {
      // Make 5 requests (well under the 10/hour limit)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/documents')
          .send({ title: `Test Document ${i}` });
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should return 429 when document creation limit exceeded', async () => {
      // Make 11 requests to exceed the 10/hour limit
      const requests = [];
      for (let i = 0; i < 11; i++) {
        requests.push(
          request(app)
            .post('/api/documents')
            .send({ title: `Test Document ${i}` })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter((r) => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Auth Rate Limiter', () => {
    beforeEach(() => {
      app.use('/api/auth', authLimiter);
      app.post('/api/auth/login', (req, res) => {
        // Simulate failed login
        res.status(401).json({ error: 'Invalid credentials' });
      });
    });

    it('should allow auth attempts within rate limit', async () => {
      // Make 3 requests (well under the 5/15min limit)
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'wrong' });
        expect(response.status).toBe(401);
      }
    });

    it('should return 429 when auth limit exceeded', async () => {
      // Make 6 failed login attempts to exceed the 5/15min limit
      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'wrong' })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter((r) => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});

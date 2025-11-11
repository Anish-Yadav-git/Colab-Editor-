import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import cors from 'cors';
import helmet from 'helmet';

describe('CORS and Security Headers', () => {
  let app: Express;

  beforeEach(() => {
    app = express();

    // Configure helmet with CSP
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'ws:', 'wss:'],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      })
    );

    // Configure CORS
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];

    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
        exposedHeaders: ['X-Correlation-ID'],
        maxAge: 86400,
      })
    );

    app.get('/api/test', (req, res) => {
      res.json({ success: true });
    });
  });

  describe('CORS Configuration', () => {
    it('should allow requests from allowed origins', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should allow requests without origin header', async () => {
      const response = await request(app).get('/api/test');

      expect(response.status).toBe(200);
    });

    it('should reject requests from disallowed origins', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'http://malicious-site.com');

      // CORS middleware will not set CORS headers for disallowed origins
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });

    it('should expose X-Correlation-ID header', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'http://localhost:5173');

      expect(response.headers['access-control-expose-headers']).toContain('X-Correlation-ID');
    });

    it('should set max age for preflight cache', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-max-age']).toBe('86400');
    });
  });

  describe('Security Headers (Helmet)', () => {
    it('should set Content-Security-Policy header', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should set X-Content-Type-Options header', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options header', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['x-frame-options']).toBeDefined();
    });

    it('should set X-XSS-Protection header', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    it('should set Strict-Transport-Security header', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should allow WebSocket connections in CSP', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['content-security-policy']).toContain('ws:');
      expect(response.headers['content-security-policy']).toContain('wss:');
    });

    it('should block object and frame sources in CSP', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['content-security-policy']).toContain("object-src 'none'");
      expect(response.headers['content-security-policy']).toContain("frame-src 'none'");
    });
  });

  describe('Allowed Methods', () => {
    it('should allow GET requests', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(200);
    });

    it('should allow POST requests', async () => {
      app.post('/api/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/api/test')
        .set('Origin', 'http://localhost:5173')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
    });

    it('should allow PATCH requests', async () => {
      app.patch('/api/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .patch('/api/test')
        .set('Origin', 'http://localhost:5173')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
    });

    it('should allow DELETE requests', async () => {
      app.delete('/api/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .delete('/api/test')
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(200);
    });
  });

  describe('Allowed Headers', () => {
    it('should allow Content-Type header', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    });

    it('should allow Authorization header', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Authorization');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-headers']).toContain('Authorization');
    });

    it('should allow X-Correlation-ID header', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'X-Correlation-ID');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-headers']).toContain('X-Correlation-ID');
    });
  });
});

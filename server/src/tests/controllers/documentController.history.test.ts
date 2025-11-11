import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import documentRoutes from '../../routes/documents.js';
import { User } from '../../models/User.js';
import { Document } from '../../models/Document.js';
import { Operation } from '../../models/Operation.js';
import { authService } from '../../services/authService.js';

const app = express();
app.use(express.json());
app.use('/api/documents', documentRoutes);

describe('Document History Controller', () => {
  let authToken: string;
  let userId: mongoose.Types.ObjectId;
  let documentId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    // Clean up collections
    await User.deleteMany({});
    await Document.deleteMany({});
    await Operation.deleteMany({});

    // Create test user
    const user = await User.createUser(
      'history@example.com',
      'Password123!',
      'History User'
    );
    userId = user._id as mongoose.Types.ObjectId;
    authToken = authService.generateAccessToken(user);

    // Create test document
    const document = await Document.createDocument('Test Document', userId);
    documentId = document._id as mongoose.Types.ObjectId;

    // Create test operations with specific timestamps
    const now = new Date();
    const timestamps = [
      new Date(now.getTime() - 5000), // 5 seconds ago
      new Date(now.getTime() - 4000), // 4 seconds ago
      new Date(now.getTime() - 3000), // 3 seconds ago
      new Date(now.getTime() - 2000), // 2 seconds ago
      new Date(now.getTime() - 1000), // 1 second ago
    ];

    const operations = [
      {
        operationType: 'insert' as const,
        yjsUpdate: Buffer.from('update1'),
        clientId: 'client1',
        sessionId: 'session1',
      },
      {
        operationType: 'delete' as const,
        yjsUpdate: Buffer.from('update2'),
        clientId: 'client1',
        sessionId: 'session1',
      },
      {
        operationType: 'format' as const,
        yjsUpdate: Buffer.from('update3'),
        clientId: 'client1',
        sessionId: 'session1',
      },
      {
        operationType: 'insert' as const,
        yjsUpdate: Buffer.from('update4'),
        clientId: 'client2',
        sessionId: 'session2',
      },
      {
        operationType: 'insert' as const,
        yjsUpdate: Buffer.from('update5'),
        clientId: 'client2',
        sessionId: 'session2',
      },
    ];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const operation = await Operation.appendOperation(
        documentId,
        userId,
        op.operationType,
        op.yjsUpdate,
        op.clientId,
        op.sessionId
      );
      // Update timestamp manually for testing
      operation.timestamp = timestamps[i];
      await operation.save();
    }
  });

  describe('GET /api/documents/:id/history', () => {
    it('should return document history with pagination', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('operations');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.operations).toBeInstanceOf(Array);
      expect(response.body.operations.length).toBeLessThanOrEqual(50);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 50,
        total: 5,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it('should return operations in descending order by timestamp', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const operations = response.body.operations;
      expect(operations.length).toBeGreaterThan(0);

      // Check that operations are sorted by timestamp descending
      for (let i = 0; i < operations.length - 1; i++) {
        const current = new Date(operations[i].timestamp);
        const next = new Date(operations[i + 1].timestamp);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('should support custom pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/history?page=1&limit=2`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.operations.length).toBe(2);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 5,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: false,
      });
    });

    it('should filter operations by start date', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 3500).toISOString();

      const response = await request(app)
        .get(`/api/documents/${documentId}/history?startDate=${startDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.operations.length).toBe(3);
      expect(response.body.filters.startDate).toBe(startDate);
    });

    it('should filter operations by end date', async () => {
      const now = new Date();
      const endDate = new Date(now.getTime() - 3500).toISOString();

      const response = await request(app)
        .get(`/api/documents/${documentId}/history?endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.operations.length).toBe(2);
      expect(response.body.filters.endDate).toBe(endDate);
    });

    it('should filter operations by date range', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 4500).toISOString();
      const endDate = new Date(now.getTime() - 2500).toISOString();

      const response = await request(app)
        .get(
          `/api/documents/${documentId}/history?startDate=${startDate}&endDate=${endDate}`
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.operations.length).toBe(2);
      expect(response.body.filters.startDate).toBe(startDate);
      expect(response.body.filters.endDate).toBe(endDate);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/history`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 500 for invalid document ID (caught by middleware)', async () => {
      const response = await request(app)
        .get('/api/documents/invalid-id/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error).toBe('Permission check failed');
    });

    it('should return 400 for invalid page parameter', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/history?page=0`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(response.body.message).toBe('Page must be greater than 0');
    });

    it('should return 400 for invalid limit parameter', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/history?limit=200`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(response.body.message).toBe('Limit must be between 1 and 100');
    });

    it('should return 400 for invalid startDate format', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/history?startDate=invalid-date`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(response.body.message).toBe('Invalid startDate format');
    });

    it('should return 400 for invalid endDate format', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/history?endDate=invalid-date`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(response.body.message).toBe('Invalid endDate format');
    });

    it('should not include yjsUpdate in response', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const operations = response.body.operations;
      expect(operations.length).toBeGreaterThan(0);

      operations.forEach((op: any) => {
        expect(op).not.toHaveProperty('yjsUpdate');
        expect(op).toHaveProperty('id');
        expect(op).toHaveProperty('documentId');
        expect(op).toHaveProperty('userId');
        expect(op).toHaveProperty('timestamp');
        expect(op).toHaveProperty('operationType');
        expect(op).toHaveProperty('metadata');
      });
    });

    it('should populate user information', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const operations = response.body.operations;
      expect(operations.length).toBeGreaterThan(0);

      operations.forEach((op: any) => {
        expect(op.userId).toHaveProperty('name');
        expect(op.userId).toHaveProperty('email');
      });
    });
  });
});

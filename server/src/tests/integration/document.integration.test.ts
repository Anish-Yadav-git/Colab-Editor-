import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import documentRoutes from '../../routes/documents.js';
import { User } from '../../models/User.js';
import { Document } from '../../models/Document.js';
import { authService } from '../../services/authService.js';
import mongoose from 'mongoose';

const app = express();
app.use(express.json());
app.use('/api/documents', documentRoutes);

describe('Document REST API Integration Tests', () => {
  let ownerUser: any;
  let editorUser: any;
  let viewerUser: any;
  let otherUser: any;
  let ownerToken: string;
  let editorToken: string;
  let viewerToken: string;
  let otherToken: string;

  beforeAll(async () => {
    await connectDatabase();
    
    // Clean up test data
    await User.deleteMany({ email: { $regex: /doctest/i } });
    await Document.deleteMany({});

    // Create test users
    ownerUser = await User.createUser(
      'doctest-owner@example.com',
      'password123',
      'Document Owner'
    );
    editorUser = await User.createUser(
      'doctest-editor@example.com',
      'password123',
      'Document Editor'
    );
    viewerUser = await User.createUser(
      'doctest-viewer@example.com',
      'password123',
      'Document Viewer'
    );
    otherUser = await User.createUser(
      'doctest-other@example.com',
      'password123',
      'Other User'
    );

    // Generate tokens using authService
    ownerToken = authService.generateAccessToken(ownerUser);
    editorToken = authService.generateAccessToken(editorUser);
    viewerToken = authService.generateAccessToken(viewerUser);
    otherToken = authService.generateAccessToken(otherUser);
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /doctest/i } });
    await Document.deleteMany({});
    await disconnectDatabase();
  });

  describe('POST /api/documents - Create Document', () => {
    it('should create a new document with valid data', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Test Document' });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Test Document');
      expect(response.body.id).toBeDefined();
      expect(response.body.ownerId).toBe(ownerUser._id.toString());
      expect(response.body.permissions).toHaveLength(1);
      expect(response.body.permissions[0].role).toBe('owner');
    });

    it('should reject creation without authentication', async () => {
      const response = await request(app)
        .post('/api/documents')
        .send({ title: 'Test Document' });

      expect(response.status).toBe(401);
    });

    it('should reject creation without title', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Title is required');
    });

    it('should reject creation with empty title', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('cannot be empty');
    });

    it('should reject creation with title too long', async () => {
      const longTitle = 'a'.repeat(201);
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: longTitle });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('200 characters');
    });

    it('should trim whitespace from title', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: '  Trimmed Title  ' });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Trimmed Title');
    });
  });

  describe('GET /api/documents/:id - Get Document', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await Document.create({
        title: 'Get Test Document',
        ownerId: ownerUser._id,
        permissions: [
          { userId: ownerUser._id, role: 'owner' },
          { userId: editorUser._id, role: 'editor' },
          { userId: viewerUser._id, role: 'viewer' },
        ],
        snapshotData: Buffer.from('test content'),
        metadata: { characterCount: 0, operationCount: 0, activeUsers: 0 },
        isDeleted: false,
      });
    });

    it('should allow owner to get document', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Get Test Document');
      expect(response.body.id).toBe(testDocument._id.toString());
    });

    it('should allow editor to get document', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Get Test Document');
    });

    it('should allow viewer to get document', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Get Test Document');
    });

    it('should deny user without permissions', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found or access denied');
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/documents/${fakeId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid document ID', async () => {
      const response = await request(app)
        .get('/api/documents/invalid-id')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid document ID');
    });
  });

  describe('GET /api/documents - List Documents', () => {
    beforeEach(async () => {
      // Clean up existing documents
      await Document.deleteMany({});

      // Create multiple documents for pagination testing
      for (let i = 1; i <= 25; i++) {
        await Document.create({
          title: `Document ${i}`,
          ownerId: ownerUser._id,
          permissions: [{ userId: ownerUser._id, role: 'owner' }],
          snapshotData: Buffer.from(`content ${i}`),
          metadata: { characterCount: 0, operationCount: 0, activeUsers: 0 },
          isDeleted: false,
        });
      }

      // Create a shared document
      await Document.create({
        title: 'Shared Document',
        ownerId: otherUser._id,
        permissions: [
          { userId: otherUser._id, role: 'owner' },
          { userId: ownerUser._id, role: 'editor' },
        ],
        snapshotData: Buffer.from('shared content'),
        metadata: { characterCount: 0, operationCount: 0, activeUsers: 0 },
        isDeleted: false,
      });
    });

    it('should list documents with default pagination', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.documents).toBeDefined();
      expect(response.body.documents.length).toBe(20); // Default limit
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
      expect(response.body.pagination.total).toBe(26); // 25 owned + 1 shared
    });

    it('should support custom pagination', async () => {
      const response = await request(app)
        .get('/api/documents?page=2&limit=10')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.documents.length).toBe(10);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.hasNextPage).toBe(true);
      expect(response.body.pagination.hasPrevPage).toBe(true);
    });

    it('should include shared documents', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      const sharedDoc = response.body.documents.find(
        (doc: any) => doc.title === 'Shared Document'
      );
      expect(sharedDoc).toBeDefined();
      expect(sharedDoc.ownerId).toBe(otherUser._id.toString());
    });

    it('should reject invalid page number', async () => {
      const response = await request(app)
        .get('/api/documents?page=0')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Page must be greater than 0');
    });

    it('should reject invalid limit', async () => {
      const response = await request(app)
        .get('/api/documents?limit=101')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('between 1 and 100');
    });

    it('should not include deleted documents', async () => {
      // Create and delete a document
      const deletedDoc = await Document.create({
        title: 'Deleted Document',
        ownerId: ownerUser._id,
        permissions: [{ userId: ownerUser._id, role: 'owner' }],
        snapshotData: Buffer.from('deleted content'),
        metadata: { characterCount: 0, operationCount: 0, activeUsers: 0 },
        isDeleted: true,
        deletedAt: new Date(),
      });

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      const foundDeleted = response.body.documents.find(
        (doc: any) => doc.id === deletedDoc._id.toString()
      );
      expect(foundDeleted).toBeUndefined();
    });
  });

  describe('PATCH /api/documents/:id - Update Document', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await Document.create({
        title: 'Original Title',
        ownerId: ownerUser._id,
        permissions: [
          { userId: ownerUser._id, role: 'owner' },
          { userId: editorUser._id, role: 'editor' },
          { userId: viewerUser._id, role: 'viewer' },
        ],
        snapshotData: Buffer.from('test content'),
        metadata: { characterCount: 0, operationCount: 0, activeUsers: 0 },
        isDeleted: false,
      });
    });

    it('should allow owner to update document title', async () => {
      const response = await request(app)
        .patch(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
    });

    it('should allow editor to update document title', async () => {
      const response = await request(app)
        .patch(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ title: 'Editor Updated Title' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Editor Updated Title');
    });

    it('should deny viewer from updating document', async () => {
      const response = await request(app)
        .patch(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ title: 'Viewer Update' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('write permission');
    });

    it('should reject empty title', async () => {
      const response = await request(app)
        .patch(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('cannot be empty');
    });

    it('should reject title too long', async () => {
      const longTitle = 'a'.repeat(201);
      const response = await request(app)
        .patch(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: longTitle });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('200 characters');
    });
  });

  describe('DELETE /api/documents/:id - Delete Document', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await Document.create({
        title: 'Document to Delete',
        ownerId: ownerUser._id,
        permissions: [
          { userId: ownerUser._id, role: 'owner' },
          { userId: editorUser._id, role: 'editor' },
          { userId: viewerUser._id, role: 'viewer' },
        ],
        snapshotData: Buffer.from('test content'),
        metadata: { characterCount: 0, operationCount: 0, activeUsers: 0 },
        isDeleted: false,
      });
    });

    it('should allow owner to delete document', async () => {
      const response = await request(app)
        .delete(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted successfully');

      // Verify document is soft deleted
      const doc = await Document.findById(testDocument._id);
      expect(doc?.isDeleted).toBe(true);
      expect(doc?.deletedAt).toBeDefined();
    });

    it('should deny editor from deleting document', async () => {
      const response = await request(app)
        .delete(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('admin permission');
    });

    it('should deny viewer from deleting document', async () => {
      const response = await request(app)
        .delete(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('admin permission');
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/documents/${fakeId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/documents/:id/share - Share Document', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await Document.create({
        title: 'Document to Share',
        ownerId: ownerUser._id,
        permissions: [{ userId: ownerUser._id, role: 'owner' }],
        snapshotData: Buffer.from('test content'),
        metadata: { characterCount: 0, operationCount: 0, activeUsers: 0 },
        isDeleted: false,
      });
    });

    it('should allow owner to share document with editor role', async () => {
      const response = await request(app)
        .post(`/api/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: editorUser.email,
          role: 'editor',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('shared successfully');
      expect(response.body.sharedWith.role).toBe('editor');
      expect(response.body.sharedWith.email).toBe(editorUser.email);

      // Verify permission was added
      const doc = await Document.findById(testDocument._id);
      const permission = doc?.permissions.find(
        (p) => p.userId.toString() === editorUser._id.toString()
      );
      expect(permission).toBeDefined();
      expect(permission?.role).toBe('editor');
    });

    it('should allow owner to share document with viewer role', async () => {
      const response = await request(app)
        .post(`/api/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: viewerUser.email,
          role: 'viewer',
        });

      expect(response.status).toBe(200);
      expect(response.body.sharedWith.role).toBe('viewer');
    });

    it('should update existing permission when sharing again', async () => {
      // First share as viewer
      await request(app)
        .post(`/api/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: editorUser.email,
          role: 'viewer',
        });

      // Then update to editor
      const response = await request(app)
        .post(`/api/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: editorUser.email,
          role: 'editor',
        });

      expect(response.status).toBe(200);
      expect(response.body.sharedWith.role).toBe('editor');

      // Verify only one permission exists for this user
      const doc = await Document.findById(testDocument._id);
      const permissions = doc?.permissions.filter(
        (p) => p.userId.toString() === editorUser._id.toString()
      );
      expect(permissions?.length).toBe(1);
      expect(permissions?.[0].role).toBe('editor');
    });

    it('should deny non-owner from sharing document', async () => {
      // First share with editor
      await request(app)
        .post(`/api/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: editorUser.email,
          role: 'editor',
        });

      // Try to share as editor
      const response = await request(app)
        .post(`/api/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          email: viewerUser.email,
          role: 'viewer',
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('admin permission');
    });

    it('should reject sharing with invalid email', async () => {
      const response = await request(app)
        .post(`/api/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'nonexistent@example.com',
          role: 'editor',
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('User with this email not found');
    });

    it('should reject sharing with invalid role', async () => {
      const response = await request(app)
        .post(`/api/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: editorUser.email,
          role: 'invalid-role',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('owner, editor, viewer');
    });

    it('should reject sharing without email', async () => {
      const response = await request(app)
        .post(`/api/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          role: 'editor',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Email is required');
    });
  });

  describe('GET /api/documents/:id/history - Get Document History', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await Document.create({
        title: 'History Test Document',
        ownerId: ownerUser._id,
        permissions: [
          { userId: ownerUser._id, role: 'owner' },
          { userId: viewerUser._id, role: 'viewer' },
        ],
        snapshotData: Buffer.from('test content'),
        metadata: { characterCount: 0, operationCount: 0, activeUsers: 0 },
        isDeleted: false,
      });

      // Create some operations
      const { Operation } = await import('../../models/Operation.js');
      for (let i = 0; i < 15; i++) {
        await Operation.create({
          documentId: testDocument._id,
          userId: ownerUser._id,
          timestamp: new Date(Date.now() - (15 - i) * 60000), // 15 minutes ago to now
          operationType: 'insert',
          yjsUpdate: Buffer.from(`update ${i}`),
          vectorClock: new Map(),
          metadata: {
            clientId: 'test-client',
            sessionId: 'test-session',
          },
        });
      }
    });

    it('should return document history with default pagination', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument._id}/history`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.operations).toBeDefined();
      expect(response.body.operations.length).toBe(15);
      expect(response.body.pagination.total).toBe(15);
    });

    it('should support custom pagination', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument._id}/history?page=1&limit=5`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.operations.length).toBe(5);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.pagination.hasNextPage).toBe(true);
    });

    it('should allow viewer to access history', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument._id}/history`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.operations).toBeDefined();
    });

    it('should support date range filtering', async () => {
      const startDate = new Date(Date.now() - 10 * 60000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/documents/${testDocument._id}/history?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.filters.startDate).toBeDefined();
      expect(response.body.filters.endDate).toBeDefined();
    });

    it('should reject invalid date format', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument._id}/history?startDate=invalid-date`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid startDate format');
    });
  });

  describe('Permission Enforcement Across All Endpoints', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await Document.create({
        title: 'Permission Test Document',
        ownerId: ownerUser._id,
        permissions: [
          { userId: ownerUser._id, role: 'owner' },
          { userId: editorUser._id, role: 'editor' },
          { userId: viewerUser._id, role: 'viewer' },
        ],
        snapshotData: Buffer.from('test content'),
        metadata: { characterCount: 0, operationCount: 0, activeUsers: 0 },
        isDeleted: false,
      });
    });

    it('viewer can read but not write or delete', async () => {
      // Can read
      const getResponse = await request(app)
        .get(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(getResponse.status).toBe(200);

      // Cannot write
      const patchResponse = await request(app)
        .patch(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ title: 'New Title' });
      expect(patchResponse.status).toBe(403);

      // Cannot delete
      const deleteResponse = await request(app)
        .delete(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(deleteResponse.status).toBe(403);

      // Cannot share
      const shareResponse = await request(app)
        .post(`/api/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ email: otherUser.email, role: 'viewer' });
      expect(shareResponse.status).toBe(403);
    });

    it('editor can read and write but not delete or share', async () => {
      // Can read
      const getResponse = await request(app)
        .get(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${editorToken}`);
      expect(getResponse.status).toBe(200);

      // Can write
      const patchResponse = await request(app)
        .patch(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ title: 'Editor Updated' });
      expect(patchResponse.status).toBe(200);

      // Cannot delete
      const deleteResponse = await request(app)
        .delete(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${editorToken}`);
      expect(deleteResponse.status).toBe(403);

      // Cannot share
      const shareResponse = await request(app)
        .post(`/api/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ email: otherUser.email, role: 'viewer' });
      expect(shareResponse.status).toBe(403);
    });

    it('owner has full permissions', async () => {
      // Can read
      const getResponse = await request(app)
        .get(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(getResponse.status).toBe(200);

      // Can write
      const patchResponse = await request(app)
        .patch(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Owner Updated' });
      expect(patchResponse.status).toBe(200);

      // Can share
      const shareResponse = await request(app)
        .post(`/api/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: otherUser.email, role: 'viewer' });
      expect(shareResponse.status).toBe(200);

      // Can delete
      const deleteResponse = await request(app)
        .delete(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(deleteResponse.status).toBe(200);
    });
  });
});

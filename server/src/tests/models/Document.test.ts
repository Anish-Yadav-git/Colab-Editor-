import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Document } from '../../models/Document.js';
import { User } from '../../models/User.js';

describe('Document Model', () => {
  let userId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    const user = await User.createUser(
      'doc@example.com',
      'password123',
      'Doc User'
    );
    userId = user._id as mongoose.Types.ObjectId;
  });

  describe('createDocument', () => {
    it('should create a document with owner permissions', async () => {
      const title = 'Test Document';
      const doc = await Document.createDocument(title, userId);

      expect(doc.title).toBe(title);
      expect(doc.ownerId.toString()).toBe(userId.toString());
      expect(doc.permissions).toHaveLength(1);
      expect(doc.permissions[0].userId.toString()).toBe(userId.toString());
      expect(doc.permissions[0].role).toBe('owner');
      expect(doc.metadata.characterCount).toBe(0);
      expect(doc.metadata.operationCount).toBe(0);
      expect(doc.isDeleted).toBe(false);
      expect(doc._id).toBeDefined();
    });

    it('should initialize metadata with default values', async () => {
      const doc = await Document.createDocument('New Doc', userId);

      expect(doc.metadata.characterCount).toBe(0);
      expect(doc.metadata.operationCount).toBe(0);
      expect(doc.metadata.activeUsers).toBe(0);
    });
  });

  describe('findByIdWithPermissions', () => {
    it('should find document for owner', async () => {
      const doc = await Document.createDocument('Owner Doc', userId);
      const docId = (doc._id as mongoose.Types.ObjectId).toString();

      const found = await Document.findByIdWithPermissions(docId, userId);

      expect(found).toBeDefined();
      expect((found?._id as mongoose.Types.ObjectId).toString()).toBe(docId);
    });

    it('should find document for user with permissions', async () => {
      const doc = await Document.createDocument('Shared Doc', userId);
      const docId = (doc._id as mongoose.Types.ObjectId).toString();

      const otherUser = await User.createUser(
        'other@example.com',
        'password123',
        'Other User'
      );

      doc.permissions.push({
        userId: otherUser._id as mongoose.Types.ObjectId,
        role: 'editor',
      });
      await doc.save();

      const found = await Document.findByIdWithPermissions(
        docId,
        otherUser._id as mongoose.Types.ObjectId
      );

      expect(found).toBeDefined();
    });

    it('should not find document for unauthorized user', async () => {
      const doc = await Document.createDocument('Private Doc', userId);
      const docId = (doc._id as mongoose.Types.ObjectId).toString();

      const otherUser = await User.createUser(
        'unauthorized@example.com',
        'password123',
        'Unauthorized User'
      );

      const found = await Document.findByIdWithPermissions(
        docId,
        otherUser._id as mongoose.Types.ObjectId
      );

      expect(found).toBeNull();
    });

    it('should not find deleted documents', async () => {
      const doc = await Document.createDocument('Deleted Doc', userId);
      const docId = (doc._id as mongoose.Types.ObjectId).toString();
      await Document.softDelete(docId);

      const found = await Document.findByIdWithPermissions(docId, userId);

      expect(found).toBeNull();
    });
  });

  describe('updateMetadata', () => {
    it('should update document metadata', async () => {
      const doc = await Document.createDocument('Update Doc', userId);
      const docId = (doc._id as mongoose.Types.ObjectId).toString();

      const updated = await Document.updateMetadata(docId, {
        characterCount: 100,
        operationCount: 5,
        activeUsers: 2,
      });

      expect(updated?.metadata.characterCount).toBe(100);
      expect(updated?.metadata.operationCount).toBe(5);
      expect(updated?.metadata.activeUsers).toBe(2);
    });

    it('should update partial metadata', async () => {
      const doc = await Document.createDocument('Partial Update', userId);
      const docId = (doc._id as mongoose.Types.ObjectId).toString();

      const updated = await Document.updateMetadata(docId, {
        characterCount: 50,
      });

      expect(updated?.metadata.characterCount).toBe(50);
      expect(updated?.metadata.operationCount).toBe(0);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a document', async () => {
      const doc = await Document.createDocument('Delete Me', userId);
      const docId = (doc._id as mongoose.Types.ObjectId).toString();

      const deleted = await Document.softDelete(docId);

      expect(deleted?.isDeleted).toBe(true);
      expect(deleted?.deletedAt).toBeDefined();
    });

    it('should not find soft deleted documents', async () => {
      const doc = await Document.createDocument('Soft Deleted', userId);
      const docId = (doc._id as mongoose.Types.ObjectId).toString();
      await Document.softDelete(docId);

      const found = await Document.findByIdWithPermissions(docId, userId);

      expect(found).toBeNull();
    });
  });

  describe('permissions array handling', () => {
    it('should handle multiple permissions', async () => {
      const doc = await Document.createDocument('Multi Permission', userId);

      const editor = await User.createUser(
        'editor@example.com',
        'password123',
        'Editor'
      );
      const viewer = await User.createUser(
        'viewer@example.com',
        'password123',
        'Viewer'
      );

      doc.permissions.push(
        {
          userId: editor._id as mongoose.Types.ObjectId,
          role: 'editor',
        },
        {
          userId: viewer._id as mongoose.Types.ObjectId,
          role: 'viewer',
        }
      );
      await doc.save();

      const docId = doc._id as mongoose.Types.ObjectId;
      const saved = await Document.findById(docId);
      expect(saved?.permissions).toHaveLength(3);
      expect(saved?.permissions[1].role).toBe('editor');
      expect(saved?.permissions[2].role).toBe('viewer');
    });

    it('should validate permission roles', async () => {
      const doc = await Document.createDocument('Invalid Role', userId);

      doc.permissions.push({
        userId: new mongoose.Types.ObjectId(),
        role: 'invalid' as any,
      });

      await expect(doc.save()).rejects.toThrow();
    });
  });
});

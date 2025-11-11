import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Operation } from '../../models/Operation.js';
import { Document } from '../../models/Document.js';
import { User } from '../../models/User.js';

describe('Operation Model', () => {
  let userId: mongoose.Types.ObjectId;
  let documentId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    const user = await User.createUser(
      'op@example.com',
      'password123',
      'Op User'
    );
    userId = user._id as mongoose.Types.ObjectId;

    const doc = await Document.createDocument('Op Doc', userId);
    documentId = doc._id as mongoose.Types.ObjectId;
  });

  describe('appendOperation', () => {
    it('should append a new operation', async () => {
      const yjsUpdate = Buffer.from('test update data');
      const clientId = 'client-123';
      const sessionId = 'session-456';

      const op = await Operation.appendOperation(
        documentId,
        userId,
        'insert',
        yjsUpdate,
        clientId,
        sessionId
      );

      expect(op.documentId.toString()).toBe(documentId.toString());
      expect(op.userId.toString()).toBe(userId.toString());
      expect(op.operationType).toBe('insert');
      expect(op.yjsUpdate.toString()).toBe(yjsUpdate.toString());
      expect(op.metadata.clientId).toBe(clientId);
      expect(op.metadata.sessionId).toBe(sessionId);
      expect(op.timestamp).toBeDefined();
    });

    it('should append operation with vector clock', async () => {
      const vectorClock = new Map<string, number>([
        ['client1', 5],
        ['client2', 3],
      ]);

      const op = await Operation.appendOperation(
        documentId,
        userId,
        'delete',
        Buffer.from('delete data'),
        'client-1',
        'session-1',
        vectorClock
      );

      expect(op.vectorClock.get('client1')).toBe(5);
      expect(op.vectorClock.get('client2')).toBe(3);
    });

    it('should default to empty vector clock if not provided', async () => {
      const op = await Operation.appendOperation(
        documentId,
        userId,
        'format',
        Buffer.from('format data'),
        'client-1',
        'session-1'
      );

      expect(op.vectorClock.size).toBe(0);
    });
  });

  describe('findSince', () => {
    it('should find operations since a timestamp', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 10000);

      await Operation.appendOperation(
        documentId,
        userId,
        'insert',
        Buffer.from('old'),
        'client-1',
        'session-1'
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      await Operation.appendOperation(
        documentId,
        userId,
        'insert',
        Buffer.from('new'),
        'client-1',
        'session-1'
      );

      const ops = await Operation.findSince(documentId, past);

      expect(ops.length).toBeGreaterThanOrEqual(2);
    });

    it('should return operations in chronological order', async () => {
      await Operation.appendOperation(
        documentId,
        userId,
        'insert',
        Buffer.from('first'),
        'client-1',
        'session-1'
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      await Operation.appendOperation(
        documentId,
        userId,
        'insert',
        Buffer.from('second'),
        'client-1',
        'session-1'
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      await Operation.appendOperation(
        documentId,
        userId,
        'insert',
        Buffer.from('third'),
        'client-1',
        'session-1'
      );

      const ops = await Operation.findSince(
        documentId,
        new Date(Date.now() - 10000)
      );

      expect(ops.length).toBe(3);
      expect(ops[0].yjsUpdate.toString()).toBe('first');
      expect(ops[1].yjsUpdate.toString()).toBe('second');
      expect(ops[2].yjsUpdate.toString()).toBe('third');
    });

    it('should only return operations for specified document', async () => {
      const otherDoc = await Document.createDocument('Other Doc', userId);

      await Operation.appendOperation(
        documentId,
        userId,
        'insert',
        Buffer.from('doc1'),
        'client-1',
        'session-1'
      );

      await Operation.appendOperation(
        otherDoc._id as mongoose.Types.ObjectId,
        userId,
        'insert',
        Buffer.from('doc2'),
        'client-1',
        'session-1'
      );

      const ops = await Operation.findSince(
        documentId,
        new Date(Date.now() - 10000)
      );

      expect(ops.length).toBe(1);
      expect(ops[0].yjsUpdate.toString()).toBe('doc1');
    });
  });

  describe('compactOperations', () => {
    it('should delete operations before a date', async () => {
      const now = new Date();
      const cutoff = new Date(now.getTime() + 1000);

      await Operation.appendOperation(
        documentId,
        userId,
        'insert',
        Buffer.from('old1'),
        'client-1',
        'session-1'
      );

      await Operation.appendOperation(
        documentId,
        userId,
        'insert',
        Buffer.from('old2'),
        'client-1',
        'session-1'
      );

      await new Promise((resolve) => setTimeout(resolve, 1500));

      await Operation.appendOperation(
        documentId,
        userId,
        'insert',
        Buffer.from('new'),
        'client-1',
        'session-1'
      );

      const deletedCount = await Operation.compactOperations(
        documentId,
        cutoff
      );

      expect(deletedCount).toBe(2);

      const remaining = await Operation.findSince(
        documentId,
        new Date(Date.now() - 10000)
      );
      expect(remaining.length).toBe(1);
      expect(remaining[0].yjsUpdate.toString()).toBe('new');
    });

    it('should return 0 if no operations to compact', async () => {
      const deletedCount = await Operation.compactOperations(
        documentId,
        new Date(Date.now() - 10000)
      );

      expect(deletedCount).toBe(0);
    });
  });

  describe('vector clock ordering', () => {
    it('should preserve vector clock data', async () => {
      const clock1 = new Map<string, number>([
        ['client1', 1],
        ['client2', 0],
      ]);
      const clock2 = new Map<string, number>([
        ['client1', 1],
        ['client2', 1],
      ]);
      const clock3 = new Map<string, number>([
        ['client1', 2],
        ['client2', 1],
      ]);

      const op1 = await Operation.appendOperation(
        documentId,
        userId,
        'insert',
        Buffer.from('op1'),
        'client-1',
        'session-1',
        clock1
      );

      const op2 = await Operation.appendOperation(
        documentId,
        userId,
        'insert',
        Buffer.from('op2'),
        'client-2',
        'session-1',
        clock2
      );

      const op3 = await Operation.appendOperation(
        documentId,
        userId,
        'insert',
        Buffer.from('op3'),
        'client-1',
        'session-1',
        clock3
      );

      expect(op1.vectorClock.get('client1')).toBe(1);
      expect(op1.vectorClock.get('client2')).toBe(0);
      expect(op2.vectorClock.get('client1')).toBe(1);
      expect(op2.vectorClock.get('client2')).toBe(1);
      expect(op3.vectorClock.get('client1')).toBe(2);
      expect(op3.vectorClock.get('client2')).toBe(1);
    });
  });
});

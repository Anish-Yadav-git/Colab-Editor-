import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { PersistenceService } from '../../services/persistenceService.js';
import { Document, IDocument } from '../../models/Document.js';
import { Operation } from '../../models/Operation.js';
import { User, IUser } from '../../models/User.js';
import * as Y from 'yjs';

const persistenceService = new PersistenceService();

const getId = (doc: IUser | IDocument): string => {
  return (doc._id as mongoose.Types.ObjectId).toString();
};

const getObjectId = (doc: IUser | IDocument): mongoose.Types.ObjectId => {
  return doc._id as mongoose.Types.ObjectId;
};

describe('PersistenceService', () => {
  describe('Snapshot save and load', () => {
    it('should save and load a snapshot with compression', async () => {
      const user = await User.createUser('test@example.com', 'password123', 'Test User');
      const document = await Document.createDocument('Test Document', getObjectId(user));

      const yjsDoc = new Y.Doc();
      const yText = yjsDoc.getText('content');
      yText.insert(0, 'Hello, World!');
      const state = Y.encodeStateAsUpdate(yjsDoc);

      await persistenceService.saveSnapshot(getId(document), state);
      const loadedState = await persistenceService.loadSnapshot(getId(document));

      expect(loadedState).not.toBeNull();
      expect(loadedState).toBeInstanceOf(Uint8Array);

      const newYjsDoc = new Y.Doc();
      Y.applyUpdate(newYjsDoc, loadedState!);
      const newYText = newYjsDoc.getText('content');
      expect(newYText.toString()).toBe('Hello, World!');
    });

    it('should return null when loading non-existent snapshot', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const snapshot = await persistenceService.loadSnapshot(fakeId);
      expect(snapshot).toBeNull();
    });
  });

  describe('Operation log methods', () => {
    it('should append operation to log', async () => {
      const user = await User.createUser('test2@example.com', 'password123', 'Test User');
      const document = await Document.createDocument('Test Document', getObjectId(user));

      const yjsDoc = new Y.Doc();
      const yText = yjsDoc.getText('content');
      yText.insert(0, 'Test');
      const update = Y.encodeStateAsUpdate(yjsDoc);

      await persistenceService.appendOperation(
        getId(document),
        getId(user),
        update,
        'insert',
        'client-1',
        'session-1'
      );

      const operations = await Operation.find({ documentId: getObjectId(document) });
      expect(operations).toHaveLength(1);
      expect(operations[0].operationType).toBe('insert');
    });
  });
});

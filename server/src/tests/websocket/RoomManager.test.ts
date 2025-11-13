import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomManager } from '../../websocket/RoomManager.js';
import { WebSocket } from 'ws';
import { persistenceService } from '../../services/persistenceService.js';
import * as Y from 'yjs';

// Mock the persistence service
vi.mock('../../services/persistenceService.js', () => ({
  persistenceService: {
    loadSnapshot: vi.fn(),
  },
}));

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    // Get a fresh instance for each test
    roomManager = RoomManager.getInstance();
    
    // Clear any existing rooms
    const roomIds = roomManager.getActiveRoomIds();
    roomIds.forEach((id) => {
      const room = roomManager.getRoomIfExists(id);
      if (room) {
        room.cleanup();
      }
    });
  });

  afterEach(() => {
    // Stop cleanup job if running
    roomManager.stopCleanupJob();
    vi.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = RoomManager.getInstance();
      const instance2 = RoomManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('getRoom', () => {
    it('should create a new room if it does not exist', async () => {
      const documentId = 'doc-1';

      vi.mocked(persistenceService.loadSnapshot).mockResolvedValue(null);

      const room = await roomManager.getRoom(documentId);

      expect(room).toBeDefined();
      expect(room.documentId).toBe(documentId);
      expect(roomManager.hasRoom(documentId)).toBe(true);
    });

    it('should return existing room if it already exists', async () => {
      const documentId = 'doc-1';

      vi.mocked(persistenceService.loadSnapshot).mockRes
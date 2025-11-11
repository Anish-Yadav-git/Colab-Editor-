/**
 * Integration tests for offline support
 * Tests the complete offline workflow including queueing, reconnection, and sync
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineDetection } from '../hooks/useOfflineDetection';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { OfflineQueue } from '../services/OfflineQueue';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

// Mock WebsocketProvider
class MockWebsocketProvider {
  public wsconnected = false;
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  connect() {
    this.wsconnected = true;
    this.emit('status', { status: 'connected' });
    this.emit('sync', true);
  }

  disconnect() {
    this.wsconnected = false;
    this.emit('status', { status: 'disconnected' });
  }
}

describe('Offline Support Integration', () => {
  let mockProvider: MockWebsocketProvider;
  let yjsDoc: Y.Doc;
  let queue: OfflineQueue;
  const documentId = 'test-doc-integration';

  beforeEach(async () => {
    mockProvider = new MockWebsocketProvider();
    yjsDoc = new Y.Doc();
    queue = new OfflineQueue(documentId);
    
    // Wait for queue initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    await queue.clear();
    queue.close();
    yjsDoc.destroy();
  });

  it('should detect offline state and queue operations', async () => {
    // Start disconnected
    mockProvider.wsconnected = false;

    const { result: detectionResult } = renderHook(() =>
      useOfflineDetection(mockProvider as unknown as WebsocketProvider)
    );

    const { result: syncResult } = renderHook(() =>
      useOfflineSync(
        mockProvider as unknown as WebsocketProvider,
        yjsDoc,
        documentId,
        detectionResult.current.isOffline
      )
    );

    // Verify initial offline state
    expect(detectionResult.current.isOffline).toBe(true);
    expect(syncResult.current.queuedOpsCount).toBe(0);

    // Simulate local edit while offline
    act(() => {
      const yText = yjsDoc.getText('content');
      yText.insert(0, 'Hello offline world');
    });

    // Wait for operation to be queued
    await waitFor(
      () => {
        expect(syncResult.current.queuedOpsCount).toBeGreaterThan(0);
      },
      { timeout: 2000 }
    );
  });

  it('should sync queued operations when coming back online', async () => {
    // Start offline
    mockProvider.wsconnected = false;

    const { result: detectionResult, rerender: rerenderDetection } = renderHook(() =>
      useOfflineDetection(mockProvider as unknown as WebsocketProvider)
    );

    const { result: syncResult, rerender: rerenderSync } = renderHook(() =>
      useOfflineSync(
        mockProvider as unknown as WebsocketProvider,
        yjsDoc,
        documentId,
        detectionResult.current.isOffline
      )
    );

    expect(detectionResult.current.isOffline).toBe(true);

    // Make edits while offline
    act(() => {
      const yText = yjsDoc.getText('content');
      yText.insert(0, 'Offline edit 1');
    });

    await waitFor(
      () => {
        expect(syncResult.current.queuedOpsCount).toBeGreaterThan(0);
      },
      { timeout: 2000 }
    );

    const queuedCount = syncResult.current.queuedOpsCount;
    expect(queuedCount).toBeGreaterThan(0);

    // Come back online
    act(() => {
      mockProvider.connect();
    });

    rerenderDetection();
    rerenderSync();

    // Wait for sync to complete
    await waitFor(
      () => {
        expect(detectionResult.current.isOffline).toBe(false);
      },
      { timeout: 3000 }
    );

    // Operations should eventually be synced and queue cleared
    await waitFor(
      () => {
        expect(syncResult.current.queuedOpsCount).toBe(0);
      },
      { timeout: 5000 }
    );
  });

  it('should handle conflict resolution after offline period', async () => {
    // Start offline
    mockProvider.wsconnected = false;

    const { result: detectionResult } = renderHook(() =>
      useOfflineDetection(mockProvider as unknown as WebsocketProvider)
    );

    renderHook(() =>
      useOfflineSync(
        mockProvider as unknown as WebsocketProvider,
        yjsDoc,
        documentId,
        detectionResult.current.isOffline
      )
    );

    // Make local edit while offline
    act(() => {
      const yText = yjsDoc.getText('content');
      yText.insert(0, 'Local edit');
    });

    // Simulate remote edit (would come from server)
    const remoteDoc = new Y.Doc();
    const remoteText = remoteDoc.getText('content');
    remoteText.insert(0, 'Remote edit');

    // Come back online
    act(() => {
      mockProvider.connect();
    });

    // Apply remote update
    act(() => {
      const remoteUpdate = Y.encodeStateAsUpdate(remoteDoc);
      Y.applyUpdate(yjsDoc, remoteUpdate);
    });

    // Both edits should be preserved (CRDT guarantees convergence)
    const yText = yjsDoc.getText('content');
    const content = yText.toString();
    
    // Content should contain both edits (order may vary due to CRDT)
    expect(content).toContain('Local edit');
    expect(content).toContain('Remote edit');

    remoteDoc.destroy();
  });

  it('should retry failed operations', async () => {
    const testQueue = new OfflineQueue('test-retry-doc');
    await new Promise(resolve => setTimeout(resolve, 100));

    const update = new Uint8Array([1, 2, 3]);
    const vectorClock = new Map([['client1', 100]]);

    const operationId = await testQueue.enqueue(update, vectorClock);

    // Verify initial retry count
    let operations = await testQueue.getAll();
    expect(operations.length).toBe(1);
    expect(operations[0].retryCount).toBe(0);

    // Increment retry count (simulating failed sync)
    await testQueue.incrementRetryCount(operationId);

    operations = await testQueue.getAll();
    expect(operations.length).toBe(1);
    expect(operations[0].retryCount).toBe(1);

    // Increment again
    await testQueue.incrementRetryCount(operationId);

    operations = await testQueue.getAll();
    expect(operations.length).toBe(1);
    expect(operations[0].retryCount).toBe(2);

    await testQueue.clear();
    testQueue.close();
  });

  it('should persist queued operations across page reloads', async () => {
    const persistDocId = 'test-persist-doc';
    const persistQueue = new OfflineQueue(persistDocId);
    await new Promise(resolve => setTimeout(resolve, 100));

    const update = new Uint8Array([10, 20, 30]);
    const vectorClock = new Map([['client1', 100]]);

    // Queue operations
    await persistQueue.enqueue(update, vectorClock);
    await persistQueue.enqueue(update, vectorClock);

    expect(await persistQueue.getCount()).toBe(2);

    // Don't close, just create new instance (simulating page reload)
    // In fake-indexeddb, data persists in memory

    // Create new queue instance (simulating page reload)
    const newQueue = new OfflineQueue(persistDocId);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Operations should still be there
    expect(await newQueue.getCount()).toBe(2);

    const operations = await newQueue.getAll();
    expect(operations[0].yjsUpdate).toEqual(update);

    await newQueue.clear();
    newQueue.close();
    await persistQueue.clear();
    persistQueue.close();
  });

  it('should handle multiple rapid offline/online transitions', async () => {
    mockProvider.wsconnected = true;

    const { result: detectionResult, rerender } = renderHook(() =>
      useOfflineDetection(mockProvider as unknown as WebsocketProvider)
    );

    expect(detectionResult.current.isOffline).toBe(false);

    // Rapid transitions
    act(() => {
      mockProvider.disconnect();
    });
    rerender();

    act(() => {
      mockProvider.connect();
    });
    rerender();

    act(() => {
      mockProvider.disconnect();
    });
    rerender();

    act(() => {
      mockProvider.connect();
    });
    rerender();

    // Should end up in connected state
    await waitFor(() => {
      expect(detectionResult.current.isOffline).toBe(false);
    });
  });
});

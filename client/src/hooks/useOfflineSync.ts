/**
 * useOfflineSync Hook
 * 
 * Manages offline operation queueing and synchronization:
 * 1. Queues Yjs updates when offline
 * 2. Syncs queued operations when connection is restored
 * 3. Handles conflicts and merges
 * 4. Clears queue after successful sync
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { OfflineQueue, QueuedOperation } from '../services/OfflineQueue';

export interface OfflineSyncState {
  queuedOpsCount: number;
  isSyncing: boolean;
  lastError: string | null;
}

export function useOfflineSync(
  provider: WebsocketProvider | null,
  yjsDoc: Y.Doc | null,
  documentId: string,
  isOffline: boolean
): OfflineSyncState {
  const [queuedOpsCount, setQueuedOpsCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const offlineQueueRef = useRef<OfflineQueue | null>(null);
  const wasOfflineRef = useRef(false);
  const isQueuingRef = useRef(false);

  // Initialize offline queue
  useEffect(() => {
    if (!documentId) return;

    const queue = new OfflineQueue(documentId);
    offlineQueueRef.current = queue;

    // Load initial queue count
    queue.getCount().then(count => {
      setQueuedOpsCount(count);
    }).catch(err => {
      console.error('Failed to get initial queue count:', err);
    });

    return () => {
      queue.close();
      offlineQueueRef.current = null;
    };
  }, [documentId]);

  // Queue operations when offline
  useEffect(() => {
    if (!yjsDoc || !offlineQueueRef.current) return;

    const handleUpdate = async (update: Uint8Array, origin: any) => {
      // Don't queue updates that come from the provider (remote updates)
      // Only queue local updates when offline
      if (origin === provider || !isOffline || !isQueuingRef.current) {
        return;
      }

      try {
        const queue = offlineQueueRef.current;
        if (!queue) return;

        // Create a simple vector clock based on timestamp
        // In a production system, you'd use a more sophisticated vector clock
        const vectorClock = new Map<string, number>();
        vectorClock.set(yjsDoc.clientID.toString(), Date.now());

        await queue.enqueue(update, vectorClock);
        const count = await queue.getCount();
        setQueuedOpsCount(count);
        
        console.log('Queued operation while offline, total:', count);
      } catch (err) {
        console.error('Failed to queue operation:', err);
        setLastError('Failed to queue operation');
      }
    };

    yjsDoc.on('update', handleUpdate);

    return () => {
      yjsDoc.off('update', handleUpdate);
    };
  }, [yjsDoc, provider, isOffline]);

  // Enable/disable queuing based on offline state
  useEffect(() => {
    isQueuingRef.current = isOffline;
  }, [isOffline]);

  // Sync queued operations when coming back online
  const syncQueuedOperations = useCallback(async () => {
    if (!offlineQueueRef.current || !yjsDoc || !provider) {
      return;
    }

    const queue = offlineQueueRef.current;
    
    try {
      setIsSyncing(true);
      setLastError(null);

      const operations = await queue.getAll();
      
      if (operations.length === 0) {
        setIsSyncing(false);
        return;
      }

      console.log(`Syncing ${operations.length} queued operations...`);

      // Apply operations in order
      for (const operation of operations) {
        try {
          // Apply the update to the Yjs document
          // The provider will automatically sync it to the server
          Y.applyUpdate(yjsDoc, operation.yjsUpdate);
          
          // Remove from queue after successful application
          await queue.dequeue(operation.id);
          
          const count = await queue.getCount();
          setQueuedOpsCount(count);
        } catch (err) {
          console.error('Failed to apply queued operation:', err);
          
          // Increment retry count
          await queue.incrementRetryCount(operation.id);
          
          // If retry count exceeds threshold, remove the operation
          if (operation.retryCount >= 3) {
            console.warn('Operation failed after 3 retries, removing:', operation.id);
            await queue.dequeue(operation.id);
            const count = await queue.getCount();
            setQueuedOpsCount(count);
          }
        }
      }

      console.log('Finished syncing queued operations');
      setIsSyncing(false);
    } catch (err) {
      console.error('Failed to sync queued operations:', err);
      setLastError('Failed to sync operations');
      setIsSyncing(false);
    }
  }, [yjsDoc, provider]);

  // Detect transition from offline to online and trigger sync
  useEffect(() => {
    if (wasOfflineRef.current && !isOffline) {
      // Just came back online
      console.log('Connection restored, syncing queued operations...');
      
      // Wait a bit for the provider to fully establish connection
      const syncTimeout = setTimeout(() => {
        syncQueuedOperations();
      }, 1000);

      return () => clearTimeout(syncTimeout);
    }
    
    wasOfflineRef.current = isOffline;
  }, [isOffline, syncQueuedOperations]);

  return {
    queuedOpsCount,
    isSyncing,
    lastError,
  };
}

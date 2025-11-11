/**
 * useOfflineDetection Hook
 * 
 * Detects offline state by monitoring:
 * 1. WebSocket provider connection status
 * 2. Browser online/offline events
 * 
 * Returns offline state and last sync time
 */

import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';

export interface OfflineState {
  isOffline: boolean;
  lastSyncTime: Date | null;
  connectionStatus: 'connected' | 'disconnected' | 'syncing';
}

export function useOfflineDetection(provider: WebsocketProvider | null): OfflineState {
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'syncing'>('disconnected');

  useEffect(() => {
    if (!provider) {
      setIsOffline(true);
      setConnectionStatus('disconnected');
      return;
    }

    // Handler for WebSocket connection status changes
    const handleStatus = ({ status }: { status: string }) => {
      switch (status) {
        case 'connected':
          setIsOffline(false);
          setConnectionStatus('connected');
          setLastSyncTime(new Date());
          break;
        case 'disconnected':
          setIsOffline(true);
          setConnectionStatus('disconnected');
          break;
        default:
          setConnectionStatus('syncing');
      }
    };

    // Handler for sync events (successful synchronization)
    const handleSync = (isSynced: boolean) => {
      if (isSynced) {
        setLastSyncTime(new Date());
        setConnectionStatus('connected');
        setIsOffline(false);
      }
    };

    // Listen to provider status events
    provider.on('status', handleStatus);
    provider.on('sync', handleSync);

    // Check initial connection state
    if (provider.wsconnected) {
      setIsOffline(false);
      setConnectionStatus('connected');
      setLastSyncTime(new Date());
    } else {
      setIsOffline(true);
      setConnectionStatus('disconnected');
    }

    // Browser online/offline event handlers
    const handleOnline = () => {
      console.log('Browser online event detected');
      // Don't immediately set offline to false, wait for WebSocket to reconnect
      // The provider status handler will update the state
    };

    const handleOffline = () => {
      console.log('Browser offline event detected');
      setIsOffline(true);
      setConnectionStatus('disconnected');
    };

    // Listen to browser online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial browser online state
    if (!navigator.onLine) {
      setIsOffline(true);
      setConnectionStatus('disconnected');
    }

    // Cleanup
    return () => {
      provider.off('status', handleStatus);
      provider.off('sync', handleSync);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [provider]);

  return {
    isOffline,
    lastSyncTime,
    connectionStatus,
  };
}

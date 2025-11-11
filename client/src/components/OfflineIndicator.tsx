/**
 * OfflineIndicator Component
 * 
 * Displays offline status banner with:
 * - Offline/online status
 * - Count of queued operations
 * - Last sync time
 * - Syncing progress indicator
 */

import React from 'react';
import './OfflineIndicator.css';

export interface OfflineIndicatorProps {
  isOffline: boolean;
  queuedOpsCount: number;
  lastSyncTime: Date | null;
  isSyncing: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'syncing';
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOffline,
  queuedOpsCount,
  lastSyncTime,
  isSyncing,
  connectionStatus,
}) => {
  // Don't show anything if we're connected and not syncing
  if (!isOffline && !isSyncing && connectionStatus === 'connected') {
    return null;
  }

  const formatLastSync = (date: Date | null): string => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    
    if (diffSec < 60) {
      return 'Just now';
    } else if (diffMin < 60) {
      return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleString();
    }
  };

  const getStatusMessage = (): string => {
    if (isSyncing) {
      return `Syncing ${queuedOpsCount} operation${queuedOpsCount !== 1 ? 's' : ''}...`;
    }
    
    if (isOffline) {
      if (queuedOpsCount > 0) {
        return `Offline - ${queuedOpsCount} operation${queuedOpsCount !== 1 ? 's' : ''} queued`;
      }
      return 'Offline - Changes will sync when connection is restored';
    }
    
    if (connectionStatus === 'syncing') {
      return 'Connecting...';
    }
    
    return 'Connected';
  };

  const getStatusClass = (): string => {
    if (isSyncing) return 'syncing';
    if (isOffline) return 'offline';
    if (connectionStatus === 'syncing') return 'syncing';
    return 'online';
  };

  return (
    <div className={`offline-indicator ${getStatusClass()}`} role="status" aria-live="polite">
      <div className="offline-indicator-content">
        <div className="offline-indicator-icon">
          {isSyncing && <span className="spinner" aria-label="Syncing">⟳</span>}
          {isOffline && !isSyncing && <span aria-label="Offline">⚠</span>}
          {!isOffline && !isSyncing && connectionStatus === 'syncing' && (
            <span className="spinner" aria-label="Connecting">⟳</span>
          )}
          {!isOffline && !isSyncing && connectionStatus === 'connected' && (
            <span aria-label="Connected">✓</span>
          )}
        </div>
        
        <div className="offline-indicator-text">
          <div className="offline-indicator-status">{getStatusMessage()}</div>
          
          {lastSyncTime && !isSyncing && (
            <div className="offline-indicator-sync-time">
              Last synced: {formatLastSync(lastSyncTime)}
            </div>
          )}
        </div>
      </div>
      
      {isSyncing && (
        <div className="offline-indicator-progress">
          <div className="progress-bar" />
        </div>
      )}
    </div>
  );
};

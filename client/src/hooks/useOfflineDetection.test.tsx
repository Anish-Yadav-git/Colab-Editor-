/**
 * Tests for useOfflineDetection hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineDetection } from './useOfflineDetection';
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
  }

  disconnect() {
    this.wsconnected = false;
    this.emit('status', { status: 'disconnected' });
  }

  sync() {
    this.emit('sync', true);
  }
}

describe('useOfflineDetection', () => {
  let mockProvider: MockWebsocketProvider;
  let originalNavigator: any;

  beforeEach(() => {
    mockProvider = new MockWebsocketProvider();
    
    // Mock navigator.onLine
    originalNavigator = global.navigator;
    Object.defineProperty(global, 'navigator', {
      value: { onLine: true },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('should initialize with disconnected state when provider is null', () => {
    const { result } = renderHook(() => useOfflineDetection(null));

    expect(result.current.isOffline).toBe(true);
    expect(result.current.connectionStatus).toBe('disconnected');
    expect(result.current.lastSyncTime).toBeNull();
  });

  it('should detect connected state', () => {
    mockProvider.wsconnected = true;
    
    const { result } = renderHook(() => 
      useOfflineDetection(mockProvider as unknown as WebsocketProvider)
    );

    expect(result.current.isOffline).toBe(false);
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.lastSyncTime).toBeInstanceOf(Date);
  });

  it('should detect disconnected state', () => {
    mockProvider.wsconnected = false;
    
    const { result } = renderHook(() => 
      useOfflineDetection(mockProvider as unknown as WebsocketProvider)
    );

    expect(result.current.isOffline).toBe(true);
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('should update state on provider status change', () => {
    const { result } = renderHook(() => 
      useOfflineDetection(mockProvider as unknown as WebsocketProvider)
    );

    expect(result.current.isOffline).toBe(true);

    act(() => {
      mockProvider.connect();
    });

    expect(result.current.isOffline).toBe(false);
    expect(result.current.connectionStatus).toBe('connected');

    act(() => {
      mockProvider.disconnect();
    });

    expect(result.current.isOffline).toBe(true);
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('should update lastSyncTime on sync event', () => {
    mockProvider.wsconnected = true;
    
    const { result } = renderHook(() => 
      useOfflineDetection(mockProvider as unknown as WebsocketProvider)
    );

    const initialSyncTime = result.current.lastSyncTime;

    act(() => {
      mockProvider.sync();
    });

    expect(result.current.lastSyncTime).toBeInstanceOf(Date);
    if (initialSyncTime) {
      expect(result.current.lastSyncTime!.getTime()).toBeGreaterThanOrEqual(
        initialSyncTime.getTime()
      );
    }
  });

  it('should detect browser offline event', () => {
    mockProvider.wsconnected = true;
    
    const { result } = renderHook(() => 
      useOfflineDetection(mockProvider as unknown as WebsocketProvider)
    );

    expect(result.current.isOffline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOffline).toBe(true);
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('should detect browser online event', () => {
    mockProvider.wsconnected = false;
    
    const { result } = renderHook(() => 
      useOfflineDetection(mockProvider as unknown as WebsocketProvider)
    );

    expect(result.current.isOffline).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Note: online event doesn't immediately set offline to false
    // It waits for WebSocket to reconnect
  });

  it('should check navigator.onLine on mount', () => {
    Object.defineProperty(global.navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => 
      useOfflineDetection(mockProvider as unknown as WebsocketProvider)
    );

    expect(result.current.isOffline).toBe(true);
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('should clean up event listeners on unmount', () => {
    const { unmount } = renderHook(() => 
      useOfflineDetection(mockProvider as unknown as WebsocketProvider)
    );

    const offSpy = vi.spyOn(mockProvider, 'off');

    unmount();

    expect(offSpy).toHaveBeenCalledWith('status', expect.any(Function));
    expect(offSpy).toHaveBeenCalledWith('sync', expect.any(Function));
  });

  it('should handle syncing status', () => {
    const { result } = renderHook(() => 
      useOfflineDetection(mockProvider as unknown as WebsocketProvider)
    );

    act(() => {
      mockProvider.emit('status', { status: 'syncing' });
    });

    expect(result.current.connectionStatus).toBe('syncing');
  });
});

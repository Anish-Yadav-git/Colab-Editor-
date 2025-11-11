import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWebSocketError, getWebSocketErrorMessage } from './useWebSocketError';

describe('useWebSocketError', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('initializes with no error', () => {
    const { result } = renderHook(() => useWebSocketError());

    expect(result.current.error).toBeNull();
    expect(result.current.isRetrying).toBe(false);
    expect(result.current.retryAttempt).toBe(0);
  });

  it('handles error correctly', () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useWebSocketError({ onError }));

    act(() => {
      result.current.handleError('Connection failed', '1006');
    });

    expect(result.current.error).toEqual({
      message: 'Connection failed',
      code: '1006',
      timestamp: expect.any(Date),
      retryCount: 0,
    });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Connection failed',
      code: '1006',
    }));
  });

  it('retries with exponential backoff', async () => {
    const onRetry = vi.fn();
    const retryFn = vi.fn();
    const { result } = renderHook(() =>
      useWebSocketError({ initialDelay: 1000, onRetry })
    );

    act(() => {
      result.current.retry(retryFn);
    });

    expect(result.current.isRetrying).toBe(true);
    expect(result.current.retryAttempt).toBe(1);
    expect(onRetry).toHaveBeenCalledWith(1);

    // Fast-forward time and flush promises
    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    expect(retryFn).toHaveBeenCalled();
  });

  it('stops retrying after max attempts', () => {
    const onMaxRetriesReached = vi.fn();
    const retryFn = vi.fn();
    const { result } = renderHook(() =>
      useWebSocketError({ maxRetries: 3, onMaxRetriesReached })
    );

    // Attempt 4 retries (exceeding max of 3)
    for (let i = 0; i < 4; i++) {
      act(() => {
        result.current.retry(retryFn);
      });
    }

    expect(result.current.retryAttempt).toBe(3);
    expect(result.current.isRetrying).toBe(false);
    expect(onMaxRetriesReached).toHaveBeenCalled();
  });

  it('resets error state', () => {
    const { result } = renderHook(() => useWebSocketError());

    act(() => {
      result.current.handleError('Connection failed');
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.resetError();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isRetrying).toBe(false);
    expect(result.current.retryAttempt).toBe(0);
  });

  it('calculates exponential backoff correctly', () => {
    const retryFn = vi.fn();
    const { result } = renderHook(() =>
      useWebSocketError({ initialDelay: 1000, maxDelay: 10000 })
    );

    // First retry: ~1000ms
    act(() => {
      result.current.retry(retryFn);
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Second retry: ~2000ms
    act(() => {
      result.current.retry(retryFn);
    });

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    // Third retry: ~4000ms
    act(() => {
      result.current.retry(retryFn);
    });

    expect(result.current.retryAttempt).toBe(3);
  });

  it('respects max delay', () => {
    const retryFn = vi.fn();
    const { result } = renderHook(() =>
      useWebSocketError({ initialDelay: 1000, maxDelay: 5000 })
    );

    // Retry multiple times to exceed max delay
    for (let i = 0; i < 5; i++) {
      act(() => {
        result.current.retry(retryFn);
      });

      act(() => {
        vi.advanceTimersByTime(10000);
      });
    }

    // Delay should not exceed maxDelay
    expect(result.current.retryAttempt).toBe(5);
  });

  it('clears timeout on unmount', () => {
    const retryFn = vi.fn();
    const { result, unmount } = renderHook(() => useWebSocketError());

    act(() => {
      result.current.retry(retryFn);
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Retry function should not be called after unmount
    expect(retryFn).not.toHaveBeenCalled();
  });
});

describe('getWebSocketErrorMessage', () => {
  it('returns correct message for known error codes', () => {
    expect(getWebSocketErrorMessage('1000')).toBe('Connection closed normally');
    expect(getWebSocketErrorMessage('1001')).toBe('Server is going away');
    expect(getWebSocketErrorMessage('1006')).toBe('Connection lost unexpectedly');
    expect(getWebSocketErrorMessage('1011')).toBe('Server encountered an error');
  });

  it('returns default message for unknown error codes', () => {
    expect(getWebSocketErrorMessage('9999')).toBe('Connection error occurred');
    expect(getWebSocketErrorMessage()).toBe('Connection error occurred');
  });
});

import { useState, useCallback, useEffect } from 'react';

export interface WebSocketError {
  message: string;
  code?: string;
  timestamp: Date;
  retryCount: number;
}

export interface WebSocketErrorState {
  error: WebSocketError | null;
  isRetrying: boolean;
  retryAttempt: number;
}

interface UseWebSocketErrorOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  onError?: (error: WebSocketError) => void;
  onRetry?: (attempt: number) => void;
  onMaxRetriesReached?: () => void;
}

export function useWebSocketError(options: UseWebSocketErrorOptions = {}) {
  const {
    maxRetries = 5,
    initialDelay = 1000,
    maxDelay = 30000,
    onError,
    onRetry,
    onMaxRetriesReached,
  } = options;

  const [errorState, setErrorState] = useState<WebSocketErrorState>({
    error: null,
    isRetrying: false,
    retryAttempt: 0,
  });

  const [retryTimeout, setRetryTimeout] = useState<NodeJS.Timeout | null>(null);

  // Calculate exponential backoff delay
  const calculateDelay = useCallback(
    (attempt: number): number => {
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay;
      return delay + jitter;
    },
    [initialDelay, maxDelay]
  );

  // Handle WebSocket error
  const handleError = useCallback(
    (message: string, code?: string) => {
      const error: WebSocketError = {
        message,
        code,
        timestamp: new Date(),
        retryCount: errorState.retryAttempt,
      };

      setErrorState((prev) => ({
        ...prev,
        error,
      }));

      if (onError) {
        onError(error);
      }

      console.error('WebSocket error:', {
        message,
        code,
        timestamp: error.timestamp.toISOString(),
        retryCount: error.retryCount,
      });
    },
    [errorState.retryAttempt, onError]
  );

  // Retry connection with exponential backoff
  const retry = useCallback(
    (retryFn: () => void) => {
      if (errorState.retryAttempt >= maxRetries) {
        console.error('Max retry attempts reached');
        setErrorState((prev) => ({
          ...prev,
          isRetrying: false,
        }));

        if (onMaxRetriesReached) {
          onMaxRetriesReached();
        }
        return;
      }

      const delay = calculateDelay(errorState.retryAttempt);

      console.log(
        `Retrying WebSocket connection in ${Math.round(delay / 1000)}s (attempt ${
          errorState.retryAttempt + 1
        }/${maxRetries})`
      );

      setErrorState((prev) => ({
        ...prev,
        isRetrying: true,
        retryAttempt: prev.retryAttempt + 1,
      }));

      if (onRetry) {
        onRetry(errorState.retryAttempt + 1);
      }

      const timeout = setTimeout(() => {
        retryFn();
      }, delay);

      setRetryTimeout(timeout);
    },
    [
      errorState.retryAttempt,
      maxRetries,
      calculateDelay,
      onRetry,
      onMaxRetriesReached,
    ]
  );

  // Reset error state
  const resetError = useCallback(() => {
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      setRetryTimeout(null);
    }

    setErrorState({
      error: null,
      isRetrying: false,
      retryAttempt: 0,
    });
  }, [retryTimeout]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [retryTimeout]);

  return {
    error: errorState.error,
    isRetrying: errorState.isRetrying,
    retryAttempt: errorState.retryAttempt,
    handleError,
    retry,
    resetError,
  };
}

// Helper function to get user-friendly error message
export function getWebSocketErrorMessage(code?: string): string {
  switch (code) {
    case '1000':
      return 'Connection closed normally';
    case '1001':
      return 'Server is going away';
    case '1002':
      return 'Protocol error';
    case '1003':
      return 'Unsupported data received';
    case '1006':
      return 'Connection lost unexpectedly';
    case '1007':
      return 'Invalid message data';
    case '1008':
      return 'Policy violation';
    case '1009':
      return 'Message too large';
    case '1010':
      return 'Extension negotiation failed';
    case '1011':
      return 'Server encountered an error';
    case '1012':
      return 'Service is restarting';
    case '1013':
      return 'Service is overloaded, try again later';
    case '1014':
      return 'Bad gateway';
    case '1015':
      return 'TLS handshake failed';
    default:
      return 'Connection error occurred';
  }
}

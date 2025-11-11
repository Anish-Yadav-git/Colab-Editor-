import React from 'react';
import './WebSocketErrorNotification.css';
import { WebSocketError } from '../hooks/useWebSocketError';

interface WebSocketErrorNotificationProps {
  error: WebSocketError | null;
  isRetrying: boolean;
  retryAttempt: number;
  maxRetries: number;
  onDismiss?: () => void;
  onManualRetry?: () => void;
}

const WebSocketErrorNotification: React.FC<WebSocketErrorNotificationProps> = ({
  error,
  isRetrying,
  retryAttempt,
  maxRetries,
  onDismiss,
  onManualRetry,
}) => {
  if (!error) {
    return null;
  }

  const isMaxRetriesReached = retryAttempt >= maxRetries;

  return (
    <div className="ws-error-notification" role="alert">
      <div className="ws-error-content">
        <div className="ws-error-icon">
          {isRetrying ? '🔄' : isMaxRetriesReached ? '❌' : '⚠️'}
        </div>
        <div className="ws-error-details">
          <div className="ws-error-title">
            {isRetrying
              ? 'Reconnecting...'
              : isMaxRetriesReached
              ? 'Connection Failed'
              : 'Connection Error'}
          </div>
          <div className="ws-error-message">{error.message}</div>
          {isRetrying && (
            <div className="ws-error-retry">
              Retry attempt {retryAttempt} of {maxRetries}
            </div>
          )}
          {isMaxRetriesReached && (
            <div className="ws-error-retry">
              Maximum retry attempts reached. Please check your connection.
            </div>
          )}
        </div>
        <div className="ws-error-actions">
          {isMaxRetriesReached && onManualRetry && (
            <button onClick={onManualRetry} className="ws-error-button retry">
              Retry Now
            </button>
          )}
          {onDismiss && !isRetrying && (
            <button onClick={onDismiss} className="ws-error-button dismiss">
              ✕
            </button>
          )}
        </div>
      </div>
      {isRetrying && (
        <div className="ws-error-progress">
          <div className="ws-error-progress-bar"></div>
        </div>
      )}
    </div>
  );
};

export default WebSocketErrorNotification;

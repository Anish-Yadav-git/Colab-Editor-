import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WebSocketErrorNotification from './WebSocketErrorNotification';
import { WebSocketError } from '../hooks/useWebSocketError';

describe('WebSocketErrorNotification', () => {
  const mockError: WebSocketError = {
    message: 'Connection failed',
    code: '1006',
    timestamp: new Date(),
    retryCount: 0,
  };

  it('renders nothing when no error', () => {
    const { container } = render(
      <WebSocketErrorNotification
        error={null}
        isRetrying={false}
        retryAttempt={0}
        maxRetries={5}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders error notification when error exists', () => {
    render(
      <WebSocketErrorNotification
        error={mockError}
        isRetrying={false}
        retryAttempt={0}
        maxRetries={5}
      />
    );

    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('shows reconnecting state when retrying', () => {
    render(
      <WebSocketErrorNotification
        error={mockError}
        isRetrying={true}
        retryAttempt={2}
        maxRetries={5}
      />
    );

    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
    expect(screen.getByText('Retry attempt 2 of 5')).toBeInTheDocument();
  });

  it('shows connection failed when max retries reached', () => {
    render(
      <WebSocketErrorNotification
        error={mockError}
        isRetrying={false}
        retryAttempt={5}
        maxRetries={5}
      />
    );

    expect(screen.getByText('Connection Failed')).toBeInTheDocument();
    expect(
      screen.getByText('Maximum retry attempts reached. Please check your connection.')
    ).toBeInTheDocument();
  });

  it('shows retry button when max retries reached', () => {
    const onManualRetry = vi.fn();
    render(
      <WebSocketErrorNotification
        error={mockError}
        isRetrying={false}
        retryAttempt={5}
        maxRetries={5}
        onManualRetry={onManualRetry}
      />
    );

    const retryButton = screen.getByText('Retry Now');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onManualRetry).toHaveBeenCalled();
  });

  it('shows dismiss button when not retrying', () => {
    const onDismiss = vi.fn();
    render(
      <WebSocketErrorNotification
        error={mockError}
        isRetrying={false}
        retryAttempt={0}
        maxRetries={5}
        onDismiss={onDismiss}
      />
    );

    const dismissButton = screen.getByText('✕');
    expect(dismissButton).toBeInTheDocument();

    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('hides dismiss button when retrying', () => {
    const onDismiss = vi.fn();
    render(
      <WebSocketErrorNotification
        error={mockError}
        isRetrying={true}
        retryAttempt={1}
        maxRetries={5}
        onDismiss={onDismiss}
      />
    );

    expect(screen.queryByText('✕')).not.toBeInTheDocument();
  });

  it('shows progress bar when retrying', () => {
    const { container } = render(
      <WebSocketErrorNotification
        error={mockError}
        isRetrying={true}
        retryAttempt={1}
        maxRetries={5}
      />
    );

    expect(container.querySelector('.ws-error-progress')).toBeInTheDocument();
  });

  it('hides progress bar when not retrying', () => {
    const { container } = render(
      <WebSocketErrorNotification
        error={mockError}
        isRetrying={false}
        retryAttempt={0}
        maxRetries={5}
      />
    );

    expect(container.querySelector('.ws-error-progress')).not.toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    render(
      <WebSocketErrorNotification
        error={mockError}
        isRetrying={false}
        retryAttempt={0}
        maxRetries={5}
      />
    );

    const notification = screen.getByRole('alert');
    expect(notification).toBeInTheDocument();
  });
});

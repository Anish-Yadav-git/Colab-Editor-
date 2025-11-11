/**
 * Tests for OfflineIndicator component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineIndicator } from './OfflineIndicator';

describe('OfflineIndicator', () => {
  it('should not render when connected and not syncing', () => {
    const { container } = render(
      <OfflineIndicator
        isOffline={false}
        queuedOpsCount={0}
        lastSyncTime={new Date()}
        isSyncing={false}
        connectionStatus="connected"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render offline banner when offline', () => {
    render(
      <OfflineIndicator
        isOffline={true}
        queuedOpsCount={0}
        lastSyncTime={null}
        isSyncing={false}
        connectionStatus="disconnected"
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });

  it('should display queued operations count', () => {
    render(
      <OfflineIndicator
        isOffline={true}
        queuedOpsCount={5}
        lastSyncTime={null}
        isSyncing={false}
        connectionStatus="disconnected"
      />
    );

    expect(screen.getByText(/5 operations queued/i)).toBeInTheDocument();
  });

  it('should display singular operation text for 1 operation', () => {
    render(
      <OfflineIndicator
        isOffline={true}
        queuedOpsCount={1}
        lastSyncTime={null}
        isSyncing={false}
        connectionStatus="disconnected"
      />
    );

    expect(screen.getByText(/1 operation queued/i)).toBeInTheDocument();
  });

  it('should display syncing status', () => {
    render(
      <OfflineIndicator
        isOffline={false}
        queuedOpsCount={3}
        lastSyncTime={new Date()}
        isSyncing={true}
        connectionStatus="syncing"
      />
    );

    expect(screen.getByText(/syncing 3 operations/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Syncing')).toBeInTheDocument();
  });

  it('should display last sync time', () => {
    const lastSyncTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

    render(
      <OfflineIndicator
        isOffline={true}
        queuedOpsCount={0}
        lastSyncTime={lastSyncTime}
        isSyncing={false}
        connectionStatus="disconnected"
      />
    );

    expect(screen.getByText(/last synced:/i)).toBeInTheDocument();
    expect(screen.getByText(/5 minutes ago/i)).toBeInTheDocument();
  });

  it('should display "Just now" for recent sync', () => {
    const lastSyncTime = new Date(Date.now() - 30 * 1000); // 30 seconds ago

    render(
      <OfflineIndicator
        isOffline={true}
        queuedOpsCount={0}
        lastSyncTime={lastSyncTime}
        isSyncing={false}
        connectionStatus="disconnected"
      />
    );

    expect(screen.getByText(/just now/i)).toBeInTheDocument();
  });

  it('should display hours for older sync', () => {
    const lastSyncTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

    render(
      <OfflineIndicator
        isOffline={true}
        queuedOpsCount={0}
        lastSyncTime={lastSyncTime}
        isSyncing={false}
        connectionStatus="disconnected"
      />
    );

    expect(screen.getByText(/2 hours ago/i)).toBeInTheDocument();
  });

  it('should not display last sync time when syncing', () => {
    render(
      <OfflineIndicator
        isOffline={false}
        queuedOpsCount={2}
        lastSyncTime={new Date()}
        isSyncing={true}
        connectionStatus="syncing"
      />
    );

    expect(screen.queryByText(/last synced:/i)).not.toBeInTheDocument();
  });

  it('should apply correct CSS class for offline state', () => {
    const { container } = render(
      <OfflineIndicator
        isOffline={true}
        queuedOpsCount={0}
        lastSyncTime={null}
        isSyncing={false}
        connectionStatus="disconnected"
      />
    );

    const indicator = container.querySelector('.offline-indicator');
    expect(indicator).toHaveClass('offline');
  });

  it('should apply correct CSS class for syncing state', () => {
    const { container } = render(
      <OfflineIndicator
        isOffline={false}
        queuedOpsCount={1}
        lastSyncTime={new Date()}
        isSyncing={true}
        connectionStatus="syncing"
      />
    );

    const indicator = container.querySelector('.offline-indicator');
    expect(indicator).toHaveClass('syncing');
  });

  it('should show progress bar when syncing', () => {
    const { container } = render(
      <OfflineIndicator
        isOffline={false}
        queuedOpsCount={1}
        lastSyncTime={new Date()}
        isSyncing={true}
        connectionStatus="syncing"
      />
    );

    expect(container.querySelector('.offline-indicator-progress')).toBeInTheDocument();
    expect(container.querySelector('.progress-bar')).toBeInTheDocument();
  });

  it('should not show progress bar when not syncing', () => {
    const { container } = render(
      <OfflineIndicator
        isOffline={true}
        queuedOpsCount={0}
        lastSyncTime={null}
        isSyncing={false}
        connectionStatus="disconnected"
      />
    );

    expect(container.querySelector('.offline-indicator-progress')).not.toBeInTheDocument();
  });

  it('should display connecting status', () => {
    render(
      <OfflineIndicator
        isOffline={false}
        queuedOpsCount={0}
        lastSyncTime={null}
        isSyncing={false}
        connectionStatus="syncing"
      />
    );

    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('should have proper ARIA attributes', () => {
    render(
      <OfflineIndicator
        isOffline={true}
        queuedOpsCount={0}
        lastSyncTime={null}
        isSyncing={false}
        connectionStatus="disconnected"
      />
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});

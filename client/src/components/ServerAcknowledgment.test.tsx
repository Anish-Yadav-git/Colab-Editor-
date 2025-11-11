import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { EditorContainer, SyncStatus } from './EditorContainer';
import * as Y from 'yjs';

// Mock Monaco Editor
const createMockEditor = () => {
  const mockModel = {
    getValue: vi.fn(() => ''),
    setValue: vi.fn(),
    onDidChangeContent: vi.fn(() => ({ dispose: vi.fn() })),
  };

  const mockEditor = {
    getModel: vi.fn(() => mockModel),
    getDomNode: vi.fn(() => document.createElement('div')),
    onDidChangeCursorPosition: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeCursorSelection: vi.fn(() => ({ dispose: vi.fn() })),
    dispose: vi.fn(),
  };

  return { mockEditor, mockModel };
};

vi.mock('@monaco-editor/react', () => ({
  default: ({ onMount }: any) => {
    if (onMount) {
      setTimeout(() => {
        const { mockEditor } = createMockEditor();
        onMount(mockEditor, {});
      }, 0);
    }
    return <div data-testid="monaco-editor">Monaco Editor Mock</div>;
  },
}));

// Mock y-monaco
let monacoBindingInstance: any = null;

vi.mock('y-monaco', () => {
  class MockMonacoBinding {
    public yText: Y.Text;
    public model: any;

    constructor(yText: Y.Text, model: any, _editors: any, _awareness?: any) {
      this.yText = yText;
      this.model = model;
      monacoBindingInstance = this;
    }

    destroy() {
      monacoBindingInstance = null;
    }
  }

  return {
    MonacoBinding: MockMonacoBinding,
  };
});

// Mock y-websocket with controllable sync
let mockProviderInstance: any = null;

vi.mock('y-websocket', () => {
  class MockWebsocketProvider {
    public awareness: any;
    private eventHandlers: Record<string, Function[]> = {};
    private doc: Y.Doc;

    constructor(_serverUrl: string, _documentId: string, doc: Y.Doc, _options?: any) {
      this.doc = doc;
      this.awareness = {
        setLocalState: vi.fn(),
        setLocalStateField: vi.fn(),
        getStates: vi.fn(() => new Map()),
        clientID: 1,
        on: vi.fn(),
        off: vi.fn(),
      };
      mockProviderInstance = this;

      // Simulate initial connection
      setTimeout(() => {
        this.emit('status', { status: 'connected' });
        this.emit('sync', true);
      }, 10);
    }

    on(event: string, handler: Function) {
      if (!this.eventHandlers[event]) {
        this.eventHandlers[event] = [];
      }
      this.eventHandlers[event].push(handler);
    }

    off(event: string, handler: Function) {
      if (this.eventHandlers[event]) {
        this.eventHandlers[event] = this.eventHandlers[event].filter((h) => h !== handler);
      }
    }

    emit(event: string, data: any) {
      if (this.eventHandlers[event]) {
        this.eventHandlers[event].forEach((handler) => handler(data));
      }
    }

    // Simulate server sync acknowledgment
    simulateSync(isSynced: boolean) {
      this.emit('sync', isSynced);
    }

    destroy() {
      mockProviderInstance = null;
    }
  }

  return {
    WebsocketProvider: MockWebsocketProvider,
  };
});

describe('Server Acknowledgment Handling', () => {
  const defaultProps = {
    documentId: 'test-doc-123',
    userId: 'user-456',
    token: 'test-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    monacoBindingInstance = null;
    mockProviderInstance = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should listen to WebSocket provider sync events', async () => {
    const onSyncStatusChange = vi.fn();
    const { unmount } = render(
      <EditorContainer {...defaultProps} onSyncStatusChange={onSyncStatusChange} />
    );

    await waitFor(() => {
      expect(mockProviderInstance).not.toBeNull();
    });

    // Initial sync event should be captured
    await waitFor(() => {
      expect(onSyncStatusChange).toHaveBeenCalled();
    });

    // Verify sync status was reported
    const calls = onSyncStatusChange.mock.calls;
    const lastCall = calls[calls.length - 1][0] as SyncStatus;
    expect(lastCall).toHaveProperty('isSynced');
    expect(lastCall).toHaveProperty('pendingOperations');

    unmount();
  });

  it('should track pending operations count', async () => {
    const onSyncStatusChange = vi.fn();
    const { unmount } = render(
      <EditorContainer {...defaultProps} onSyncStatusChange={onSyncStatusChange} />
    );

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;

    // Clear previous calls
    onSyncStatusChange.mockClear();

    // Make local edits (should increment pending operations)
    yText.insert(0, 'A');
    yText.insert(1, 'B');
    yText.insert(2, 'C');

    // Wait for sync status updates
    await waitFor(() => {
      expect(onSyncStatusChange).toHaveBeenCalled();
    });

    // Check that pending operations were tracked
    const calls = onSyncStatusChange.mock.calls;
    const lastCall = calls[calls.length - 1][0] as SyncStatus;
    expect(lastCall.pendingOperations).toBeGreaterThan(0);
    expect(lastCall.isSynced).toBe(false);

    unmount();
  });

  it('should show syncing indicator when operations are pending', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;

    // Make local edit
    yText.insert(0, 'Test');

    // Should show syncing state
    await waitFor(() => {
      expect(screen.getByText(/Syncing/)).toBeInTheDocument();
    });

    unmount();
  });

  it('should reset pending operations count after sync', async () => {
    const onSyncStatusChange = vi.fn();
    const { unmount } = render(
      <EditorContainer {...defaultProps} onSyncStatusChange={onSyncStatusChange} />
    );

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;

    // Make local edits
    yText.insert(0, 'Hello');

    // Wait for pending operations to be tracked
    await waitFor(() => {
      const calls = onSyncStatusChange.mock.calls;
      if (calls.length > 0) {
        const lastCall = calls[calls.length - 1][0] as SyncStatus;
        return lastCall.pendingOperations > 0;
      }
      return false;
    });

    // Simulate server sync acknowledgment
    mockProviderInstance.simulateSync(true);

    // Wait for sync status to update
    await waitFor(() => {
      const calls = onSyncStatusChange.mock.calls;
      const lastCall = calls[calls.length - 1][0] as SyncStatus;
      return lastCall.isSynced === true && lastCall.pendingOperations === 0;
    });

    const calls = onSyncStatusChange.mock.calls;
    const lastCall = calls[calls.length - 1][0] as SyncStatus;
    expect(lastCall.isSynced).toBe(true);
    expect(lastCall.pendingOperations).toBe(0);

    unmount();
  });

  it('should display pending operations count in UI', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;

    // Make multiple local edits
    yText.insert(0, 'A');
    yText.insert(1, 'B');
    yText.insert(2, 'C');

    // Should show pending operations in UI
    await waitFor(() => {
      const syncingText = screen.getByText(/Syncing/);
      expect(syncingText).toBeInTheDocument();
      // Check for pending operations indicator
      const pendingText = screen.getByText(/pending/);
      expect(pendingText).toBeInTheDocument();
    });

    unmount();
  });

  it('should handle rapid edits and track all pending operations', async () => {
    const onSyncStatusChange = vi.fn();
    const { unmount } = render(
      <EditorContainer {...defaultProps} onSyncStatusChange={onSyncStatusChange} />
    );

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;

    // Make rapid edits
    for (let i = 0; i < 10; i++) {
      yText.insert(i, String(i));
    }

    // Wait for sync status updates
    await waitFor(() => {
      expect(onSyncStatusChange).toHaveBeenCalled();
    });

    // Verify pending operations were tracked
    const calls = onSyncStatusChange.mock.calls;
    const lastCall = calls[calls.length - 1][0] as SyncStatus;
    expect(lastCall.pendingOperations).toBeGreaterThan(0);

    unmount();
  });

  it('should not count remote updates as pending operations', async () => {
    const onSyncStatusChange = vi.fn();
    const { unmount } = render(
      <EditorContainer {...defaultProps} onSyncStatusChange={onSyncStatusChange} />
    );

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    // Clear initial sync calls
    onSyncStatusChange.mockClear();

    // Simulate remote update (origin is the provider)
    const yText = monacoBindingInstance.yText;
    const yjsDoc = yText.doc;
    
    // Apply update with provider as origin (simulating remote change)
    yjsDoc.transact(() => {
      yText.insert(0, 'Remote');
    }, mockProviderInstance);

    // Wait a bit to ensure any handlers would have fired
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not have incremented pending operations for remote updates
    if (onSyncStatusChange.mock.calls.length > 0) {
      const calls = onSyncStatusChange.mock.calls;
      const lastCall = calls[calls.length - 1][0] as SyncStatus;
      // Remote updates should not increase pending count
      expect(lastCall.pendingOperations).toBe(0);
    }

    unmount();
  });

  it('should transition from syncing to connected after acknowledgment', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;

    // Make local edit
    yText.insert(0, 'Test');

    // Should show syncing
    await waitFor(() => {
      expect(screen.getByText(/Syncing/)).toBeInTheDocument();
    });

    // Simulate server acknowledgment
    mockProviderInstance.simulateSync(true);

    // Should transition to connected
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    unmount();
  });
});

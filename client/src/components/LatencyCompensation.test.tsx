import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { EditorContainer } from './EditorContainer';
import * as Y from 'yjs';

// Mock Monaco Editor with more detailed implementation
const createMockEditor = () => {
  const mockModel = {
    getValue: vi.fn(() => ''),
    setValue: vi.fn(),
    onDidChangeContent: vi.fn(() => ({ dispose: vi.fn() })),
    getValueLength: vi.fn(() => 0),
    getLineCount: vi.fn(() => 1),
    applyEdits: vi.fn(),
  };

  const mockEditor = {
    getModel: vi.fn(() => mockModel),
    getDomNode: vi.fn(() => document.createElement('div')),
    onDidChangeCursorPosition: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeCursorSelection: vi.fn(() => ({ dispose: vi.fn() })),
    dispose: vi.fn(),
    getValue: vi.fn(() => mockModel.getValue()),
    setValue: vi.fn((value: string) => mockModel.setValue(value)),
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

// Mock y-monaco with tracking
let monacoBindingInstance: any = null;

vi.mock('y-monaco', () => {
  class MockMonacoBinding {
    private yText: Y.Text;
    private model: any;
    private awareness: any;

    constructor(yText: Y.Text, model: any, _editors: any, awareness?: any) {
      this.yText = yText;
      this.model = model;
      this.awareness = awareness;
      monacoBindingInstance = this;

      // Simulate binding: when yText changes, update model
      this.yText.observe(() => {
        const content = this.yText.toString();
        this.model.setValue(content);
      });
    }

    destroy() {
      monacoBindingInstance = null;
    }
  }

  return {
    MonacoBinding: MockMonacoBinding,
  };
});

// Mock y-websocket with latency simulation
let mockProviderInstance: any = null;
let simulatedLatency = 0;

vi.mock('y-websocket', () => {
  class MockWebsocketProvider {
    public awareness: any;
    private eventHandlers: Record<string, Function[]> = {};
    private doc: Y.Doc;
    private connected = false;

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

      // Simulate connection after a delay
      setTimeout(() => {
        this.connected = true;
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

    // Simulate server acknowledgment with latency
    simulateServerAck(delay: number = simulatedLatency) {
      return new Promise((resolve) => {
        setTimeout(() => {
          this.emit('sync', true);
          resolve(true);
        }, delay);
      });
    }

    destroy() {
      this.connected = false;
      mockProviderInstance = null;
    }
  }

  return {
    WebsocketProvider: MockWebsocketProvider,
  };
});

describe('Latency Compensation - Local-First Editing', () => {
  const defaultProps = {
    documentId: 'test-doc-123',
    userId: 'user-456',
    token: 'test-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    monacoBindingInstance = null;
    mockProviderInstance = null;
    simulatedLatency = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should apply local changes immediately without waiting for server', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    // Wait for editor to mount and initialize
    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    }, { timeout: 1000 });

    // Get the Yjs text instance
    const yText = monacoBindingInstance.yText;
    const startTime = Date.now();

    // Insert text locally
    yText.insert(0, 'Hello World');

    // Measure how long it took to apply locally
    const localApplyTime = Date.now() - startTime;

    // Local changes should be applied immediately (< 10ms)
    expect(localApplyTime).toBeLessThan(10);

    // Verify the text was inserted
    expect(yText.toString()).toBe('Hello World');

    unmount();
  });

  it('should maintain typing responsiveness with 200ms network latency', async () => {
    simulatedLatency = 200;
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    }, { timeout: 1000 });

    const yText = monacoBindingInstance.yText;
    const typingTimes: number[] = [];

    // Simulate typing multiple characters
    const characters = 'The quick brown fox';
    for (let i = 0; i < characters.length; i++) {
      const startTime = Date.now();
      yText.insert(i, characters[i]);
      const endTime = Date.now();
      typingTimes.push(endTime - startTime);
    }

    // All local insertions should be fast (< 10ms each)
    typingTimes.forEach((time) => {
      expect(time).toBeLessThan(10);
    });

    // Verify all characters were inserted locally
    expect(yText.toString()).toBe(characters);

    // Server acknowledgment happens in background (doesn't block typing)
    await mockProviderInstance.simulateServerAck(200);

    unmount();
  });

  it('should handle rapid typing without blocking on server responses', async () => {
    simulatedLatency = 500; // High latency
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    }, { timeout: 1000 });

    const yText = monacoBindingInstance.yText;
    const startTime = Date.now();

    // Simulate rapid typing (50 characters)
    const text = 'a'.repeat(50);
    for (let i = 0; i < text.length; i++) {
      yText.insert(i, text[i]);
    }

    const totalTime = Date.now() - startTime;

    // All 50 characters should be inserted locally in < 100ms total
    expect(totalTime).toBeLessThan(100);
    expect(yText.toString()).toBe(text);

    unmount();
  });

  it('should update Monaco editor immediately on local changes', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    }, { timeout: 1000 });

    const yText = monacoBindingInstance.yText;
    const model = monacoBindingInstance.model;

    // Insert text
    yText.insert(0, 'Test content');

    // Wait for observer to fire
    await waitFor(() => {
      expect(model.setValue).toHaveBeenCalled();
    });

    // Verify model was updated with the content
    const calls = model.setValue.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toBe('Test content');

    unmount();
  });

  it('should not block local edits while waiting for server sync', async () => {
    simulatedLatency = 1000; // Very high latency
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    }, { timeout: 1000 });

    const yText = monacoBindingInstance.yText;

    // Make first edit
    yText.insert(0, 'First ');
    expect(yText.toString()).toBe('First ');

    // Make second edit immediately (don't wait for server)
    yText.insert(6, 'Second ');
    expect(yText.toString()).toBe('First Second ');

    // Make third edit
    yText.insert(13, 'Third');
    expect(yText.toString()).toBe('First Second Third');

    // All edits applied locally without waiting
    // Server sync happens in background
    const syncPromise = mockProviderInstance.simulateServerAck(1000);

    // Can still make more edits while syncing
    yText.insert(18, '!');
    expect(yText.toString()).toBe('First Second Third!');

    await syncPromise;

    unmount();
  });

  it('should verify Yjs CRDT properties enable local-first editing', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    }, { timeout: 1000 });

    const yText = monacoBindingInstance.yText;

    // Yjs should allow local operations without coordination
    yText.insert(0, 'A');
    yText.insert(1, 'B');
    yText.insert(2, 'C');

    // All operations applied immediately
    expect(yText.toString()).toBe('ABC');

    // Delete operation also immediate
    yText.delete(1, 1);
    expect(yText.toString()).toBe('AC');

    unmount();
  });
});

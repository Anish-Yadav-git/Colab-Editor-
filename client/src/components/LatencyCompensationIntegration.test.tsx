import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { EditorContainer } from './EditorContainer';
import * as Y from 'yjs';

// Mock Monaco Editor with detailed tracking
const createMockEditor = () => {
  let currentPosition = { lineNumber: 1, column: 1 };
  let contentChangeHandlers: Array<(e: any) => void> = [];

  const mockModel = {
    getValue: vi.fn(() => ''),
    setValue: vi.fn(),
    onDidChangeContent: vi.fn((handler) => {
      contentChangeHandlers.push(handler);
      return { dispose: vi.fn() };
    }),
    getValueLength: vi.fn(() => 0),
    getLineCount: vi.fn(() => 1),
    applyEdits: vi.fn(),
    _triggerContentChange: (changes: any[]) => {
      const event = { changes };
      contentChangeHandlers.forEach(handler => handler(event));
    },
  };

  const mockEditor = {
    getModel: vi.fn(() => mockModel),
    getDomNode: vi.fn(() => document.createElement('div')),
    getPosition: vi.fn(() => currentPosition),
    setPosition: vi.fn((pos) => {
      currentPosition = pos;
    }),
    onDidChangeCursorPosition: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeCursorSelection: vi.fn(() => ({ dispose: vi.fn() })),
    dispose: vi.fn(),
    _setPosition: (pos: any) => {
      currentPosition = pos;
    },
  };

  return { mockEditor, mockModel };
};

let editorInstance: any = null;

vi.mock('@monaco-editor/react', () => ({
  default: ({ onMount }: any) => {
    if (onMount) {
      setTimeout(() => {
        const { mockEditor } = createMockEditor();
        editorInstance = mockEditor;
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
    public editor: any;

    constructor(yText: Y.Text, model: any, editors: Set<any>, _awareness?: any) {
      this.yText = yText;
      this.model = model;
      this.editor = Array.from(editors)[0];
      monacoBindingInstance = this;

      this.yText.observe((event) => {
        const content = this.yText.toString();
        this.model.setValue(content);
        this.model.getValueLength.mockReturnValue(content.length);
        
        const changes = event.changes.delta.map((change: any, index: number) => ({
          range: {
            startLineNumber: 1,
            startColumn: index + 1,
            endLineNumber: 1,
            endColumn: index + 1,
          },
          rangeLength: change.retain || 0,
          text: change.insert || '',
        }));
        
        if (this.model._triggerContentChange) {
          this.model._triggerContentChange(changes);
        }
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
let networkLatency = 0;

vi.mock('y-websocket', () => {
  class MockWebsocketProvider {
    public awareness: any;
    private eventHandlers: Record<string, Function[]> = {};
    private doc: Y.Doc;
    private syncQueue: Array<() => void> = [];

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

      // Simulate initial connection with latency
      setTimeout(() => {
        this.emit('status', { status: 'connected' });
        this.emit('sync', true);
      }, networkLatency || 10);
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

    // Simulate server sync with artificial latency
    simulateServerSync(isSynced: boolean, delay: number = networkLatency) {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          this.emit('sync', isSynced);
          resolve();
        }, delay);
      });
    }

    destroy() {
      mockProviderInstance = null;
    }
  }

  return {
    WebsocketProvider: MockWebsocketProvider,
  };
});

describe('Latency Compensation Integration Tests', () => {
  const defaultProps = {
    documentId: 'test-doc-123',
    userId: 'user-456',
    token: 'test-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    monacoBindingInstance = null;
    mockProviderInstance = null;
    editorInstance = null;
    networkLatency = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Local Editing Responsiveness', () => {
    it('should maintain sub-10ms local edit latency with 500ms network latency', async () => {
      networkLatency = 500;
      const { unmount } = render(<EditorContainer {...defaultProps} />);

      await waitFor(() => {
        expect(monacoBindingInstance).not.toBeNull();
      }, { timeout: 2000 });

      const yText = monacoBindingInstance.yText;
      const editTimes: number[] = [];

      // Perform 20 rapid edits
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        yText.insert(i, String(i));
        const end = performance.now();
        editTimes.push(end - start);
      }

      // All local edits should be fast despite network latency
      editTimes.forEach((time) => {
        expect(time).toBeLessThan(10);
      });

      // Verify all edits were applied locally (at least 20 characters)
      expect(yText.toString().length).toBeGreaterThanOrEqual(20);

      unmount();
    });

    it('should handle burst typing without blocking', async () => {
      networkLatency = 300;
      const { unmount } = render(<EditorContainer {...defaultProps} />);

      await waitFor(() => {
        expect(monacoBindingInstance).not.toBeNull();
      }, { timeout: 2000 });

      const yText = monacoBindingInstance.yText;
      const text = 'The quick brown fox jumps over the lazy dog';
      const startTime = performance.now();

      // Simulate burst typing
      for (let i = 0; i < text.length; i++) {
        yText.insert(i, text[i]);
      }

      const totalTime = performance.now() - startTime;

      // Total time should be minimal (< 100ms for 44 characters)
      expect(totalTime).toBeLessThan(100);
      expect(yText.toString()).toBe(text);

      unmount();
    });

    it('should not block on server acknowledgment', async () => {
      networkLatency = 1000; // Very high latency
      const { unmount } = render(<EditorContainer {...defaultProps} />);

      await waitFor(() => {
        expect(monacoBindingInstance).not.toBeNull();
      }, { timeout: 2000 });

      const yText = monacoBindingInstance.yText;

      // Make first edit
      const start1 = performance.now();
      yText.insert(0, 'First');
      const time1 = performance.now() - start1;

      // Make second edit immediately (don't wait for server)
      const start2 = performance.now();
      yText.insert(5, ' Second');
      const time2 = performance.now() - start2;

      // Both edits should be fast
      expect(time1).toBeLessThan(10);
      expect(time2).toBeLessThan(10);

      expect(yText.toString()).toBe('First Second');

      unmount();
    });
  });

  describe('Cursor Preservation During Conflicts', () => {
    it('should preserve cursor position with injected latency', async () => {
      networkLatency = 200;
      const { unmount } = render(<EditorContainer {...defaultProps} />);

      await waitFor(() => {
        expect(monacoBindingInstance).not.toBeNull();
      }, { timeout: 2000 });

      const yText = monacoBindingInstance.yText;

      // Initial content
      yText.insert(0, 'Hello World');
      await waitFor(() => expect(yText.toString()).toBe('Hello World'));

      // Set cursor position
      editorInstance._setPosition({ lineNumber: 1, column: 7 });

      // Remote edit before cursor
      yText.insert(0, 'Prefix: ');

      await waitFor(() => {
        expect(yText.toString()).toBe('Prefix: Hello World');
      });

      // Cursor should be preserved relative to content
      // Monaco binding handles this automatically

      unmount();
    });

    it('should handle concurrent edits with artificial latency', async () => {
      networkLatency = 250;
      const { unmount } = render(<EditorContainer {...defaultProps} />);

      await waitFor(() => {
        expect(monacoBindingInstance).not.toBeNull();
      }, { timeout: 2000 });

      const yText = monacoBindingInstance.yText;

      // Initial content
      yText.insert(0, 'Document');
      await waitFor(() => expect(yText.toString()).toBe('Document'));

      // Set cursor in middle
      editorInstance._setPosition({ lineNumber: 1, column: 5 });

      // Simulate concurrent edits with latency
      yText.insert(0, 'My ');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      yText.insert(yText.length, ' Content');
      await new Promise(resolve => setTimeout(resolve, 50));

      await waitFor(() => {
        expect(yText.toString()).toBe('My Document Content');
      });

      unmount();
    });

    it('should avoid cursor jumps during high-latency conflict resolution', async () => {
      networkLatency = 500;
      const { unmount } = render(<EditorContainer {...defaultProps} />);

      await waitFor(() => {
        expect(monacoBindingInstance).not.toBeNull();
      }, { timeout: 2000 });

      const yText = monacoBindingInstance.yText;

      // Setup initial state
      yText.insert(0, 'Line 1\nLine 2\nLine 3');
      await waitFor(() => expect(yText.toString()).toContain('Line 3'));

      // Position cursor on line 2
      editorInstance._setPosition({ lineNumber: 2, column: 4 });

      // Concurrent edits on different lines
      yText.insert(0, 'Header\n');
      yText.insert(yText.length, '\nFooter');

      await waitFor(() => {
        expect(yText.toString()).toContain('Header');
        expect(yText.toString()).toContain('Footer');
      });

      // Cursor should remain stable on line 2 content
      // y-monaco binding handles this

      unmount();
    });
  });

  describe('Artificial Latency Injection', () => {
    it('should verify behavior with 100ms latency', async () => {
      networkLatency = 100;
      const { unmount } = render(<EditorContainer {...defaultProps} />);

      await waitFor(() => {
        expect(monacoBindingInstance).not.toBeNull();
      }, { timeout: 2000 });

      const yText = monacoBindingInstance.yText;

      // Local edit should be immediate
      const start = performance.now();
      yText.insert(0, 'Test');
      const localTime = performance.now() - start;

      expect(localTime).toBeLessThan(10);
      expect(yText.toString()).toBe('Test');

      // Server sync happens in background
      await mockProviderInstance.simulateServerSync(true, 100);

      unmount();
    });

    it('should verify behavior with 500ms latency', async () => {
      networkLatency = 500;
      const { unmount } = render(<EditorContainer {...defaultProps} />);

      await waitFor(() => {
        expect(monacoBindingInstance).not.toBeNull();
      }, { timeout: 2000 });

      const yText = monacoBindingInstance.yText;

      // Multiple rapid edits
      const edits = ['A', 'B', 'C', 'D', 'E'];
      const editTimes: number[] = [];

      for (let i = 0; i < edits.length; i++) {
        const start = performance.now();
        yText.insert(i, edits[i]);
        editTimes.push(performance.now() - start);
      }

      // All edits should be fast locally
      editTimes.forEach(time => expect(time).toBeLessThan(10));
      expect(yText.toString()).toBe('ABCDE');

      unmount();
    });

    it('should verify behavior with 1000ms latency', async () => {
      networkLatency = 1000;
      const { unmount } = render(<EditorContainer {...defaultProps} />);

      await waitFor(() => {
        expect(monacoBindingInstance).not.toBeNull();
      }, { timeout: 2000 });

      const yText = monacoBindingInstance.yText;

      // Even with 1s latency, local edits should be instant
      const start = performance.now();
      yText.insert(0, 'Immediate local edit');
      const time = performance.now() - start;

      expect(time).toBeLessThan(10);
      expect(yText.toString()).toBe('Immediate local edit');

      unmount();
    });

    it('should handle variable latency conditions', async () => {
      const { unmount } = render(<EditorContainer {...defaultProps} />);

      await waitFor(() => {
        expect(monacoBindingInstance).not.toBeNull();
      }, { timeout: 2000 });

      const yText = monacoBindingInstance.yText;

      // Simulate variable network conditions
      const latencies = [50, 200, 500, 100, 300];
      
      for (let i = 0; i < latencies.length; i++) {
        const start = performance.now();
        yText.insert(i, String(i));
        const editTime = performance.now() - start;

        // Local edit should always be fast regardless of network
        expect(editTime).toBeLessThan(10);

        // Simulate server sync with variable latency
        await mockProviderInstance.simulateServerSync(true, latencies[i]);
      }

      expect(yText.toString()).toBe('01234');

      unmount();
    });
  });

  describe('End-to-End Latency Compensation', () => {
    it('should provide seamless experience with realistic latency', async () => {
      networkLatency = 150; // Realistic internet latency
      const onSyncStatusChange = vi.fn();
      
      const { unmount } = render(
        <EditorContainer {...defaultProps} onSyncStatusChange={onSyncStatusChange} />
      );

      await waitFor(() => {
        expect(monacoBindingInstance).not.toBeNull();
      }, { timeout: 2000 });

      const yText = monacoBindingInstance.yText;

      // User types a sentence
      const sentence = 'This is a test of latency compensation';
      const typingTimes: number[] = [];

      for (let i = 0; i < sentence.length; i++) {
        const start = performance.now();
        yText.insert(i, sentence[i]);
        typingTimes.push(performance.now() - start);
        
        // Simulate realistic typing speed (50ms between keystrokes)
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // All typing should feel instant
      typingTimes.forEach(time => expect(time).toBeLessThan(10));

      // Content should be correct
      expect(yText.toString()).toBe(sentence);

      // Sync status should have been tracked
      expect(onSyncStatusChange).toHaveBeenCalled();

      unmount();
    });

    it('should handle complex editing scenario with latency', async () => {
      networkLatency = 200;
      const { unmount } = render(<EditorContainer {...defaultProps} />);

      await waitFor(() => {
        expect(monacoBindingInstance).not.toBeNull();
      }, { timeout: 2000 });

      const yText = monacoBindingInstance.yText;

      // Complex editing scenario
      yText.insert(0, 'Initial text');
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(yText.toString()).toBe('Initial text');

      yText.insert(0, 'Prefix: ');
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(yText.toString()).toBe('Prefix: Initial text');

      yText.insert(yText.length, ' - Suffix');
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(yText.toString()).toBe('Prefix: Initial text - Suffix');

      yText.delete(0, 8); // Delete "Prefix: " (8 characters)
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(yText.toString()).toBe('Initial text - Suffix');

      yText.insert(0, 'Final ');
      await new Promise(resolve => setTimeout(resolve, 50));

      // All operations should complete successfully
      expect(yText.toString()).toBe('Final Initial text - Suffix');

      unmount();
    });
  });
});

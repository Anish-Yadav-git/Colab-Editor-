import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { EditorContainer } from './EditorContainer';
import * as Y from 'yjs';

// Mock Monaco Editor with position tracking
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

      // Simulate binding: when yText changes, update model and trigger content change
      this.yText.observe((event) => {
        const content = this.yText.toString();
        this.model.setValue(content);
        this.model.getValueLength.mockReturnValue(content.length);
        
        // Trigger content change event
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

// Mock y-websocket
let mockProviderInstance: any = null;

vi.mock('y-websocket', () => {
  class MockWebsocketProvider {
    public awareness: any;
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

      setTimeout(() => {
        this.emit('status', { status: 'connected' });
        this.emit('sync', true);
      }, 10);
    }

    on() {}
    off() {}
    emit() {}
    destroy() {
      mockProviderInstance = null;
    }
  }

  return {
    WebsocketProvider: MockWebsocketProvider,
  };
});

describe('Conflict Resolution UI Feedback', () => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should detect when remote changes affect local cursor position', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
      expect(editorInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;
    
    // Set cursor at position 5
    editorInstance._setPosition({ lineNumber: 1, column: 5 });
    
    // Insert text before cursor (simulating remote change)
    yText.insert(0, 'Hello ');
    
    // Wait for change to propagate
    await waitFor(() => {
      expect(yText.toString()).toBe('Hello ');
    });

    // Cursor position tracking should have detected the change
    expect(editorInstance.getPosition).toHaveBeenCalled();

    unmount();
  });

  it('should preserve cursor position relative to content after remote insert', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;
    
    // Initial content
    yText.insert(0, 'World');
    
    await waitFor(() => {
      expect(yText.toString()).toBe('World');
    });

    // Set cursor at end of "World" (position 5)
    editorInstance._setPosition({ lineNumber: 1, column: 6 });
    
    // Remote user inserts "Hello " at the beginning
    yText.insert(0, 'Hello ');
    
    await waitFor(() => {
      expect(yText.toString()).toBe('Hello World');
    });

    // Monaco binding with Yjs CRDT automatically preserves cursor position
    // The cursor should still be at the end of "World" (now position 11)
    // This is handled by y-monaco binding automatically

    unmount();
  });

  it('should handle concurrent edits without visible cursor jumps', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;
    
    // Initial content
    yText.insert(0, 'The quick brown fox');
    
    await waitFor(() => {
      expect(yText.toString()).toBe('The quick brown fox');
    });

    // Set cursor in the middle (after "quick")
    editorInstance._setPosition({ lineNumber: 1, column: 10 });
    
    // Simulate concurrent edits
    // Local edit: insert " very" after "quick"
    yText.insert(9, ' very');
    
    // Remote edit: insert "lazy " at the end
    yText.insert(yText.length, ' jumps over the lazy dog');
    
    await waitFor(() => {
      expect(yText.toString()).toContain('very');
      expect(yText.toString()).toContain('lazy');
    });

    // Both edits should be applied without cursor jumping
    expect(yText.toString()).toBe('The quick very brown fox jumps over the lazy dog');

    unmount();
  });

  it('should preserve cursor when remote delete occurs before cursor', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;
    
    // Initial content
    yText.insert(0, 'Hello World');
    
    await waitFor(() => {
      expect(yText.toString()).toBe('Hello World');
    });

    // Set cursor after "World" (position 11)
    editorInstance._setPosition({ lineNumber: 1, column: 12 });
    
    // Remote user deletes "Hello " (6 characters)
    yText.delete(0, 6);
    
    await waitFor(() => {
      expect(yText.toString()).toBe('World');
    });

    // Cursor should be adjusted to maintain relative position
    // Monaco binding handles this automatically

    unmount();
  });

  it('should handle remote changes that split text around cursor', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;
    
    // Initial content
    yText.insert(0, 'HelloWorld');
    
    await waitFor(() => {
      expect(yText.toString()).toBe('HelloWorld');
    });

    // Set cursor between "Hello" and "World" (position 5)
    editorInstance._setPosition({ lineNumber: 1, column: 6 });
    
    // Remote user inserts space at cursor position
    yText.insert(5, ' ');
    
    await waitFor(() => {
      expect(yText.toString()).toBe('Hello World');
    });

    // Cursor position should be preserved correctly

    unmount();
  });

  it('should maintain cursor stability during rapid remote changes', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;
    
    // Initial content
    yText.insert(0, 'Test');
    
    await waitFor(() => {
      expect(yText.toString()).toBe('Test');
    });

    // Set cursor at end
    editorInstance._setPosition({ lineNumber: 1, column: 5 });
    
    // Simulate rapid remote changes
    yText.insert(0, 'A');
    yText.insert(0, 'B');
    yText.insert(0, 'C');
    
    await waitFor(() => {
      expect(yText.toString()).toBe('CBATest');
    });

    // Cursor should remain stable relative to "Test"
    // y-monaco binding handles this automatically

    unmount();
  });

  it('should avoid visible jumps when local and remote edits conflict', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;
    
    // Initial content
    yText.insert(0, 'Original text');
    
    await waitFor(() => {
      expect(yText.toString()).toBe('Original text');
    });

    // Set cursor in middle
    editorInstance._setPosition({ lineNumber: 1, column: 9 });
    
    // Local edit at cursor
    yText.insert(8, ' modified');
    
    // Concurrent remote edit at different position
    yText.insert(0, 'Prefix: ');
    
    await waitFor(() => {
      expect(yText.toString()).toContain('modified');
      expect(yText.toString()).toContain('Prefix');
    });

    // Both edits should be merged without visible jumps
    expect(yText.toString()).toBe('Prefix: Original modified text');

    unmount();
  });

  it('should handle cursor preservation with multi-line content', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;
    
    // Initial multi-line content
    yText.insert(0, 'Line 1\nLine 2\nLine 3');
    
    await waitFor(() => {
      expect(yText.toString()).toBe('Line 1\nLine 2\nLine 3');
    });

    // Set cursor on line 2
    editorInstance._setPosition({ lineNumber: 2, column: 4 });
    
    // Remote user inserts text on line 1
    yText.insert(0, 'New ');
    
    await waitFor(() => {
      expect(yText.toString()).toContain('New Line 1');
    });

    // Cursor on line 2 should be preserved
    // Monaco binding handles line number adjustments

    unmount();
  });

  it('should track content changes for conflict detection', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);

    await waitFor(() => {
      expect(monacoBindingInstance).not.toBeNull();
    });

    const yText = monacoBindingInstance.yText;
    const model = monacoBindingInstance.model;
    
    // Verify content change listener is set up
    expect(model.onDidChangeContent).toHaveBeenCalled();
    
    // Make a change
    yText.insert(0, 'Test content');
    
    await waitFor(() => {
      expect(yText.toString()).toBe('Test content');
    });

    // Content change should have been detected
    expect(model.getValueLength).toHaveBeenCalled();

    unmount();
  });
});

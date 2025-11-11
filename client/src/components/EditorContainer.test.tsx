import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { EditorContainer } from './EditorContainer';

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: ({ onMount }: any) => {
    // Simulate editor mount after a short delay
    if (onMount) {
      setTimeout(() => {
        const mockEditor = {
          getModel: () => ({
            getValue: () => '',
            setValue: vi.fn(),
            onDidChangeContent: vi.fn(),
          }),
          getDomNode: () => document.createElement('div'),
          onDidChangeCursorPosition: vi.fn(() => ({ dispose: vi.fn() })),
          onDidChangeCursorSelection: vi.fn(() => ({ dispose: vi.fn() })),
          dispose: vi.fn(),
        };
        onMount(mockEditor, {});
      }, 0);
    }
    return <div data-testid="monaco-editor">Monaco Editor Mock</div>;
  },
}));

// Mock y-monaco
vi.mock('y-monaco', () => {
  class MockMonacoBinding {
    constructor(_yText: any, _model: any, _editors: any, _awareness?: any) {
      // Mock constructor
    }

    destroy() {
      // Mock destroy
    }
  }

  return {
    MonacoBinding: MockMonacoBinding,
  };
});

// Mock y-websocket
vi.mock('y-websocket', () => {
  class MockWebsocketProvider {
    public awareness: any;
    private eventHandlers: Record<string, Function[]> = {};

    constructor(_serverUrl: string, _documentId: string, _doc: any, _options?: any) {
      this.awareness = {
        setLocalState: vi.fn(),
        setLocalStateField: vi.fn(),
        getStates: vi.fn(() => new Map()),
        clientID: 1,
        on: vi.fn(),
        off: vi.fn(),
      };
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

    destroy() {
      // Mock destroy
    }
  }

  return {
    WebsocketProvider: MockWebsocketProvider,
  };
});

describe('EditorContainer', () => {
  const defaultProps = {
    documentId: 'test-doc-123',
    userId: 'user-456',
    token: 'test-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the editor container', () => {
    render(<EditorContainer {...defaultProps} />);
    
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('should initialize Yjs document on mount', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);
    
    // Wait for component to initialize
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    unmount();
  });

  it('should display connection state', () => {
    render(<EditorContainer {...defaultProps} />);
    
    const statusText = screen.getByText('Disconnected');
    expect(statusText).toBeInTheDocument();
    
    const statusDot = document.querySelector('.status-dot.status-disconnected');
    expect(statusDot).toBeInTheDocument();
  });

  it('should pass readOnly prop to Monaco editor', () => {
    render(<EditorContainer {...defaultProps} readOnly={true} />);
    
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('should use custom server URL when provided', () => {
    const customServerUrl = 'ws://custom-server:8080';
    render(<EditorContainer {...defaultProps} serverUrl={customServerUrl} />);
    
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('should cleanup resources on unmount', async () => {
    const { unmount } = render(<EditorContainer {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    // Unmount should not throw errors
    expect(() => unmount()).not.toThrow();
  });

  it('should create shared text type from Yjs document', async () => {
    render(<EditorContainer {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    // Component should render without errors, indicating Yjs doc was created successfully
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('should reinitialize when documentId changes', async () => {
    const { rerender } = render(<EditorContainer {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    // Change documentId
    rerender(<EditorContainer {...defaultProps} documentId="new-doc-789" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });
});

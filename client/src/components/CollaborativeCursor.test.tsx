import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CollaborativeCursor, generateUserColor } from './CollaborativeCursor';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

describe('CollaborativeCursor', () => {
  let yjsDoc: Y.Doc;
  let awareness: Awareness;
  let editorElement: HTMLElement;

  beforeEach(() => {
    yjsDoc = new Y.Doc();
    awareness = new Awareness(yjsDoc);
    editorElement = document.createElement('div');
    vi.useFakeTimers();
  });

  afterEach(() => {
    yjsDoc.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('cursor rendering', () => {
    it('should not render when no remote cursors exist', () => {
      const { container } = render(
        <CollaborativeCursor awareness={awareness} editorElement={editorElement} />
      );

      expect(container.querySelector('.collaborative-cursors')).toBeNull();
    });

    it('should render remote cursor with user name', () => {
      // Add a remote user
      const remoteClientId = 123;
      awareness.states.set(remoteClientId, {
        user: {
          id: 'user-123',
          name: 'Alice',
          color: '#ff0000',
        },
        cursor: {
          line: 1,
          column: 5,
        },
        selection: null,
      });

      // Trigger awareness change
      awareness.emit('change', [{ added: [], updated: [remoteClientId], removed: [] }]);

      render(<CollaborativeCursor awareness={awareness} editorElement={editorElement} />);

      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('should not render local client cursor', () => {
      const localClientId = awareness.clientID;

      awareness.setLocalState({
        user: {
          id: 'local-user',
          name: 'Local User',
          color: '#00ff00',
        },
        cursor: {
          line: 1,
          column: 1,
        },
        selection: null,
      });

      const { container } = render(
        <CollaborativeCursor awareness={awareness} editorElement={editorElement} />
      );

      expect(container.querySelector('.collaborative-cursors')).toBeNull();
    });

    it('should render multiple remote cursors', () => {
      awareness.states.set(100, {
        user: {
          id: 'user-1',
          name: 'Alice',
          color: '#ff0000',
        },
        cursor: { line: 1, column: 1 },
        selection: null,
      });

      awareness.states.set(200, {
        user: {
          id: 'user-2',
          name: 'Bob',
          color: '#00ff00',
        },
        cursor: { line: 2, column: 1 },
        selection: null,
      });

      awareness.emit('change', [{ added: [], updated: [100, 200], removed: [] }]);

      render(<CollaborativeCursor awareness={awareness} editorElement={editorElement} />);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('should render selection highlighting', () => {
      awareness.states.set(100, {
        user: {
          id: 'user-1',
          name: 'Alice',
          color: '#ff0000',
        },
        cursor: { line: 1, column: 1 },
        selection: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 10 },
        },
      });

      awareness.emit('change', [{ added: [], updated: [100], removed: [] }]);

      const { container } = render(
        <CollaborativeCursor awareness={awareness} editorElement={editorElement} />
      );

      const selection = container.querySelector('.remote-selection');
      expect(selection).toBeInTheDocument();
    });
  });

  describe('color assignment', () => {
    it('should generate stable colors from user ID', () => {
      const color1 = generateUserColor('user-123');
      const color2 = generateUserColor('user-123');
      const color3 = generateUserColor('user-456');

      // Same user ID should generate same color
      expect(color1).toBe(color2);

      // Different user IDs should generate different colors
      expect(color1).not.toBe(color3);

      // Should be valid HSL color
      expect(color1).toMatch(/^hsl\(\d+, 70%, 50%\)$/);
    });

    it('should use assigned color for cursor', () => {
      const testColor = '#ff5500';
      awareness.states.set(100, {
        user: {
          id: 'user-1',
          name: 'Alice',
          color: testColor,
        },
        cursor: { line: 1, column: 1 },
        selection: null,
      });

      awareness.emit('change', [{ added: [], updated: [100], removed: [] }]);

      const { container } = render(
        <CollaborativeCursor awareness={awareness} editorElement={editorElement} />
      );

      const cursor = container.querySelector('.remote-cursor') as HTMLElement;
      expect(cursor?.style.borderLeftColor).toBe('rgb(255, 85, 0)'); // #ff5500 in RGB
    });
  });

  describe('inactive cursor fading', () => {
    it('should fade cursor after 20 seconds of inactivity', async () => {
      awareness.states.set(100, {
        user: {
          id: 'user-1',
          name: 'Alice',
          color: '#ff0000',
        },
        cursor: { line: 1, column: 1 },
        selection: null,
      });

      awareness.emit('change', [{ added: [], updated: [100], removed: [] }]);

      const { container } = render(
        <CollaborativeCursor awareness={awareness} editorElement={editorElement} />
      );

      // Initially should be fully visible
      let cursor = container.querySelector('.remote-cursor') as HTMLElement;
      expect(cursor?.style.opacity).toBe('1');

      // Advance time by 21 seconds and run timers
      await vi.advanceTimersByTimeAsync(21000);

      cursor = container.querySelector('.remote-cursor') as HTMLElement;
      expect(cursor?.classList.contains('fading')).toBe(true);
    });

    it('should mark cursor as inactive after 30 seconds', async () => {
      awareness.states.set(100, {
        user: {
          id: 'user-1',
          name: 'Alice',
          color: '#ff0000',
        },
        cursor: { line: 1, column: 1 },
        selection: null,
      });

      awareness.emit('change', [{ added: [], updated: [100], removed: [] }]);

      const { container } = render(
        <CollaborativeCursor awareness={awareness} editorElement={editorElement} />
      );

      // Advance time by 31 seconds and run timers
      await vi.advanceTimersByTimeAsync(31000);

      const cursor = container.querySelector('.remote-cursor') as HTMLElement;
      expect(cursor?.classList.contains('inactive')).toBe(true);
      expect(cursor?.style.opacity).toBe('0.3');
    });

    it('should remove cursor on user disconnect', () => {
      awareness.states.set(100, {
        user: {
          id: 'user-1',
          name: 'Alice',
          color: '#ff0000',
        },
        cursor: { line: 1, column: 1 },
        selection: null,
      });

      awareness.emit('change', [{ added: [], updated: [100], removed: [] }]);

      const { container, rerender } = render(
        <CollaborativeCursor awareness={awareness} editorElement={editorElement} />
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();

      // Remove the user
      awareness.states.delete(100);
      awareness.emit('change', [{ added: [], updated: [], removed: [100] }]);

      rerender(<CollaborativeCursor awareness={awareness} editorElement={editorElement} />);

      expect(container.querySelector('.collaborative-cursors')).toBeNull();
    });

    it('should reset inactivity timer when cursor moves', async () => {
      awareness.states.set(100, {
        user: {
          id: 'user-1',
          name: 'Alice',
          color: '#ff0000',
        },
        cursor: { line: 1, column: 1 },
        selection: null,
      });

      awareness.emit('change', [{ added: [], updated: [100], removed: [] }]);

      const { container, rerender } = render(
        <CollaborativeCursor awareness={awareness} editorElement={editorElement} />
      );

      // Advance time by 25 seconds (should be fading)
      await vi.advanceTimersByTimeAsync(25000);

      let cursor = container.querySelector('.remote-cursor') as HTMLElement;
      expect(cursor?.classList.contains('fading')).toBe(true);

      // Update cursor position
      awareness.states.set(100, {
        user: {
          id: 'user-1',
          name: 'Alice',
          color: '#ff0000',
        },
        cursor: { line: 2, column: 5 }, // Changed position
        selection: null,
      });

      awareness.emit('change', [{ added: [], updated: [100], removed: [] }]);

      // Force re-render
      rerender(<CollaborativeCursor awareness={awareness} editorElement={editorElement} />);

      // Should no longer be fading after cursor moved
      cursor = container.querySelector('.remote-cursor') as HTMLElement;
      expect(cursor?.classList.contains('fading')).toBe(false);
      expect(cursor?.style.opacity).toBe('1');
    });
  });

  describe('null awareness handling', () => {
    it('should not render when awareness is null', () => {
      const { container } = render(
        <CollaborativeCursor awareness={null} editorElement={editorElement} />
      );

      expect(container.querySelector('.collaborative-cursors')).toBeNull();
    });

    it('should not render when editorElement is null', () => {
      const { container } = render(
        <CollaborativeCursor awareness={awareness} editorElement={null} />
      );

      expect(container.querySelector('.collaborative-cursors')).toBeNull();
    });
  });
});

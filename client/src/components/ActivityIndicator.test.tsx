import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityIndicator } from './ActivityIndicator';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

describe('ActivityIndicator', () => {
  let yjsDoc: Y.Doc;
  let awareness: Awareness;

  beforeEach(() => {
    yjsDoc = new Y.Doc();
    awareness = new Awareness(yjsDoc);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when awareness is null', () => {
    const { container } = render(<ActivityIndicator awareness={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no users are typing', () => {
    const { container } = render(<ActivityIndicator awareness={awareness} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows typing indicator when user is actively typing', () => {
    const now = Date.now();
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'John Doe',
        color: '#ff0000',
      },
      cursor: { line: 1, column: 1 },
      lastActivity: now,
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<ActivityIndicator awareness={awareness} />);

    expect(screen.getByText('John Doe is typing...')).toBeInTheDocument();
  });

  it('shows typing indicator for multiple users', () => {
    const now = Date.now();
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'John Doe',
        color: '#ff0000',
      },
      cursor: { line: 1, column: 1 },
      lastActivity: now,
    });
    awareness.states.set(101, {
      user: {
        id: 'user2',
        name: 'Jane Smith',
        color: '#00ff00',
      },
      cursor: { line: 2, column: 1 },
      lastActivity: now,
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<ActivityIndicator awareness={awareness} />);

    expect(screen.getByText('John Doe and Jane Smith are typing...')).toBeInTheDocument();
  });

  it('shows typing indicator for three or more users', () => {
    const now = Date.now();
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'John Doe',
        color: '#ff0000',
      },
      cursor: { line: 1, column: 1 },
      lastActivity: now,
    });
    awareness.states.set(101, {
      user: {
        id: 'user2',
        name: 'Jane Smith',
        color: '#00ff00',
      },
      cursor: { line: 2, column: 1 },
      lastActivity: now,
    });
    awareness.states.set(102, {
      user: {
        id: 'user3',
        name: 'Bob Johnson',
        color: '#0000ff',
      },
      cursor: { line: 3, column: 1 },
      lastActivity: now,
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<ActivityIndicator awareness={awareness} />);

    expect(screen.getByText('John Doe and 2 others are typing...')).toBeInTheDocument();
  });

  it('does not show typing indicator for users inactive for more than 3 seconds', () => {
    const now = Date.now();
    const fourSecondsAgo = now - 4000;
    
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'John Doe',
        color: '#ff0000',
      },
      cursor: { line: 1, column: 1 },
      lastActivity: fourSecondsAgo,
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    const { container } = render(<ActivityIndicator awareness={awareness} />);

    expect(container.firstChild).toBeNull();
  });

  it('excludes local client from typing indicator', () => {
    const now = Date.now();
    const localClientId = awareness.clientID;
    
    awareness.states.set(localClientId, {
      user: {
        id: 'local-user',
        name: 'Local User',
        color: '#ff0000',
      },
      cursor: { line: 1, column: 1 },
      lastActivity: now,
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    const { container } = render(<ActivityIndicator awareness={awareness} />);

    expect(container.firstChild).toBeNull();
  });

  it('shows typing dots animation', () => {
    const now = Date.now();
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'John Doe',
        color: '#ff0000',
      },
      cursor: { line: 1, column: 1 },
      lastActivity: now,
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    const { container } = render(<ActivityIndicator awareness={awareness} />);

    const dots = container.querySelectorAll('.dot');
    expect(dots).toHaveLength(3);
  });

  it('tracks activity status correctly', () => {
    const now = Date.now();
    
    // Active user (typing)
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'Active User',
        color: '#ff0000',
      },
      cursor: { line: 1, column: 1 },
      lastActivity: now,
    });
    
    // Idle user (30+ seconds)
    awareness.states.set(101, {
      user: {
        id: 'user2',
        name: 'Idle User',
        color: '#00ff00',
      },
      lastActivity: now - 31000,
    });
    
    // Away user (5+ minutes)
    awareness.states.set(102, {
      user: {
        id: 'user3',
        name: 'Away User',
        color: '#0000ff',
      },
      lastActivity: now - 360000,
    });
    
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<ActivityIndicator awareness={awareness} />);

    // Only the active user should show in typing indicator
    expect(screen.getByText('Active User is typing...')).toBeInTheDocument();
  });

  it('requires cursor to be present for typing status', () => {
    const now = Date.now();
    
    // User with recent activity but no cursor
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'John Doe',
        color: '#ff0000',
      },
      lastActivity: now,
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    const { container } = render(<ActivityIndicator awareness={awareness} />);

    expect(container.firstChild).toBeNull();
  });
});

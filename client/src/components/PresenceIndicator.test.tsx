import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresenceIndicator } from './PresenceIndicator';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

describe('PresenceIndicator', () => {
  let yjsDoc: Y.Doc;
  let awareness: Awareness;

  beforeEach(() => {
    yjsDoc = new Y.Doc();
    awareness = new Awareness(yjsDoc);
  });

  it('renders nothing when awareness is null', () => {
    const { container } = render(<PresenceIndicator awareness={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no remote users are present', () => {
    const { container } = render(<PresenceIndicator awareness={awareness} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays active users with initials when no avatar', () => {
    // Set local state (should be excluded)
    awareness.setLocalStateField('user', {
      id: 'user1',
      name: 'Local User',
      color: '#ff0000',
    });

    // Simulate remote user
    const remoteAwareness = new Awareness(new Y.Doc());
    remoteAwareness.setLocalStateField('user', {
      id: 'user2',
      name: 'John Doe',
      color: '#00ff00',
    });

    // Merge remote state into local awareness
    const remoteStates = remoteAwareness.getStates();
    remoteStates.forEach((state, clientId) => {
      if (clientId !== awareness.clientID) {
        awareness.states.set(clientId, state);
      }
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<PresenceIndicator awareness={awareness} />);

    // Check for initials
    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.getByTitle('John Doe (typing)')).toBeInTheDocument();
  });

  it('displays user count badge', () => {
    // Add multiple remote users
    const remoteClientIds = [100, 101, 102];
    
    remoteClientIds.forEach((clientId, index) => {
      awareness.states.set(clientId, {
        user: {
          id: `user${index}`,
          name: `User ${index}`,
          color: `#${index}${index}${index}${index}${index}${index}`,
        },
      });
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<PresenceIndicator awareness={awareness} />);

    // Check count badge
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('users online')).toBeInTheDocument();
  });

  it('displays singular "user" for single user', () => {
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'Single User',
        color: '#ff0000',
      },
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<PresenceIndicator awareness={awareness} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('user online')).toBeInTheDocument();
  });

  it('displays avatar image when avatarUrl is provided', () => {
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'Avatar User',
        color: '#ff0000',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<PresenceIndicator awareness={awareness} />);

    const avatar = screen.getByAltText('Avatar User');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('generates correct initials for single name', () => {
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'Alice',
        color: '#ff0000',
      },
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<PresenceIndicator awareness={awareness} />);

    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('generates correct initials for multiple names', () => {
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'Alice Bob Charlie',
        color: '#ff0000',
      },
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<PresenceIndicator awareness={awareness} />);

    expect(screen.getByText('AC')).toBeInTheDocument();
  });

  it('updates when users join', () => {
    const { rerender } = render(<PresenceIndicator awareness={awareness} />);

    // Initially no users
    expect(screen.queryByText('users online')).not.toBeInTheDocument();

    // Add a user
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'New User',
        color: '#ff0000',
      },
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    rerender(<PresenceIndicator awareness={awareness} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('user online')).toBeInTheDocument();
  });

  it('updates when users leave', () => {
    // Add two users
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'User 1',
        color: '#ff0000',
      },
    });
    awareness.states.set(101, {
      user: {
        id: 'user2',
        name: 'User 2',
        color: '#00ff00',
      },
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    const { rerender } = render(<PresenceIndicator awareness={awareness} />);

    expect(screen.getByText('2')).toBeInTheDocument();

    // Remove one user
    awareness.states.delete(101);
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    rerender(<PresenceIndicator awareness={awareness} />);

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('applies user color to avatar border', () => {
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'Colored User',
        color: '#ff5733',
      },
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<PresenceIndicator awareness={awareness} />);

    const avatar = screen.getByTitle('Colored User (typing)');
    expect(avatar).toHaveStyle({ borderColor: '#ff5733' });
  });

  it('shows typing status for active users', () => {
    const now = Date.now();
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'Active User',
        color: '#ff0000',
      },
      lastActivity: now,
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<PresenceIndicator awareness={awareness} />);

    const avatar = screen.getByTitle('Active User (typing)');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveClass('presence-avatar--typing');
  });

  it('shows idle status for users inactive for 30+ seconds', () => {
    const now = Date.now();
    const thirtyOneSecondsAgo = now - 31000;
    
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'Idle User',
        color: '#ff0000',
      },
      lastActivity: thirtyOneSecondsAgo,
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<PresenceIndicator awareness={awareness} />);

    const avatar = screen.getByTitle('Idle User (idle)');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveClass('presence-avatar--idle');
  });

  it('shows away status for users inactive for 5+ minutes', () => {
    const now = Date.now();
    const sixMinutesAgo = now - 360000;
    
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'Away User',
        color: '#ff0000',
      },
      lastActivity: sixMinutesAgo,
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<PresenceIndicator awareness={awareness} />);

    const avatar = screen.getByTitle('Away User (away)');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveClass('presence-avatar--away');
  });

  it('fades idle users with reduced opacity', () => {
    const now = Date.now();
    const thirtyOneSecondsAgo = now - 31000;
    
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'Idle User',
        color: '#ff0000',
      },
      lastActivity: thirtyOneSecondsAgo,
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<PresenceIndicator awareness={awareness} />);

    const avatar = screen.getByTitle('Idle User (idle)');
    expect(avatar).toHaveStyle({ opacity: 0.6 });
  });

  it('fades away users with minimal opacity', () => {
    const now = Date.now();
    const sixMinutesAgo = now - 360000;
    
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'Away User',
        color: '#ff0000',
      },
      lastActivity: sixMinutesAgo,
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    render(<PresenceIndicator awareness={awareness} />);

    const avatar = screen.getByTitle('Away User (away)');
    expect(avatar).toHaveStyle({ opacity: 0.3 });
  });

  it('shows typing indicator dot for active users', () => {
    const now = Date.now();
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'Typing User',
        color: '#ff0000',
      },
      lastActivity: now,
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    const { container } = render(<PresenceIndicator awareness={awareness} />);

    const typingIndicator = container.querySelector('.presence-status-indicator--typing');
    expect(typingIndicator).toBeInTheDocument();
  });

  it('does not show typing indicator for idle users', () => {
    const now = Date.now();
    const thirtyOneSecondsAgo = now - 31000;
    
    awareness.states.set(100, {
      user: {
        id: 'user1',
        name: 'Idle User',
        color: '#ff0000',
      },
      lastActivity: thirtyOneSecondsAgo,
    });
    awareness.emit('change', [{ added: [], updated: [], removed: [] }, 'local']);

    const { container } = render(<PresenceIndicator awareness={awareness} />);

    const typingIndicator = container.querySelector('.presence-status-indicator--typing');
    expect(typingIndicator).not.toBeInTheDocument();
  });
});

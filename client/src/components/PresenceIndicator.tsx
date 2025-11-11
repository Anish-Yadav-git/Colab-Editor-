import { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import './PresenceIndicator.css';

export interface UserPresence {
  clientId: number;
  userId: string;
  userName: string;
  color: string;
  avatarUrl?: string;
  lastUpdate: number;
}

export interface PresenceIndicatorProps {
  awareness: Awareness | null;
}

// Generate initials from user name
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  awareness,
}) => {
  const [activeUsers, setActiveUsers] = useState<Map<number, UserPresence>>(new Map());

  useEffect(() => {
    if (!awareness) return;

    const updatePresence = () => {
      const states = awareness.getStates();
      const localClientId = awareness.clientID;
      const now = Date.now();

      setActiveUsers((prevUsers) => {
        const newUsers = new Map<number, UserPresence>();

        states.forEach((state: any, clientId) => {
          // Skip local client
          if (clientId === localClientId) return;

          if (state.user) {
            // Preserve lastUpdate if user hasn't changed
            const prevUser = prevUsers.get(clientId);
            const userChanged = 
              !prevUser ||
              prevUser.userName !== state.user.name ||
              prevUser.color !== state.user.color;

            newUsers.set(clientId, {
              clientId,
              userId: state.user.id,
              userName: state.user.name,
              color: state.user.color,
              avatarUrl: state.user.avatarUrl,
              lastUpdate: userChanged ? now : (prevUser?.lastUpdate || now),
            });
          }
        });

        return newUsers;
      });
    };

    // Listen to awareness changes
    awareness.on('change', updatePresence);

    // Initial update
    updatePresence();

    return () => {
      awareness.off('change', updatePresence);
    };
  }, [awareness]);

  if (!awareness || activeUsers.size === 0) {
    return null;
  }

  const userCount = activeUsers.size;

  return (
    <div className="presence-indicator">
      <div className="presence-avatars">
        {Array.from(activeUsers.values()).map((user) => (
          <div
            key={user.clientId}
            className="presence-avatar"
            style={{ borderColor: user.color }}
            title={user.userName}
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.userName} />
            ) : (
              <div
                className="presence-initials"
                style={{ backgroundColor: user.color }}
              >
                {getInitials(user.userName)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="presence-count">
        <span className="count-badge">{userCount}</span>
        <span className="count-label">
          {userCount === 1 ? 'user' : 'users'} online
        </span>
      </div>
    </div>
  );
};

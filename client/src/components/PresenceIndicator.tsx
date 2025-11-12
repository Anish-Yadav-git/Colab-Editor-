import { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import './PresenceIndicator.css';

export type ActivityStatus = 'typing' | 'idle' | 'away';

export interface UserPresence {
  clientId: number;
  userId: string;
  userName: string;
  color: string;
  avatarUrl?: string;
  lastUpdate: number;
  activityStatus: ActivityStatus;
  lastActivity: number;
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

const IDLE_THRESHOLD = 30000; // 30 seconds
const AWAY_THRESHOLD = 300000; // 5 minutes

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

            const lastActivity = state.lastActivity || now;
            const timeSinceActivity = now - lastActivity;

            // Determine activity status
            let activityStatus: ActivityStatus = 'typing';
            if (timeSinceActivity > AWAY_THRESHOLD) {
              activityStatus = 'away';
            } else if (timeSinceActivity > IDLE_THRESHOLD) {
              activityStatus = 'idle';
            }

            newUsers.set(clientId, {
              clientId,
              userId: state.user.id,
              userName: state.user.name,
              color: state.user.color,
              avatarUrl: state.user.avatarUrl,
              lastUpdate: userChanged ? now : (prevUser?.lastUpdate || now),
              activityStatus,
              lastActivity,
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

    // Update activity status every second
    const activityCheckInterval = setInterval(updatePresence, 1000);

    return () => {
      awareness.off('change', updatePresence);
      clearInterval(activityCheckInterval);
    };
  }, [awareness]);

  if (!awareness || activeUsers.size === 0) {
    return null;
  }

  const userCount = activeUsers.size;

  return (
    <div className="presence-indicator" role="complementary" aria-label="Active users">
      <div className="presence-avatars" role="list" aria-label="User avatars">
        {Array.from(activeUsers.values()).map((user) => {
          // Calculate opacity based on activity status
          const opacity = user.activityStatus === 'away' ? 0.3 : 
                         user.activityStatus === 'idle' ? 0.6 : 1;
          
          return (
            <div
              key={user.clientId}
              className={`presence-avatar presence-avatar--${user.activityStatus}`}
              style={{ borderColor: user.color, opacity }}
              title={`${user.userName} (${user.activityStatus})`}
              role="listitem"
              aria-label={`${user.userName} is ${user.activityStatus}`}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={`${user.userName}'s avatar`} />
              ) : (
                <div
                  className="presence-initials"
                  style={{ backgroundColor: user.color }}
                  aria-hidden="true"
                >
                  {getInitials(user.userName)}
                </div>
              )}
              {user.activityStatus === 'typing' && (
                <div 
                  className="presence-status-indicator presence-status-indicator--typing"
                  aria-label="typing"
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="presence-count" role="status" aria-live="polite">
        <span className="count-badge" aria-hidden="true">{userCount}</span>
        <span className="count-label">
          {userCount === 1 ? 'user' : 'users'} online
        </span>
      </div>
    </div>
  );
};

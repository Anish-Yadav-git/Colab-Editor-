import { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import './ActivityIndicator.css';

export type ActivityStatus = 'typing' | 'idle' | 'away';

export interface UserActivity {
  userId: string;
  userName: string;
  status: ActivityStatus;
  lastActivity: number;
}

export interface ActivityIndicatorProps {
  awareness: Awareness | null;
}

const IDLE_THRESHOLD = 30000; // 30 seconds
const AWAY_THRESHOLD = 300000; // 5 minutes

export const ActivityIndicator: React.FC<ActivityIndicatorProps> = ({
  awareness,
}) => {
  const [activeUsers, setActiveUsers] = useState<Map<number, UserActivity>>(new Map());
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!awareness) return;

    const updateActivity = () => {
      const states = awareness.getStates();
      const localClientId = awareness.clientID;
      const now = Date.now();

      const newActiveUsers = new Map<number, UserActivity>();
      const newTypingUsers: string[] = [];

      states.forEach((state: any, clientId) => {
        // Skip local client
        if (clientId === localClientId) return;

        if (state.user) {
          const lastActivity = state.lastActivity || now;
          const timeSinceActivity = now - lastActivity;

          let status: ActivityStatus = 'typing';
          if (timeSinceActivity > AWAY_THRESHOLD) {
            status = 'away';
          } else if (timeSinceActivity > IDLE_THRESHOLD) {
            status = 'idle';
          }

          // Check if user is actively typing (cursor or selection changed recently)
          const isTyping = state.cursor && timeSinceActivity < 3000; // 3 seconds

          if (isTyping) {
            newTypingUsers.push(state.user.name);
          }

          newActiveUsers.set(clientId, {
            userId: state.user.id,
            userName: state.user.name,
            status,
            lastActivity,
          });
        }
      });

      setActiveUsers(newActiveUsers);
      setTypingUsers(newTypingUsers);
    };

    // Listen to awareness changes
    awareness.on('change', updateActivity);

    // Initial update
    updateActivity();

    // Check activity status every second
    const activityCheckInterval = setInterval(updateActivity, 1000);

    return () => {
      awareness.off('change', updateActivity);
      clearInterval(activityCheckInterval);
    };
  }, [awareness]);

  if (!awareness || typingUsers.length === 0) {
    return null;
  }

  const formatTypingMessage = (): string => {
    if (typingUsers.length === 0) return '';
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;
  };

  return (
    <div className="activity-indicator">
      <div className="typing-indicator">
        <span className="typing-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </span>
        <span className="typing-text">{formatTypingMessage()}</span>
      </div>
    </div>
  );
};

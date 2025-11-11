import { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import './CollaborativeCursor.css';

export interface CursorPosition {
  line: number;
  column: number;
}

export interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

export interface AwarenessState {
  user: {
    id: string;
    name: string;
    color: string;
  };
  cursor: CursorPosition | null;
  selection: SelectionRange | null;
}

export interface RemoteCursor {
  clientId: number;
  userId: string;
  userName: string;
  color: string;
  cursor: CursorPosition | null;
  selection: SelectionRange | null;
  lastUpdate: number;
}

export interface CollaborativeCursorProps {
  awareness: Awareness | null;
  editorElement: HTMLElement | null;
}

// Hash function to generate stable color from user ID
const hashStringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate HSL color with good saturation and lightness
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
};

export const CollaborativeCursor: React.FC<CollaborativeCursorProps> = ({
  awareness,
  editorElement,
}) => {
  const [remoteCursors, setRemoteCursors] = useState<Map<number, RemoteCursor>>(new Map());
  const [, setTick] = useState(0); // Force re-render for opacity updates

  useEffect(() => {
    if (!awareness) return;

    const updateCursors = () => {
      const states = awareness.getStates();
      const localClientId = awareness.clientID;
      const now = Date.now();

      setRemoteCursors((prevCursors) => {
        const newCursors = new Map<number, RemoteCursor>();

        states.forEach((state, clientId) => {
          // Skip local client
          if (clientId === localClientId) return;

          const awarenessState = state as AwarenessState;
          if (awarenessState.user) {
            // Preserve lastUpdate if cursor hasn't changed
            const prevCursor = prevCursors.get(clientId);
            const cursorChanged = 
              !prevCursor ||
              JSON.stringify(prevCursor.cursor) !== JSON.stringify(awarenessState.cursor) ||
              JSON.stringify(prevCursor.selection) !== JSON.stringify(awarenessState.selection);

            newCursors.set(clientId, {
              clientId,
              userId: awarenessState.user.id,
              userName: awarenessState.user.name,
              color: awarenessState.user.color,
              cursor: awarenessState.cursor,
              selection: awarenessState.selection,
              lastUpdate: cursorChanged ? now : (prevCursor?.lastUpdate || now),
            });
          }
        });

        return newCursors;
      });
    };

    // Listen to awareness changes
    awareness.on('change', updateCursors);

    // Initial update
    updateCursors();

    // Check for inactive cursors every second
    const inactivityCheckInterval = setInterval(() => {
      setTick((t) => t + 1); // Force re-render to update opacity
    }, 1000);

    return () => {
      awareness.off('change', updateCursors);
      clearInterval(inactivityCheckInterval);
    };
  }, [awareness]);

  if (!editorElement || remoteCursors.size === 0) {
    return null;
  }

  const now = Date.now();

  return (
    <div className="collaborative-cursors">
      {Array.from(remoteCursors.values()).map((cursor) => {
        const timeSinceUpdate = now - cursor.lastUpdate;
        const isInactive = timeSinceUpdate > 30000; // 30 seconds
        const isFading = timeSinceUpdate > 20000 && timeSinceUpdate <= 30000; // 20-30 seconds
        
        // Calculate opacity based on inactivity
        let opacity = 1;
        if (isInactive) {
          opacity = 0.3;
        } else if (isFading) {
          // Gradually fade from 1 to 0.5 between 20-30 seconds
          opacity = 1 - ((timeSinceUpdate - 20000) / 10000) * 0.5;
        }

        return (
          <div key={cursor.clientId}>
            {cursor.cursor && (
              <div
                className={`remote-cursor ${isInactive ? 'inactive' : ''} ${isFading ? 'fading' : ''}`}
                style={{
                  borderLeftColor: cursor.color,
                  opacity,
                }}
                data-user-id={cursor.userId}
              >
                <div
                  className="cursor-label"
                  style={{
                    backgroundColor: cursor.color,
                    opacity,
                  }}
                >
                  {cursor.userName}
                </div>
              </div>
            )}
            {cursor.selection && (
              <div
                className="remote-selection"
                style={{
                  backgroundColor: `${cursor.color}33`, // 20% opacity
                  opacity,
                }}
                data-user-id={cursor.userId}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// Export utility function for use in EditorContainer
export const generateUserColor = hashStringToColor;
